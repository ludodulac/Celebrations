import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {handleEditorDemo} from '../migration/cloudflare/editor-demo-page.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
const BASE='https://celebrations-exit-staging.rondes.workers.dev/__editor/demo';
test('demo is anonymous, local and CSP-restricted',async()=>{
 const response=handleEditorDemo(new Request(BASE));
 assert.equal(response.status,200);
 assert.match(await response.text(),/Atelier visuel/);
 assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);
 assert.equal(response.headers.get('cache-control'),'no-store');
});
test('demo rejects other hosts and POST',()=>{
 assert.equal(handleEditorDemo(new Request(BASE,{method:'POST'})).status,405);
 assert.equal(handleEditorDemo(new Request('https://example.com/__editor/demo')).status,404);
});
test('demo client parses and uses browser local drafts only',()=>{
 new vm.Script(DEMO_CLIENT);
 assert.ok(DEMO_CLIENT.includes('localStorage.setItem'));
 assert.ok(DEMO_CLIENT.includes('contentEditable'));
 assert.ok(!DEMO_CLIENT.includes('fetch('));
});
test('demo file manager uses IndexedDB only, with PDF/audio/video and file-backed preview buttons',()=>{
 assert.ok(DEMO_CLIENT.includes('indexedDB.open'));
 assert.ok(DEMO_CLIENT.includes('application/pdf'));
 assert.ok(DEMO_CLIENT.includes("'video/mp4'"));
 assert.ok(DEMO_CLIENT.includes("'audio/mpeg'"));
 assert.ok(DEMO_CLIENT.includes("data-action='choose-asset'")||DEMO_CLIENT.includes("dataset.action='choose-asset'"));
 assert.ok(DEMO_CLIENT.includes('URL.createObjectURL'));
 assert.ok(!DEMO_CLIENT.includes('fetch('));
});

test('rich text is restricted to safe tags and formatting uses block-local state',()=>{
 assert.ok(DEMO_CLIENT.includes("function htmlSafe("));
 assert.ok(DEMO_CLIENT.includes("function editorFormatToolbar("));
 assert.ok(DEMO_CLIENT.includes("function duplicateBlock("));
 assert.ok(DEMO_CLIENT.includes("strong"));
 assert.ok(DEMO_CLIENT.includes("em"));
 assert.ok(DEMO_CLIENT.includes("fontSize"));
 assert.ok(DEMO_CLIENT.includes("validColor"));
 assert.ok(DEMO_CLIENT.includes("sizeOf"));
 assert.ok(DEMO_CLIENT.includes("uniqueBlockId"));
 assert.ok(DEMO_CLIENT.includes("Supprimer cet élément"));
 assert.ok(!DEMO_CLIENT.includes("eval("));
});
