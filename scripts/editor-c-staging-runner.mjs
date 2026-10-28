// MISSION C: source-only migration of legacy D1 programme into new editor draft pages.
// Dry-run is default. --emit-sql writes ONLY an ephemeral SQL file for explicit guarded
// staging execution. --verify makes read-only comparisons. No API exposes source rows.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {convertLegacy,TABLES} from './editor-c-converter.mjs';

const EXPECTED_DB='0f761662-241f-42cc-ac94-5c68b4aa7797';
const FORBIDDEN_DB='28736d2a-479b-472b-bf82-703ad0affe10';
const EXPECTED_R2='celebrations-exit-staging';
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const token=process.env.CLOUDFLARE_API_TOKEN;
const db=process.env.STAGING_D1_ID;
const mode=process.argv[2]||'--dry-run';
assert.ok(['--dry-run','--emit-sql','--verify'].includes(mode),'Unrecognized mode');
assert.match(account||'',/^[a-f0-9]{32}$/i);
assert.ok(token?.length>15,'Cloudflare private token missing');
assert.equal(db,EXPECTED_DB,'STOP: not the approved staging database');
assert.notEqual(db,FORBIDDEN_DB,'STOP: production D1 forbidden');
assert.equal(process.env.STAGING_R2_BUCKET,EXPECTED_R2);

async function cf(path,method='GET',body){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{
  method,headers:{Authorization:'Bearer '+token, ...(body?{'content-type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined});
 assert.equal(response.status,200,'Cloudflare read denied');
 const json=await response.json();
 assert.equal(json.success,true,'Cloudflare API unsuccessful');
 return json.result;
}
async function bindings(){
 const result=await cf('/workers/scripts/celebrations-exit-staging/settings');
 const bs=result?.bindings;
 assert.ok(Array.isArray(bs),'Deployed staging bindings unavailable');
 const d1=bs.filter(x=>x.type==='d1');
 const r2=bs.filter(x=>x.type==='r2_bucket');
 assert.deepEqual(d1.map(x=>x.name).sort(),['DB','MEDIA_ACL']);
 assert.ok(d1.every(x=>(x.database_id||x.id)===EXPECTED_DB));
 assert.ok(!d1.some(x=>(x.database_id||x.id)===FORBIDDEN_DB));
 assert.equal(r2.length,1);
 assert.equal(r2[0].name,'MEDIA_BUCKET');
 assert.equal(r2[0].bucket_name,EXPECTED_R2);
 assert.equal(bs.filter(x=>['service','dispatch_namespace'].includes(x.type)).length,0);
 console.log('MISSION_C_DEPLOYED_BINDINGS_PASS db=approved_staging r2=approved_staging production_binding=false');
}
async function query(sql){
 // Only hard-coded SELECT queries below. SQL never reaches the official D1.
 assert.match(sql.trim(),/^SELECT\s/i,'Only SELECT is permitted in this tool');
 const arr=await cf('/d1/database/'+EXPECTED_DB+'/query','POST',{sql});
 assert.ok(Array.isArray(arr)&&arr.length===1&&arr[0].success!==false,'D1 read invalid');
 assert.ok(Array.isArray(arr[0].results),'Missing D1 rows');
 return arr[0].results;
}
const queries={
 celebrations_celebrations:'SELECT * FROM celebrations_celebrations ORDER BY id',
 celebrations_steps:'SELECT * FROM celebrations_steps ORDER BY celebration_id,sort_order,id',
 celebrations_events:'SELECT * FROM celebrations_events ORDER BY celebration_id,step_key,sort_order,id',
 celebrations_contents:'SELECT * FROM celebrations_contents ORDER BY id',
 celebrations_event_contents:'SELECT * FROM celebrations_event_contents ORDER BY event_id,sort_order,content_id',
 celebrations_step_contents:'SELECT * FROM celebrations_step_contents ORDER BY celebration_id,step_key,sort_order,content_id',
 celebrations_links:'SELECT * FROM celebrations_links ORDER BY id',
 celebrations_footer_drafts:'SELECT * FROM celebrations_footer_drafts ORDER BY slug,draft_number,id',
 celebrations_committee_letters:'SELECT * FROM celebrations_committee_letters ORDER BY id',
 celebrations_public_settings:'SELECT * FROM celebrations_public_settings ORDER BY id'
};
const staticPaths=['index.html','mentions-legales.html','confidentialite.html','cookies.html','apres-la-ronde/index.html','concepteur.html'];
function staticSource(){
 const o={};
 for(const p of staticPaths) o[p]=readFileSync(p,'utf8');
 return o;
}
function literal(x){
 if(x===null||x===undefined)return 'NULL';
 if(typeof x==='number'){assert.ok(Number.isSafeInteger(x),'Noninteger SQL numeric');return String(x)}
 return "'"+String(x).replaceAll("'","''")+"'";
}
function stmt(table,cols,vals,{prefix='INSERT OR IGNORE'}={}){
 assert.ok(/^editor_[bc]_[a-z_]+$/.test(table));
 return prefix+' INTO '+table+'('+cols.join(',')+') VALUES('+vals.map(literal).join(',')+');';
}
function assertCoverage(plan){
 for(const [t,v] of Object.entries(plan.coverage)){
  assert.equal(v.source,v.represented,'Unrepresented source rows: '+t);
  assert.equal(v.missing,0,'Source rows missing: '+t);
 }
 if(plan.notes.some(x=>x.startsWith('BLOCK_LIMIT:')||x.startsWith('UNREPRESENTED:')||x.startsWith('missing_content_ref:')))
  throw Error('Lossy conversion not authorized');
 assert.equal(plan.statistics.unpublished_pages,plan.statistics.pages);
 assert.ok(plan.pages.every(p=>p.blocks.length<=64));
 assert.ok(plan.pages.every(p=>p.id&&p.route_path.startsWith('/__editor/legacy/')));
}
async function existing(){
 const imports=await query('SELECT page_id,source_key,source_sha256,imported_version FROM editor_c_imports ORDER BY page_id');
 const pages=await query('SELECT id,head_version,draft_version,published_version FROM editor_b_pages ORDER BY id');
 const imp=new Map(imports.map(x=>[x.source_key,x]));
 const p=new Map(pages.map(x=>[x.id,x]));
 return {imp,p};
}
function sqlFor(plan,old){
 const SQL=['-- MISSION C generated draft-only, idempotent staging SQL. Historical tables are READ ONLY.'];
 const disposition={new:0,unchanged:0,refreshed:0,conflict:0};
 const conflictNames=[];
 for(const page of plan.pages){
  const imp=old.imp.get(page.source_key);
  const found=old.p.get(page.id);
  if(found&&!imp){disposition.conflict++;conflictNames.push(page.source_key);continue}
  if(imp&&imp.page_id!==page.id){disposition.conflict++;conflictNames.push(page.source_key);continue}
  if(imp&&imp.source_sha256===page.source_hash){disposition.unchanged++;continue}
  if(imp&&(!found||found.head_version!==imp.imported_version||found.draft_version!==imp.imported_version||found.published_version!==null)){
   disposition.conflict++;conflictNames.push(page.source_key);continue;
  }
  const version=imp?Number(imp.imported_version)+1:1;
  assert.ok(Number.isSafeInteger(version)&&version>0&&version<10000);
  if(imp)disposition.refreshed++;else disposition.new++;
  // Pages remain unpublished by design. An existing route collision is flagged by verification.
  if(!imp){
   SQL.push(stmt('editor_b_pages',['id','route_path','celebration_id','step_key','head_version','draft_version','published_version'],[
    page.id,page.route_path,page.celebration_id,page.step_key,1,1,null]));
  }
  SQL.push(stmt('editor_b_revisions',['page_id','version','title','operation'],[
   page.id,version,page.title,imp?'edit':'create']));
  for(const block of page.blocks){
   SQL.push(stmt('editor_c_blocks',['page_id','version','block_id','position','legacy_kind','source_table','source_id','data_json'],[
    page.id,version,block.block_id,block.position,block.kind,block.source_table,block.source_id,JSON.stringify(block.data)]));
  }
  if(!imp){
   SQL.push(stmt('editor_c_imports',['page_id','source_key','original_route','source_sha256','imported_version'],[
    page.id,page.source_key,page.original_route,page.source_hash,version]));
  }else{
   SQL.push('UPDATE editor_b_pages SET head_version='+version+',draft_version='+version+',updated_at=CURRENT_TIMESTAMP WHERE id='+literal(page.id)+
    ' AND head_version='+literal(imp.imported_version)+' AND published_version IS NULL;');
   SQL.push('UPDATE editor_c_imports SET source_sha256='+literal(page.source_hash)+',imported_version='+version+
    ',imported_at=CURRENT_TIMESTAMP WHERE page_id='+literal(page.id)+' AND imported_version='+literal(imp.imported_version)+';');
  }
 }
 // Each query is read-only after the action; never log the SQL or legal texts.
 return {sql:SQL.join('\n')+'\n',disposition,conflicts:conflictNames};
}
await bindings();
const legacy={};
for(const table of TABLES)legacy[table]=await query(queries[table]);
const plan=convertLegacy(legacy,{staticPages:staticSource()});
assertCoverage(plan);
const coverage=Object.fromEntries(Object.entries(plan.coverage).map(([k,v])=>[k,v.source]));
console.log('MISSION_C_SOURCE_COVERAGE '+JSON.stringify(coverage));
console.log('MISSION_C_PLAN '+JSON.stringify({...plan.statistics,notes:plan.notes}));
if(mode==='--dry-run'){
 console.log('MISSION_C_DRY_RUN_PASS no_d1_writes=true no_r2_writes=true unpublished=true');
}else{
 const old=await existing();
 const result=sqlFor(plan,old);
 console.log('MISSION_C_IMPORT_STATE '+JSON.stringify(result.disposition));
 if(result.conflicts.length){
  // No page identifiers or legal content in logs. Intentional refusal to overwrite edits.
  throw Error('Imported page conflicts ('+result.conflicts.length+'): manual reconciliation needed');
 }
 if(mode==='--emit-sql'){
  const target='/tmp/editor-c-staging-import.sql';
  writeFileSync(target,result.sql,{mode:0o600});
  console.log('MISSION_C_SQL_READY statements='+result.sql.split('\n').length+' file=protected_tmp');
 }else{
  assert.equal(result.disposition.new+result.disposition.refreshed,0,'Expected no pending import changes during verification');
  const blocks=await query('SELECT page_id,version,COUNT(*) AS n FROM editor_c_blocks GROUP BY page_id,version ORDER BY page_id,version');
  const check=old.imp.size;
  assert.equal(check,plan.pages.length,'Staging page count does not match conversion plan');
  const nByPage=new Map(blocks.map(b=>[String(b.page_id)+'|'+String(b.version),Number(b.n)]));
  for(const p of plan.pages){
   const state=old.imp.get(p.source_key);
   assert.ok(state&&state.source_sha256===p.source_hash,'Source checksum changed during import');
   assert.equal(nByPage.get(p.id+'|'+state.imported_version)||0,p.blocks.length,'Converted block count mismatch');
   const row=old.p.get(p.id);
   assert.ok(row,'Imported editor page missing');
   assert.equal(row.published_version,null,'Imported page unexpectedly published');
  }
  console.log('MISSION_C_STAGING_VERIFY_PASS pages='+plan.pages.length+' blocks='+plan.statistics.blocks+' published=0 source_coverage_complete=true');
 }
}
