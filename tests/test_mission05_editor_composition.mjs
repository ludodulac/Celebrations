import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {SERVER_EDITOR_SYNC} from '../migration/cloudflare/editor-server-sync-client.mjs';

const adapter=readFileSync('migration/cloudflare/editor-demo-preparation-page.mjs','utf8');
const actualSources=[
 'migration/cloudflare/editor-demo-client.mjs',
 'migration/cloudflare/editor-demo-preparation-page.mjs'
];
test('stage editor is a single explicitly composed program rather than string-patched runtime JavaScript',()=>{
 new vm.Script(DEMO_CLIENT,{filename:'editor-composed.mjs'});
 assert.equal(adapter.includes('const client=DEMO_CLIENT;'),true);
 assert.equal(adapter.includes('.replace("function mark(){'),false);
 assert.equal(adapter.includes('.replace("render();loadFiles();'),false);
 assert.equal(adapter.includes('.replace("let tab='),false);
 assert.equal(adapter.includes('const client=DEMO_CLIENT\n   .replace('),false);
 assert.equal((DEMO_CLIENT.match(/async function serverSave\(/g)||[]).length,1);
 assert.equal((DEMO_CLIENT.match(/async function serverLoad\(/g)||[]).length,1);
 assert.ok(DEMO_CLIENT.includes(SERVER_EDITOR_SYNC));
});
test('explicit editor stage mode still preserves page merging and historic existing IDs',()=>{
 assert.ok(DEMO_CLIENT.includes('if(STAGE_SEED)seed.pages=STAGE_SEED.pages'));
 assert.ok(DEMO_CLIENT.includes('for(const archived of seed.pages)'));
 assert.ok(DEMO_CLIENT.includes("if(!db.pages.some(p=>p.id===archived.id))"));
 assert.ok(DEMO_CLIENT.includes("if(IS_STAGE)await serverLoad()"));
 assert.ok(DEMO_CLIENT.includes("const KEY=STAGE_SEED?'celebrations-demo-preparation-'"));
 assert.ok(DEMO_CLIENT.includes('stageActive?.id'));
});
test('server persistence remains explicitly conditional and user-triggered',()=>{
 assert.match(DEMO_CLIENT,/serverLocalEditCounter\+\+/);
 assert.match(DEMO_CLIENT,/db\._serverPending=true/);
 assert.match(DEMO_CLIENT,/IS_STAGE\?\(\)=>\{save\(\);void serverSave\(\);\}/);
 assert.ok(DEMO_CLIENT.includes("const see=document.getElementById('view-site-btn')"));
 assert.ok(DEMO_CLIENT.includes("see.hidden=stateOfPage(current)!=='published'"));
 assert.ok(DEMO_CLIENT.includes("if(dirty||(IS_STAGE&&(db._serverPending||serverSaving)))"));
});
test('important page deletion and undo guards are preserved',()=>{
 assert.ok(DEMO_CLIENT.includes("async function removeCustomPage(q)"));
 assert.ok(DEMO_CLIENT.includes("if(stateOfPage(q)==='published')"));
 assert.ok(DEMO_CLIENT.includes("serverPublish({kind:'page',pageId:q.id,visibility:'hidden'})"));
 assert.ok(DEMO_CLIENT.includes("deletedPageIds:deleted"));
 assert.ok(DEMO_CLIENT.includes("function undoLastEditorAction()"));
 assert.ok(DEMO_CLIENT.includes("void serverSave()"));
});
test('demo mode stays available and does not issue stage network requests',()=>{
 assert.ok(DEMO_CLIENT.includes("const IS_STAGE=!!STAGE_SEED"));
 assert.ok(DEMO_CLIENT.includes("if(IS_STAGE)await serverLoad();"));
 assert.ok(DEMO_CLIENT.includes("'celebrations-demo-editor-v1'"));
 assert.ok(DEMO_CLIENT.includes("el('save-btn').onclick=IS_STAGE?"));
});
test('staging PDF, video and paragraph editor actions have not been stripped',()=>{
 for(const term of ["Choisir une vidéo du site","file-picker-dialog",
  "function block(","saveRich(","section-add-blue","section-add-green"])
  assert.ok(DEMO_CLIENT.includes(term),term);
});
