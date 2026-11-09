import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import staging from '../migration/cloudflare/staging-worker.mjs';
import candidate from '../migration/cloudflare/production-worker.mjs';

const stagingHost='https://celebrations-exit-staging.rondes.workers.dev';
const preview='https://celebrations-visual-candidate.rondes.workers.dev';
const otherCandidate='https://celebrations-exit-production.rondes.workers.dev';
const official='https://www.ronde-des-archanges-universelle.eu';
const tracked={r2:0,d1:0,asset:0,write:0};
function guardEnv(){
 for(const k in tracked)tracked[k]=0;
 const deny=(k)=>()=>{tracked[k]++;throw Error('Private access '+k)};
 const bucket={get:deny('r2'),put:deny('write'),list:deny('r2'),delete:deny('write')};
 return {DB:{prepare:deny('d1')},EDITOR_BUCKET:bucket,MEDIA_BUCKET:bucket,ASSETS:{fetch:deny('asset')}};
}
const privateRoutes=[
 '/api/editor-open-draft?celebration=101',
 '/api/editor-server-draft?celebration=101',
 '/api/editor-media',
 '/api/editor-access',
 '/api/editor-logout',
 '/api/admin',
 '/api/safe-save',
 '/api/media-admin',
 '/api/participants-admin',
 '/api/footer-admin',
 '/api/auth',
 '/api/audience',
 '/api/stats',
 '/api/editor-e1',
 '/api/editor-b',
 '/__editor/preview',
 '/__editor/session',
 '/__editor/entry',
 '/__editor/media',
 '/__editor/access/config',
 '/__editor/edit',
 '/__editor/e1-client.js',
 '/__editor/demo-preparation',
 '/admin',
 '/admin.html',
 '/media/new/12345678-1234-4234-8234-123456789abc.jpg'
];
test('M2: obsolete staging private/admin GET returns 404 before any D1/R2/static asset read',async()=>{
 const env=guardEnv();
 for(const path of privateRoutes){
  const res=await staging.fetch(new Request(stagingHost+path),env);
  assert.equal(res.status,404,path);
  assert.equal(res.headers.get('cache-control'),'no-store');
  assert.match(res.headers.get('x-robots-tag')||'',/noindex/);
  assert.equal(res.headers.get('x-content-type-options'),'nosniff');
 }
 assert.deepEqual(tracked,{r2:0,d1:0,asset:0,write:0});
});
test('M2: obsolete staging cannot mutate anything through HTTP verbs',async()=>{
 const env=guardEnv();
 for(const method of ['POST','PUT','PATCH','DELETE']){
  for(const path of ['/api/editor-open-draft','/api/admin','/api/media-admin','/api/editor-publication','/media/new/12345678-1234-4234-8234-123456789abc.jpg']){
   const req=new Request(stagingHost+path,{method,headers:{origin:stagingHost}});
   const res=await staging.fetch(req,env);
   assert.equal(res.status,405,method+' '+path);
  }
 }
 assert.deepEqual(tracked,{r2:0,d1:0,asset:0,write:0});
});
test('M2: public-only candidates cannot read private APIs or unpublished upload URLs',async()=>{
 for(const host of [preview,otherCandidate]){
  const env=guardEnv();
  for(const path of privateRoutes){
   const res=await candidate.fetch(new Request(host+path),env);
   assert.equal(res.status,404,host+path);
  }
  assert.deepEqual(tracked,{r2:0,d1:0,asset:0,write:0});
 }
});
test('M2: only real official domains retain the original admin route and login semantics',()=>{
 const stagingCode=staging.fetch.toString(),candidateCode=candidate.fetch.toString();
 assert.ok(stagingCode.includes("obsoleteStaging"));
 assert.ok(candidateCode.includes("isReadonlyCandidateHost"));
 assert.ok(candidateCode.includes("const officialHost"));
 assert.ok(candidateCode.includes("hasEditorAccess"));
 assert.ok(!stagingCode.includes("celebrations-exit-production.rondes.workers.dev"));
 assert.ok(!candidateCode.includes("npx wrangler"));
});

test('M2: future production publish keeps workers.dev OFF while visual candidate stays reachable',()=>{
 const workflow=readFileSync('.github/workflows/celebrations-publish-visual-site-once.yml','utf8');
 const candidate=workflow.indexOf('migration/cloudflare/wrangler.production.toml > migration/cloudflare/wrangler.visual.toml');
 const secure=workflow.indexOf("sed -i 's/^workers_dev = true$/workers_dev = false/' migration/cloudflare/wrangler.production.toml");
 const deploy=workflow.indexOf('npx wrangler deploy --config wrangler.production.toml --keep-vars');
 assert.ok(candidate>0,'candidate should be generated before separate official config');
 assert.ok(secure>candidate,'official config must be locked down only after candidate derived');
 assert.ok(deploy>secure,'official deploy must use disabled workers.dev config');
 assert.ok(workflow.includes("grep -Fx 'preview_urls = false' migration/cloudflare/wrangler.production.toml"));
 assert.ok(workflow.includes("grep -Fx 'workers_dev = true' migration/cloudflare/wrangler.visual.toml"));
});
