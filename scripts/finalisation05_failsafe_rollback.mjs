// Safety-net rollback from ANY failed post-deploy GitHub Actions step.
// Refuses third-party deployment drift. No D1/R2/DNS writes.
import assert from 'node:assert/strict';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,
 token=process.env.CLOUDFLARE_API_TOKEN,
 script='celebrations-exit-production',
 OLD='dcda4193-1d82-4283-9f0e-ae8a09e6a444',
 NEW='eccb1274-2ed8-491f-8557-c4330342e4bf';
assert.equal(process.env.GITHUB_REF,
 'refs/heads/release/celebrations-finalisation-05-livraison-20261109');
assert.match(account,/^[a-f0-9]{32}$/i);
assert.ok(token?.length>=16);
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+script;
async function call(path,method='GET',payload=null){
 const response=await fetch(base+path,{method,
  headers:{authorization:'Bearer '+token,accept:'application/json',
    ...(payload?{'content-type':'application/json'}:{})},
  ...(payload?{body:JSON.stringify(payload)}:{}),
  signal:AbortSignal.timeout(26000)});
 assert.equal(response.status,200,'Worker rollback API unavailable');
 const body=await response.json();assert.equal(body.success,true);
 return body.result;
}
const current=async()=>{
 const r=await call('/deployments');
 const dep=r?.deployments?.[0];
 assert.equal(dep?.versions?.length,1,'Unexpected deployment split');
 assert.equal(dep?.versions[0].percentage,100);
 return{deployment:dep.id,version:dep.versions[0].version_id};
};
const existing=await current();
if(existing.version!==NEW&&existing.version!==OLD)
 throw Error('Worker version changed by a third party; refuse destructive override');
let restored=existing.version===OLD;
if(!restored){
 const prior=await call('/versions/'+OLD);
 assert.equal(prior.id,OLD,'Original immutable Worker no longer available');
 const body={strategy:'percentage',versions:[{version_id:OLD,percentage:100}],
   annotations:{'workers/message':'Célébrations M05 automatic exact-version rollback after failing release QA'}};
 for(let tryNo=0;tryNo<3&&!restored;tryNo++){
  try{
   await call('/deployments','POST',body);
   restored=(await current()).version===OLD;
  }catch(e){if(tryNo===2)throw e}
  if(!restored)await new Promise(r=>setTimeout(r,3000));
 }
}
assert.ok(restored,'Original Worker version not restored');
const sub=await call('/subdomain');
assert.equal(sub.enabled,false);assert.equal(sub.previews_enabled,false);
for(const host of ['https://ronde-des-archanges-universelle.eu',
                 'https://www.ronde-des-archanges-universelle.eu']){
 let healthy=false;
 for(let attempt=0;attempt<5;attempt++){
  const r=await fetch(host+'/',{method:'GET',cache:'no-store',redirect:'manual',
    signal:AbortSignal.timeout(22000)});
  await r.body?.cancel().catch(()=>{});
  if(r.status===200){healthy=true;break}
  await new Promise(r=>setTimeout(r,2600));
 }
 assert.ok(healthy,'Official site did not recover after rollback');
}
console.log('M05_ROLLBACK_FAILSAFE_VERIFIED '+JSON.stringify({
 priorOldVersionRestored:true,originalAssetsAndBindingsManagedByCloudflareVersion:true,
 technicalWorkerDomainStillDisabled:true,bothOfficialDomains200:true,
 d1Writes:0,r2Writes:0,dnsChanges:0
}));
