// Mission B local integration: real SQL + real API, all synthetic, no Cloudflare writes.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomBytes} from 'node:crypto';
import {handleEditorB} from '../migration/cloudflare/editor-b-api.mjs';

const ORIGIN='https://celebrations-exit-staging.rondes.workers.dev';
function setup(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('PRAGMA foreign_keys=ON; CREATE TABLE celebrations_celebrations(id INTEGER PRIMARY KEY,status TEXT); CREATE TABLE celebrations_admin_sessions(token_hash TEXT PRIMARY KEY,admin_email TEXT,expires_at TEXT);');
 sqlite.exec(readFileSync(new URL('../migration/cloudflare/editor-b-schema.sql',import.meta.url),'utf8'));
 sqlite.exec(readFileSync(new URL('../migration/cloudflare/editor-c-schema.sql',import.meta.url),'utf8'));
 sqlite.prepare("INSERT INTO celebrations_celebrations(id,status) VALUES(1,'active'),(2,'planned')").run();
 const raw=randomBytes(32).toString('hex');
 const hash=createHash('sha256').update(raw).digest('hex');
 sqlite.prepare('INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)').run(hash,'synthetic@invalid.example',new Date(Date.now()+600000).toISOString());
 const adapter={
  prepare(sql){return{bind(...args){const stmt=sqlite.prepare(sql);return{
   async first(){return stmt.get(...args)||null},
   async all(){return{results:stmt.all(...args)}},
   async run(){const result=stmt.run(...args);return{meta:{changes:Number(result.changes)}}}
  }}}},
  async batch(statements){
   sqlite.exec('BEGIN');
   try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results}
   catch(e){sqlite.exec('ROLLBACK');throw e}
  }
 };
 async function api(action,data={},authenticated=true){
  const get=action==='public'||action==='draft';
  const id=data.page_id;
  const url=get?ORIGIN+'/api/editor-b?action='+action+'&page_id='+encodeURIComponent(id||''):ORIGIN+'/api/editor-b';
  const headers=authenticated?{Authorization:'Bearer '+raw}:{};
  if(!get)headers['Content-Type']='application/json';
  const request=new Request(url,{method:get?'GET':'POST',headers,body:get?undefined:JSON.stringify({action,...data})});
  const response=await handleEditorB(request,{DB:adapter});
  return {status:response.status,body:await response.json()};
 }
 return {sqlite,api};
}
test('Mission B drafts, deliberate publication, versions, CAS, secure API and historical integrity',async()=>{
 const {api,sqlite}=setup();
 const initial={celebrations:sqlite.prepare('SELECT COUNT(*) n FROM celebrations_celebrations').get().n,
                  sessions:sqlite.prepare('SELECT COUNT(*) n FROM celebrations_admin_sessions').get().n};
 const denied=await api('create',{title:'Ébauche',route_path:'/mission-b/test'},false);
 assert.equal(denied.status,401);
 const create=await api('create',{title:'Page fictive',route_path:'/mission-b/test'});
 assert.equal(create.status,201);
 const id=create.body.page_id;
 assert.equal((await api('public',{page_id:id},false)).status,404,'Draft must never be public');
 assert.equal((await api('draft',{page_id:id},false)).status,401,'Visitor cannot read draft');
 let rev=1;
 const edited=await api('edit_title',{page_id:id,expected_version:rev,title:'Titre fictif modifié'});
 assert.equal(edited.status,200);rev=edited.body.version;
 const addA=await api('add_block',{page_id:id,expected_version:rev,kind:'text',data:{text:'Premier bloc fictif'}});
 assert.equal(addA.status,200);rev=addA.body.version;
 const addB=await api('add_block',{page_id:id,expected_version:rev,kind:'banner',data:{text:'Bandeau fictif'}});
 assert.equal(addB.status,200);rev=addB.body.version;
 const draft=await api('draft',{page_id:id});
 assert.equal(draft.body.page.blocks.length,2);
 const block0=draft.body.page.blocks[0].block_id,block1=draft.body.page.blocks[1].block_id;
 const move=await api('move_block',{page_id:id,expected_version:rev,block_id:block1,position:0});
 assert.equal(move.status,200);rev=move.body.version;
 assert.equal((await api('draft',{page_id:id})).body.page.blocks[0].block_id,block1);
 const change=await api('edit_block',{page_id:id,expected_version:rev,block_id:block0,data:{text:'Premier bloc modifié'}});
 assert.equal(change.status,200);rev=change.body.version;
 assert.equal((await api('public',{page_id:id},false)).status,404);
 const stale=await api('edit_title',{page_id:id,expected_version:rev-1,title:'Conflit'});
 assert.equal(stale.status,409,'Concurrent stale writer must be rejected');
 const noAuth=await api('publish',{page_id:id,expected_version:rev},false);
 assert.equal(noAuth.status,401);
 const publish=await api('publish',{page_id:id,expected_version:rev});
 assert.equal(publish.status,200);rev=publish.body.version;
 assert.equal((await api('public',{page_id:id},false)).body.page.blocks.length,2);
 const cut=await api('remove_block',{page_id:id,expected_version:rev,block_id:block1});
 assert.equal(cut.status,200);rev=cut.body.version;
 assert.equal((await api('public',{page_id:id},false)).body.page.blocks.length,2,'Unpublished edits cannot change public snapshot');
 const restored=await api('restore',{page_id:id,expected_version:rev,source_version:2});
 assert.equal(restored.status,200);rev=restored.body.version;
 assert.equal((await api('draft',{page_id:id})).body.page.blocks.length,0,'Restoration creates a draft snapshot');
 assert.equal((await api('public',{page_id:id},false)).body.page.blocks.length,2,'Restoration must not publish');
 const republish=await api('publish',{page_id:id,expected_version:rev});
 assert.equal(republish.status,200);
 assert.equal((await api('public',{page_id:id},false)).body.page.blocks.length,0);
 const planned=await api('create',{title:'Célébration future',route_path:'/mission-b/future',celebration_id:2});
 assert.equal(planned.status,201);
 assert.equal((await api('publish',{page_id:planned.body.page_id,expected_version:1})).status,403,'Future celebration cannot publish');
 assert.equal((await api('public',{page_id:planned.body.page_id},false)).status,404);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM celebrations_celebrations').get().n,initial.celebrations);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM celebrations_admin_sessions').get().n,initial.sessions);
 console.log('MISSION_B_LOCAL_INTEGRATION_PASS create=true blocks=true move=true edit=true draft_private=true publish_explicit=true version_restore=true conflict_409=true anonymous_denied=true future_blocked=true historical_unchanged=true');
});
