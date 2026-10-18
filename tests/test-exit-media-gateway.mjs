import {test} from "node:test";
import assert from "node:assert/strict";
import {handleMedia} from "../migration/cloudflare/media-gateway.mjs";
function setup({publicApproved=false,committeeRow=null,range=false}={}){
 const calls=[];
 const env={
  MEDIA_ACL:{prepare(sql){return {bind(...args){return {async first(){calls.push({sql,args});return sql.includes("committee_media")?committeeRow:(publicApproved?{approved:1,revoked_at:null}:null)}}}}}},
  MEDIA_BUCKET:{async get(key,opts){calls.push({key,opts});return {body:"ABC",size:3,httpEtag:'"hash"',range:range?{offset:0,length:2}:undefined,writeHttpMetadata(headers){headers.set("content-type","audio/mpeg")}}}}
 };
 return {env,calls};
}
test("denies unknown media",async()=>{const {env,calls}=setup();const r=await handleMedia(new Request("https://test/media/media/a.mp3"),env);assert.equal(r.status,404);assert.equal(calls.filter(x=>x.key).length,0)});
test("denies direct committee path even if public allowlist",async()=>{const {env}=setup({publicApproved:true});const r=await handleMedia(new Request("https://test/media/committee/private.pdf"),env);assert.equal(r.status,404)});
test("allows explicitly approved media",async()=>{const {env}=setup({publicApproved:true});const r=await handleMedia(new Request("https://test/media/media/a.mp3"),env);assert.equal(r.status,200);assert.equal(await r.text(),"ABC")});
test("serves partial content with range",async()=>{const {env,calls}=setup({publicApproved:true,range:true});const r=await handleMedia(new Request("https://test/media/media/a.mp3",{headers:{Range:"bytes=0-1"}}),env);assert.equal(r.status,206);assert.equal(r.headers.get("content-range"),"bytes 0-1/3");assert.ok(calls.some(x=>x.opts?.range))});
test("committee slug resolves private key",async()=>{const {env,calls}=setup({committeeRow:{storage_path:"committee/secret.pdf"}});const r=await handleMedia(new Request("https://test/letter/approved-slug"),env);assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"no-store");assert.ok(calls.some(x=>x.key==="committee/secret.pdf"))});
test("revoked committee returns 404",async()=>{const {env}=setup();const r=await handleMedia(new Request("https://test/letter/revoked"),env);assert.equal(r.status,404)});
test("rejects traversal",async()=>{const {env}=setup({publicApproved:true});const r=await handleMedia(new Request("https://test/media/media/%2e%2e%2fsecret"),env);assert.equal(r.status,404)});
test("rejects malformed range",async()=>{const {env}=setup({publicApproved:true});const r=await handleMedia(new Request("https://test/media/media/a.mp3",{headers:{range:"bytes=0-1,3-4"}}),env);assert.equal(r.status,416)});
test("HEAD returns no body",async()=>{const {env}=setup({publicApproved:true});const r=await handleMedia(new Request("https://test/media/media/a.mp3",{method:"HEAD"}),env);assert.equal(r.status,200);assert.equal(await r.text(),"")});

test("infers image MIME for legacy R2 objects without metadata",async()=>{
 const {env}=setup({publicApproved:true});
 env.MEDIA_BUCKET.get=async()=>({body:"IMG",size:3,httpEtag:'"hash"'});
 const r=await handleMedia(new Request("https://test/media/media/old-photo.jpg"),env);
 assert.equal(r.status,200);
 assert.equal(r.headers.get("content-type"),"image/jpeg");
});
test("infers PDF MIME for legacy R2 objects without metadata",async()=>{
 const {env}=setup({publicApproved:true});
 env.MEDIA_BUCKET.get=async()=>({body:"PDF",size:3,httpEtag:'"hash"'});
 const r=await handleMedia(new Request("https://test/media/media/document.pdf"),env);
 assert.equal(r.headers.get("content-type"),"application/pdf");
});

test("serves public D1 content without an extra ACL row",async()=>{
 const {env}=setup();
 env.DB={prepare(sql){assert.match(sql,/audience='all'/);return {bind(...args){assert.deepEqual(args,['media/a.jpg','media/a.jpg']);return {async first(){return {1:1}}}}}}};
 const r=await handleMedia(new Request("https://test/media/media/a.jpg"),env);
 assert.equal(r.status,200);
});
test("does not serve audience-restricted content to anonymous visitors",async()=>{
 const {env}=setup();
 env.DB={prepare(){return {bind(){return {async first(){return null}}}}}};
 const r=await handleMedia(new Request("https://test/media/media/private.jpg"),env);
 assert.equal(r.status,404);
});

test("explicit ACL revocation overrides public D1 content and participant access",async()=>{
 const {env,calls}=setup();
 env.MEDIA_ACL={prepare(){return {bind(){return {async first(){return {approved:1,revoked_at:'2026-10-18'}}}}}}};
 env.DB={prepare(){throw Error('revoked key must not query D1')}};
 const r=await handleMedia(new Request('https://test/media/media/revoked.jpg'),env);
 assert.equal(r.status,404);assert.equal(calls.filter(x=>x.key).length,0);
});
test("explicit unapproved ACL row blocks D1 fallback",async()=>{
 const {env}=setup();
 env.MEDIA_ACL={prepare(){return {bind(){return {async first(){return {approved:0,revoked_at:null}}}}}}};
 env.DB={prepare(){throw Error('unapproved key must not query D1')}};
 const r=await handleMedia(new Request('https://test/media/media/denied.jpg'),env);
 assert.equal(r.status,404);
});
