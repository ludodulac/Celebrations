import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 activeDeployment,checkReleaseEvidence,exactRollbackPlan,
 OFFICIAL_WORKER,EDITOR_BUCKET,EDITOR_OBJECT,SCHEMA
} from '../migration/cloudflare/app/release/editor-release-policy.mjs';
import {captureActiveWorker,endpoint} from '../scripts/mission16_capture_worker_readonly.mjs';
import {verifyLivePreflight} from '../scripts/mission16_release_preflight_readonly.mjs';
import {REGRESSION_FILES,assertMatrix} from '../scripts/mission16_editor_regressions.mjs';

const NOW=Date.parse('2026-11-08T19:00:00.000Z');
const ago=minutes=>new Date(NOW-minutes*60000).toISOString();
const uuid=n=>n.repeat(8)+'-'+n.repeat(4)+'-'+n.repeat(4)+'-'+n.repeat(4)+'-'+n.repeat(12);
const previous=uuid('a'),active=uuid('b'),candidate=uuid('c');
const previousDeployment=uuid('d'),candidateDeployment=uuid('e');
const observed={script:OFFICIAL_WORKER,deploymentId:previousDeployment,versionId:previous,
 observedAt:ago(1)};
const deepCopy=x=>JSON.parse(JSON.stringify(x));
const evidence=()=>({
 schema:SCHEMA,candidateCommit:'f'.repeat(40),source:'synthetic-test',
 collectedAt:ago(2),ownerReleaseApproval:true,
 worker:{script:OFFICIAL_WORKER,deploymentId:previousDeployment,versionId:previous,
  rollbackTestOnIsolatedCandidate:true,isolatedCandidateVersionId:candidate,
  originalBundleSha256:'a'.repeat(64),isolatedRestoredBundleSha256:'a'.repeat(64),
  rehearsedAt:ago(9)},
 editor:{bucket:EDITOR_BUCKET,sourceKey:EDITOR_OBJECT,revision:115,
  sourceSha256:'b'.repeat(64),restoredSha256:'b'.repeat(64),
  encryptedBackupSha256:'c'.repeat(64),independentBackupSha256:'c'.repeat(64),
  immutableArchive:true,archiveReadbackVerified:true,etagUnchanged:true,
  offCloudflareReadbackVerified:true,offCloudflareProvider:'Independent storage provider',
  backedUpAt:ago(12)},
 d1:{database:'celebrations-exit-production',exportSha256:'d'.repeat(64),
  restoredExportSha256:'d'.repeat(64),schemaAndDataExport:true,
  restoredInIsolatedSqlite:true,sqliteIntegrity:'ok',foreignKeyViolations:0,
  tableCounts:[{table:'celebrations',source:5,restored:5},
   {table:'media_acl',source:17,restored:17}],
  allTablesIncluded:true,offCloudflareCopyRestored:true,exportedAt:ago(19)},
 media:{referencedObjects:129,recoveredObjects:129,offCloudflareCopies:129,
  verifiedSha256Objects:129,includesHistoricMedia:true,
  includesEditorUploads:true,pathsPreserved:true,
  manifestSha256:'e'.repeat(64),restoredManifestSha256:'e'.repeat(64),
  copiedAt:ago(18)}
});
const synthetic=e=>checkReleaseEvidence(e,observed,{allowSynthetic:true,now:NOW});
const refuses=(mutate,label)=>test('M16 BLOCK: '+label,()=>{
 const e=evidence();mutate(e);
 assert.throws(()=>synthetic(e),/^Error: M16_BLOCK:/);
});
test('M16: Cloudflare deployment GET must identify exactly one active version at 100%',()=>{
 const output={success:true,result:{deployments:[{id:previousDeployment,
  created_on:ago(1),versions:[{percentage:100,version_id:previous}]}]}};
 assert.deepEqual(activeDeployment(output),{script:OFFICIAL_WORKER,
  deploymentId:previousDeployment,versionId:previous,createdAt:ago(1)});
 for(const bad of [null,{}, {success:false}, {success:true,result:{deployments:[]}},
  {success:true,result:{deployments:[{id:previousDeployment,versions:[]}]}},
  {success:true,result:{deployments:[{id:previousDeployment,versions:[
   {percentage:40,version_id:previous},{percentage:60,version_id:active}]}]}},
  {success:true,result:{deployments:[{id:previousDeployment,versions:[
   {percentage:99,version_id:previous}]}]}},
  {success:true,result:{deployments:[{id:'old',versions:[
   {percentage:100,version_id:previous}]}]}}
 ])assert.throws(()=>activeDeployment(bad),/M16_BLOCK/);
});
test('M16: real release checker rejects synthetic CI evidence regardless of contents',()=>{
 assert.throws(()=>checkReleaseEvidence(evidence(),observed,{now:NOW}),/M16_BLOCK/);
 const result=synthetic(evidence());
 assert.equal(result.status,'SYNTHETIC_CONTRACT_ONLY');
 assert.equal(result.editorRevision,115);
 assert.equal(result.rollbackVersionId,previous);
 assert.equal(result.mediaCount,129);
 assert.equal(result.d1Tables,2);
});
refuses(e=>{e.candidateCommit='unknown'},'unidentified candidate commit');
refuses(e=>{e.collectedAt=ago(40)},'stale audit');
refuses(e=>{e.worker.versionId=active},'live Worker version drift');
refuses(e=>{e.worker.deploymentId=candidateDeployment},'live Worker deployment drift');
refuses(e=>{e.worker.originalBundleSha256='f'.repeat(64)},'different original Worker bytes');
refuses(e=>{e.worker.isolatedCandidateVersionId=previous},'candidate ID reused as original');
refuses(e=>{e.worker.rollbackTestOnIsolatedCandidate=false},'no actual isolated candidate');
refuses(e=>{e.worker.rehearsedAt=ago(60*25)},'old Worker rehearsal');
refuses(e=>{e.editor.sourceKey='different'},'wrong editor key');
refuses(e=>{e.editor.revision=0},'missing editor revision');
refuses(e=>{e.editor.restoredSha256='0'.repeat(64)},'editor JSON backup differs');
refuses(e=>{e.editor.independentBackupSha256='0'.repeat(64)},'offsite backup not identical');
refuses(e=>{e.editor.offCloudflareProvider='Cloudflare R2'},'not independent of Cloudflare');
refuses(e=>{e.editor.offCloudflareReadbackVerified=false},'offsite backup not read back');
refuses(e=>{e.editor.etagUnchanged=false},'editor updated during backup');
refuses(e=>{e.editor.backedUpAt=ago(1441)},'stale backup');
refuses(e=>{e.d1.restoredInIsolatedSqlite=false},'no SQLite restore');
refuses(e=>{e.d1.foreignKeyViolations=3},'D1 foreign key violations');
refuses(e=>{e.d1.tableCounts[0].restored=4},'D1 restored row count mismatch');
refuses(e=>{e.d1.tableCounts.push({...e.d1.tableCounts[0]})},'duplicate D1 tables');
refuses(e=>{e.d1.allTablesIncluded=false},'missing D1 table');
refuses(e=>{e.d1.offCloudflareCopyRestored=false},'missing independent D1 restore');
refuses(e=>{e.media.recoveredObjects=128},'lost binary media object');
refuses(e=>{e.media.offCloudflareCopies=128},'missing offsite binary');
refuses(e=>{e.media.verifiedSha256Objects=128},'unverified media hash');
refuses(e=>{e.media.includesEditorUploads=false},'missing new media');
refuses(e=>{e.media.includesHistoricMedia=false},'missing historic media');
refuses(e=>{e.media.pathsPreserved=false},'broken historical URL');
refuses(e=>{e.media.restoredManifestSha256='0'.repeat(64)},'media manifest mismatch');
refuses(e=>{e.ownerReleaseApproval=false},'no explicit owner release approval');
test('M16: mock Cloudflare metadata GET never performs mutation',async()=>{
 const calls=[];
 const data={success:true,result:{deployments:[{id:previousDeployment,
  created_on:ago(1),versions:[{version_id:previous,percentage:100}]}]}};
 const fetcher=async(url,options)=>{calls.push({url,options});
  return {ok:true,async json(){return deepCopy(data)}}};
 const result=await captureActiveWorker({account:'0'.repeat(32),token:'secret-do-not-print',
  fetcher,now:()=>ago(1)});
 assert.equal(result.versionId,previous);
 assert.equal(result.deploymentId,previousDeployment);
 assert.equal(result.observedAt,ago(1));
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,endpoint('0'.repeat(32)));
 assert.equal(calls[0].options.method,'GET');
 assert.equal(calls[0].options.redirect,'error');
 assert.equal(calls[0].options.cache,'no-store');
 assert.equal(calls[0].options.headers.Authorization,'Bearer secret-do-not-print');
 assert.equal(JSON.stringify(result).includes('secret-do-not-print'),false);
 await assert.rejects(captureActiveWorker({account:'not-id',token:'token',fetcher}),/M16_BLOCK/);
 await assert.rejects(captureActiveWorker({account:'0'.repeat(32),token:'token',
  fetcher:async()=>({ok:false})}),/M16_BLOCK/);
});
test('M16: live preflight rejects fixture source even with matching Worker GET',async()=>{
 const payload={success:true,result:{deployments:[{id:previousDeployment,
  versions:[{version_id:previous,percentage:100}]}]}};
 const fetcher=async()=>({ok:true,async json(){return payload}});
 await assert.rejects(verifyLivePreflight(evidence(),{
  account:'1'.repeat(32),token:'local-fake',fetcher,now:NOW}),/M16_BLOCK/);
});
test('M16: simulate approved rollback plan ONLY if previous ID and failed new live ID match',()=>{
 const plan=exactRollbackPlan({previous:observed,
  afterFailedDeploy:{script:OFFICIAL_WORKER,versionId:active},
  expectedNewVersionId:active,ownerApproved:true});
 assert.deepEqual(plan.args.slice(0,5),
  ['wrangler','rollback',previous,'--name',OFFICIAL_WORKER]);
 assert.ok(plan.args.includes('--message'));
 assert.equal(plan.expectedActiveVersionAfter,previous);
 const options={previous:observed,
  afterFailedDeploy:{script:OFFICIAL_WORKER,versionId:active},
  expectedNewVersionId:active,ownerApproved:true};
 for(const invalid of [{ownerApproved:false},{expectedNewVersionId:previous},
  {afterFailedDeploy:{script:OFFICIAL_WORKER,versionId:candidate}},
  {previous:{script:'other',versionId:previous}},
  {previous:{script:OFFICIAL_WORKER,versionId:'not-valid'}}])
  assert.throws(()=>exactRollbackPlan({...options,...invalid}),/M16_BLOCK/);
});
test('M16: old publisher guard is false and obsolete rollback commit removed',()=>{
 const old=readFileSync('.github/workflows/celebrations-publish-visual-site-once.yml','utf8');
 assert.match(old,/ANCIEN PUBLISHER DÉSACTIVÉ/);
 assert.match(old,/false && contains\(github.event.head_commit.message/);
 assert.doesNotMatch(old,/git show 94affae000554942eb98880d149f758c46908ab7/);
 assert.doesNotMatch(old,/production-worker-rollback\.mjs/);
 assert.doesNotMatch(old,/wrangler\.rollback\.toml/);
 assert.doesNotMatch(old,/CELEBRATIONS_ROLLBACK_LAST_PUBLISHED_EDITOR_DEPLOYED/);
 assert.match(old,/M16: previous Worker version unverified/);
});
test('M16: no release code can execute a Cloudflare write or shell deploy',()=>{
 for(const path of ['migration/cloudflare/app/release/editor-release-policy.mjs',
  'scripts/mission16_capture_worker_readonly.mjs',
  'scripts/mission16_release_preflight_readonly.mjs']){
  const s=readFileSync(path,'utf8');
  for(const expression of [/spawnSync\(/,/execSync\(/,/fetch\([^\n]*method:\s*'POST'/,
   /wrangler deploy/])assert.doesNotMatch(s,expression,path);
 }
 assert.equal(assertMatrix(),29);
 assert.equal(REGRESSION_FILES[0],'tests/test_mission15_legacy_cleanup.mjs');
 assert.equal(REGRESSION_FILES.at(-1),'tests/test-editor-celebration-themes.mjs');
});
