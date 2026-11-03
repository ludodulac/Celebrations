import assert from 'node:assert/strict';
import test from 'node:test';
import {handleEditorRecovery} from '../migration/cloudflare/editor-e2a-access-recovery.mjs';
import {handleEditorD4Access} from '../migration/cloudflare/editor-d4-access.mjs';

const HOST='https://celebrations-exit-staging.rondes.workers.dev';
test('E2A-ACCESS recovery is private, CSP protected and keeps exact approved key only',async()=>{
 for(const key of ['home','celebration:101:step:Mercredi']){
  const r=handleEditorRecovery(new Request(HOST+'/__editor/edit?key='+encodeURIComponent(key)),key);
  assert.equal(r.status,401);
  assert.match(r.headers.get('content-type'),/text\/html/);
  assert.equal(r.headers.get('cache-control'),'no-store');
  assert.match(r.headers.get('content-security-policy'),/script-src 'nonce-/);
  const body=await r.text();
  assert.match(body,/Se reconnecter/);
  assert.ok(body.includes('/__editor/access?return='+encodeURIComponent(key)));
  assert.ok(!body.includes('Preview requires authorized staging access'));
  assert.ok(!body.includes('celebrations-admin-token='));
  assert.ok(!body.includes('window.CELEBRATIONS_'));
 }
 assert.equal(handleEditorRecovery(new Request(HOST+'/__editor/edit?key=home'),'https://evil.example').status,404);
 assert.equal(handleEditorRecovery(new Request('https://evil.example/__editor/edit?key=home'),'home').status,404);
});
test('E2A-ACCESS original D4 form remains guarded and has safe return-to-editor logic',async()=>{
 const r=await handleEditorD4Access(new Request(HOST+'/__editor/access?return=home'));
 assert.equal(r.status,200);
 const body=await r.text();
 assert.match(body,/celebrations-admin-token/);
 assert.match(body,/\['home','celebration:101:step:Mercredi'\]/);
 assert.match(body,/\/__editor\/session/);
 assert.ok(!body.includes('ADMIN_D4_ACCESS_HASH'));
 assert.equal(r.headers.get('cache-control'),'no-store');
});
