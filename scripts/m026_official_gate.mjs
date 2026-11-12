// M021-C: exact-target read-only Cloudflare gates, never a destructive operation.
// All production changes are in the separately owner-approved release workflow.
import assert from 'node:assert/strict';
import {writeFileSync,appendFileSync,readFileSync} from 'node:fs';
const ACCOUNT='60a7b17758a93fe6681ce998e72ddff0';
const WORKER='celebrations-exit-production';
const DB='28736d2a-479b-472b-bf82-703ad0affe10';
const HOSTS=['ronde-des-archanges-universelle.eu','www.ronde-des-archanges-universelle.eu'];
const branch='refs/heads/fix/m026-mp3-detection-90mb-20261112';
const mode=process.argv[2]||'before';
assert.ok(['before','after-migration','before-promotion','after-promotion','after-rollback'].includes(mode));
assert.equal(process.env.GITHUB_REF,branch);
assert.equal(process.env.M026_PROD_APPROVED,'YES');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,ACCOUNT);
assert.ok((process.env.CLOUDFLARE_API_TOKEN||'').length>20);
const base='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT;
async function cf(path,method='GET',body) {
 const response=await fetch(base+path,{
  method,
  headers:{authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,
   ...(body?{'content-type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),
  signal:AbortSignal.timeout(35000)
 });
 assert.equal(response.status,200,'Cloudflare read '+path);
 const payload=await response.json();
 assert.equal(payload.success,true,'Cloudflare read response '+path);
 return payload.result;
}
const [deployed,settings,domains,rawSchema,rawCounts]=await Promise.all([
 cf('/workers/scripts/'+WORKER+'/deployments'),
 cf('/workers/scripts/'+WORKER+'/settings'),
 cf('/workers/domains'),
 cf('/d1/database/'+DB+'/query','POST',{
  sql:"SELECT name,type FROM sqlite_master WHERE (type='table' OR type='trigger' OR type='index') AND name NOT LIKE 'sqlite_%' ORDER BY name"
 }),
 cf('/d1/database/'+DB+'/query','POST',{
  sql:"SELECT (SELECT count(*) FROM celebrations_celebrations) AS celebrations,(SELECT min(id) FROM celebrations_celebrations) AS first_celebration_id,(SELECT count(*) FROM celebrations_steps) AS steps,(SELECT count(*) FROM celebrations_contents) AS contents,(SELECT count(*) FROM celebrations_events) AS events,(SELECT count(*) FROM celebrations_links) AS links,(SELECT count(*) FROM celebrations_participants) AS participants,(SELECT count(*) FROM celebrations_admin_sessions) AS admin_sessions,(SELECT count(*) FROM celebrations_participants WHERE email LIKE 'm021-%@test.invalid') AS fake_participants"
 })
]);
const versions=deployed.deployments?.[0]?.versions||[];
assert.equal(versions.length,1,'No split production traffic');
assert.equal(versions[0].percentage,100);
const version=versions[0].version_id;
assert.match(version,/^[0-9a-f-]{36}$/i);
if(mode==='before'&&process.env.M026_HOTFIX_EXPECTED_OFFICIAL_VERSION){
 assert.equal(version,process.env.M026_HOTFIX_EXPECTED_OFFICIAL_VERSION,
  'STOP: production Worker changed since verified M026. Never replace newer features with old branch.');
 console.log('M026_HOTFIX_EXACT_BASELINE_OK '+version);
}
const baselineFile='/tmp/m026-official-baseline.json';
const prev=mode==='before'?null:JSON.parse(readFileSync(baselineFile,'utf8'));
if(prev) {
 const expected=mode==='after-promotion'?process.env.M026_NEW_VERSION:
  mode==='after-rollback'?prev.version:prev.version;
 assert.match(expected||'',/^[0-9a-f-]{36}$/i);
 assert.equal(version,expected,'Production version drift');
}
for(const host of HOSTS)
 assert.equal(domains.find(d=>d.hostname===host)?.service,WORKER,'Official routing changed '+host);
const bindings=new Map((settings.bindings||[]).map(b=>[b.name,b]));
for(const name of ['DB','MEDIA_ACL'])
 assert.equal(bindings.get(name)?.database_id||bindings.get(name)?.id,DB,'Unexpected production DB '+name);
assert.equal(bindings.get('MEDIA_BUCKET')?.bucket_name,'celebrations-exit-production');
assert.equal(bindings.get('EDITOR_BUCKET')?.bucket_name,'celebrations-exit-staging');
assert.equal(bindings.get('ASSETS')?.type,'assets');
for(const name of ['ADMIN_PASSWORD_HASH','ADMIN_PASSWORD_SALT'])
 assert.equal(bindings.get(name)?.type,'secret_text','Preserve official administrative secret '+name);
// A new independent D1 challenge signer is installed ONLY in the inactive
// candidate Worker version. The owner's existing code signer never changes.
if(mode==='after-promotion')assert.equal(bindings.get('EDITOR_D1_CHALLENGE_SECRET')?.type,'secret_text',
 'New member-session challenge secret missing on the promoted official version');
// Only M016 can create test identities. Production must never enable their switches.
for(const name of ['M021_DEMO_MEMBERS_ENABLED','M021_DEMO_D1_ISOLATED','M016_PREPROD_WRITE_ENABLED'])
 assert.notEqual(bindings.get(name)?.text,'true','Forbidden production test flag '+name);
const rows=rawSchema?.[0]?.results||[];
const tables=new Set(rows.filter(x=>x.type==='table').map(x=>x.name));
const legacy=['celebrations_celebrations','celebrations_steps','celebrations_contents',
 'celebrations_events','celebrations_links','celebrations_participants',
 'celebrations_admin_sessions','celebrations_login_attempts'];
for(const t of legacy)assert.ok(tables.has(t),'Missing historical table '+t);
assert.ok(!tables.has('celebrations_m021_demo_members'),'M021-A test table on official database');
const m018=[
 'celebrations_directory_people','celebrations_directory_member_types',
 'celebrations_directory_person_types','celebrations_directory_person_celebrations',
 'celebrations_directory_private_spaces','celebrations_directory_private_space_enrollments',
 'celebrations_directory_identity_claims','celebrations_directory_identity_links',
 'celebrations_directory_admin_audit','celebrations_directory_admin_revisions',
 'celebrations_editor_admin_challenges','celebrations_private_release_fences'
];
const m020d=['celebrations_member_invitation_bindings','celebrations_member_email_tokens',
 'celebrations_member_mail_events','celebrations_member_mail_quota'];
const count=arr=>arr.filter(x=>tables.has(x)).length;
const oldCount=count(m018),newCount=count(m020d);
assert.ok(oldCount===0||oldCount===m018.length,'Partial M018 schema: refuse migration');
assert.ok(newCount===0||newCount===m020d.length,'Partial M020-D schema: refuse migration');
if(newCount>0)assert.equal(oldCount,m018.length,'M020-D lacks M018 prerequisites');
const pragma=await cf('/d1/database/'+DB+'/query','POST',{
 sql:"PRAGMA table_info(celebrations_directory_member_types)"
});
const abbreviation=!!pragma[0]?.results?.some(x=>x.name==='abbreviation');
const counts=rawCounts[0]?.results?.[0];
assert.ok(counts&&counts.celebrations>0&&counts.steps>0,'Production historical D1 appears empty');
assert.equal(counts.fake_participants,0,'Synthetic test participants on official D1');
if(mode==='before'){
 assert.equal(oldCount,m018.length,'M018 official schema missing');
 assert.equal(newCount,m020d.length,'M020-D official schema missing');
 assert.equal(abbreviation,true,'M020-B abbreviation missing');
 writeFileSync(baselineFile,JSON.stringify({version,counts,createdAt:new Date().toISOString()}));
 const flags={m018:oldCount===0?'yes':'no',
  m020b:abbreviation?'no':'yes',m020d:newCount===0?'yes':'no'};
 if(process.env.GITHUB_OUTPUT)for(const [key,value] of Object.entries({
  previous_version:version,...flags
 }))appendFileSync(process.env.GITHUB_OUTPUT,key+'='+value+'\n');
 console.log('M026_OFFICIAL_PREDEPLOY_READONLY_OK '+JSON.stringify({
  previous_version:version,domain_routes:HOSTS.length,
  historic_counts:counts,additive_schema_plan:flags,
  media_binding_preserved:true,editor_binding_preserved:true,demo_disabled:true
 }));
}else{
 assert.deepEqual(counts,prev.counts,'Historical official D1 rows changed during release');
 if(mode!=='after-rollback'){
  assert.equal(count(m018),m018.length,'M018 member directory missing');
  assert.equal(count(m020d),m020d.length,'M020-D member activation schema missing');
  assert.equal(abbreviation,true,'M020-B abbreviated category column missing');
 }
 if(mode==='after-promotion'){
  for(const [key,value] of Object.entries({
   MEMBER_DIRECTORY_API_ENABLED:'true',
   MEMBER_DIRECTORY_API_HOST:'ronde-des-archanges-universelle.eu',
   MEMBER_DIRECTORY_OFFICIAL_ENABLED:'true',
   EDITOR_D1_SESSION_API_ENABLED:'true',
   EDITOR_PIN_D1_BRIDGE_ENABLED:'true',
   MEMBER_PAGE_READ_API_ENABLED:'true'
  }))assert.equal(bindings.get(key)?.text,value,'Required official flag '+key);
 }
 console.log('M026_OFFICIAL_VERIFIED_'+mode.toUpperCase().replaceAll('-','_')+' '+JSON.stringify({
  version,historical_rows_preserved:true,official_routes_preserved:true,
  media_binding_preserved:true,editor_binding_preserved:true,demo_disabled:true
 }));
}