// M012-A: only synthetic credentials, local HTTPS Request/Response and D1.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,createHmac,pbkdf2Sync} from 'node:crypto';
export const HOST='editor-session-lab.test',ORIGIN='https://'+HOST;
export const PATH='/api/admin/editor-session';
export const DIRECTORY='/api/admin/member-directory?action=snapshot';
export const PARTICIPANT='a'.repeat(64);
export const SALT='0123456789abcdef'.repeat(4);
const PASSWORD='synthetic-only M012-A password';
export const SECRET=pbkdf2Sync(PASSWORD,SALT,180000,32,'sha256').toString('hex');
export const hash=v=>createHash('sha256').update(v).digest('hex');
const sign=(key,msg)=>createHmac('sha256',key).update(msg).digest('hex');
export const flags={
 MEMBER_DIRECTORY_API_ENABLED:'true',MEMBER_DIRECTORY_API_HOST:HOST,
 EDITOR_D1_SESSION_API_ENABLED:'true',
 ADMIN_PASSWORD_HASH:SECRET,ADMIN_PASSWORD_SALT:SALT
};
export const schemaFiles=[
 'celebrations-schema.sql',
 'd1-migrations/20261110_007a_contact_directory.sql',
 'd1-migrations/20261110_008b_directory_integrity.sql',
 'd1-migrations/20261110_009b_explicit_identity_links.sql',
 'd1-migrations/20261111_010b_member_admin_revisions.sql',
 'd1-migrations/20261111_012a_editor_admin_challenges.sql'
];
export const schema=path=>readFileSync(new URL('../../migration/cloudflare/'+path,import.meta.url),'utf8');
const enc=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
// Identical to Construction B's documented WebCrypto derivation.
export async function proof(challenge,salt=SALT,origin=ORIGIN,password=PASSWORD){
 const k=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
 const derived=hex(await crypto.subtle.deriveBits({
  name:'PBKDF2',salt:enc.encode(salt),iterations:180000,hash:'SHA-256'
 },k,256));
 const key=await crypto.subtle.importKey('raw',enc.encode(derived),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,enc.encode(
  'celebrations-admin-login-v1:'+origin+':'+challenge)));
}
export function request(path=PATH,{method='POST',body,token,origin=ORIGIN,
 host=HOST,scheme='https',headers={}}={}){
 return new Request(scheme+'://'+host+path,{method,headers:{
  ...(method==='POST'?{'content-type':'application/json'}:{}),
  ...(method==='POST'&&origin!==null?{origin}:{}),
  ...(token?{authorization:'Bearer '+token}:{}),...headers
 },...(method==='POST'?{body:JSON.stringify(body??{action:'challenge'})}:{})});
}
export const signedEditorCookie=()=>{
 const payload=Date.now()+'.'+'b'.repeat(32);
 return 'celebrations_editor_access='+payload+'.'+sign(SECRET,'site-editor-v1:'+payload);
};
export function expiredChallenge(){
 const payload=(Date.now()-180000)+'.'+'c'.repeat(64);
 return payload+'.'+sign(SECRET,'celebrations-admin-challenge-v1:'+ORIGIN+':'+payload);
}
export async function seedParticipant(db){
 await db.prepare('INSERT INTO celebrations_participants(email,password_hash,audience) VALUES(?,?,?)')
  .bind('participant@example.test','synthetic','angel').run();
 await db.prepare('INSERT INTO celebrations_participant_sessions(token_hash,participant_email,expires_at) VALUES(?,?,?)')
  .bind(hash(PARTICIPANT),'participant@example.test',new Date(Date.now()+3600000).toISOString()).run();
}
const call=async(fetch,body,token,headers={})=>{
 const response=await fetch(request(PATH,{body,token,headers}));
 const json=await response.json();
 assert.match(response.headers.get('cache-control')||'',/no-store/);
 assert.equal(response.headers.get('access-control-allow-origin'),null);
 assert.equal(response.headers.get('set-cookie'),null);
 return {status:response.status,json};
};
export async function challenge(fetch){
 const r=await call(fetch,{action:'challenge'});
 assert.equal(r.status,200);assert.equal(r.json.ok,true);
 assert.equal(r.json.iterations,180000);assert.equal(r.json.expires_in,120);
 assert.equal(r.json.salt,SALT);assert.notEqual(r.json.challenge,SECRET);
 return r.json;
}
export async function login(fetch,old){
 const c=await challenge(fetch);
 const body={action:'login',challenge:c.challenge,response:await proof(c.challenge,c.salt)};
 const r=await call(fetch,body,old);
 assert.equal(r.status,200);assert.equal(r.json.ok,true);
 assert.equal(r.json.email,'admin@celebrations.local');
 assert.match(r.json.token,/^[a-f0-9]{64}$/);
 assert.notEqual(r.json.token,SECRET);
 assert.ok(Date.parse(r.json.expires_at)>Date.now());
 return {body,...r.json};
}
export async function exerciseLifecycle(fetch,db){
 await seedParticipant(db);
 const count=async()=>Number((await db.prepare('SELECT count(*) AS n FROM celebrations_admin_sessions').bind().first()).n);
 const directory=async(token)=>fetch(request(DIRECTORY,{method:'GET',token}));
 assert.equal(await count(),0);
 for(const bad of [undefined,PARTICIPANT,'d'.repeat(64),'legacy-'+ 'f'.repeat(50)]){
  assert.equal((await call(fetch,{action:'session'},bad)).status,401);
  assert.equal((await directory(bad)).status,401);
 }
 assert.equal((await call(fetch,{action:'session'},undefined,{cookie:signedEditorCookie()})).status,401);
 assert.equal(await count(),0);
 const first=await login(fetch);
 const row=await db.prepare('SELECT token_hash,admin_email,expires_at FROM celebrations_admin_sessions WHERE token_hash=?')
  .bind(hash(first.token)).first();
 assert.equal(row.token_hash,hash(first.token));assert.equal(row.admin_email,first.email);
 assert.equal(row.expires_at,first.expires_at);
 assert.equal(await db.prepare('SELECT token_hash FROM celebrations_admin_sessions WHERE token_hash=?').bind(first.token).first(),null);
 assert.equal(await count(),1);
 assert.equal((await call(fetch,first.body)).status,401,'consumed challenge cannot be replayed');
 assert.equal(await count(),1);
 const session=await call(fetch,{action:'session'},first.token);
 assert.deepEqual(session.json,{ok:true,email:first.email,expires_at:first.expires_at});
 assert.equal((await directory(first.token)).status,200);
 assert.equal((await fetch(request('/api/participant/identity-claim',{
  token:first.token,body:{personId:'person:unknown'}
 }))).status,401);
 // A participant cannot rotate even with a valid admin credential proof.
 const c=await challenge(fetch);
 const b={action:'login',challenge:c.challenge,response:await proof(c.challenge,c.salt)};
 assert.equal((await call(fetch,b,PARTICIPANT)).status,401);
 assert.equal(await count(),1);
 const renewed=await login(fetch,first.token);
 assert.notEqual(renewed.token,first.token);assert.equal(await count(),1);
 assert.equal((await directory(first.token)).status,401);
 assert.equal((await call(fetch,{action:'session'},first.token)).status,401);
 assert.equal((await directory(renewed.token)).status,200);
 assert.equal((await call(fetch,{action:'logout'},PARTICIPANT)).status,401);
 assert.equal((await call(fetch,{action:'logout'},renewed.token)).status,200);
 assert.equal(await count(),0);
 assert.equal((await call(fetch,{action:'session'},renewed.token)).status,401);
 assert.equal((await directory(renewed.token)).status,401);
 const expiring=await login(fetch);
 await db.prepare('UPDATE celebrations_admin_sessions SET expires_at=? WHERE token_hash=?')
  .bind(new Date(Date.now()-1000).toISOString(),hash(expiring.token)).run();
 assert.equal((await call(fetch,{action:'session'},expiring.token)).status,401);
 assert.equal((await directory(expiring.token)).status,401);
 assert.equal((await call(fetch,{action:'logout'},expiring.token)).status,401);
 const next=await login(fetch);
 assert.equal((await directory(next.token)).status,200);
 await db.prepare('DELETE FROM celebrations_admin_sessions WHERE token_hash=?').bind(hash(next.token)).run();
 assert.equal((await directory(next.token)).status,401,'server-side revocation takes effect');
 assert.equal((await call(fetch,{action:'session'},next.token)).status,401);
}
export async function exerciseBadCredentials(fetch,db){
 const c=await challenge(fetch);
 const forged=c.challenge.slice(0,-1)+(c.challenge.endsWith('0')?'1':'0');
 assert.equal((await call(fetch,{action:'login',challenge:forged,response:await proof(forged)})).status,401);
 const expired=expiredChallenge();
 assert.equal((await call(fetch,{action:'login',challenge:expired,response:await proof(expired)})).status,401);
 assert.equal((await call(fetch,{action:'login',challenge:c.challenge,response:await proof(c.challenge,SALT,'https://other.test')})).status,401);
 assert.equal((await call(fetch,{action:'login',challenge:c.challenge,response:await proof(c.challenge,SALT,ORIGIN,'incorrect')})).status,401);
 assert.equal((await call(fetch,{action:'login',challenge:c.challenge,response:'0'.repeat(64)})).status,401);
 assert.equal((await call(fetch,{action:'challenge'})).status,429,'uses existing admin rate limiter');
 assert.equal((await db.prepare('SELECT count(*) AS n FROM celebrations_admin_sessions').bind().first()).n,0);
}
export async function exerciseReplayRace(fetch,db){
 const c=await challenge(fetch);
 const body={action:'login',challenge:c.challenge,response:await proof(c.challenge,c.salt)};
 const results=await Promise.all([call(fetch,body),call(fetch,body)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);
 const issued=results.find(r=>r.status===200).json.token;
 const c1=await challenge(fetch),c2=await challenge(fetch);
 const results2=await Promise.all([
  call(fetch,{action:'login',challenge:c1.challenge,response:await proof(c1.challenge)},issued),
  call(fetch,{action:'login',challenge:c2.challenge,response:await proof(c2.challenge)},issued)
 ]);
 assert.deepEqual(results2.map(r=>r.status).sort(),[200,401]);
 assert.equal(Number((await db.prepare('SELECT count(*) AS n FROM celebrations_admin_sessions').bind().first()).n),1);
 assert.equal((await call(fetch,{action:'session'},issued)).status,401);
}
