// M05: promote ONE immutable, previously uploaded Worker version to BOTH existing
// domains; no route/DNS/bucket/DB writes. Automatic rollback on failure.
// The Workflow also has a second, independent always() rollback step.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,
 token=process.env.CLOUDFLARE_API_TOKEN,
 OLD_VERSION='dcda4193-1d82-4283-9f0e-ae8a09e6a444',
 OLD_DEPLOYMENT='cd46e1ba-e106-4f03-90aa-7110628a5b9f',
 NEW_VERSION='eccb1274-2ed8-491f-8557-c4330342e4bf',
 worker='celebrations-exit-production',
 base='https://api.cloudflare.com/client/v4/accounts/'+account,
 route=base+'/workers/scripts/'+worker;
assert.equal(process.env.GITHUB_REF,
 'refs/heads/release/celebrations-finalisation-05-livraison-20261109');
assert.match(account,/^[a-f0-9]{32}$/i);
assert.ok(token?.length>=16);
assert.equal(process.env.M05_ALLOW_LIVE_DEPLOY,'yes','Missing explicit M05 one-shot release approval');
async function api(path,method='GET',body=null){
 const r=await fetch(path,{method,headers:{authorization:'Bearer '+token,
  accept:'application/json',...(body?{'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),
  redirect:'error',cache:'no-store',signal:AbortSignal.timeout(30000)});
 if(r.status!==200)throw Error('Cloudflare API '+method+' failed HTTP '+r.status);
 const b=await r.json();assert.equal(b.success,true);
 return b.result;
}
const deployment=()=>api(route+'/deployments').then(x=>x.deployments[0]);
async function current(){
 const d=await deployment();
 assert.equal(d.versions?.length,1,'Unexpected split deployment');
 assert.equal(d.versions[0].percentage,100,'Unexpected Worker rollout distribution');
 return {deploymentId:d.id,versionId:d.versions[0].version_id};
}
async function setVersion(id,tag){
 const payload={strategy:'percentage',versions:[{version_id:id,percentage:100}],
  annotations:{'workers/message':'Célébrations finalisation M05 '+tag}};
 await api(route+'/deployments','POST',payload);
 const next=await current();
 assert.equal(next.versionId,id,'Worker version not activated as requested');
 return next;
}
const domains=await api(base+'/workers/domains');
for(const hostname of ['ronde-des-archanges-universelle.eu',
 'www.ronde-des-archanges-universelle.eu']){
 assert.equal(domains.find(d=>d.hostname===hostname)?.service,worker);
}
const before=await current();
assert.deepEqual(before,{deploymentId:OLD_DEPLOYMENT,versionId:OLD_VERSION},
 'Original Worker deployment unexpectedly changed');
const old=await api(route+'/versions/'+OLD_VERSION),
 neu=await api(route+'/versions/'+NEW_VERSION);
assert.equal(old.id,OLD_VERSION);
assert.equal(neu.id,NEW_VERSION);
assert.ok(neu.resources?.script?.etag&&old.resources?.script?.etag);
assert.notEqual(neu.resources.script.etag,old.resources.script.etag);
const binds=neu.resources?.bindings;
assert.ok(Array.isArray(binds),'Staged immutable version bindings not enumerable');
for(const [name,type] of [['ADMIN_PASSWORD_HASH','secret_text'],
 ['MEDIA_BUCKET','r2_bucket'],['EDITOR_BUCKET','r2_bucket'],['DB','d1'],['MEDIA_ACL','d1']]){
 const x=binds.find(x=>x.name===name);
 assert.equal(x?.type,type,'New immutable version lacks required binding: '+name);
 if(name==='MEDIA_BUCKET')assert.equal(x.bucket_name,'celebrations-exit-production');
 if(name==='EDITOR_BUCKET')assert.equal(x.bucket_name,'celebrations-exit-staging');
 if(type==='d1')assert.equal(x.database_id||x.id,'28736d2a-479b-472b-bf82-703ad0affe10');
}
const sub=await api(route+'/subdomain');
assert.equal(sub.enabled,false);
assert.equal(sub.previews_enabled,false);
const proof={oldDeploymentId:OLD_DEPLOYMENT,oldVersionId:OLD_VERSION,
 newVersionId:NEW_VERSION};
if(process.env.GITHUB_OUTPUT){
 fs.appendFileSync(process.env.GITHUB_OUTPUT,'attempted=yes\n');
 fs.appendFileSync(process.env.GITHUB_OUTPUT,'new_version_id='+NEW_VERSION+'\n');
}
// From this point a network failure may occur after Cloudflare accepted a POST.
// The outer Action has an independent rollback that checks CURRENT version.
let live=false;
async function read(url){
 const r=await fetch(url,{method:'GET',redirect:'manual',cache:'no-store',
  signal:AbortSignal.timeout(25000)});
 return r;
}
async function smokeHost(host){
 for(const route of ['/','/mercredi/','/mediatheque-generale']){
  const response=await read(host+route);
  assert.equal(response.status,200,'New site route failed: '+route);
  await response.body?.cancel().catch(()=>{});
 }
 const publicR=await read(host+'/api/editor-publication?celebration=101');
 assert.equal(publicR.status,200);
 const pub=await publicR.json();
 assert.equal(pub.revision,117,'Public revision changed during release');
 assert.ok(pub.record?.pages?.length>=8);
 assert.ok(pub.shared?.pages?.length>=1);
 const draft=await read(host+'/api/editor-open-draft?celebration=101');
 assert.equal(draft.status,401,'Protected editor GET opened to anonymous viewers');
 await draft.body?.cancel().catch(()=>{});
 const login=await read(host+'/admin.html');
 assert.equal(login.status,200);
 const text=await login.text();
 assert.ok(text.includes('Code d’accès'),'Official editor login not available');
 assert.match(text,/name="_csrf"\s+value="[^"]+"/,'Signed login form not present');
 const anonymous=await fetch(host+'/api/editor-open-draft',{
  method:'POST',headers:{origin:host,'content-type':'application/json'},
  body:'{}',redirect:'manual',signal:AbortSignal.timeout(20000)});
 assert.equal(anonymous.status,401,'Anonymous editor write not denied');
 await anonymous.body?.cancel().catch(()=>{});
 return {home:200,pages:3,publicRevision:pub.revision,draftAnon:401,
  loginForm:200,anonymousSave:401};
}
try{
 const active=await setVersion(NEW_VERSION,'owner-approved publishing; revert to old immutable version on failed smoke');
 live=true;
 console.log('M05_OFFICIAL_IMMUTABLE_VERSION_ACTIVATED '+JSON.stringify({
  deploymentId:active.deploymentId,versionId:active.versionId,
  originalVersionPreserved:OLD_VERSION,workerVersionOnly:true,
  dnsChanged:false,d1Writes:0,r2Writes:0
 }));
 let smokeOk=false,lastError;
 for(let attempt=0;attempt<6&&!smokeOk;attempt++){
  try{
   const results=[];
   for(const host of ['https://ronde-des-archanges-universelle.eu',
                     'https://www.ronde-des-archanges-universelle.eu']){
    results.push(await smokeHost(host));
   }
   smokeOk=true;
   console.log('M05_OFFICIAL_BASIC_SMOKE_PASS '+JSON.stringify({
    domains:2,each:results,privateOrContentPayloadLogged:false,
    workerDeploymentId:active.deploymentId}));
  }catch(e){
   lastError=e;
   if(attempt!==5)await new Promise(r=>setTimeout(r,3100));
  }
 }
 if(!smokeOk)throw lastError||Error('Postrelease smoke failed');
 const now=await current();
 assert.equal(now.versionId,NEW_VERSION);
 const tech=await api(route+'/subdomain');
 assert.equal(tech.enabled,false);
 assert.equal(tech.previews_enabled,false);
 console.log('M05_PRELIMINARY_PRODUCTION_RELEASE_PASS '+JSON.stringify({
  oldVersionStillAvailable:true,activeNewVersion:NEW_VERSION,
  workerDeploymentId:now.deploymentId,
  officialSites:2,technicalWorkerHostDisabled:true,
  backupsUnchanged:true,d1Writes:0,r2Writes:0}));
}catch(e){
 console.error('M05_PRODUCTION_SMOKE_STOP category='+String(e?.name||'Error'));
 try{
  const seen=await current();
  if(seen.versionId===NEW_VERSION){
   const rolled=await setVersion(OLD_VERSION,'automatic rollback after failed M05 basic smoke');
   assert.equal(rolled.versionId,OLD_VERSION);
   console.log('M05_AUTOMATIC_IMMUTABLE_ROLLBACK_PASS '+JSON.stringify({
    oldVersionRestored:true,worker:worker,d1Writes:0,r2Writes:0
   }));
  }else if(seen.versionId===OLD_VERSION){
   console.log('M05_OLD_WORKER_UNCHANGED_AFTER_FAILED_ATTEMPT');
  }else{
   console.error('M05_REFUSE_ROLLBACK_UNKNOWN_THIRD_PARTY_VERSION');
  }
 }catch(error){
  console.error('M05_AUTOMATIC_ROLLBACK_FAILED category='+String(error?.name||'Error'));
 }
 process.exitCode=1;
}
