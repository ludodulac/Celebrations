import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomBytes,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {handleEditorD4Login,handleEditorD4Access} from '../migration/cloudflare/editor-d4-access.mjs';
import {handleAuth} from '../migration/cloudflare/auth-api.mjs';

const root='https://celebrations-exit-staging.rondes.workers.dev';
function fixture(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('CREATE TABLE celebrations_admin_sessions(token_hash TEXT PRIMARY KEY,admin_email TEXT NOT NULL,expires_at TEXT NOT NULL);');
 const DB={prepare(sql){const q=sqlite.prepare(sql);return{bind(...args){return{
  async run(){q.run(...args);return{meta:{changes:1}}},
  async first(){return q.get(...args)||null}
 }}}}};
 return{sqlite,DB,close:()=>sqlite.close()};
}
const digest=value=>createHash('sha256').update(value).digest('hex');
test('D4 temporary personal access authenticates only on staging without changing official password',async()=>{
 const f=fixture();
 try{
  const code='D4'+randomBytes(20).toString('hex').toUpperCase();
  const verifier=digest(code);
  const env={DB:f.DB,ADMIN_D4_ACCESS_HASH:verifier};
  const post=(value,hostname=root)=>new Request(hostname+'/__editor/access/session',{
   method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:value})
  });
  assert.equal((await handleEditorD4Login(post(code,'https://example.org'),env)).status,404);
  assert.equal((await handleEditorD4Login(post('D4'+randomBytes(20).toString('hex')),env)).status,401);
  assert.equal((await handleEditorD4Login(post(code),{DB:f.DB}),).status,503);
  const invitation=await handleEditorD4Login(post(code),env);
  assert.equal(invitation.status,200);
  const data=await invitation.json();
  assert.equal(data.ok,true);
  assert.equal(data.staging,true);
  assert.equal(typeof data.token,'string');
  assert.ok(data.token.length>=64);
  assert.equal(f.sqlite.prepare('SELECT COUNT(*) AS n FROM celebrations_admin_sessions').get().n,1);
  const status=await handleAuth(new Request(root+'/api/auth',{method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({action:'admin_session',admin_token:data.token})}),{DB:f.DB});
  assert.equal(status.status,200);
  assert.equal((await status.json()).ok,true);
  assert.equal((await handleEditorD4Login(post(code),{...env,ADMIN_D4_ACCESS_HASH:digest('wrong')})).status,401);
 }finally{f.close()}
});
test('D4 access form is mobile-ready, CSP protected, no code or verifier exposed',async()=>{
 const res=await handleEditorD4Access(new Request(root+'/__editor/access'));
 assert.equal(res.status,200);
 const body=await res.text();
 assert.ok(body.includes('<meta name="viewport"')&&body.includes('Code d\'accès temporaire'));
 assert.ok(body.includes('/__editor/access/session'));
 assert.ok(body.includes('admin.html?staging=1')&&body.includes('/__editor/entry'));
 assert.ok(!body.includes('ADMIN_D4_ACCESS_HASH'));
 assert.equal(res.headers.get('cache-control'),'no-store');
 const csp=res.headers.get('content-security-policy');
 assert.match(csp,/script-src 'nonce-/);
 assert.match(csp,/style-src 'nonce-/);
 const nonces=[...body.matchAll(/nonce="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(nonces.length,2);
 assert.equal(nonces[0],nonces[1]);
 assert.equal((await handleEditorD4Access(new Request('https://example.org/__editor/access'))).status,404);
});
