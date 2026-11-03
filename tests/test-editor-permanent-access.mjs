import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {pbkdf2Sync,createHash,randomBytes} from 'node:crypto';
import {accessConfig,accessLogin,accessLogout,accessPage,setupPage} from '../migration/cloudflare/editor-permanent-access.mjs';
import {handleAuth,authorize} from '../migration/cloudflare/auth-api.mjs';
const BASE='https://celebrations-exit-staging.rondes.workers.dev';
const sha=v=>createHash('sha256').update(v).digest('hex');
const fictitious=()=>{
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE celebrations_admin_sessions(token_hash TEXT PRIMARY KEY,admin_email TEXT NOT NULL,expires_at TEXT NOT NULL);'+
 'CREATE TABLE celebrations_login_attempts(identity_hash TEXT PRIMARY KEY,failed_count INTEGER NOT NULL,locked_until TEXT,updated_at TEXT);');
 const DB={prepare(sql){const q=db.prepare(sql);return{
 bind(...args){return{first:async()=>q.get(...args)||null,run:async()=>({meta:{changes:q.run(...args).changes}})}}
 }}};
 const password=randomBytes(24).toString('hex');
 const salt=randomBytes(16).toString('hex'),proof=pbkdf2Sync(password,Buffer.from(salt,'hex'),210000,32,'sha256').toString('hex');
 return {db,DB,env:{DB,STAGING_ADMIN_PASSWORD_SALT:salt,STAGING_ADMIN_PASSWORD_VERIFIER:sha(Buffer.from(proof,'hex'))},proof,close:()=>db.close()};
};
const login=(proof)=>new Request(BASE+'/__editor/access/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({proof})});
test('permanent access: protected offline setup, staging-only, no D4 or production secrets',async()=>{
 const f=fictitious();try{
  assert.equal(accessConfig(new Request(BASE+'/__editor/access/config'),{}).status,503);
  assert.equal(accessConfig(new Request('https://www.ronde-des-archanges-universelle.eu/__editor/access/config'),f.env).status,404);
  assert.equal((await accessLogin(login(f.proof),{DB:f.DB})).status,503,'Fail closed until secrets manually set');
  const salt=await accessConfig(new Request(BASE+'/__editor/access/config'),f.env).json();
  assert.equal(salt.salt,f.env.STAGING_ADMIN_PASSWORD_SALT);
  assert.ok(!JSON.stringify(salt).includes(f.env.STAGING_ADMIN_PASSWORD_VERIFIER),'Verifier not sent to browser');
  for(const path of ['access','access/setup']){
   const fn=path.endsWith('setup')?setupPage:accessPage;
   const response=fn(new Request(BASE+'/__editor/'+path));
   assert.equal(response.status,200);
   assert.match(response.headers.get('content-security-policy'),/script-src 'nonce-/);
   const html=await response.text();
   assert.ok(!html.includes(f.env.STAGING_ADMIN_PASSWORD_VERIFIER));
   assert.match(html,/type="password"/);
   const source=html.match(/<script nonce="[^"]+">([\s\S]*?)<\/script>/)?.[1];
   assert.ok(source?.length>300,'Client script available');
   const {Script}=await import('node:vm');assert.doesNotThrow(()=>new Script(source),'Browser script syntax');
   assert.ok(html.includes('210000')||path==='access');
  }
  assert.equal((await accessLogin(new Request('https://example.org/__editor/access/session',{method:'POST',body:JSON.stringify({proof:f.proof})}),f.env)).status,404);
 }finally{f.close();}
});
test('30-day staging session and explicit revocation on fictional database',async()=>{
 const f=fictitious();try{
  assert.equal((await accessLogin(login('b'.repeat(64)),f.env)).status,401,'Wrong proof denied');
  const wrongCount=f.db.prepare('SELECT failed_count FROM celebrations_login_attempts').get();
  assert.equal(wrongCount.failed_count,1);
  const r=await accessLogin(login(f.proof),f.env);
  assert.equal(r.status,200);
  const data=await r.json();assert.equal(data.ok,true);assert.equal(data.staging,true);
  assert.match(data.token,/^[a-f0-9]{64}$/);
  const lifetime=Date.parse(data.expires_at)-Date.now();
  assert.ok(lifetime>29*86400000&&lifetime<=30*86400000+2000);
  assert.equal(f.db.prepare('SELECT token_hash FROM celebrations_admin_sessions').get().token_hash,sha(data.token));
  const secured=new Request(BASE+'/api/editor-e1',{headers:{authorization:'Bearer '+data.token}});
  assert.ok(await authorize(secured,f.env,true),'Authorized for existing visual editor');
  assert.equal((await handleAuth(new Request(BASE+'/api/auth',{method:'POST',body:JSON.stringify({action:'admin_session',admin_token:data.token})}),f.env)).status,200);
  const logout=await accessLogout(new Request(BASE+'/__editor/access/logout',{method:'POST',headers:{authorization:'Bearer '+data.token}}),f.env);
  assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM celebrations_admin_sessions').get().n,0);
  assert.equal(await authorize(secured,f.env,true),null,'Revoked session can no longer edit');
  assert.equal((await accessLogout(new Request(BASE+'/__editor/access/logout',{method:'POST'}),f.env)).status,401);
  assert.equal((await accessLogin(login(f.proof.replace(/./,'x')),f.env)).status,401);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM celebrations_admin_sessions').get().n,0);
 }finally{f.close();}
});
test('5 incorrect fictional attempts lock out even a valid proof',async()=>{
 const f=fictitious();try{
  for(let i=0;i<5;i++)assert.equal((await accessLogin(login('b'.repeat(64)),f.env)).status,401);
  assert.equal((await accessLogin(login(f.proof),f.env)).status,429);
  assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM celebrations_admin_sessions').get().n,0);
 }finally{f.close();}
});
