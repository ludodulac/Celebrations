import {test} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {handleStats} from "../migration/cloudflare/stats-api.mjs";
const schema=await readFile(new URL("../migration/cloudflare/celebrations-schema.sql",import.meta.url),"utf8");
function fixture(){
 const db=new DatabaseSync(":memory:");db.exec(schema);
 const token="a".repeat(64);
 const digest=createHash("sha256").update(token).digest("hex");
 db.prepare("INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES (?,?,?)").run(digest,"admin@isolated.invalid","2999-01-01T00:00:00Z");
 function prepare(sql,args=[]){return {
  bind(...values){return prepare(sql,values)},
  async first(){return db.prepare(sql).get(...args)||null},
  async all(){return {results:db.prepare(sql).all(...args)}},
  async run(){return {meta:{changes:db.prepare(sql).run(...args).changes}}}
 }}
 let scans=0;
 const trackedPrepare=sql=>{if(sql.includes("FROM celebrations_clicks")&&sql.trim().startsWith("SELECT"))scans++;return prepare(sql)};
 const env={DB:{prepare:trackedPrepare}};
 const post=async(body,{origin="https://staging.invalid",authorization="",ctype="application/json"}={})=>{
  const headers={"content-type":ctype};
  if(origin)headers.origin=origin;
  if(authorization)headers.authorization=authorization;
  const response=await handleStats(new Request("https://staging.invalid/api/stats",{
   method:"POST",headers,body:JSON.stringify(body)
  }),env);
  return {status:response.status,...await response.json()};
 };
 return {db,post,token,scans:()=>scans,close:()=>db.close()};
}
test("same origin page views and clicks land in D1 and admin sums real events",async()=>{
 const f=fixture();try{
  const basic={action:"track",visitor_id:"anonymous-test-visitor-123",celebration_id:123,
   target_kind:"page-view",page_path:"/index.html",target_label:"Accueil"};
  assert.equal((await f.post(basic)).status,200);
  assert.equal((await f.post({...basic,visitor_id:"anonymous-other-visitor-456"})).status,200);
  assert.equal((await f.post({...basic,target_kind:"pdf",target_label:"Document"})).status,200);
  const result=await f.post({action:"summary"},{authorization:"Bearer "+f.token});
  assert.equal(result.status,200);
  assert.equal(result.visits.visits,2);
  assert.equal(result.visits.visitors,2);
  assert.equal(result.clicks[0].click_count,1);
  assert.equal(result.visits.pages[0].cnt,2);
 }finally{f.close()}
});
test("cross-origin writes denied, unauthorized summaries denied, malformed events denied",async()=>{
 const f=fixture();try{
  const event={action:"track",visitor_id:"anonymous-test-visitor-123",target_kind:"page-view"};
  assert.equal((await f.post(event,{origin:"https://outside.invalid"})).status,403);
  assert.equal((await f.post(event,{origin:null})).status,403);
  assert.equal((await f.post({action:"summary"})).status,401);
  assert.equal((await f.post({...event,visitor_id:"short"})).status,400);
  assert.equal((await f.post({...event,target_kind:"admin"})).status,400);
  assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM celebrations_clicks").get().n,0);
 }finally{f.close()}
});

test("authenticated summary uses one D1 scan batch for repeated requests and never leaks to guests",async()=>{
 const f=fixture();
 try{
  f.db.prepare("INSERT INTO celebrations_clicks(target_kind,visitor_id,page_path) VALUES(?,?,?)")
    .run("page-view","visitor-one","/initial");
  const first=await f.post({action:"summary"},{authorization:"Bearer "+f.token});
  assert.equal(first.status,200);
  assert.equal(first.visits.visits,1);
  assert.equal(f.scans(),3,"Initial aggregation must issue three SQL scans");
  const guest=await f.post({action:"summary"});
  assert.equal(guest.status,401,"Anonymous user cannot access cached statistics");
  const second=await f.post({action:"summary"},{authorization:"Bearer "+f.token});
  assert.equal(second.status,200);
  assert.equal(second.visits.visits,1);
  assert.equal(f.scans(),3,"Cached repeat must issue ZERO extra analytics scans");
  assert.equal(second.max_age_seconds,900);
 }finally{f.close()}
});
