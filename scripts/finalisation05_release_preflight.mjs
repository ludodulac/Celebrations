// Finalisation M5 — live release preflight, READ ONLY except Cloudflare D1 SELECT API.
// No draft payloads, secret values, private slugs, or URL paths logged.
import assert from 'node:assert/strict';
import {captureActiveWorker} from './mission16_capture_worker_readonly.mjs';
import {activeDeployment} from '../migration/cloudflare/app/release/editor-release-policy.mjs';

const ACCOUNT=process.env.CLOUDFLARE_ACCOUNT_ID||'',
 TOKEN=process.env.CLOUDFLARE_API_TOKEN||'',
 EXPECTED='cd46e1ba-e106-4f03-90aa-7110628a5b9f',
 OLD_VERSION='dcda4193-1d82-4283-9f0e-ae8a09e6a444',
 D1='28736d2a-479b-472b-bf82-703ad0affe10',
 STAGING='celebrations-exit-staging',PRODUCTION='celebrations-exit-production',
 SCRIPT='celebrations-exit-production';
assert.equal(process.env.GITHUB_REF,
 'refs/heads/release/celebrations-finalisation-05-livraison-20261109');
assert.match(ACCOUNT,/^[a-f0-9]{32}$/i);
assert.ok(TOKEN.length>=16);
assert.equal(process.env.CELEBRATIONS_PROD_D1_ID,D1);
assert.equal(process.env.CELEBRATIONS_PROD_R2_BUCKET,PRODUCTION);
assert.equal(process.env.CELEBRATIONS_STAGING_R2_BUCKET,STAGING);
const base='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
const headers={authorization:'Bearer '+TOKEN,accept:'application/json'};
async function get(url){
 const r=await fetch(url,{method:'GET',headers,redirect:'error',cache:'no-store',
   signal:AbortSignal.timeout(25000)});
 if(r.status!==200)throw Error('Cloudflare GET failed HTTP '+r.status);
 const p=await r.json();
 if(!p.success||p.result===undefined)throw Error('Cloudflare GET unsuccessful');
 return p.result;
}
const worker=await captureActiveWorker({account:ACCOUNT,token:TOKEN});
assert.equal(worker.script,SCRIPT);
assert.equal(worker.deploymentId,EXPECTED,'Live Worker changed; release freeze failed');
assert.equal(worker.versionId,OLD_VERSION,'Live Worker version changed; release freeze failed');
const old=await get(base+'/workers/scripts/'+SCRIPT+'/versions/'+OLD_VERSION);
assert.ok(old&&String(old.id||old.version_id)===OLD_VERSION,'Rollback version no longer available');
const sub=await get(base+'/workers/scripts/'+SCRIPT+'/subdomain');
assert.equal(sub.enabled,false,'Official technical workers.dev reopened');
assert.equal(sub.previews_enabled,false,'Official worker preview URLs reopened');
const domains=await get(base+'/workers/domains');
const owned=['ronde-des-archanges-universelle.eu','www.ronde-des-archanges-universelle.eu'];
assert.ok(Array.isArray(domains));
for(const domain of owned){
 const found=domains.find(x=>x.hostname===domain);
 assert.equal(found?.service,SCRIPT,'Domain no longer mapped to official Worker');
}
const settings=await get(base+'/workers/scripts/'+SCRIPT+'/settings');
const bindings=settings.bindings||[];
for(const [name,type] of [
 ['ADMIN_PASSWORD_HASH','secret_text'],
 ['MEDIA_BUCKET','r2_bucket'],
 ['EDITOR_BUCKET','r2_bucket'],
 ['DB','d1'],
 ['MEDIA_ACL','d1']
]){
 const item=bindings.find(x=>x.name===name);
 assert.ok(item, 'Critical Worker binding absent: '+name);
 assert.equal(item.type,type,'Critical Worker binding type drift: '+name);
 if(name==='MEDIA_BUCKET')assert.equal(item.bucket_name,PRODUCTION);
 if(name==='EDITOR_BUCKET')assert.equal(item.bucket_name,STAGING);
 if(type==='d1')assert.equal(item.database_id||item.id,D1);
}
async function select(sql){
 assert.ok(/^SELECT\s/i.test(sql),'Only SQL SELECT allowed');
 const r=await fetch(base+'/d1/database/'+D1+'/query',{method:'POST',
 headers:{...headers,'content-type':'application/json'},body:JSON.stringify({sql}),
 signal:AbortSignal.timeout(30000)});
 assert.equal(r.status,200,'D1 SELECT query inaccessible');
 const result=await r.json();
 assert.equal(result.success,true);
 assert.equal(result.result?.[0]?.success,true);
 assert.equal(result.result[0]?.meta?.rows_written,0);
 return result.result[0].results;
}
const names=(await select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name")).map(x=>x.name);
assert.equal(names.length,19,'Number of backed-up D1 app tables drifted');
assert.ok(names.every(x=>/^[a-z][a-z0-9_]*$/.test(x)));
let rows=0;
for(const name of names){
 const item=await select('SELECT COUNT(*) AS c FROM "'+name+'"');
 assert.ok(Number.isInteger(item[0]?.c));
 rows+=item[0].c;
}
assert.equal(rows,12797,'D1 application row counts differ from M3 verified offsite backup');
const pub=await select("SELECT COUNT(*) AS c FROM public_media WHERE approved=1 AND revoked_at IS NULL");
const pdf=await select("SELECT COUNT(*) AS c FROM committee_media WHERE published=1 AND revoked_at IS NULL");
assert.equal(pub[0].c,113);
assert.equal(pdf[0].c,9);
const origins=['https://ronde-des-archanges-universelle.eu',
 'https://www.ronde-des-archanges-universelle.eu'];
for(const origin of origins){
 async function code(path){
  const r=await fetch(origin+path,{method:'GET',redirect:'manual',cache:'no-store',
   signal:AbortSignal.timeout(25000)});
  await r.body?.cancel().catch(()=>{});
  return r.status;
 }
 assert.equal(await code('/'),200);
 assert.equal(await code('/api/editor-open-draft?celebration=101'),401);
 assert.equal(await code('/admin.html'),200);
}
const candidate='https://celebrations-visual-candidate.rondes.workers.dev';
for(const path of ['/','/mercredi/']){
 const r=await fetch(candidate+path,{method:'GET',cache:'no-store',
  signal:AbortSignal.timeout(25000)});
 assert.equal(r.status,200,'Current candidate visual page failed');
 await r.body?.cancel().catch(()=>{});
}
const test=await fetch(candidate+'/api/editor-open-draft?celebration=101',{method:'GET',
 redirect:'manual',signal:AbortSignal.timeout(25000)});
assert.equal(test.status,404);
await test.body?.cancel().catch(()=>{});
console.log('M05_PRE_RELEASE_REAL_READONLY_PASS '+JSON.stringify({
 officialDeploymentId:worker.deploymentId,oldRollbackVersionId:worker.versionId,
 rollbackVersionAvailable:true,allOfficialDomainsAttached:true,
 technicalWorkersDevDisabled:true,previewUrlsDisabled:true,
 protectedAdminSecretPresent:true,
 requiredWorkerBindingsPresent:5,
 d1AppTables:names.length,d1Rows:rows,
 publicApprovedMedia:113,approvedPdf:9,
 officialPagesHealthy:2,officialLoginProtected:2,
 visualCandidatePagesHealthy:2,visualCandidateDraftAnonymousDenied:true,
 editorSnapshotInR2VerifySeparately:true,
 independentDriveArchiveVerifiedInM03:true,
 candidateCommit:process.env.GITHUB_SHA||null,
 releasesAttempted:0,workerWrites:0,r2Writes:0,d1Writes:0
}));
