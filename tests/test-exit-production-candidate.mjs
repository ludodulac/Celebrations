import assert from "node:assert/strict";
import {test} from "node:test";
import worker from "../migration/cloudflare/production-worker.mjs";

test("production candidate serves public root with NO forced staging query",async()=>{
 const events=[];
 const env={ASSETS:{async fetch(req){events.push(new URL(req.url).pathname);return new Response("<html>synthetic candidate</html>",{status:200,headers:{"content-type":"text/html"}})}}};
 const response=await worker.fetch(new Request("https://candidate.invalid/"),env);
 assert.equal(response.status,200);
 assert.equal(response.headers.get("location"),null);
 assert.deepEqual(events,["/"]);
});
test("production candidate preserves denied unknown API routes without database",async()=>{
 const response=await worker.fetch(new Request("https://candidate.invalid/api/unlisted"),{});
 assert.equal(response.status,404);
});

test("fully editable isolated QA wrapper prevents public indexing and retains legacy PDF paths",async()=>{
 const qa=(await import("../migration/cloudflare/editable-qa-worker.mjs")).default;
 const root="https://celebrations-exit-editable-qa.rondes.workers.dev";
 const env={ASSETS:{async fetch(){return new Response("<html>QA only</html>",{
   status:200,headers:{"content-type":"text/html"}})}}};
 const response=await qa.fetch(new Request(root+"/"),env);
 assert.equal(response.status,200);
 assert.match(response.headers.get("x-robots-tag"),/noindex/);
 assert.equal(response.headers.get("cache-control"),"no-store");
 const robots=await qa.fetch(new Request(root+"/robots.txt"),env);
 assert.equal(robots.status,200);
 assert.match(await robots.text(),/Disallow: \/?/);
 const help=await qa.fetch(new Request(root+"/communique"),env);
 assert.equal(help.status,302);
 assert.match(help.headers.get("location")||"",/^https:\/\/drive.google.com\//);
 const badInvite=await qa.fetch(new Request(root+"/?lettre=definitely-not-an-invite"),{
   ...env,MEDIA_BUCKET:{},MEDIA_ACL:{prepare(){return {bind(){return {first:async()=>null}}}}}
 });
 assert.equal(badInvite.status,404);
});

test("published Préparation programme route remains navigable inside site",async()=>{
 const touched=[];
 const env={ASSETS:{async fetch(req){
  touched.push(new URL(req.url).pathname);
  return new Response("<html>Programme Préparation</html>",{
   status:200,headers:{"content-type":"text/html"}
  });
 }}};
 for(const route of ["/preparation","/preparation/"]){
  const r=await worker.fetch(new Request("https://candidate.invalid"+route),env);
  assert.equal(r.status,200);
  assert.equal(r.headers.get("location"),null);
  assert.match(await r.text(),/Préparation/);
 }
 assert.deepEqual(touched,["/preparation","/preparation/"]);
});
