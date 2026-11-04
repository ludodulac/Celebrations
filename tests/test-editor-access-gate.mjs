// Tests for the official editor's server-signed, cookie-independent login form.
// The secret owner code is never stored in tests or shown to visitors.
// This specifically tests Brave/mobile forms without Origin and without cookie handshakes.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../migration/cloudflare/production-worker.mjs';
import {editorLoginPage,hasEditorAccess,editorAccessAction,editorLogout} from '../migration/cloudflare/editor-site-access.mjs';
import {handleServerDraft} from '../migration/cloudflare/editor-server-draft-api.mjs';

const origin='https://www.ronde-des-archanges-universelle.eu';
const fakeEnv=()=>({
 ADMIN_PASSWORD_HASH:'a'.repeat(64),
 DB:{prepare(){return{
  bind(){return{first:async()=>null,run:async()=>({success:true})}},
  first:async()=>null
 }}}
});
const req=(path,init={})=>new Request(origin+path,init);
async function challenge(env=fakeEnv()){
 const res=await editorLoginPage(req('/admin.html'),env);
 assert.equal(res.status,200);
 const body=await res.text();
 const csrf=body.match(/name="_csrf" value="([0-9]{13}\.[a-f0-9]{32}\.[a-f0-9]{64})"/)?.[1];
 assert.ok(csrf,'editor form contains a signed short-lived challenge');
 assert.equal(res.headers.get('set-cookie'),null,'challenge does not require a preliminary cookie');
 return csrf;
}
const formReq=(csrf,originHeader)=>req('/api/editor-access',{
 method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',
  ...(originHeader===undefined?{}:{origin:originHeader})},
 body:new URLSearchParams({_csrf:csrf,code:'incorrect'})
});

test('anonymous editor URLs present the signed login form, never the editor',async()=>{
 const e=fakeEnv();
 for(const path of ['/admin','/admin.html','/__editor/demo-preparation?celebration=101']){
  const res=await worker.fetch(req(path),e);
  assert.equal(res.status,200);
  assert.equal(res.headers.get('cache-control'),'no-store');
  const html=await res.text();
  assert.match(html,/Code d’accès/);
  assert.match(html,/<form action="\/api\/editor-access" method="post">/);
  assert.match(html,/name="_csrf" value="[0-9]{13}\.[a-f0-9]{32}\.[a-f0-9]{64}"/);
  assert.ok(!html.includes('window.__PREPARATION_SEED__'));
 }
});

test('anonymous users cannot overwrite official server draft through either handler',async()=>{
 const e={...fakeEnv(),EDITOR_BUCKET:{},MEDIA_BUCKET:{}};
 const data={celebration:'101',expectedRevision:0,record:{pages:[]},plans:[],shared:{pages:[],homeId:''}};
 const init={method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(data)};
 assert.equal((await worker.fetch(req('/api/editor-open-draft',init),e)).status,401);
 assert.equal((await handleServerDraft(req('/api/editor-open-draft',init),e)).status,401);
});

test('mobile privacy browser missing Origin/cookies reaches code check with signed challenge',async()=>{
 const e=fakeEnv(),csrf=await challenge(e);
 const res=await editorAccessAction(formReq(csrf),e);
 assert.equal(res.status,303);
 assert.match(res.headers.get('location')||'',/erreur=1/);
 assert.equal(res.headers.get('set-cookie'),null);
});

test('www and apex and opaque Origin navigation are compatible with a valid form signature',async()=>{
 const e=fakeEnv(),csrf=await challenge(e);
 for(const header of [origin,'https://ronde-des-archanges-universelle.eu','null']){
  const res=await editorAccessAction(formReq(csrf,header),e);
  assert.equal(res.status,303,header);
  assert.match(res.headers.get('location')||'',/erreur=1/);
 }
});

test('missing, fabricated, expired and tampered signatures cannot submit the login form',async()=>{
 const e=fakeEnv(),csrf=await challenge(e);
 for(const invalid of ['', '0'.repeat(64),csrf.slice(0,-1)+(csrf.endsWith('0')?'1':'0')]){
  assert.equal((await editorAccessAction(formReq(invalid),e)).status,403);
 }
 const age=String(Date.now()-20*60*1000)+csrf.slice(13);
 assert.equal((await editorAccessAction(formReq(age),e)).status,403);
});

test('foreign sites cannot forge a signed login form just by sending an Origin',async()=>{
 const e=fakeEnv();
 const res=await editorAccessAction(formReq('f'.repeat(64),'https://attacker.example'),e);
 assert.equal(res.status,403);
});

test('randomly fabricated session cookie never unlocks the editor',async()=>{
 const e=fakeEnv(),fake=String(Date.now())+'.'+'a'.repeat(32)+'.'+'b'.repeat(64);
 assert.equal(await hasEditorAccess(req('/admin.html',{headers:{cookie:'celebrations_editor_access='+fake}}),e),false);
 assert.equal(await hasEditorAccess(req('/admin.html'),e),false);
 assert.equal(await hasEditorAccess(new Request('https://attacker.example/admin.html'),e),false);
});

test('valid server-signed session does unlock the same editor on both official hosts',async()=>{
 const e=fakeEnv(),stamp=String(Date.now()),nonce='b'.repeat(32),payload=stamp+'.'+nonce;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(e.ADMIN_PASSWORD_HASH),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signed=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('site-editor-v1:'+payload));
 const hash=Buffer.from(signed).toString('hex');
 for(const host of ['www.ronde-des-archanges-universelle.eu','ronde-des-archanges-universelle.eu']){
  const request=new Request('https://'+host+'/admin.html',
   {headers:{cookie:'celebrations_editor_access='+payload+'.'+hash}});
  assert.equal(await hasEditorAccess(request,e),true);
 }
});

test('logout clears the HttpOnly session without changing public content',()=>{
 const res=editorLogout();
 assert.equal(res.status,303);
 const cookie=res.headers.get('set-cookie')||'';
 assert.match(cookie,/HttpOnly/);
 assert.match(cookie,/Secure/);
 assert.match(cookie,/Max-Age=0/);
});

test('the login form never discloses the private verifier or password salt',async()=>{
 const e=fakeEnv(),r=await editorLoginPage(req('/admin.html'),e),html=await r.text();
 assert.match(html,/Administration/);
 assert.doesNotMatch(html,/e84a7dc7085d9c/);
 assert.doesNotMatch(html,/c16cde110a7/);
});

test('missing server signing secret fails closed',async()=>{
 const e=fakeEnv();delete e.ADMIN_PASSWORD_HASH;
 const page=await editorLoginPage(req('/admin.html'),e);
 assert.equal(page.status,503);
 assert.equal((await editorAccessAction(formReq('0'),e)).status,503);
});
