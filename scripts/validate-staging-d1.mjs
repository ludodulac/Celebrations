// Real Cloudflare D1 / staging Worker validation. FAIL CLOSED before any write.
// Uses dedicated disposable IDs only; never invokes media or production routes.
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';

const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const token=process.env.CLOUDFLARE_API_TOKEN;
const dbId=process.env.STAGING_D1_ID;
const bucket=process.env.STAGING_R2_BUCKET;
const script='celebrations-exit-staging';
const dbName='celebrations-exit-staging';
const endpoint='https://celebrations-exit-staging.rondes.workers.dev/api/safe-save';
const runId=process.env.GITHUB_RUN_ID || 'local';
const required=(v)=>typeof v==='string' && v.trim().length>0;
function check(ok,message){if(!ok)throw Error(message)}
function uuid(s){return typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)}
check([account,token,dbId,bucket].every(required),'Missing staging credentials/config');
check(uuid(dbId),'Staging D1 identifier is not a UUID');
check(bucket===dbName,'Unexpected R2 bucket; refusing to continue');
const base='https://api.cloudflare.com/client/v4';
async function cf(path,options={}){
 const res=await fetch(base+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(options.headers||{})}});
 const data=await res.json().catch(()=>null);
 check(res.ok&&data?.success===true,'Cloudflare API request failed ('+res.status+')');
 return data;
}
function d1(sql,params=[]){
 return cf('/accounts/'+account+'/d1/database/'+dbId+'/query',{method:'POST',body:JSON.stringify({sql,params})}).then(data=>{
  check(Array.isArray(data.result)&&data.result.length===1&&data.result[0]?.success!==false,'D1 query failed');
  return data.result[0].results||[];
 });
}
function tableCount(table){return d1('SELECT COUNT(*) AS n FROM "'+table+'"').then(rows=>Number(rows[0].n))}
function eq(actual,expected,message){assert.deepEqual(actual,expected,message)}
async function verifyIsolation(){
 const verify=await cf('/user/tokens/verify');
 check(verify.result?.status==='active','Cloudflare token is not active');
 const database=(await cf('/accounts/'+account+'/d1/database/'+dbId)).result;
 check(database?.uuid===dbId && database?.name===dbName,'D1 identity mismatch');
 const dbs=(await cf('/accounts/'+account+'/d1/database?per_page=100')).result;
 check(Array.isArray(dbs),'D1 database listing unavailable');
 check(dbs.length<100,'D1 database inventory not proven complete');
 check(dbs.filter(d=>d.uuid===dbId).length===1,'Staging D1 absent or duplicated');
 check(dbs.filter(d=>d.name===dbName).length===1,'Staging database name ambiguous');
 // Enumerate EVERY script in the account. Fail if any script is uninspectable.
 const workersData=await cf('/accounts/'+account+'/workers/scripts?per_page=100');
 const scripts=workersData.result;
 check(Array.isArray(scripts)&&scripts.length<100,'Cannot exhaustively enumerate Workers');
 check(scripts.some(s=>(s.id||s.name)===script),'Staging Worker missing');
 for(const item of scripts){
  const name=item.id||item.name;
  check(typeof name==='string'&&name.length>0,'Unknown script identity');
  const settings=(await cf('/accounts/'+account+'/workers/scripts/'+encodeURIComponent(name)+'/settings')).result;
  check(Array.isArray(settings?.bindings),'Worker bindings unavailable for '+name);
  const bindings=settings.bindings;
  const staging=name===script;
  if(staging){
   const d1Bindings=bindings.filter(b=>b.type==='d1');
   check(d1Bindings.length===2,'Staging Worker has unexpected D1 bindings');
   check(['DB','MEDIA_ACL'].every(n=>d1Bindings.some(b=>b.name===n&&(b.id||b.database_id)===dbId)),'Staging D1 bindings mismatch');
   const r2=bindings.filter(b=>b.type==='r2_bucket');
   check(r2.length===1&&r2[0].name==='MEDIA_BUCKET'&&r2[0].bucket_name===bucket,'Staging Worker has unsafe R2 bindings');
  }else{
   check(!bindings.some(b=>b.type==='d1'&&(b.id||b.database_id)===dbId),'Another Worker shares staging D1');
  }
 }
 const storage=(await cf('/accounts/'+account+'/r2/buckets/'+bucket)).result;
 check(storage?.name===bucket,'Staging R2 bucket identity cannot be verified');
 // A staging base with real visitors is not suitable for destructive tests.
 for(const table of ['celebrations_participants','celebrations_participant_sessions','celebrations_user_profiles','celebrations_clicks']){
  check(await tableCount(table)===0,'Potential real visitor data found: '+table);
 }
 console.log('ISOLATION PASS: Cloudflare account, database UUID/name, all Worker bindings, R2 bucket, visitor-data checks');
}
const suffix=runId.replace(/[^0-9]/g,'').slice(-9)+'-'+randomBytes(5).toString('hex');
const idA=1500000000+randomBytes(4).readUInt32BE(0)%100000000;
const idB=idA+1;
const contentA='validation-002c-content-'+suffix;
const contentB='validation-002c-text-'+suffix;
const eventA='validation-002c-event-'+suffix;
const eventB='validation-002c-other-'+suffix;
const day='validation-002c-day';
const secret=randomBytes(32).toString('hex');
const hash=createHash('sha256').update(secret).digest('hex');
let writeStarted=false, tests=0;
const checkTest=(value,message)=>{check(value,message);tests++;console.log('PASS: '+message)};
const one=async(sql,params=[])=> (await d1(sql,params))[0];
const safeBody=(withControl,title='Event initial',eventLinks=[{label:'Ev',url:'https://example.invalid/event'}])=>({
 action:'safe_merge', groups:[],
 contents:[
  {id:contentA,name:'Audio',type:'audio',sourceType:'storage',storagePath:'validation-only/audio.mp3',fileName:'audio.mp3',hasCover:true,coverStoragePath:'validation-only/cover.png',coverFileName:'cover.png'},
  {id:contentB,name:'Text',type:'text',sourceType:'inline',text:'Validation'}
 ],
 celebrations:[
  {id:idA,archangel:'Validation',days:[{key:day,label:'Day',contentIds:[contentB,contentA],links:[{label:'First',url:'https://example.invalid/1'},{label:'Second',url:'https://example.invalid/2'}]}]},
  ...(withControl?[{id:idB,archangel:'Control',days:[{key:day,label:'Day',contentIds:[],links:[{label:'Control',url:'https://example.invalid/control'}]}]}]:[])
 ],
 events:[
  {id:eventA,celebrationId:idA,dayKey:day,title,contentIds:[contentA,contentB],links:eventLinks},
  ...(withControl?[{id:eventB,celebrationId:idB,dayKey:day,title:'Unchanged',contentIds:[],links:[]}]:[])
 ]
});
async function save(payload){
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+secret},body:JSON.stringify(payload),redirect:'error'});
 const body=await response.json().catch(()=>null);
 check(response.status===200&&body?.ok===true&&body?.safe===true,'Real Worker save failed: HTTP '+response.status+' '+String(body?.error||''));
}
async function readLinks(id){
 return d1('SELECT step_key,event_id,label,url,sort_order FROM celebrations_links WHERE celebration_id=? ORDER BY CASE WHEN event_id IS NULL THEN 0 ELSE 1 END,sort_order',[id]);
}
async function cleanup(){
 // Delete ONLY synthetic records created under dedicated IDs, respecting FK dependencies.
 // Never use a blanket table deletion.
 const queries=[
  ['DELETE FROM celebrations_links WHERE celebration_id IN (?,?)',[idA,idB]],
  ['DELETE FROM celebrations_event_contents WHERE event_id IN (?,?)',[eventA,eventB]],
  ['DELETE FROM celebrations_step_contents WHERE celebration_id IN (?,?)',[idA,idB]],
  ['DELETE FROM celebrations_events WHERE id IN (?,?)',[eventA,eventB]],
  ['DELETE FROM celebrations_steps WHERE celebration_id IN (?,?)',[idA,idB]],
  ['DELETE FROM celebrations_contents WHERE id IN (?,?)',[contentA,contentB]],
  ['DELETE FROM celebrations_celebrations WHERE id IN (?,?)',[idA,idB]],
  ['DELETE FROM celebrations_admin_sessions WHERE token_hash=?',[hash]]
 ];
 const errors=[];
 for(const [sql,params] of queries){try{await d1(sql,params)}catch(e){errors.push(e.message)}}
 check(errors.length===0,'Cleanup incomplete: '+errors.join('; '));
 check((await one('SELECT COUNT(*) AS n FROM celebrations_celebrations WHERE id IN (?,?)',[idA,idB])).n===0,'Cleanup celebrations failed');
 check((await one('SELECT COUNT(*) AS n FROM celebrations_admin_sessions WHERE token_hash=?',[hash])).n===0,'Cleanup session failed');
 console.log('CLEANUP PASS: validation records removed');
}
await verifyIsolation(); // NO WRITES before this line succeeds
// Verify all synthetic IDs are unused, including adjacent control record.
const collisions=[
 await one('SELECT COUNT(*) AS n FROM celebrations_celebrations WHERE id IN (?,?)',[idA,idB]),
 await one('SELECT COUNT(*) AS n FROM celebrations_events WHERE id IN (?,?)',[eventA,eventB]),
 await one('SELECT COUNT(*) AS n FROM celebrations_contents WHERE id IN (?,?)',[contentA,contentB]),
 await one('SELECT COUNT(*) AS n FROM celebrations_admin_sessions WHERE token_hash=?',[hash])
];
check(collisions.every(x=>x.n===0),'Collision with existing staging data');
try{
 writeStarted=true;
 await d1('INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)',[hash,'test-only@invalid.example',new Date(Date.now()+3600_000).toISOString()]);
 await save(safeBody(true));
 checkTest((await one('SELECT COUNT(*) AS n FROM celebrations_links WHERE celebration_id=?',[idA])).n===3,'links created in real D1');
 const initialLinks=await readLinks(idA);
 eq(initialLinks.map(x=>x.sort_order),[0,1,0],'link sort order');
 checkTest(true,'link order preserved');
 const relation=await d1('SELECT content_id,sort_order FROM celebrations_event_contents WHERE event_id=? ORDER BY sort_order',[eventA]);
 eq(relation.map(x=>[x.content_id,x.sort_order]),[[contentA,0],[contentB,1]],'event relation sort order');
 checkTest(true,'event/content relations');
 const steps=await d1('SELECT content_id,sort_order FROM celebrations_step_contents WHERE celebration_id=? ORDER BY sort_order',[idA]);
 eq(steps.map(x=>[x.content_id,x.sort_order]),[[contentB,0],[contentA,1]],'step relation sort order');
 checkTest(true,'step/content relations');
 checkTest((await one('SELECT storage_path,cover_storage_path FROM celebrations_contents WHERE id=?',[contentA])).cover_storage_path==='validation-only/cover.png','media reference preserved');
 const controlLinks=await readLinks(idB);
 await save(safeBody(false,'Event modified',[]));
 checkTest((await one('SELECT title FROM celebrations_events WHERE id=?',[eventA])).title==='Event modified','event modification');
 checkTest((await one('SELECT COUNT(*) AS n FROM celebrations_links WHERE celebration_id=?',[idA])).n===2,'explicit event link deletion');
 checkTest(JSON.stringify(await readLinks(idB))===JSON.stringify(controlLinks),'unrelated celebration untouched');
 const before=await readLinks(idA);
 await save(safeBody(false,'Event modified',[]));
 checkTest(JSON.stringify(before)===JSON.stringify(await readLinks(idA)),'idempotent save');
 checkTest((await d1('PRAGMA foreign_key_check')).length===0,'foreign keys intact');
 console.log('D1 VALIDATION PASS: '+tests+' checks');
}finally{
 if(writeStarted)await cleanup();
}
