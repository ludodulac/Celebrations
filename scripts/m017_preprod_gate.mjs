// M017: preflight for one already-created isolated Cloudflare Worker/D1/R2 set.
// No production mutation. Fail closed on drift or preexisting user data.
import assert from 'node:assert/strict';
const account='60a7b17758a93fe6681ce998e72ddff0';
const db='3bb4108f-5ff8-4959-ba32-bd53f33156cb';
const dbName='celebrations-m016-admin-preprod';
const target='celebrations-m016-admin-preprod';
const media='celebrations-m016-admin-media',editor='celebrations-m016-admin-editor';
const baseline='87dba010-c719-4a52-97c1-027a9c9de9b6';
assert.equal(process.env.GITHUB_REF,'refs/heads/feat/celebrations-m017-admin-online-20261111');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,account);
assert.ok((process.env.CLOUDFLARE_API_TOKEN||'').length>20);
const password=process.env.M017_ADMIN_PASSWORD||'';
assert.ok(password.length>=16&&password.length<=32&&/[a-z]/i.test(password)&&/[0-9]/.test(password)&&/[^a-z0-9]/i.test(password),
 'Dedicated M017 secret CELEBRATIONS_M017_ADMIN_PASSWORD is absent or too weak (16-32 mixed characters)');
const root='https://api.cloudflare.com/client/v4/accounts/'+account;
async function request(method,path,body) {
 const response=await fetch(root+path,{method,headers:{
  authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,
  ...(body?{'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok||result.success!==true)throw Error('Cloudflare gate '+method+' '+path.split('?')[0]+' status='+response.status);
 return result.result;
}
const prod=await request('GET','/workers/scripts/celebrations-exit-production/deployments');
const version=prod.deployments?.[0]?.versions||[];
assert.equal(version.length,1);
assert.equal(version[0].version_id,baseline,'Official Worker drifted: stop');
assert.equal(version[0].percentage,100);
const inventory=await request('GET','/d1/database');
assert.ok(Array.isArray(inventory));
const databases=inventory.filter(x=>x.name===dbName);
assert.equal(databases.length,1);
assert.equal(databases[0].uuid,db);
assert.notEqual(db,'28736d2a-479b-472b-bf82-703ad0affe10');
const buckets=await request('GET','/r2/buckets');
assert.ok(Array.isArray(buckets.buckets)&&!buckets.cursor,'Complete R2 inventory required');
for(const name of [media,editor])assert.equal(buckets.buckets.filter(x=>x.name===name).length,1);
assert.notEqual(media,'celebrations-exit-production');
assert.notEqual(editor,'celebrations-exit-staging');
const q=await request('POST','/d1/database/'+db+'/query',{
 sql:"SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"});
assert.ok(Array.isArray(q)&&q[0]?.results?.length===1);
assert.equal(q[0].results[0].n,0,'Target D1 is not empty; refuse destructive/repeated installation');
const probe=await fetch(root+'/workers/scripts/'+target+'/settings',{
 headers:{authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN},signal:AbortSignal.timeout(25000)});
if(probe.status!==404) {
 assert.equal(probe.status,200);
 const result=await probe.json();
 assert.equal(result.success,true);
 const binds=new Map((result.result.bindings||[]).map(b=>[b.name,b]));
 for(const name of ['DB','MEDIA_ACL'])assert.equal(binds.get(name)?.id||binds.get(name)?.database_id,db);
 assert.equal(binds.get('MEDIA_BUCKET')?.bucket_name,media);
 assert.equal(binds.get('EDITOR_BUCKET')?.bucket_name,editor);
 assert.ok(![...binds.values()].some(b=>b.bucket_name==='celebrations-exit-production'||b.bucket_name==='celebrations-exit-staging'));
}
console.log('M017_GATE_PASS distinct_D1=true distinct_R2=true empty_D1=true official_version_unchanged=true');
