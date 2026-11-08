// M15: prove removed editor prototype handlers are unreachable,
// while preserving actual legacy route files and published site contracts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import production from '../migration/cloudflare/production-worker.mjs';
import staging from '../migration/cloudflare/staging-worker.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {DEMO_CSS} from '../migration/cloudflare/editor-demo-style.mjs';
import {TRIAL_SITE_CLIENT,TRIAL_SITE_STYLE} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {handleEditorDemo} from '../migration/cloudflare/editor-demo-page.mjs';
import {handleEditorMediaFile} from '../migration/cloudflare/editor-publication-api.mjs';

const BASE='5e0155b3d816f8ac6f2912a1d202955b315bf005';
const OLD=[
 'attachFile','deleteSelectedImages','historicalUnused','insertBlockAtTime',
 'showInsertDialog','attachPublicAudio','attachCloudAudio','audioWorkbench'
];
const originalBlobShas={
 'migration/cloudflare/production-worker.mjs':'a96575252b5702b18e6917730372d4f991d2767c',
 'migration/cloudflare/staging-worker.mjs':'b759666229dca2fcfc2f98de59324bdff8a33cee',
 'migration/cloudflare/legacy-link-router.mjs':'926b3a776f18271036f22b9058a73ae7f439f604',
 'migration/cloudflare/media-gateway.mjs':'a833e679190a0b6a1aade7dabc8b49c33a339408',
 'migration/cloudflare/editor-demo-page.mjs':'9f91ec14e60ef6637fbf4747dd813029c68768eb',
 'migration/cloudflare/editor-e2a-access-recovery.mjs':'26b535ed294fa83a2bc39cc5a85c8b3187042268',
 'migration/cloudflare/editor-trial-site-client.mjs':'5ee471ed75952b6c2f78aaba323e1cceea7b689d',
 'migration/cloudflare/editor-publication-api.mjs':'b7166bec93bd875741a25ae86450ccf6c427ac29',
 'migration/cloudflare/editor-server-draft-api.mjs':'2b4e381ee83416f5f1ed4645f078ec493f4e4a5d',
 'migration/cloudflare/editor-server-sync-client.mjs':'61ab92c0f11c8c6709aa747048f6fea769caf324',
 'migration/cloudflare/editor-demo-preparation-page.mjs':'0f312ef00223f42bf7145cda839e2ad4df618bbd',
 'migration/cloudflare/editor-trial-site-page.mjs':'9a516fb30b3f9046d1c3b52a3fdaa36f64b25a3f'
};
const blobSha=p=>{
 const buffer=readFileSync(p);
 return createHash('sha1').update('blob '+buffer.length+'\0').update(buffer).digest('hex');
};
test('M15: generated editor remains syntactically valid and old dead handlers are absent',()=>{
 new Script(DEMO_CLIENT);
 new Script(TRIAL_SITE_CLIENT);
 assert.equal(OLD.length,8);
 for(const name of OLD){
  assert.doesNotMatch(DEMO_CLIENT,new RegExp('\\b(?:async\\s+)?function\\s+'+name+'\\s*\\('),name);
 }
 assert.ok(DEMO_CLIENT.includes('function chooseFile(x){'),'real file chooser remains');
 assert.ok(DEMO_CLIENT.includes('function savedPageSets(){'),'media source analysis remains');
 assert.ok(DEMO_CLIENT.includes('function media(){'),'global library still renders');
 assert.ok(DEMO_CLIENT.includes('function pageWorkspace(group,mount=w){'),'editor still renders pages');
 assert.ok(DEMO_CLIENT.includes('editorDragModel.intoBlock('),'drag/drop remains');
 assert.ok(DEMO_CLIENT.includes('editorUndoPolicy.record('),'Undo remains');
 assert.ok(DEMO_CLIENT.includes('function cloudAudioUsages(key){'),'active media inventory remains');
 assert.ok(DEMO_CLIENT.includes('function userGuide(){'),'public admin guide remains');
 assert.ok(DEMO_CSS.includes('.media-unused-ribbon'),'media appearance unchanged');
 assert.ok(TRIAL_SITE_STYLE.includes('.trial-video-title'),'public appearance unchanged');
});
test('M15: no dangling prototype calls or single-use function declarations',()=>{
 const raw=readFileSync('migration/cloudflare/editor-demo-client.mjs','utf8');
 const match=raw.match(/export const DEMO_CLIENT=("(?:\\.|[^"\\])*")\+EDITOR_MODULES\+("(?:\\.|[^"\\])*")\+SERVER_EDITOR_SYNC\+("(?:\\.|[^"\\])*");\s*$/s);
 assert.ok(match,'editor module composition remains unchanged');
 const content=match.slice(1).map(JSON.parse).join('\n');
 for(const name of OLD){
  assert.doesNotMatch(content,new RegExp('\\b(?:async\\s+)?function\\s+'+name+'\\s*\\('));
  assert.equal((content.match(new RegExp('\\b'+name+'\\s*\\(','g'))||[]).length,0,
   'no stale invocation of '+name);
 }
 const declarations=[...content.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([_$A-Za-z][_$\w]*)\s*\(/g)]
  .map(x=>x[1]);
 assert.ok(declarations.length>=140);
 const orphans=declarations.filter(name=>
  (content.match(new RegExp('\\b'+name+'\\b','g'))||[]).length===1);
 assert.deepEqual(orphans,[],'no script function is declaration-only');
});
test('M15: 12 critical legacy route and public-media sources are byte-identical to M14',()=>{
 assert.equal(Object.keys(originalBlobShas).length,12);
 for(const [path,sha] of Object.entries(originalBlobShas))
  assert.equal(blobSha(path),sha,'legacy/route source changed unexpectedly: '+path);
});
test('M15: disconnected former demo module is RETAINED as compatibility entry',async()=>{
 const origin='https://celebrations-exit-staging.rondes.workers.dev';
 const direct=handleEditorDemo(new Request(origin+'/__editor/demo'));
 assert.equal(direct.status,200);
 assert.ok((await direct.text()).includes('Atelier visuel'));
 assert.equal(handleEditorDemo(new Request('https://other.example/__editor/demo')).status,404);
 const actual=await staging.fetch(new Request(origin+'/__editor/demo'),{});
 assert.equal(actual.status,302);
 assert.equal(new URL(actual.headers.get('location')).pathname,'/__editor/demo-preparation');
});
test('M15: historic staging routes, prepared pages and asset fallback remain untouched',async()=>{
 const routeCode=readFileSync('migration/cloudflare/staging-worker.mjs','utf8');
 for(const route of ['/__editor/demo-preparation','/__editor/voir-le-site',
  '/__editor/edit','/__editor/e1-client.js','/api/editor-open-draft',
  '/api/editor-server-draft','/api/editor-trial-audio','/api/editor-e1',
  '/__editor/preview','/__editor/access','/api/editor-publication'])
  assert.ok(routeCode.includes('"'+route+'"'),'legacy staging route removed: '+route);
 let served=0;
 const env={ASSETS:{async fetch(req){
  served++;return new Response('Fichier statique historique',{status:200});
 }}};
 const r=await staging.fetch(new Request(
  'https://celebrations-exit-staging.rondes.workers.dev/un-chemin-historique'),env);
 assert.equal(r.status,200);
 assert.equal(await r.text(),'Fichier statique historique');
 assert.equal(served,1);
 const denied=await staging.fetch(new Request(
  'https://celebrations-exit-staging.rondes.workers.dev/api/editor-open-draft',{
    method:'POST',body:'{}'}),env);
 assert.equal(denied.status,403,'legacy staging read-only write behaviour preserved');
});
test('M15: official Worker keeps static fallback and read-only candidate restrictions',async()=>{
 let count=0;
 const env={ASSETS:{async fetch(req){
  count++;return new Response('Page historique conservée',{status:200});
 }}};
 const unknown=await production.fetch(new Request('https://legacy-candidate.invalid/ancienne-page'),env);
 assert.equal(unknown.status,200);
 assert.equal(await unknown.text(),'Page historique conservée');
 assert.equal(count,1);
 const trial=await production.fetch(new Request(
  'https://celebrations-visual-candidate.rondes.workers.dev/admin.html'),env);
 assert.equal(trial.status,404,'M14 preview/private route boundary survives cleanup');
 assert.equal(count,1);
 const home=await production.fetch(new Request(
  'https://celebrations-exit-production.rondes.workers.dev/robots.txt'),env);
 assert.equal(home.status,200);
 assert.match(await home.text(),/Disallow:\s*\//);
});
test('M15: new-media GET and HEAD still use the original EDITOR_BUCKET key and mime',async()=>{
 const id='123e4567-e89b-42d3-a456-426614174000.png';
 const expected='editor-trials/uploads/'+id;
 let requested=[];
 const bucket={async get(key){requested.push(key);
  assert.equal(key,expected);
  return {body:new Uint8Array([137,80,78,71]),httpMetadata:{contentType:'image/png'}};
 }};
 for(const method of ['GET','HEAD']){
  const response=await handleEditorMediaFile(new Request(
   'https://www.ronde-des-archanges-universelle.eu/media/new/'+id,
   {method}),{EDITOR_BUCKET:bucket});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('content-type'),'image/png');
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  const bytes=new Uint8Array(await response.arrayBuffer());
  assert.deepEqual([...bytes],method==='GET'?[137,80,78,71]:[]);
 }
 assert.deepEqual(requested,[expected,expected]);
});
test('M15: no production Worker, staging Worker or legacy media module is removed from manifest',()=>{
 assert.match(BASE,/^[a-f0-9]{40}$/);
 const productionCode=readFileSync('migration/cloudflare/production-worker.mjs','utf8');
 const stagingCode=readFileSync('migration/cloudflare/staging-worker.mjs','utf8');
 for(const module of ['legacy-link-router.mjs','media-gateway.mjs'])
  assert.ok(productionCode.includes(module),'legacy public import dropped '+module);
 for(const module of ['editor-d-preview.mjs','editor-e1-api.mjs','editor-d4-access.mjs',
  'editor-permanent-access.mjs','editor-trial-audio-api.mjs'])
  assert.ok(stagingCode.includes(module),'staging editor import dropped '+module);
});
