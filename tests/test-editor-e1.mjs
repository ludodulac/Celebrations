import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {handleEditorE1} from '../migration/cloudflare/editor-e1-api.mjs';
const BASE='https://celebrations-exit-staging.rondes.workers.dev';
const auth='synthetic-active-admin-session'.padEnd(64,'x');
const hash=s=>createHash('sha256').update(s).digest('hex');
const pid=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON; CREATE TABLE celebrations_celebrations(id INTEGER PRIMARY KEY,archangel TEXT,status TEXT,year TEXT);CREATE TABLE celebrations_contents(id TEXT PRIMARY KEY,name TEXT,content_type TEXT,source_type TEXT,storage_path TEXT,audience TEXT); CREATE TABLE celebrations_admin_sessions(token_hash TEXT PRIMARY KEY,admin_email TEXT,expires_at TEXT);');
 db.exec(readFileSync(new URL('../migration/cloudflare/editor-b-schema.sql',import.meta.url),'utf8'));
 db.exec(readFileSync(new URL('../migration/cloudflare/editor-c-schema.sql',import.meta.url),'utf8'));
 db.prepare("INSERT INTO celebrations_celebrations VALUES(101,'Michaël','active','2026')").run();
 db.prepare("INSERT INTO celebrations_contents VALUES('img-1','Image disponible','image','file','media/existing.jpg','all')").run();
 db.prepare('INSERT INTO celebrations_admin_sessions VALUES(?,?,?)').run(hash(auth),'qa@example.invalid',new Date(Date.now()+3600000).toISOString());
 for(let i=0;i<2;i++){
  const id=pid[i],key=i?'celebration:101:step:Mercredi':'home';
  db.prepare('INSERT INTO editor_b_pages(id,route_path,celebration_id,step_key) VALUES(?,?,?,?)').run(id,'/__editor/legacy/'+i,i?101:null,i?'mercredi-101':null);
  db.prepare("INSERT INTO editor_b_revisions(page_id,version,title,operation) VALUES(?,1,?,'create')").run(id,i?'Michaël — mercredi':'Accueil général');
  db.prepare('INSERT INTO editor_c_imports(page_id,source_key,original_route,source_sha256,imported_version) VALUES(?,?,?,?,1)').run(id,key,'/','sha_'+i);
  const kind=i?'legacy_event':'static_html_snapshot';
  const record=i?{record:{id:7,title:'Historique midi',description:'Texte original',audience:'all'},ordered_content_refs:[{content_id:'doc-1'}],links:[]}:{html:'<p>Historique initial</p>',render_policy:'sanitize_and_review'};
  db.prepare('INSERT INTO editor_c_blocks(page_id,version,block_id,position,legacy_kind,source_table,source_id,data_json) VALUES(?,1,?,0,?,?,?,?)').run(id,'block-'+i,kind,i?'celebrations_events':'static',i?'7':'index.html#welcome',JSON.stringify(record));
 }
 const DB={
  prepare(sql){const q=db.prepare(sql);return{
   bind(...params){return{
    first:async()=>q.get(...params)||null, all:async()=>({results:q.all(...params)}),
    run:async()=>({meta:{changes:q.run(...params).changes}})
   }},
   first:async()=>q.get()||null,all:async()=>({results:q.all()}),run:async()=>({meta:{changes:q.run().changes}})
  }},
  async batch(statements){
   db.exec('BEGIN IMMEDIATE');
   try{const results=[];for(const st of statements)results.push(await st.run());db.exec('COMMIT');return results}
   catch(e){db.exec('ROLLBACK');throw e}
  }
 };
 return {db,DB,close:()=>db.close()};
}
const send=(DB,payload,authenticated=true)=>handleEditorE1(new Request(BASE+'/api/editor-e1',{method:'POST',headers:{'content-type':'application/json',...(authenticated?{authorization:'Bearer '+auth}:{})},body:JSON.stringify(payload)}),{DB});
const get=(DB,key,action='page',authenticated=true)=>handleEditorE1(new Request(BASE+'/api/editor-e1?key='+encodeURIComponent(key)+'&action='+action,{headers:authenticated?{authorization:'Bearer '+auth}:{}}),{DB});
test('E1 real imported home block: save, reload, CAS conflict, version history, restore original',async()=>{
 const x=fixture();
 try{
  assert.equal((await get(x.DB,'home','page',false)).status,401);
  assert.equal((await get(x.DB,'catalogue-part:0')).status,404);
  let baseline=await(await get(x.DB,'home')).json();
  assert.equal(baseline.version,1);
  assert.equal(baseline.editable[0].kind,'static_html_snapshot');
  let imageList=await(await get(x.DB,'home','images')).json();
  assert.equal(imageList.images[0].id,'img-1');
  const saved=await send(x.DB,{action:'save',key:'home',expected_version:1,changes:[{
   id:'block-0',values:{heading:'Nouveau titre',subtitle:'Sous-titre mobile',button_label:'Découvrir',button_href:'/__editor/preview?key=celebration%3A101',hero_image_id:'img-1'}
  }]});
  assert.equal(saved.status,200,await saved.text().catch(()=>null));
  const current=await(await get(x.DB,'home')).json();
  assert.equal(current.version,2);
  assert.equal(current.editable[0].values.heading,'Nouveau titre');
  assert.equal((await send(x.DB,{action:'save',key:'home',expected_version:1,changes:[{id:'block-0',values:{heading:'Concurrent'}}]})).status,409);
  assert.equal((await send(x.DB,{action:'save',key:'home',expected_version:2,changes:[{id:'block-0',values:{hero_image_id:'a-private-file'}}]})).status,400);
  const original=x.db.prepare('SELECT data_json,source_id FROM editor_c_blocks WHERE page_id=? AND version=1').get(pid[0]);
  const overlay=x.db.prepare('SELECT data_json,source_id FROM editor_c_blocks WHERE page_id=? AND version=2').get(pid[0]);
  assert.equal(original.source_id,overlay.source_id);
  assert.equal(JSON.parse(overlay.data_json).html,JSON.parse(original.data_json).html);
  const history=await(await get(x.DB,'home','versions')).json();
  assert.equal(history.versions.length,2);
  const restored=await send(x.DB,{action:'restore',key:'home',expected_version:2,source_version:1});
  assert.equal(restored.status,200);
  const after=await(await get(x.DB,'home')).json();
  assert.equal(after.version,3);
  assert.equal(after.editable[0].values.heading,baseline.editable[0].values.heading);
  assert.equal(x.db.prepare('SELECT COUNT(*) AS n FROM editor_b_revisions WHERE page_id=?').get(pid[0]).n,3);
 }finally{x.close()}
});
test('E1 real imported Wednesday event stores editable overlay, not historical source event',async()=>{
 const x=fixture();
 try{
  const before=await(await get(x.DB,'celebration:101:step:Mercredi')).json();
  const event=before.editable[0];
  const saved=await send(x.DB,{action:'save',key:before.key,expected_version:1,changes:[{
   id:event.id,values:{title:'Rendez-vous corrigé',description:'Description corrigée'}
  }]});
  assert.equal(saved.status,200);
  const current=await(await get(x.DB,before.key)).json();
  assert.equal(current.editable[0].values.title,'Rendez-vous corrigé');
  const old=x.db.prepare('SELECT data_json FROM editor_c_blocks WHERE page_id=? AND version=1').get(pid[1]);
  const now=x.db.prepare('SELECT data_json FROM editor_c_blocks WHERE page_id=? AND version=2').get(pid[1]);
  assert.equal(JSON.parse(now.data_json).record.title,JSON.parse(old.data_json).record.title);
  assert.equal(JSON.parse(now.data_json).ordered_content_refs[0].content_id,'doc-1');
  assert.equal((await send(x.DB,{action:'save',key:before.key,expected_version:2,changes:[{id:event.id,values:{title:'<script>not executable</script>'}}]},false)).status,401);
  assert.equal((await send(x.DB,{action:'restore',key:before.key,expected_version:2,source_version:1})).status,200);
  assert.equal((await(await get(x.DB,before.key)).json()).editable[0].values.title,event.values.title);
 }finally{x.close()}
});
