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
