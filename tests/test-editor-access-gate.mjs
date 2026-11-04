// Access gate acceptance checks: visitor content stays public, editing requires a signed cookie.
// HMAC-SHA256 sessions are verified only by the server.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../migration/cloudflare/production-worker.mjs';
import {editorLoginPage,hasEditorAccess,editorAccessAction,editorLogout} from '../migration/cloudflare/editor-site-access.mjs';
import {handleServerDraft} from '../migration/cloudflare/editor-server-draft-api.mjs';

const origin='https://www.ronde-des-archanges-universelle.eu';
const fakeEnv=()=>({
 ADMIN_PASSWORD_HASH:'a'.repeat(64),
 DB:{prepare(query){return {
  bind(...args){return {first:async()=>null,run:async()=>({success:true})}},
  first:async()=>null
 }}}
});
const req=(path,init={})=>new Request(origin+path,init);

test('unauthenticated public administration URL shows only a code form, not editor data',async()=>{
 const e=fakeEnv();
 for(const path of ['/admin','/admin.html','/__editor/demo-preparation?celebration=101']){
  const r=await worker.fetch(req(path),e);
  assert.equal(r.status,200);
  assert.match(r.headers.get('cache-control'),/no-store/);
  assert.match(r.headers.get('x-robots-tag'),/noindex/);
  const html=await r.text();
  assert.match(html,/Code d’accès/);
  assert.match(html,/<form action="\/api\/editor-access" method="post">/);
  assert.ok(!html.includes('window.__PREPARATION_SEED__'));
  assert.ok(!html.includes('SERVER_ENDPOINT'));
 }
});

test('official server draft cannot be changed through raw API without code session',async()=>{
 const e={...fakeEnv(),EDITOR_BUCKET:{},MEDIA_BUCKET:{}};
 const data={celebration:'101',expectedRevision:0,record:{pages:[]},plans:[],shared:{pages:[],homeId:''}};
 const response=await worker.fetch(req('/api/editor-open-draft',{
  method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(data)
 }),e);
 assert.equal(response.status,401);
 const direct=await handleServerDraft(req('/api/editor-open-draft',{
  method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(data)
 }),e);
 assert.equal(direct.status,401);
});

test('login endpoint does not accept cross-origin PIN submissions',async()=>{
 const e=fakeEnv();
 const r=await editorAccessAction(req('/api/editor-access',{
  method:'POST',headers:{origin:'https://attacker.example','content-type':'application/x-www-form-urlencoded'},
  body:'code=invalid'
 }),e);
 assert.equal(r.status,403);
});

test('wrong code produces generic error and does not create an editor cookie',async()=>{
 const e=fakeEnv();
 const page=editorLoginPage(req('/admin.html'));
 const html=await page.text();
 const code=html.match(/name="_csrf" value="([a-f0-9]{64})"/)?.[1];
 assert.ok(code);
 const r=await editorAccessAction(req('/api/editor-access',{
  method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded',
    cookie:'celebrations_editor_form='+code},
  body:new URLSearchParams({_csrf:code,code:'invalid'})
 }),e);
 assert.equal(r.status,303);
 assert.equal(r.headers.get('set-cookie'),null);
 assert.match(r.headers.get('location'),/erreur=1/);
});

test('privacy browser form without Origin is accepted for code validation',async()=>{
 const page=editorLoginPage(req('/admin.html'));
 const html=await page.text(),csrf=html.match(/name="_csrf" value="([a-f0-9]{64})"/)?.[1];
 assert.ok(csrf);
 const r=await editorAccessAction(req('/api/editor-access',{method:'POST',
  headers:{cookie:'celebrations_editor_form='+csrf,'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({_csrf:csrf,code:'incorrect'})
 }),fakeEnv());
 assert.equal(r.status,303);
 assert.match(r.headers.get('location')||'',/erreur/);
});

test('www form redirected to apex is accepted, but an invalid token is rejected',async()=>{
 const page=editorLoginPage(req('/admin.html'));
 const html=await page.text(),csrf=html.match(/name="_csrf" value="([a-f0-9]{64})"/)?.[1];
 assert.ok(csrf);
 const headers={origin:'https://ronde-des-archanges-universelle.eu',
  cookie:'celebrations_editor_form='+csrf,'content-type':'application/x-www-form-urlencoded'};
 const allowed=await editorAccessAction(req('/api/editor-access',{method:'POST',headers,
  body:new URLSearchParams({_csrf:csrf,code:'incorrect'})}),fakeEnv());
 assert.equal(allowed.status,303);
 const denied=await editorAccessAction(req('/api/editor-access',{method:'POST',headers,
  body:new URLSearchParams({_csrf:'0'.repeat(64),code:'incorrect'})}),fakeEnv());
 assert.equal(denied.status,403);
});

test('fabricated cookies cannot bypass the editor gate',async()=>{
 const e=fakeEnv();
 const fake=String(Date.now())+'.'+'a'.repeat(32)+'.'+'b'.repeat(64);
 assert.equal(await hasEditorAccess(req('/admin.html',{headers:{cookie:'celebrations_editor_access='+fake}}),e),false);
 assert.equal(await hasEditorAccess(req('/admin.html'),e),false);
 assert.equal(await hasEditorAccess(new Request('https://attacker.example/admin.html'),e),false);
});

test('logout clears protected HttpOnly session cookie',()=>{
 const res=editorLogout();
 assert.equal(res.status,303);
 const cookie=res.headers.get('set-cookie')||'';
 assert.match(cookie,/HttpOnly/);
 assert.match(cookie,/Secure/);
 assert.match(cookie,/Max-Age=0/);
});

test('login page contains no access verifier or raw expected code',async()=>{
 const r=editorLoginPage(req('/admin.html'));
 const html=await r.text();
 assert.match(html,/Administration/);
 assert.doesNotMatch(html,/e84a7dc7085d9c/);
 assert.doesNotMatch(html,/c16cde110a7/);
});
