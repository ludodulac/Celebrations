import {test} from "node:test";
import assert from "node:assert/strict";
import worker from "../migration/cloudflare/staging-worker.mjs";
import {handleSafeSave} from "../migration/cloudflare/safe-save-api.mjs";
import {sha256} from "../migration/cloudflare/auth-api.mjs";
function env(){
 const statements=[],calls=[];
 const DB={prepare(sql){return {bind(...args){statements.push({sql,args});return {async first(){if(sql.includes("FROM celebrations_admin_sessions"))return {email:"admin@test.invalid",expires_at:"2999-01-01T00:00:00Z"};return null},async run(){return {meta:{changes:1}}}}},async all(){return {results:[]}}}},async batch(xs){calls.push(xs.length);return xs.map(()=>({success:true}))}};
 return {DB,statements,calls,MEDIA_BUCKET:{},MEDIA_ACL:DB};
}
function req(path,body,token="t".repeat(64)){return new Request("https://preview.invalid"+path,{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+token},body:JSON.stringify(body)})}
// Reuse a complete, valid snapshot: the safe-save API requires all four
// collections and explicit day/event link arrays to prevent accidental loss.
const completeSnapshot=()=>({action:"safe_merge",groups:[],contents:[{id:"x",name:"Test",type:"PDF"}],celebrations:[{id:1,archangel:"Michael",days:[{key:"day1",label:"Jour 1",contentIds:["x"],links:[]}]}],events:[{id:"evt",celebrationId:1,dayKey:"day1",title:"Event",contentIds:["x"],links:[]}]});
test("staging Worker routes admin save to transactional D1 batch",async()=>{
 const e=env(),r=await worker.fetch(req("/api/safe-save",completeSnapshot()),e);
 assert.equal(r.status,200);assert.equal((await r.json()).ok,true);assert.equal(e.calls.length,1);assert.ok(e.calls[0]>=5);assert.ok(e.statements.some(x=>x.sql.includes("celebrations_step_contents")));
});
test("atomic save rejects without admin token and writes nothing",async()=>{
 const e=env(),r=await worker.fetch(new Request("https://preview.invalid/api/safe-save",{method:"POST",body:JSON.stringify({action:"safe_merge",contents:[{id:"x"}]})}),e);
 assert.equal(r.status,401);assert.equal(e.calls.length,0);
});
test("atomic batch failure returns non-success",async()=>{
 const e=env();e.DB.batch=async()=>{throw new Error("constraint")};
 const r=await handleSafeSave(req("/api/safe-save",completeSnapshot()),e);
 assert.equal(r.status,409);assert.equal((await r.json()).ok,false);
});
test("unknown staging route does not fall through to Supabase",async()=>{
 const e=env(),r=await worker.fetch(new Request("https://preview.invalid/api/unknown"),e);
 assert.equal(r.status,404);
});
