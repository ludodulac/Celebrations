import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
import {DatabaseSync} from "node:sqlite";

const source=await readFile(new URL("../migration/cloudflare/participants-admin-api.mjs",import.meta.url),"utf8");
const moduleText=source.replace('import {authorize} from "./auth-api.mjs";',
 'const authorize=async(request)=>request.headers.get("authorization")==="Bearer valid-staging-admin";')
 .replace("export async function handleParticipantsAdmin","async function handleParticipantsAdmin");
const ctx={Request,Response,Date,Number,Set,String,Array,Object};
vm.runInNewContext(moduleText+"\nthis.handler=handleParticipantsAdmin;",ctx);
const schema=await readFile(new URL("../migration/cloudflare/celebrations-schema.sql",import.meta.url),"utf8");
function fixture(){
 const db=new DatabaseSync(":memory:");db.exec(schema);
 let batches=0;
 const statement=(sql,args=[])=>({
  bind(...values){return statement(sql,values)},
  async all(){return {results:db.prepare(sql).all(...args)}},
  async first(){return db.prepare(sql).get(...args)||null},
  async run(){return {meta:{changes:db.prepare(sql).run(...args).changes}}},
  sql,args
 });
 const env={DB:{prepare:sql=>statement(sql),async batch(stmts){
  batches++;
  db.exec("BEGIN");
  try{for(const s of stmts)db.prepare(s.sql).run(...s.args);db.exec("COMMIT")}
  catch(e){db.exec("ROLLBACK");throw e}
 }}};
 return {db,env,getBatches:()=>batches};
}
async function call(env,action,body={},authorized=true){
 const response=await ctx.handler(new Request("https://staging.invalid/api/participants-admin",{
  method:"POST",headers:{"content-type":"application/json",...(authorized?{authorization:"Bearer valid-staging-admin"}:{})},
  body:JSON.stringify({action,...body})
 }),env);
 return {status:response.status,body:await response.json()};
}

test("anonymous access to all participant admin actions is rejected",async()=>{
 const {db,env,getBatches}=fixture();
 try{
  for(const action of ["admin_list_participants","admin_list","admin_add_participant","admin_set","admin_remove_participant"])
   assert.equal((await call(env,action,{email:"a@example.test",audience:"angel"},false)).status,401);
  assert.equal(db.prepare("SELECT count(*) AS n FROM celebrations_participants").get().n,0);
  assert.equal(getBatches(),0);
 }finally{db.close()}
});
test("admin can authorize, assign, list, and revoke exactly one participant with its session",async()=>{
 const {db,env,getBatches}=fixture();
 try{
  const one="member@staging.invalid",other="other@staging.invalid";
  assert.equal((await call(env,"admin_add_participant",{email:one.toUpperCase()})).status,200);
  assert.equal((await call(env,"admin_add_participant",{email:other})).status,200);
  assert.equal((await call(env,"admin_add_participant",{email:one})).status,200);
  assert.equal(db.prepare("SELECT count(*) AS n FROM celebrations_participants").get().n,2);
  assert.equal((await call(env,"admin_set",{email:one,audience:"angel"})).status,200);
  db.prepare("UPDATE celebrations_participants SET password_hash=?,password_salt=? WHERE email=?")
    .run("dont-expose-hashes","test-salt",one);
  db.prepare("INSERT INTO celebrations_participant_sessions(token_hash,participant_email,expires_at) VALUES(?,?,?)")
    .run("synthetic-session-hash",one,"2999-01-01T00:00:00Z");
  const access=await call(env,"admin_list_participants");
  assert.equal(access.status,200);
  assert.equal(access.body.participants.length,2);
  assert.ok(Object.keys(access.body.participants[0]).every(k=>["email","registered_at"].includes(k)));
  assert.ok(!JSON.stringify(access.body).includes("dont-expose-hashes"));
  const aud=await call(env,"admin_list");
  assert.equal(aud.status,200);
  assert.equal(aud.body.participants.find(x=>x.email===one).audience,"angel");
  assert.equal((await call(env,"admin_remove_participant",{email:one})).status,200);
  assert.equal(getBatches(),1);
  assert.equal(db.prepare("SELECT count(*) AS n FROM celebrations_participant_sessions").get().n,0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM celebrations_participants WHERE email=?").get(other).n,1);
 }finally{db.close()}
});
test("invalid email, invalid audience and absent member refuse changes",async()=>{
 const {db,env,getBatches}=fixture();
 try{
  assert.equal((await call(env,"admin_add_participant",{email:"not-an-email"})).status,400);
  assert.equal((await call(env,"admin_set",{email:"member@staging.invalid",audience:"all"})).status,400);
  assert.equal((await call(env,"admin_remove_participant",{email:"absent@staging.invalid"})).status,404);
  assert.equal((await call(env,"admin_set",{email:"absent@staging.invalid",audience:"angel"})).status,404);
  assert.equal(getBatches(),0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM celebrations_participants").get().n,0);
 }finally{db.close()}
});
