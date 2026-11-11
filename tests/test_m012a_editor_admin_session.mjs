// Real production and staging Worker entrypoints, actual SQL constraints in local SQLite.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import production from '../migration/cloudflare/production-worker.mjs';
import staging from '../migration/cloudflare/staging-worker.mjs';
import {
 HOST,ORIGIN,PATH,DIRECTORY,flags,request,schema,schemaFiles,SECRET,SALT,
 signedEditorCookie,exerciseLifecycle,exerciseBadCredentials,exerciseReplayRace
} from './fixtures/m012a-editor-session-http.mjs';
function fixture(worker){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('PRAGMA foreign_keys=ON');
 for(const path of schemaFiles)sqlite.exec(schema(path));
 const DB={
  prepare(sql){
   let args=[];
   return {
    bind(...v){args=v;return this},
    async first(){return sqlite.prepare(sql).get(...args)??null},
    async all(){return {results:sqlite.prepare(sql).all(...args)}},
    async run(){return {success:true,meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}}
   };
  },
  async batch(stmts){
   sqlite.exec('BEGIN IMMEDIATE');
   try{const result=[];for(const stmt of stmts)result.push(await stmt.run());sqlite.exec('COMMIT');return result}
   catch(e){sqlite.exec('ROLLBACK');throw e}
  }
 };
 const env={DB,...flags,ASSETS:{fetch:async()=>{throw Error('private route fell through to assets')}}};
 return {DB,fetch:(req,patch={})=>worker.fetch(req,{...env,...patch}),close:()=>sqlite.close()};
}
for(const [name,worker] of [['production',production],['staging',staging]]){
 test(name+' M012-A complete D1 credential/session/member-directory lifecycle',async()=>{
  const f=fixture(worker);try{await exerciseLifecycle(f.fetch,f.DB)}finally{f.close()}
 });
 test(name+' M012-A forged/expired/wrong proof and D1 rate limiter',async()=>{
  const f=fixture(worker);try{await exerciseBadCredentials(f.fetch,f.DB)}finally{f.close()}
 });
 test(name+' M012-A one-time challenge and renewal concurrency',async()=>{
  const f=fixture(worker);try{await exerciseReplayRace(f.fetch,f.DB)}finally{f.close()}
 });
 test(name+' M012-A off by default; official and readonly hosts permanently forbidden',async()=>{
  const f=fixture(worker);
  try{
   for(const patch of [{EDITOR_D1_SESSION_API_ENABLED:undefined},{MEMBER_DIRECTORY_API_ENABLED:undefined},{MEMBER_DIRECTORY_API_HOST:undefined}]){
    assert.equal((await f.fetch(request(),patch)).status,404);
   }
   for(const host of ['ronde-des-archanges-universelle.eu','www.ronde-des-archanges-universelle.eu',
    'celebrations-exit-production.rondes.workers.dev','celebrations-visual-candidate.rondes.workers.dev',
    'celebrations-exit-staging.rondes.workers.dev']){
    for(const method of ['GET','POST']){
     const response=await f.fetch(request(PATH,{host,origin:'https://'+host,method,
      headers:{cookie:signedEditorCookie()}}),{MEMBER_DIRECTORY_API_HOST:host});
     assert.ok([404,405].includes(response.status),host+' '+method);
    }
   }
   assert.equal((await f.fetch(request(PATH,{scheme:'http'}))).status,404);
   assert.equal((await f.fetch(request(PATH,{host:'other.test',origin:'https://other.test'}))).status,404);
  }finally{f.close()}
 });
 test(name+' M012-A exact same origin, method, content type, body shape and missing DB',async()=>{
  const f=fixture(worker);
  try{
   for(const origin of [null,'https://evil.test','null']){
    assert.equal((await f.fetch(request(PATH,{origin}))).status,403);
   }
   assert.equal((await f.fetch(request(PATH,{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
   assert.equal((await f.fetch(request(PATH,{method:'GET'}))).status,405);
   assert.equal((await f.fetch(request(PATH,{headers:{'content-type':'text/plain'}}))).status,400);
   for(const body of [{action:'login',admin_token:'a'.repeat(64)},{action:'login',password_proof:SECRET},{action:'challenge',email:'spoof@example.test'},
    {action:'session',admin_token:'a'.repeat(64)},{action:'x'.repeat(5000)}]){
    assert.equal((await f.fetch(request(PATH,{body}))).status,400);
   }
   assert.equal((await f.fetch(request(),{DB:undefined})).status,503);
   assert.equal((await f.fetch(request(),{ADMIN_PASSWORD_HASH:undefined})).status,503);
   assert.equal((await f.fetch(request(),{ADMIN_PASSWORD_SALT:undefined})).status,503);
   assert.equal((await f.fetch(request(),{EDITOR_D1_CHALLENGE_SECRET:undefined})).status,503);
   assert.equal((await f.fetch(request(),{EDITOR_D1_CHALLENGE_SECRET:SECRET})).status,503);
  }finally{f.close()}
 });
 test(name+' M012-A existing D1 auth login still uses same session table and M011-A accepts it',async()=>{
  const f=fixture(worker);
  try{
   const r=await f.fetch(request('/api/auth',{body:{action:'admin_login_derived',email:'admin@celebrations.local',password_proof:SECRET}}));
   assert.equal(r.status,200);
   const b=await r.json();assert.equal(b.ok,true);
   assert.equal((await f.fetch(request(DIRECTORY,{method:'GET',token:b.token}))).status,200);
   const s=await f.fetch(request(PATH,{body:{action:'session'},token:b.token}));
   assert.equal(s.status,200);
   assert.equal((await s.json()).email,'admin@celebrations.local');
   const logout=await f.fetch(request('/api/auth',{body:{action:'admin_logout',admin_token:b.token}}));
   assert.equal(logout.status,200);
   assert.equal((await f.fetch(request(DIRECTORY,{method:'GET',token:b.token}))).status,401);
  }finally{f.close()}
 });
}
