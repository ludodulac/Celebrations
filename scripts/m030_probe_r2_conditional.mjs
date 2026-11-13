// M030 official release prerequisite: verify optimistic R2 writes on a TEST key
// in the isolated M016 bucket. Never touch an existing object or official R2.
import assert from 'node:assert/strict';
const acc='60a7b17758a93fe6681ce998e72ddff0';
assert.equal(process.env.M030_CAS_PROBE_ONLY,'YES');
assert.equal(process.env.GITHUB_REF,'refs/heads/feat/m030-canonical-celebration-cycles-20261113');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,acc);
const token=process.env.CLOUDFLARE_API_TOKEN;
assert.ok(token?.length>20);
const bucket='celebrations-m016-admin-editor';
const key='m030-safety-probe/'+String(process.env.GITHUB_RUN_ID||'no-run')+'.txt';
const url='https://api.cloudflare.com/client/v4/accounts/'+acc+'/r2/buckets/'+bucket+'/objects/'+key;
const request=(method,body,headers={})=>fetch(url,{
 method,headers:{authorization:'Bearer '+token,...headers},
 ...(body!==undefined?{body}:{}),signal:AbortSignal.timeout(30000)
});
let created=false;
try{
 const initial=await request('PUT','m030-cas-probe',{'content-type':'text/plain','If-None-Match':'*'});
 assert.ok([200,201].includes(initial.status),'M016 CAS probe PUT not supported: HTTP '+initial.status);
 created=true;
 const got=await request('GET');
 assert.equal(got.status,200);
 assert.equal(await got.text(),'m030-cas-probe');
 const wrong=await request('PUT','MUST-NOT-COMMIT',{'content-type':'text/plain','If-Match':'"00000000000000000000000000000000"'});
 assert.equal(wrong.status,412,'STOP: R2 REST If-Match not atomic; cannot safely migrate official editor R2');
 const unchanged=await request('GET');
 assert.equal(await unchanged.text(),'m030-cas-probe','Conditional failure still changed test object');
 console.log('M030_R2_CONDITIONAL_COMPARE_AND_SWAP_SUPPORTED probe_bucket=M016 official_objects_touched=0');
}finally{
 if(created){const r=await request('DELETE');
  assert.ok([200,204,404].includes(r.status),'Could not remove isolated test object');}
 console.log('M030_R2_PROBE_ISOLATED_CLEANUP_DONE');
}
