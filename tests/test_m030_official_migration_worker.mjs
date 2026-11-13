import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import migration from '../scripts/m030_official_migration_worker.mjs';
const SHA=x=>createHash('sha256').update(x).digest('hex');
const original=JSON.stringify({version:41,drafts:Object.fromEntries(
 ['101','102','103','104','105','106','107'].map(x=>[x,{pages:[{id:'accueil-'+x,blocks:[]}]}])),
 published:{drafts:Object.fromEntries(['101','102','103','104','105','106','107'].map(x=>[x,{pages:[{id:'accueil-'+x,blocks:[]}]}]))},
 shared:{pages:[{id:'home',name:'Accueil',blocks:[]}]},
 mediaCatalogue:[{id:'asset-1',src:'media/old.jpg'}]});
const cleaned=JSON.stringify({...JSON.parse(original),version:42,
 drafts:{'101':JSON.parse(original).drafts['101']},
 published:{drafts:{'101':JSON.parse(original).published.drafts['101']}}});
const rollback=JSON.stringify({...JSON.parse(original),version:43});
function fixture({dbFailure=false,concurrent=false}={}){
 const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE celebrations_celebrations(id INTEGER PRIMARY KEY,archangel TEXT,year TEXT)');
 db.exec('CREATE TABLE celebrations_steps(id INTEGER PRIMARY KEY,celebration_id INTEGER, step_key TEXT)');
 for(let id=101;id<=107;id++){
  const names={101:['Michaël','2026'],102:['Gabriel','2026–2027'],
   103:['Raphaël','2027'],104:['Ouriel','2028'],105:['Michaël','2026'],
   106:['Michaël','2026'],107:['Gabriel','2027']};
  db.prepare('INSERT INTO celebrations_celebrations VALUES(?,?,?)').run(id,...names[id]);
 }
 for(let i=0;i<7;i++)db.prepare('INSERT INTO celebrations_steps(celebration_id,step_key) VALUES(?,?)').run(101,'s'+i);
 for(const id of [102,103,104])for(let i=0;i<7;i++)
  db.prepare('INSERT INTO celebrations_steps(celebration_id,step_key) VALUES(?,?)').run(id,'s'+i);
 const store={value:original,etag:'etag-0',puts:0};
 const bucket={
  async get(key){assert.equal(key,'editor-trials/server-drafts-v1.json');
   return {etag:store.etag,async text(){return store.value}}},
  async put(key,body,opts){
   assert.equal(key,'editor-trials/server-drafts-v1.json');
   if(concurrent){store.value=JSON.stringify({...JSON.parse(original),version:55});store.etag='etag-concurrent';concurrent=false}
   if(opts.onlyIf?.etagMatches!==store.etag)return null;
   store.value=body;store.puts++;store.etag='etag-'+store.puts;
   return {etag:store.etag};
  }
 };
 const adapter={
  prepare(sql){
   const st=db.prepare(sql);
   return {
    async all(){return {results:st.all()}},
    async first(){return st.get()||null},
    sql
   }
  },
  async batch(queries){
   if(dbFailure)throw Error('D1 batch failed before any commit');
   db.exec('BEGIN');
   const result=[];
   try{
    for(const q of queries){
     const info=db.prepare(q.sql).run();
     result.push({meta:{changes:Number(info.changes)}});
    }
    db.exec('COMMIT');return result;
   }catch(e){db.exec('ROLLBACK');throw e}
  }
 };
 const env={DB:adapter,BUCKET:bucket,M030_RELEASE_APPROVED:'YES',
  M030_TARGET_KEY:'editor-trials/server-drafts-v1.json',M030_RELEASE_TOKEN:'a'.repeat(64)};
 const manifest={expectedWorker:'76f31003-53b1-436f-ab6d-3217b05c91c3',
  expectedD1Ids:['101','102','103','104','105','106','107'],
  deleteIds:['102','103','104','105','106','107'],keepId:'101',deleteStepCount:21,
  oldRevision:41,newRevision:42,rollbackRevision:43,
  oldSha256:SHA(original),newSha256:SHA(cleaned),rollbackSha256:SHA(rollback)};
 async function call({token=env.M030_RELEASE_TOKEN,input={manifest,cleanPayload:cleaned,rollbackPayload:rollback}}={}){
  const res=await migration.fetch(new Request('https://m030-ephemeral.rondes.workers.dev/m030-commit',{
   method:'POST',headers:{'content-type':'application/json','x-m030-release-token':token},
   body:JSON.stringify(input)
  }),env);
  return {status:res.status,data:await res.json()};
 }
 return {db,store,call,close:()=>db.close()};
}
test('M10: one-shot atomic migration preserves Michaël 101, pages, media; deletes exactly six identities and 21 steps',async()=>{
 const f=fixture();
 try{
  const res=await f.call();
  assert.equal(res.status,200,JSON.stringify(res.data));
  assert.equal(res.data.ok,true);
  assert.equal(res.data.removedIdentities,6);
  assert.equal(res.data.removedSteps,21);
  assert.equal(res.data.mediaObjectsDeleted,0);
  assert.deepEqual(f.db.prepare('SELECT id FROM celebrations_celebrations').all().map(x=>x.id),[101]);
  assert.equal(f.db.prepare('SELECT count(*) n FROM celebrations_steps').get().n,7);
  assert.equal(f.db.prepare("SELECT count(*) n FROM sqlite_master WHERE type='index' AND name='idx_celebrations_archangel_year_unique'").get().n,1);
  assert.equal(f.store.value,cleaned);
  assert.ok(JSON.parse(f.store.value).mediaCatalogue.some(x=>x.id==='asset-1'));
 }finally{f.close()}
});
test('M10: unauthorized token and stale source SHA never write either D1 or R2',async()=>{
 const f=fixture();
 try{
  const unauthorized=await f.call({token:'bad'});
  assert.equal(unauthorized.status,401);
  assert.equal(f.store.puts,0);
  const input={manifest:{expectedWorker:'wrong',expectedD1Ids:[]},cleanPayload:cleaned,rollbackPayload:rollback};
  const mismatch=await f.call({input});
  assert.equal(mismatch.status,400);
  assert.equal(f.db.prepare('SELECT count(*) n FROM celebrations_celebrations').get().n,7);
  assert.equal(f.store.value,original);
 }finally{f.close()}
});
test('M10: concurrent R2 write fails atomic CAS and must not alter D1',async()=>{
 const f=fixture({concurrent:true});
 try{
  const res=await f.call();
  assert.equal(res.status,409,JSON.stringify(res.data));
  assert.equal(f.db.prepare('SELECT count(*) n FROM celebrations_celebrations').get().n,7);
  assert.equal(f.store.puts,0);
 }finally{f.close()}
});
test('M10: failed D1 batch restores editor through CAS without overwriting other data',async()=>{
 const f=fixture({dbFailure:true});
 try{
  const res=await f.call();
  assert.equal(res.status,500);
  assert.match(res.data.error,/R2 restored safely/);
  assert.equal(f.db.prepare('SELECT count(*) n FROM celebrations_celebrations').get().n,7);
  assert.equal(f.store.puts,2);
  assert.equal(JSON.parse(f.store.value).version,43);
  assert.deepEqual(Object.keys(JSON.parse(f.store.value).drafts).length,7);
 }finally{f.close()}
});
