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
