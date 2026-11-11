// D-only copy of M018 READ-ONLY preflight; original release guard unchanged.
// M018. The only remote operation on production D1 is a bounded SELECT over
// sqlite_master. No R2 reads, no publishing, no Workers settings mutation.
import assert from 'node:assert/strict';
const account='60a7b17758a93fe6681ce998e72ddff0';
const worker='celebrations-exit-production';
const d1='28736d2a-479b-472b-bf82-703ad0affe10';
const baseline='87dba010-c719-4a52-97c1-027a9c9de9b6';
assert.equal(process.env.GITHUB_REF,'refs/heads/feat/m018d-integration-preparation-20261111');
assert.equal(process.env.M018_ISOLATED_ONLY,'YES');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,account);
assert.ok((process.env.CLOUDFLARE_API_TOKEN||'').length>20);
const endpoint='https://api.cloudflare.com/client/v4/accounts/'+account;
const headers={authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN};
async function cf(path,method='GET',data){
 const res=await fetch(endpoint+path,{
  method,headers:{...headers,...(data?{'content-type':'application/json'}:{})},
  ...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(25000)
 });
 if(!res.ok)throw Error('Cloudflare read '+path+' http '+res.status);
 const json=await res.json();
 if(json.success!==true)throw Error('Cloudflare read failed '+path);
 return json.result;
}
const deployed=await cf('/workers/scripts/'+worker+'/deployments');
const version=deployed.deployments?.[0]?.versions||[];
const domains=await cf('/workers/domains');
const settings=await cf('/workers/scripts/'+worker+'/settings');
const bindings=new Map((settings.bindings||[]).map(b=>[b.name,b]));
const expected=['ronde-des-archanges-universelle.eu','www.ronde-des-archanges-universelle.eu'];
const routes=expected.map(host=>({host,service:domains.find(d=>d.hostname===host)?.service||null}));
const tableResult=await cf('/d1/database/'+d1+'/query','POST',{
 sql:"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
});
const tables=(tableResult[0]?.results||[]).map(x=>x.name);
const needs=[
 'celebrations_directory_people',
 'celebrations_directory_member_types',
 'celebrations_directory_person_types',
 'celebrations_directory_person_celebrations',
 'celebrations_directory_private_spaces',
 'celebrations_directory_private_space_enrollments',
 'celebrations_directory_identity_claims',
 'celebrations_directory_identity_links',
 'celebrations_directory_admin_audit',
 'celebrations_directory_admin_revisions',
 'celebrations_editor_admin_challenges',
 'celebrations_private_release_fences'
];
const report={
 official_worker:worker,
 current_version:version[0]?.version_id||null,
 baseline_version:baseline,
 percent:version[0]?.percentage||null,
 routes,
 d1_binding:bindings.get('DB')?.database_id||bindings.get('DB')?.id||null,
 media_acl_d1:bindings.get('MEDIA_ACL')?.database_id||bindings.get('MEDIA_ACL')?.id||null,
 media_r2:bindings.get('MEDIA_BUCKET')?.bucket_name||null,
 editor_r2:bindings.get('EDITOR_BUCKET')?.bucket_name||null,
 binding_names:[...bindings.keys()].filter(x=>!x.includes('SECRET')).sort(),
 admin_pin_signer_present:bindings.get('ADMIN_PASSWORD_HASH')?.type==='secret_text',
 admin_password_salt_present:bindings.get('ADMIN_PASSWORD_SALT')?.type==='secret_text',
 challenge_signer_present:bindings.get('EDITOR_D1_CHALLENGE_SECRET')?.type==='secret_text',
 production_existing_tables:tables.length,
 existing_member_tables:needs.filter(x=>tables.includes(x)),
 missing_member_tables:needs.filter(x=>!tables.includes(x)),
 essential_tables_present:['celebrations_celebrations','celebrations_steps','celebrations_admin_sessions',
  'celebrations_login_attempts'].every(x=>tables.includes(x))
};
console.log('M018_OFFICIAL_READONLY '+JSON.stringify(report));
assert.ok(version.length===1&&version[0].version_id===baseline&&version[0].percentage===100,
 'Production version drift: no release');
assert.ok(routes.every(x=>x.service===worker),'Unexpected official domain mapping: no release');
assert.equal(report.d1_binding,d1,'Unexpected production DB binding');
assert.equal(report.media_r2,'celebrations-exit-production','Unexpected historical media binding');
assert.equal(report.essential_tables_present,true,'Historical D1 tables missing');
assert.equal(report.admin_pin_signer_present,true,'Official PIN cookie signing secret missing');
console.log('M018_OFFICIAL_READONLY_PASS no_remote_writes=true');
