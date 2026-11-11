// M018 official release boundary: only Cloudflare GET and a bounded D1
// SELECT over sqlite_master. No production write occurs in this module.
import assert from 'node:assert/strict';
const account='60a7b17758a93fe6681ce998e72ddff0';
const db='28736d2a-479b-472b-bf82-703ad0affe10';
const worker='celebrations-exit-production';
const baseline='87dba010-c719-4a52-97c1-027a9c9de9b6';
const mode=process.argv[2];
const newVersion=process.argv[3]||'';
assert.ok(['before','after-migration','after-promotion','before-rollback'].includes(mode));
assert.equal(process.env.GITHUB_REF,'refs/heads/feat/celebrations-m018-official-release-prep-20261111');
assert.equal(process.env.M018_OWNER_APPROVED,'YES','No owner-approved release authorization');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,account);
assert.ok((process.env.CLOUDFLARE_API_TOKEN||'').length>20);
const endpoint='https://api.cloudflare.com/client/v4/accounts/'+account;
async function cf(path,method='GET',body){
 const r=await fetch(endpoint+path,{method,headers:{
  authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,
  ...(body?{'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
 if(r.status!==200)throw Error('Cloudflare verification '+path+' status '+r.status);
 const data=await r.json();
 assert.equal(data.success,true,'Cloudflare response for '+path);
 return data.result;
}
const deployment=await cf('/workers/scripts/'+worker+'/deployments');
const versions=deployment.deployments?.[0]?.versions||[];
assert.equal(versions.length,1,'Split traffic not permitted');
assert.equal(versions[0].percentage,100,'Expected 100%');
const officialVersion=mode==='after-promotion'||mode==='before-rollback'?newVersion:baseline;
assert.match(officialVersion,/^[a-f0-9-]{36}$/);
assert.equal(versions[0].version_id,officialVersion,'Official worker drift');
const domains=await cf('/workers/domains');
for(const host of ['ronde-des-archanges-universelle.eu','www.ronde-des-archanges-universelle.eu'])
 assert.equal(domains.find(d=>d.hostname===host)?.service,worker,'Unexpected official custom domain '+host);
const config=await cf('/workers/scripts/'+worker+'/settings');
const bindings=new Map((config.bindings||[]).map(x=>[x.name,x]));
for(const name of ['DB','MEDIA_ACL'])
 assert.equal(bindings.get(name)?.database_id||bindings.get(name)?.id,db,'Production D1 binding drift');
assert.equal(bindings.get('MEDIA_BUCKET')?.bucket_name,'celebrations-exit-production');
assert.equal(bindings.get('EDITOR_BUCKET')?.bucket_name,'celebrations-exit-staging',
 'Historical shared editor bucket must NOT be switched or cleared');
for(const name of ['ADMIN_PASSWORD_HASH','ADMIN_PASSWORD_SALT'])
 assert.equal(bindings.get(name)?.type,'secret_text','Existing admin credential cannot be replaced');
assert.equal(bindings.get('ASSETS')?.type,'assets');
const query=await cf('/d1/database/'+db+'/query','POST',{
 sql:"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
});
const tables=new Set(query[0]?.results?.map(x=>x.name)||[]);
const additions=[
 'celebrations_directory_people','celebrations_directory_member_types',
 'celebrations_directory_person_types','celebrations_directory_person_celebrations',
 'celebrations_directory_private_spaces','celebrations_directory_private_space_enrollments',
 'celebrations_directory_identity_claims','celebrations_directory_identity_links',
 'celebrations_directory_admin_audit','celebrations_directory_admin_revisions',
 'celebrations_editor_admin_challenges','celebrations_private_release_fences'
];
for(const name of ['celebrations_celebrations','celebrations_steps','celebrations_login_attempts','celebrations_admin_sessions'])
 assert.equal(tables.has(name),true,'Historical D1 schema missing '+name);
if(mode==='before'){
 assert.equal(additions.filter(x=>tables.has(x)).length,0,'Partially prepared D1; stop before changes');
}else{
 assert.equal(additions.filter(x=>tables.has(x)).length,additions.length,'Additive D1 migration incomplete');
}
if(mode==='after-promotion'){
 for(const [name,value] of Object.entries({
  MEMBER_DIRECTORY_API_ENABLED:'true',MEMBER_DIRECTORY_API_HOST:'ronde-des-archanges-universelle.eu',
  MEMBER_DIRECTORY_OFFICIAL_ENABLED:'true',EDITOR_D1_SESSION_API_ENABLED:'true',
  EDITOR_PIN_D1_BRIDGE_ENABLED:'true',MEMBER_PAGE_READ_API_ENABLED:'true'
 }))assert.equal(bindings.get(name)?.text,value,'Expected official opt-in missing '+name);
}
console.log('M018_PROD_BOUNDARY_PASS '+JSON.stringify({
 mode,official_version:officialVersion,official_domains_unchanged:true,
 protected_credentials_unchanged:true,history_d1_unchanged:true,
 media_bucket_unchanged:true,editor_bucket_unchanged:true,
 schema_additive:(mode!=='before'),private_media_routes_enabled:false
}));
