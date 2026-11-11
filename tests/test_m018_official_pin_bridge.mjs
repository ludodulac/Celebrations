// M018 targeted tests: the current simple editor PIN unlocks members only
// through a same-origin, explicit, short-lived D1 bearer exchange.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import production from '../migration/cloudflare/production-worker.mjs';
import {createEditorD1Session} from '../migration/cloudflare/app/admin/real-editor-member-spaces.mjs';
import {mayUseIsolatedMemberApi} from '../migration/cloudflare/app/security/editor-route-policy.mjs';
import {schemaFiles,schema,SECRET,SALT,signedEditorCookie} from './fixtures/m012a-editor-session-http.mjs';

const HOST='ronde-des-archanges-universelle.eu',ORIGIN='https://'+HOST;
const ROOT='/api/admin/editor-session',MEMBERS='/api/admin/member-directory?action=snapshot';
function makeFixture(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('PRAGMA foreign_keys=ON');
 for(const path of schemaFiles)sqlite.exec(schema(path));
 const db={
  prepare(sql){
   let args=[];return {
    bind(...v){args=v;return this},
    async first(){return sqlite.prepare(sql).get(...args)??null},
    async all(){return {results:sqlite.prepare(sql).all(...args)}},
    async run(){return {success:true,meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}}
   };
  },
  async batch(stmts){
   sqlite.exec('BEGIN IMMEDIATE');
   try{const out=[];for(const s of stmts)out.push(await s.run());sqlite.exec('COMMIT');return out}
   catch(e){sqlite.exec('ROLLBACK');throw e}
  }
 };
 const env={
  DB:db,ASSETS:{fetch(){throw Error('Sensitive route reached assets')}},
  ADMIN_PASSWORD_HASH:SECRET,ADMIN_PASSWORD_SALT:SALT,
  MEMBER_DIRECTORY_API_ENABLED:'true',MEMBER_DIRECTORY_API_HOST:HOST,
  MEMBER_DIRECTORY_OFFICIAL_ENABLED:'true',EDITOR_PIN_D1_BRIDGE_ENABLED:'true',
  EDITOR_D1_SESSION_API_ENABLED:'true'
 };
 function req(path,method='POST',{headers={},body,host=HOST}={}){
  return new Request('https://'+host+path,{method,
   headers:{...(method==='POST'?{origin:'https://'+host,'content-type':'application/json'}:{}),...headers},
   ...(method==='POST'?{body:JSON.stringify(body??{action:'editor-pin-session'})}:{})});
 }
 return {sqlite,db,env,req,fetch:(r,patch)=>production.fetch(r,{...env,...patch}),close(){sqlite.close()}};
}
const allow=env=>mayUseIsolatedMemberApi(new URL('https://'+HOST+'/api/admin/editor-session'),env);
test('M018 official member API remains OFF until explicit production flags, never preview',()=>{
 const env={MEMBER_DIRECTORY_API_ENABLED:'true',MEMBER_DIRECTORY_API_HOST:HOST};
 assert.equal(allow(env),false);
 assert.equal(allow({...env,MEMBER_DIRECTORY_OFFICIAL_ENABLED:'true'}),true);
 assert.equal(mayUseIsolatedMemberApi(new URL('https://www.'+HOST+'/api/admin/editor-session'),
  {...env,MEMBER_DIRECTORY_OFFICIAL_ENABLED:'true'}),true);
 assert.equal(mayUseIsolatedMemberApi(new URL('https://celebrations-exit-production.rondes.workers.dev/'),
  {...env,MEMBER_DIRECTORY_API_HOST:'celebrations-exit-production.rondes.workers.dev',
   MEMBER_DIRECTORY_OFFICIAL_ENABLED:'true'}),false);
 assert.equal(mayUseIsolatedMemberApi(new URL('http://'+HOST+'/'),{...env,MEMBER_DIRECTORY_OFFICIAL_ENABLED:'true'}),false);
});
test('M018 official PIN exchange requires editor cookie, same origin, custom CSRF header, both flags',async()=>{
 const f=makeFixture();
 try{
  const headers={cookie:signedEditorCookie(),'x-celebrations-editor-bridge':'1'};
  const send=(h=headers,patch={})=>f.fetch(f.req(ROOT,'POST',{headers:h}),patch);
  assert.equal((await send(headers,{MEMBER_DIRECTORY_OFFICIAL_ENABLED:undefined})).status,404);
  assert.equal((await send(headers,{EDITOR_PIN_D1_BRIDGE_ENABLED:undefined})).status,404);
  assert.equal((await send({'x-celebrations-editor-bridge':'1'})).status,401);
  assert.equal((await send({cookie:'celebrations_editor_access=forged',
    'x-celebrations-editor-bridge':'1'})).status,401);
  assert.equal((await send({cookie:signedEditorCookie()})).status,403);
  assert.equal((await send({...headers,origin:'https://evil.example'})).status,403);
  assert.equal((await send({...headers,'sec-fetch-site':'cross-site'})).status,403);
  assert.equal((await send({...headers,authorization:'Bearer '+'b'.repeat(64)})).status,403);
  assert.equal((await f.fetch(f.req(MEMBERS,'GET',{headers:{cookie:signedEditorCookie()}}))).status,401,
   'editor cookie alone must never authorize directory GET');
  const ok=await send();
  assert.equal(ok.status,200);
  const data=await ok.json();
  assert.equal(data.ok,true);
  assert.equal(data.email,'admin@celebrations.local');
  assert.match(data.token,/^[a-f0-9]{64}$/);
  assert.ok(Date.parse(data.expires_at)>Date.now());
  assert.equal((await f.fetch(f.req(MEMBERS,'GET',{headers:{authorization:'Bearer '+data.token}}))).status,200);
  const revoke=await f.fetch(f.req(ROOT,'POST',{headers:{authorization:'Bearer '+data.token},
   body:{action:'logout'}}));
  assert.equal(revoke.status,200);
  assert.equal((await f.fetch(f.req(MEMBERS,'GET',{headers:{authorization:'Bearer '+data.token}}))).status,401);
 }finally{f.close()}
});
test('M018 client sends cookie only for PIN exchange, never on ordinary member requests',async()=>{
 const calls=[];
 const client=createEditorD1Session({origin:ORIGIN,fetchImpl:async(url,options)=>{
  calls.push({url,options});
  if(JSON.parse(options.body||'{}').action==='editor-pin-session')
   return new Response(JSON.stringify({ok:true,token:'a'.repeat(64),expires_at:new Date(Date.now()+300000).toISOString()}),
    {status:200,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({ok:true,data:{members:[]}}),
    {status:200,headers:{'content-type':'application/json'}});
 }});
 await client.loginWithEditorPin();
 assert.equal(calls[0].options.credentials,'same-origin');
 assert.equal(calls[0].options.headers['x-celebrations-editor-bridge'],'1');
 assert.equal(calls[0].options.headers.authorization,undefined);
 assert.equal((await client.transport({method:'GET',action:'snapshot'})).ok,true);
 assert.equal(calls[1].options.credentials,'omit');
 assert.equal(calls[1].options.headers.authorization,'Bearer '+'a'.repeat(64));
});
