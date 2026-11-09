// M05 — isolated rehearsal of Cloudflare native Worker VERSION rollback.
// Mutates ONLY the pre-existing public-only visual candidate (NOT production).
// No SQL, R2 writes, DNS, secrets or admin contents read.
import assert from 'node:assert/strict';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,
 token=process.env.CLOUDFLARE_API_TOKEN,
 candidate='celebrations-visual-candidate';
assert.equal(process.env.GITHUB_REF,
 'refs/heads/release/celebrations-finalisation-05-livraison-20261109');
assert.match(account,/^[a-f0-9]{32}$/i);
assert.ok(token?.length>16);
const a='https://api.cloudflare.com/client/v4/accounts/'+account;
const route=a+'/workers/scripts/'+candidate;
async function api(path,method='GET',body=null){
 const r=await fetch(path,{method,headers:{authorization:'Bearer '+token,
  accept:'application/json',...(body?{'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(26000),
  redirect:'error'});
 if(!r.ok)throw Error('Cloudflare API '+method+' HTTP '+r.status);
 const j=await r.json();
 assert.equal(j.success,true,'Cloudflare API '+method+' failed');
 return j.result;
}
const domains=await api(a+'/workers/domains');
assert.ok(Array.isArray(domains));
assert.ok(!domains.some(d=>d.service===candidate),'Rollback test Worker has official domains');
const deployment=(await api(route+'/deployments')).deployments;
assert.ok(deployment?.length>=2,'Candidate Worker lacks previous deployment');
const active=deployment[0],older=deployment.find((x,i)=>i>0&&
 x.versions?.length===1&&x.versions[0].percentage===100&&
 x.versions[0].version_id!==active.versions?.[0]?.version_id&&
 Date.parse(x.created_on)>Date.parse('2026-11-09T12:00:00Z'));
assert.ok(active.versions?.length===1&&active.versions[0].percentage===100);
assert.ok(older,'Secure M2 candidate previous version unavailable');
const stable=active.versions[0].version_id,
 temporary=older.versions[0].version_id;
const ver=await Promise.all([api(route+'/versions/'+stable),api(route+'/versions/'+temporary)]);
assert.equal(ver[0].id,stable);assert.equal(ver[1].id,temporary);
assert.ok(stable!==temporary);
const makeBody=version=>({strategy:'percentage',
 versions:[{version_id:version,percentage:100}],
 annotations:{'workers/message':'M05 rehearsal on public-only candidate; restore immediately'}});
let switched=false,restored=false,revertedToPrior=false;
try{
 switched=true; // Restore stable candidate even if the first POST times out after reaching Cloudflare.
 const trial=await api(route+'/deployments','POST',makeBody(temporary));
 assert.equal(trial?.versions?.[0]?.version_id,temporary);
 const during=(await api(route+'/deployments')).deployments[0];
 assert.equal(during.versions[0].version_id,temporary);
 revertedToPrior=true;
 console.log('M05_ISOLATED_CANDIDATE_VERSION_SWITCH_PASS '+JSON.stringify({
  usedNonproductionWorker:true,changedToDifferentImmutableVersion:true,
  originalOfficialWorkerTouched:false,originalOfficialDataTouched:false}));
}finally{
 if(switched){
  for(let n=0;n<3&&!restored;n++){
   try{
    const done=await api(route+'/deployments','POST',makeBody(stable));
    assert.equal(done.versions?.[0]?.version_id,stable);
    const actual=(await api(route+'/deployments')).deployments[0];
    assert.equal(actual.versions[0].version_id,stable);
    restored=true;
   }catch(e){if(n===2)throw e;await new Promise(r=>setTimeout(r,2200))}
  }
 }
}
assert.ok(revertedToPrior&&restored,'Rehearsed rollback did not restore original version');
const host='https://celebrations-visual-candidate.rondes.workers.dev';
async function status(path){
 const r=await fetch(host+path,{method:'GET',redirect:'manual',cache:'no-store',
  signal:AbortSignal.timeout(17000)});
 await r.body?.cancel().catch(()=>{});
 return r.status;
}
let ok=false;
for(let attempt=0;attempt<6;attempt++){
 const home=await status('/');
 const privateStatus=await status('/api/editor-open-draft?celebration=101');
 if(home===200&&privateStatus===404){ok=true;break}
 await new Promise(r=>setTimeout(r,2000));
}
assert.ok(ok,'Candidate did not recover public availability and private access protections');
const prod=(await api(a+'/workers/scripts/celebrations-exit-production/deployments')).deployments[0];
assert.equal(prod.id,'cd46e1ba-e106-4f03-90aa-7110628a5b9f');
assert.equal(prod.versions[0].version_id,'dcda4193-1d82-4283-9f0e-ae8a09e6a444');
console.log('M05_WORKER_NATIVE_ROLLBACK_REHEARSAL_PASS '+JSON.stringify({
 isolatedCandidateService:candidate,stableVersionRestored:true,
 immutableVersionRollbackWorks:true,candidatePublicRoot:200,
 candidatePrivateAnonymous:404,officialDeploymentUnchanged:true,
 officialD1Writes:0,officialR2Writes:0,officialWorkerDeployments:0
}));
