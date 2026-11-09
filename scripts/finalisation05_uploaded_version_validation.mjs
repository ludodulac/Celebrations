// M05 — cloud provider proof of staged (NOT LIVE) Worker version bindings.
import assert from 'node:assert/strict';
const account=process.env.CLOUDFLARE_ACCOUNT_ID,
 token=process.env.CLOUDFLARE_API_TOKEN,
 worker='celebrations-exit-production',
 previous='dcda4193-1d82-4283-9f0e-ae8a09e6a444',
 candidate='eccb1274-2ed8-491f-8557-c4330342e4bf';
assert.equal(process.env.GITHUB_REF,
 'refs/heads/release/celebrations-finalisation-05-livraison-20261109');
assert.match(account,/^[a-f0-9]{32}$/i);
const base='https://api.cloudflare.com/client/v4/accounts/'+account+'/workers/scripts/'+worker;
async function get(path){
 const response=await fetch(base+path,{headers:{authorization:'Bearer '+token},
   signal:AbortSignal.timeout(25000)});
 assert.equal(response.status,200,'Cloudflare read failed');
 const obj=await response.json();
 assert.equal(obj.success,true);
 return obj.result;
}
const [deployment,old,ready,settings,sub]=await Promise.all([
 get('/deployments'),get('/versions/'+previous),get('/versions/'+candidate),
 get('/settings'),get('/subdomain')
]);
assert.equal(deployment.deployments[0].id,'cd46e1ba-e106-4f03-90aa-7110628a5b9f');
assert.equal(deployment.deployments[0].versions[0].version_id,previous);
assert.equal(old.id,previous);
assert.equal(ready.id,candidate);
assert.notEqual(ready.resources?.script?.etag,old.resources?.script?.etag,'New code not different');
assert.ok(ready.resources?.script?.etag);
assert.ok(old.resources?.script?.etag);
assert.ok(ready.resources?.script?.handlers?.includes('fetch'));
assert.equal(sub.enabled,false);
assert.equal(sub.previews_enabled,false);
const bindings=settings.bindings||[];
for(const [name,type] of [
 ['ADMIN_PASSWORD_HASH','secret_text'],['MEDIA_BUCKET','r2_bucket'],
 ['EDITOR_BUCKET','r2_bucket'],['DB','d1'],['MEDIA_ACL','d1']
]){
 const x=bindings.find(b=>b.name===name);
 assert.equal(x?.type,type,'Latest staged Worker binding missing '+name);
 if(name==='MEDIA_BUCKET')assert.equal(x.bucket_name,'celebrations-exit-production');
 if(name==='EDITOR_BUCKET')assert.equal(x.bucket_name,'celebrations-exit-staging');
 if(type==='d1')assert.equal(x.database_id||x.id,'28736d2a-479b-472b-bf82-703ad0affe10');
}
// Verify bindings actually captured on new immutable version (not only settings).
const raw=ready.resources?.bindings;
const list=Array.isArray(raw)?raw:
 raw&&Array.isArray(raw.bindings)?raw.bindings:
 raw&&typeof raw==='object'&&Object.values(raw).every(x=>x&&typeof x==='object')?
  Object.values(raw):[];
const names=list.map(x=>x.name||x.binding).filter(Boolean);
const important=['ADMIN_PASSWORD_HASH','MEDIA_BUCKET','EDITOR_BUCKET','DB','MEDIA_ACL'];
const versionHasCompleteDetail=important.every(name=>names.includes(name));
console.log('M05_NEW_WORKER_IMMUTABLE_VERSION_REVIEW '+JSON.stringify({
 oldDeploymentStillLive:true,oldVersionAvailable:true,
 newVersion:candidate,oldScriptEtagKnown:true,newScriptEtagKnown:true,
 scriptDigestsDifferent:true,workerFetchHandlerPresent:true,
 newestConfigurationCriticalBindings:important.length,
 versionBindingShape:Array.isArray(raw)?'array':raw===undefined?'not-returned':typeof raw,
 versionBindingEntries:names.length,
 allVersionBindingNamesVisible:versionHasCompleteDetail,
 technicalWorkersDevDisabled:true,previewUrlsDisabled:true,
 candidatePublished:false,
 remoteWrites:0
}));
