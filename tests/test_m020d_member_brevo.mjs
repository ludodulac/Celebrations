// M020-D: only fictitious identities, local D1 and simulated Brevo.
// Run: node --test tests/test_m020d_member_brevo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash,pbkdf2Sync} from 'node:crypto';
import {handleMemberAccount,inviteMember,revokeMember,getMemberAccessStatus}
  from '../migration/cloudflare/member-account-api.mjs';
import {handleAuth,sha256} from '../migration/cloudflare/auth-api.mjs';
import {resolveExplicitMemberIdentity} from '../migration/cloudflare/app/security/member-identity-links.mjs';
import production from '../migration/cloudflare/production-worker.mjs';

const BASE='https://members.example.invalid',MAIL='invented@example.invalid';
const P='person:550e8400-e29b-41d4-a716-446655440000';
const Q='person:550e8400-e29b-41d4-a716-446655440001';
const ADMIN='a'.repeat(64),oldPassword='This_is_a_dummy_strong_password_27!';
const sql=name=>readFileSync(new URL('../migration/cloudflare/'+name,import.meta.url),'utf8');
const hash=value=>createHash('sha256').update(value).digest('hex');
function sqliteD1(sqlite){
 return {prepare(statement){
  let params=[];
  return {
   bind(...values){params=values;return this;},
   async first(){return sqlite.prepare(statement).get(...params)??null;},
   async all(){return {results:sqlite.prepare(statement).all(...params)};},
   async run(){const x=sqlite.prepare(statement).run(...params);return {meta:{changes:Number(x.changes)},success:true};}
  };
 },async batch(statements){
  sqlite.exec('BEGIN IMMEDIATE');
  try{
   const result=[];for(const s of statements)result.push(await s.run());
   sqlite.exec('COMMIT');return result;
  }catch(err){sqlite.exec('ROLLBACK');throw err}
 }};
}
function setup(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');
 for(const path of ['celebrations-schema.sql',
  'd1-migrations/20261110_007a_contact_directory.sql',
  'd1-migrations/20261110_008b_directory_integrity.sql',
  'd1-migrations/20261110_009b_explicit_identity_links.sql',
  'd1-migrations/20261111_010b_member_admin_revisions.sql',
  'd1-migrations/20261111_020d_member_brevo.sql'])sqlite.exec(sql(path));
 sqlite.prepare('INSERT INTO celebrations_celebrations(id,archangel) VALUES(?,?)').run(41,'Gabriel');
 sqlite.prepare('INSERT INTO celebrations_celebrations(id,archangel) VALUES(?,?)').run(42,'Michaël');
 sqlite.prepare('INSERT INTO celebrations_directory_people(id,email_normalized,given_name,family_name) VALUES(?,?,?,?)')
  .run(P,MAIL,'Inventée','Test');
 sqlite.prepare('INSERT INTO celebrations_directory_person_celebrations(person_id,celebration_id) VALUES(?,?)').run(P,41);
 sqlite.prepare('INSERT INTO celebrations_directory_person_celebrations(person_id,celebration_id) VALUES(?,?)').run(P,42);
 sqlite.prepare('INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)')
  .run(hash(ADMIN),'operator@example.invalid',new Date(Date.now()+3600000).toISOString());
 const env={DB:sqliteD1(sqlite),BREVO_API_KEY:'simulation-only-not-a-secret',
  BREVO_SENDER_EMAIL:'fictive@example.invalid',BREVO_SENDER_NAME:'Célébrations',
  MEMBER_PUBLIC_ORIGIN:BASE,MEMBER_DIRECTORY_API_ENABLED:'true',MEMBER_DIRECTORY_API_HOST:'members.example.invalid',
  ASSETS:{fetch:async()=>new Response('ASSET')}};
 async function request(body,{cookie,origin=BASE,envOverride={},target='/api/member-account'}={}){
  const req=new Request(BASE+target,{method:'POST',
   headers:{origin,'content-type':'application/json',...(cookie?{cookie}:{})},
   body:JSON.stringify(body)});
  return production.fetch(req,{...env,...envOverride});
 }
 return {sqlite,env,request};
}
function proof(password,salt){return pbkdf2Sync(password,salt,180000,32,'sha256').toString('hex')}
function fakeBrevo(){
 const messages=[],original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://api.brevo.com/v3/smtp/email');
  assert.ok(options.headers['api-key'].includes('simulation-only'));
  const body=JSON.parse(options.body);
  assert.ok(!JSON.stringify(body).includes('password_hash'));
  messages.push(body);
  return Response.json({messageId:'simulation-only'},{status:201});
 };
 return {messages,restore:()=>{globalThis.fetch=original}};
}
function tokenFrom(body,kind){
 const match=body.textContent.match(/https:\/\/\S+/);
 assert.ok(match,'expected safe URL in simulated Brevo payload');
 const link=new URL(match[0]);
 assert.equal(link.origin,BASE);
 assert.equal(link.searchParams.get('page'),'member-area');
 return {token:new URLSearchParams(link.hash.slice(1)).get(kind),
  email:new URLSearchParams(link.hash.slice(1)).get('email')};
}
test('M020-D — activation, session cookie, two celebrations, reset and immediate revocation',async()=>{
 const f=setup(),mock=fakeBrevo();
 try{
  const invited=await inviteMember(f.env.DB,f.env,P,'operator@example.invalid',{send:true,language:'en'});
  assert.deepEqual(invited,{status:'invited',mail:'sent'});
  assert.equal(mock.messages.length,1);
  assert.match(mock.messages[0].subject,/Activate/);
  assert.equal(f.sqlite.prepare('SELECT password_hash FROM celebrations_participants WHERE email=?').get(MAIL).password_hash,null);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM celebrations_directory_person_celebrations WHERE person_id=?').get(P).n,2);
  const activation=tokenFrom(mock.messages[0],'activate');
  assert.equal(activation.email,MAIL);
  assert.equal(f.sqlite.prepare('SELECT token_hash FROM celebrations_member_email_tokens').get().token_hash,hash(activation.token));
  assert.ok(!JSON.stringify(f.sqlite.prepare('SELECT * FROM celebrations_member_email_tokens').get()).includes(activation.token));
  let response=await f.request({action:'finish_activation',...activation,password_salt:'b'.repeat(64),password_proof:proof(oldPassword,'b'.repeat(64))});
  assert.equal(response.status,200,await response.text());
  assert.equal((await getMemberAccessStatus(f.env.DB,P)).status,'active');
  response=await f.request({action:'finish_activation',...activation,password_salt:'c'.repeat(64),password_proof:proof('otherpassword','c'.repeat(64))});
  assert.equal(response.status,400,'one time activation token cannot be replayed');
  const begin=await f.request({action:'participant_begin',email:MAIL},{target:'/api/auth'});
  assert.equal(begin.status,200);
  const salt=(await begin.json()).salt;
  assert.equal(salt,'b'.repeat(64));
  const login=await f.request({action:'participant_login_derived',email:MAIL,password_proof:proof(oldPassword,salt)},{target:'/api/auth'});
  assert.equal(login.status,200);
  const {token:legacyBearer}=await login.json();
  response=await f.request({action:'adopt_session',participant_token:legacyBearer});
  assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie');
  assert.match(cookie,/__Host-celebrations_member=/);
  assert.match(cookie,/Secure; SameSite=Lax/);
  assert.match(cookie,/HttpOnly/);
  const cookieRequest=cookie.split(';')[0];
  response=await f.request({action:'session'},{cookie:cookieRequest});
  assert.equal(response.status,200);
  const memberReq=new Request(BASE+'/api/participant/space-pages?celebration=all',{headers:{cookie:cookieRequest}});
  assert.equal((await resolveExplicitMemberIdentity(memberReq,f.env)).id,P);
  // Reset is issued only for the linked active member and invalidates sessions.
  response=await f.request({action:'request_reset',email:MAIL,language:'es'});
  assert.equal(response.status,200);
  assert.equal(mock.messages.length,2);
  const reset=tokenFrom(mock.messages[1],'reset');
  response=await f.request({action:'finish_reset',...reset,password_salt:'d'.repeat(64),password_proof:proof('Another_dummy_strong_password!','d'.repeat(64))});
  assert.equal(response.status,200);
  response=await f.request({action:'finish_reset',...reset,password_salt:'e'.repeat(64),password_proof:proof('This_one_cannot_work','e'.repeat(64))});
  assert.equal(response.status,400,'reset link is one use');
  assert.equal((await f.request({action:'session'},{cookie:cookieRequest})).status,401,'old session invalidated');
  let badLogin=await f.request({action:'participant_login_derived',email:MAIL,password_proof:proof(oldPassword,'d'.repeat(64))},{target:'/api/auth'});
  assert.equal(badLogin.status,401);
  const goodLogin=await f.request({action:'participant_login_derived',email:MAIL,password_proof:proof('Another_dummy_strong_password!','d'.repeat(64))},{target:'/api/auth'});
  assert.equal(goodLogin.status,200);
  const bearer2=(await goodLogin.json()).token;
  assert.equal((await resolveExplicitMemberIdentity(new Request(BASE,{headers:{authorization:'Bearer '+bearer2}}),f.env)).id,P);
  await revokeMember(f.env.DB,P,'operator@example.invalid');
  assert.equal((await getMemberAccessStatus(f.env.DB,P)).status,'revoked');
  assert.equal(await resolveExplicitMemberIdentity(new Request(BASE,{headers:{authorization:'Bearer '+bearer2}}),f.env),null);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM celebrations_participant_sessions WHERE participant_email=?').get(MAIL).n,0);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM celebrations_directory_person_celebrations WHERE person_id=?').get(P).n,2,'historic grants are preserved');
  assert.equal(f.sqlite.prepare('SELECT password_hash FROM celebrations_participants WHERE email=?').get(MAIL).password_hash,hash(proof('Another_dummy_strong_password!','d'.repeat(64))));
  assert.equal(f.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{mock.restore();f.sqlite.close()}
});
test('M020-D — no implicit identity linking, no live mail without configuration',async()=>{
 const f=setup();
 try {
  const oldHash='old-credential-hash-unaltered';
  f.sqlite.prepare('INSERT INTO celebrations_participants(email,password_hash) VALUES(?,?)').run(MAIL,oldHash);
  await assert.rejects(()=>inviteMember(f.env.DB,{...f.env,BREVO_API_KEY:undefined},P,'operator@example.invalid',{send:true}),/historique/);
  assert.equal(f.sqlite.prepare('SELECT password_hash FROM celebrations_participants WHERE email=?').get(MAIL).password_hash,oldHash);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) n FROM celebrations_directory_identity_links').get().n,0);
  f.sqlite.prepare('INSERT INTO celebrations_directory_people(id,email_normalized) VALUES(?,?)').run(Q,'another@example.invalid');
  f.sqlite.prepare('INSERT INTO celebrations_directory_person_celebrations(person_id,celebration_id) VALUES(?,?)').run(Q,41);
  const x=await inviteMember(f.env.DB,{...f.env,BREVO_API_KEY:undefined},Q,'operator@example.invalid',{send:true});
  assert.equal(x.mail,'unconfigured');
  for(const value of ['another@example.invalid','unknown@example.invalid']){
   const r=await f.request({action:'request_activation',email:value},{envOverride:{BREVO_API_KEY:undefined}});
   assert.equal(r.status,503);
   assert.match((await r.json()).error,/aucun message envoyé/i);
  }
  const uninvited=await f.request({action:'finish_activation',email:MAIL,token:'a'.repeat(64),password_salt:'b'.repeat(64),password_proof:'c'.repeat(64)});
  assert.equal(uninvited.status,400);
  assert.equal(f.sqlite.prepare('SELECT password_hash FROM celebrations_participants WHERE email=?').get(MAIL).password_hash,oldHash);
 }finally{f.sqlite.close()}
});
test('M020-D — default off, origin protection and uniform public lookup',async()=>{
 const f=setup(),mock=fakeBrevo();
 try{
  assert.equal((await f.request({action:'session'},{envOverride:{MEMBER_DIRECTORY_API_ENABLED:'false'}})).status,404);
  assert.equal((await f.request({action:'request_activation',email:MAIL},{origin:'https://evil.example.invalid'})).status,403);
  await inviteMember(f.env.DB,f.env,P,'operator@example.invalid',{send:false});
  const ok=await f.request({action:'request_activation',email:MAIL});
  const missing=await f.request({action:'request_activation',email:'missing@example.invalid'});
  assert.equal(ok.status,200);assert.equal(missing.status,200);
  assert.deepEqual(await ok.json(),await missing.json(),'existing and unknown emails have identical public response');
  assert.equal(mock.messages.length,1);
  assert.equal((await f.request({action:'adopt_session',participant_token:'f'.repeat(64)})).status,401);
 }finally{mock.restore();f.sqlite.close()}
});
