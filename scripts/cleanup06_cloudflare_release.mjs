// Mission 6: exact-version Cloudflare Worker release with verified fail-safe rollback.
// The only supported remote mutation is a single Worker deployment version switch.
// No SQL, D1 writes, R2 writes, DNS changes, Cloudflare zone edits or secret writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const MODE=process.argv[2];
const MODES=['preflight','validate','promote','postcheck','rollback'];
assert.ok(MODES.includes(MODE),'Unknown cleanup06 mode');
assert.equal(process.env.GITHUB_REF,
  'refs/heads/release/celebrations-cleanup-06-20261110');
const worker='celebrations-exit-production';
const original='eccb1274-2ed8-491f-8557-c4330342e4bf';
const originalDeployment='ffdc7b2b-a443-45cf-843d-0419fe71cb8d';
const newVersion=process.env.CLEANUP06_NEW_VERSION_ID||'';
const account=process.env.CLOUDFLARE_ACCOUNT_ID||'';
const token=process.env.CLOUDFLARE_API_TOKEN||'';
assert.match(account,/^[a-f0-9]{32}$/i,'Cloudflare account not available');
assert.ok(token.length>=16,'Cloudflare token unavailable');
const apiRoot='https://api.cloudflare.com/client/v4/accounts/'+account;
const endpoint=apiRoot+'/workers/scripts/'+worker;
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const domains=['ronde-des-archanges-universelle.eu',
 'www.ronde-des-archanges-universelle.eu'];
const sites=domains.map(d=>'https://'+d);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function call(url,method='GET',payload=null){
 const res=await fetch(url,{
  method,headers:{authorization:'Bearer '+token,accept:'application/json',
    ...(payload?{'content-type':'application/json'}:{})},
  ...(payload?{body:JSON.stringify(payload)}:{}),
  redirect:'error',cache:'no-store',signal:AbortSignal.timeout(35000)
 });
 if(res.status!==200)throw Error('Cloudflare '+method+' failed with HTTP '+res.status);
 const body=await res.json();
 assert.equal(body.success,true,'Cloudflare API reported failure');
 return body.result;
}
async function current(){
 const data=await call(endpoint+'/deployments');
 const d=data?.deployments?.[0];
 assert.equal(d?.versions?.length,1,'Worker deployment is unexpectedly split');
 assert.equal(d.versions[0].percentage,100,'Worker traffic allocation is not 100%');
 assert.ok(uuid.test(d.id),'Current deployment missing ID');
 return {deployment:d.id,version:d.versions[0].version_id};
}
async function identity(){
 const [actualDomains,sub,settings,old]=await Promise.all([
  call(apiRoot+'/workers/domains'),call(endpoint+'/subdomain'),
  call(endpoint+'/settings'),call(endpoint+'/versions/'+original)
 ]);
 for(const host of domains){
  assert.equal(actualDomains.find(d=>d.hostname===host)?.service,worker,
    'Official domain no longer belongs to original Worker');
 }
 assert.equal(sub.enabled,false,'Technical workers.dev hostname reopened');
 assert.equal(sub.previews_enabled,false,'Preview URLs reopened');
 assert.equal(old.id,original,'Prior immutable version unavailable');
 const bindings=settings.bindings||[];
 for(const [name,type] of [
  ['ADMIN_PASSWORD_HASH','secret_text'],
  ['MEDIA_BUCKET','r2_bucket'],['EDITOR_BUCKET','r2_bucket'],
  ['DB','d1'],['MEDIA_ACL','d1']]){
  const b=bindings.find(x=>x.name===name);
  assert.equal(b?.type,type,'Missing production binding '+name);
  if(name==='MEDIA_BUCKET')assert.equal(b.bucket_name,'celebrations-exit-production');
  if(name==='EDITOR_BUCKET')assert.equal(b.bucket_name,'celebrations-exit-staging');
  if(type==='d1')assert.equal(b.database_id||b.id,
   '28736d2a-479b-472b-bf82-703ad0affe10');
 }
 return old;
}
async function httpSmoke(){
 for(const base of sites){
  for(const path of ['/','/mercredi/','/mediatheque-generale']){
   const r=await fetch(base+path,{redirect:'manual',cache:'no-store',
    signal:AbortSignal.timeout(22000)});
   assert.equal(r.status,200,'Public route unavailable '+path);
   await r.body?.cancel().catch(()=>{});
  }
  const snap=await fetch(base+'/api/editor-publication?celebration=101',
   {cache:'no-store',signal:AbortSignal.timeout(22000)});
  assert.equal(snap.status,200,'Public snapshot not available');
  const pub=await snap.json();
  assert.ok(pub.revision>=1,'Public revision invalid');
  assert.ok(pub.record?.pages?.length>=8,'Published celebration lost pages');
  assert.ok(pub.shared?.pages?.length>=1,'Published home missing');
  const draft=await fetch(base+'/api/editor-open-draft?celebration=101',{
    redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(22000)
  });
  assert.equal(draft.status,401,'Unpublished admin data leaked to visitors');
  await draft.body?.cancel().catch(()=>{});
  const login=await fetch(base+'/admin.html',{cache:'no-store',
   signal:AbortSignal.timeout(22000)});
  assert.equal(login.status,200,'Admin login missing');
  const html=await login.text();
  assert.ok(html.includes('Code d’accès'),'Admin access form missing');
  const noauth=await fetch(base+'/api/editor-open-draft',{
   method:'POST',headers:{origin:base,'content-type':'application/json'},
   body:'{}',redirect:'manual',signal:AbortSignal.timeout(22000)});
  assert.equal(noauth.status,401,'Anonymous write not rejected');
  await noauth.body?.cancel().catch(()=>{});
 }
}
async function validateCandidate(){
 assert.ok(uuid.test(newVersion),'Uploaded candidate Worker version ID invalid');
 assert.notEqual(newVersion,original,'Candidate must differ from original');
 const [old,ready]=await Promise.all([
  call(endpoint+'/versions/'+original),
  call(endpoint+'/versions/'+newVersion)
 ]);
 assert.equal(ready.id,newVersion,'Worker version upload missing');
 assert.ok(ready.resources?.script?.etag,'Uploaded Worker script etag unavailable');
 assert.ok(old.resources?.script?.etag,'Old Worker script etag unavailable');
 assert.notEqual(ready.resources.script.etag,old.resources.script.etag,
  'New Worker has no observable script change');
 const bindings=ready.resources?.bindings;
 assert.ok(Array.isArray(bindings),'Immutable version binding list unavailable');
 for(const [name,type] of [
  ['ADMIN_PASSWORD_HASH','secret_text'],['MEDIA_BUCKET','r2_bucket'],
  ['EDITOR_BUCKET','r2_bucket'],['DB','d1'],['MEDIA_ACL','d1']]){
  const b=bindings.find(x=>x.name===name);
  assert.equal(b?.type,type,'Uploaded version missing binding '+name);
  if(name==='MEDIA_BUCKET')assert.equal(b.bucket_name,'celebrations-exit-production');
  if(name==='EDITOR_BUCKET')assert.equal(b.bucket_name,'celebrations-exit-staging');
  if(type==='d1')assert.equal(b.database_id||b.id,
     '28736d2a-479b-472b-bf82-703ad0affe10');
 }
}
async function setVersion(version,label){
 const body={strategy:'percentage',versions:[{version_id:version,percentage:100}],
  annotations:{'workers/message':'Célébrations M06 '+label}};
 await call(endpoint+'/deployments','POST',body);
 const next=await current();
 assert.equal(next.version,version,'Deployment did not activate requested version');
 return next;
}
if(MODE==='preflight'){
 const before=await current();
 assert.deepEqual(before,{deployment:originalDeployment,version:original},
  'Original production Worker drift: refuse to deploy');
 await identity();
 await httpSmoke();
 console.log('CLEANUP06_LIVE_PREFLIGHT_PASS '+JSON.stringify({
  originalDeployment:before.deployment,originalVersion:before.version,
  domains:2,d1Writes:0,r2Writes:0,dnsChanges:0,officialProtected:true
 }));
}else if(MODE==='validate'){
 assert.deepEqual(await current(),
  {deployment:originalDeployment,version:original},
  'Upload altered active Worker or third party changed it');
 await identity();
 await validateCandidate();
 console.log('CLEANUP06_VERSION_UPLOADED_NOT_PUBLISHED_PASS '+JSON.stringify({
  candidateVersion:newVersion,originalVersionStillLive:true,
  bindingCountChecked:5,technicalHostClosed:true
 }));
}else if(MODE==='promote'){
 assert.equal(process.env.CLEANUP06_OWNER_APPROVED,'yes',
  'Live release missing owner authorization');
 assert.deepEqual(await current(),
  {deployment:originalDeployment,version:original},
  'Production Worker has changed during preflight');
 await identity();
 await validateCandidate();
 // Set this BEFORE POST: if Cloudflare accepts the POST then times out,
 // a separate Action step still knows it must check and restore the old version.
 if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,
  'attempted=yes\nnew_version_id='+newVersion+'\n');
 console.log('CLEANUP06_STARTING_EXACT_VERSION_SWITCH');
 const after=await setVersion(newVersion,'owner-approved cleanup M1-M5 release');
 console.log('CLEANUP06_NEW_VERSION_ACTIVATED '+JSON.stringify({
  version:after.version,deployment:after.deployment,rollbackTarget:original,
  d1Writes:0,r2Writes:0,dnsChanges:0
 }));
 let healthy=false,last;
 for(let i=0;i<5&&!healthy;i++){
  try{await httpSmoke();healthy=true}
  catch(e){last=e;if(i<4)await wait(2000)}
 }
 if(!healthy)throw last||Error('Post-deploy smoke failed');
 console.log('CLEANUP06_FIRST_PUBLIC_SMOKE_PASS domains=2 protectedDrafts=true');
}else if(MODE==='postcheck'){
 assert.ok(uuid.test(newVersion));
 assert.equal((await current()).version,newVersion,'Released version drift');
 await identity();
 await httpSmoke();
 console.log('CLEANUP06_OFFICIAL_POSTCHECK_PASS domains=2 protectedDrafts=true');
}else if(MODE==='rollback'){
 assert.ok(uuid.test(newVersion),'Rollback missing candidate version');
 const before=await current();
 assert.ok([original,newVersion].includes(before.version),
  'Other party changed Worker; refuse destructive rollback');
 if(before.version===newVersion){
  await call(endpoint+'/versions/'+original);
  let succeeded=false,last;
  for(let retry=0;retry<3&&!succeeded;retry++){
   try{await setVersion(original,'automatic exact rollback after failed QA');
    succeeded=true;}catch(e){last=e;if(retry<2)await wait(2000)}
  }
  if(!succeeded)throw last||Error('Rollback failed');
 }
 assert.equal((await current()).version,original);
 await identity();
 await httpSmoke();
 console.log('CLEANUP06_ROLLBACK_CONFIRMED '+JSON.stringify({
  originalVersionRestored:true,domains:2,d1Writes:0,
  r2Writes:0,dnsChanges:0
 }));
}
