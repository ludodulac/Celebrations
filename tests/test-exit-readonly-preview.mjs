import assert from "node:assert/strict";
import {test} from "node:test";
import preview from "../migration/cloudflare/readonly-preview-worker.mjs";
const origin="https://preview.invalid";
test("read-only preview refuses any state changes including analytics, auth and admin",async()=>{
 const env={DB:{prepare(){throw Error("Forbidden D1 read in POST")}},MEDIA_BUCKET:{put(){throw Error("Forbidden R2 write")}}};
 for(const route of ["/api/auth","/api/admin","/api/stats","/api/safe-save","/api/media-admin","/api/participants-admin","/api/footer-admin","/api/other"]){
  const r=await preview.fetch(new Request(origin+route,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}),env);
  assert.equal(r.status,405,route);
  assert.equal(r.headers.get("x-robots-tag"),"noindex, nofollow, noarchive");
 }
 const unknown=await preview.fetch(new Request(origin+"/api/participants-admin"),env);
 assert.equal(unknown.status,404);
});
test("preview page never redirects to the live domain and always disallows indexing",async()=>{
 let loaded=0;
 const env={ASSETS:{async fetch(req){
  loaded++;return new Response("<html><title>Preview seulement</title></html>",{
   headers:{"content-type":"text/html; charset=utf-8"}});
 }}};
 const r=await preview.fetch(new Request(origin+"/"),env);
 assert.equal(r.status,200);assert.equal(loaded,1);
 assert.equal(r.headers.get("x-robots-tag"),"noindex, nofollow, noarchive");
 assert.equal(r.headers.get("cache-control"),"no-store");
 assert.equal(r.headers.get("location"),null);
 assert.match(await r.text(),/Preview seulement/);
 const robots=await preview.fetch(new Request(origin+"/robots.txt"),env);
 assert.equal(robots.status,200);assert.match(await robots.text(),/Disallow: \/?/);
 const unknown=await preview.fetch(new Request(origin+"/api/unknown"),env);
 assert.equal(unknown.status,404);
});
test("public data endpoint cannot access private tables",async()=>{
 const env={DB:{prepare(){throw Error("Should not query a private table")}}};
 const response=await preview.fetch(new Request(origin+"/api/public-data?table=celebrations_participants"),env);
 assert.equal(response.status,404);
 assert.deepEqual(await response.json(),{error:"Not found"});
});


test("all mailed ?lettre permalinks return the same PDF without changing URL",async()=>{
 const key="committee/synthetic.pdf",slug="private-synthetic-invite-1234";
 const data=new Uint8Array([37,80,68,70,45,49,46,55,10,37,37,69,79,70]);
 const env={
  MEDIA_ACL:{
   prepare(sql){
    assert.match(sql,/FROM committee_media/);
    return {bind(found){return {async first(){
     return found===slug?{storage_path:key}:null;
    }}}};
   }
  },
  MEDIA_BUCKET:{
   async get(found){
    assert.equal(found,key);
    return {size:data.length,httpEtag:'"test"',body:data,writeHttpMetadata(headers){
      headers.set("content-type","application/pdf");
    }};
   }
  }
 };
 const url=origin+"/?lettre="+encodeURIComponent(slug);
 const response=await preview.fetch(new Request(url),env);
 assert.equal(response.status,200);
 assert.equal(response.headers.get("location"),null);
 assert.match(response.headers.get("content-type")||"",/application\/pdf/);
 assert.deepEqual(new Uint8Array(await response.arrayBuffer()),data);
 const invalid=await preview.fetch(new Request(origin+"/?lettre=unknown-invalid-slug"),env);
 assert.equal(invalid.status,404);
 const blocked=await preview.fetch(new Request(origin+"/?lettre="+encodeURIComponent(slug),{method:"POST"}),env);
 assert.equal(blocked.status,405);
});
test("existing mailed document aliases preserve original external destinations",async()=>{
 for(const name of ["communique","rituel-court","rituel-long","preparation"]){
  const r=await preview.fetch(new Request(origin+"/"+name),{});
  assert.equal(r.status,302);
  assert.match(r.headers.get("location")||"",/^https:\/\/drive.google.com\/file\/d\//);
  assert.equal(r.headers.get("x-robots-tag"),"noindex, nofollow, noarchive");
 }
});
