import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHmac} from 'node:crypto';
import {sha256} from '../migration/cloudflare/auth-api.mjs';
import {handlePrivateEditorCommand} from '../migration/cloudflare/app/application/private-editor-publication-service.mjs';
import {createCanonicalPrivateLoaders} from '../migration/cloudflare/app/persistence/private-canonical-content.mjs';
import {handleCanonicalPrivatePage} from '../migration/cloudflare/app/application/private-content-read-service.mjs';
import {publicSnapshot,handleEditorPublication} from '../migration/cloudflare/editor-publication-api.mjs';
import {handleServerDraft} from '../migration/cloudflare/editor-server-draft-api.mjs';
import {EDITOR_SNAPSHOT_KEY} from '../migration/cloudflare/app/ports/editor-snapshot-contract.mjs';
const SITE='https://www.ronde-des-archanges-universelle.eu',ADMIN='a'.repeat(64),PART='b'.repeat(64);
const TYPE='member-type:chant',P='person:550e8400-e29b-41d4-a716-446655440000',EMAIL='p@example.org';
const CLAIM='claim:550e8400-e29b-41d4-a716-446655440000';
const policy={mode:'SELECTED_TYPES',typeIds:[TYPE]};
const pubPolicy={mode:'PUBLIC'};
const page=(id,more={})=>({id,name:'PRIVATE_SECRET',blocks:[{kind:'text',text:'PRIVATE_SECRET'}],accessPolicy:policy,...more});
const space=(id='draft-space:1',pid='draft-page:1',more={})=>({id,celebrationId:'41',name:'PRIVATE_SPACE',
 visibility:'PRIVATE',accessPolicy:policy,pages:[page(pid,{spaceId:id,accessPolicy:pubPolicy})],...more});
const request=(b,token=ADMIN,origin=SITE)=>new Request(SITE+'/api/admin/private-editor',{
 method:'POST',headers:{'content-type':'application/json',origin,...(token?{authorization:'Bearer '+token}:{})},
 body:JSON.stringify(b)});
async function fixture(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 for(const f of ['celebrations-schema.sql','d1-migrations/20261110_007a_contact_directory.sql',
  'd1-migrations/20261110_008b_directory_integrity.sql','d1-migrations/20261110_009b_explicit_identity_links.sql',
  'd1-migrations/20261111_012c_private_release_fences.sql'])
  db.exec(readFileSync(new URL('../migration/cloudflare/'+f,import.meta.url),'utf8'));
 for(const id of [41,42])db.prepare('INSERT INTO celebrations_celebrations(id,archangel) VALUES(?,?)').run(id,'Gabriel');
 db.prepare('INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)')
  .run(await sha256(ADMIN),'admin@example.org',new Date(Date.now()+3600000).toISOString());
 db.prepare('INSERT INTO celebrations_participants(email,password_hash,audience) VALUES(?,?,?)').run(EMAIL,'hash','angel');
 db.prepare('INSERT INTO celebrations_participant_sessions(token_hash,participant_email,expires_at) VALUES(?,?,?)')
  .run(await sha256(PART),EMAIL,new Date(Date.now()+3600000).toISOString());
 db.prepare('INSERT INTO celebrations_directory_people(id,email_normalized) VALUES(?,?)').run(P,EMAIL);
 db.prepare('INSERT INTO celebrations_directory_member_types(id,name) VALUES(?,?)').run(TYPE,'Chant');
 db.prepare('INSERT INTO celebrations_directory_person_types(person_id,type_id) VALUES(?,?)').run(P,TYPE);
 db.prepare('INSERT INTO celebrations_directory_person_celebrations(person_id,celebration_id) VALUES(?,?)').run(P,41);
 db.prepare("INSERT INTO celebrations_directory_identity_claims(claim_id,participant_email,person_id,status,reviewed_at,reviewed_by,verification_method) VALUES(?,?,?,'approved',?,?,?)")
  .run(CLAIM,EMAIL,P,'2026-11-11T00:00:00.000Z','admin@example.org','video_verified');
 db.prepare('INSERT INTO celebrations_directory_identity_links(participant_email,person_id,approved_claim_id) VALUES(?,?,?)').run(EMAIL,P,CLAIM);
 let state={version:1,drafts:{'41':{pages:[{id:'mercredi-41',name:'Public',group:'celebration',visibility:'published',blocks:[{kind:'text',text:'PUBLIC'}]}]}},
  shared:{pages:[],homeId:'',celebrationVisibility:{'41':'published'}},plans:[],mediaCatalogue:[]};
 let etag=1,failD1=false,failCAS=false,batches=0,writes=0;
 const DB={prepare(sql){return {bind(...params){const stmt=db.prepare(sql);
  const run=()=>({meta:{changes:Number(stmt.run(...params).changes)}});
  return {first:async()=>stmt.get(...params)??null,all:async()=>({results:stmt.all(...params)}),run:async()=>run(),_run:run}
 } }},async batch(stmts){
  batches++;if(failD1)throw Error('synthetic D1 fault');
  db.exec('BEGIN');try{const results=stmts.map(s=>s._run());db.exec('COMMIT');return results}
  catch(e){db.exec('ROLLBACK');throw e}
 }};
 const EDITOR_BUCKET={async get(key){assert.equal(key,EDITOR_SNAPSHOT_KEY);
  const snapshot=JSON.stringify(state);return {etag:String(etag),body:true,text:async()=>snapshot}},
  async put(key,value,options){assert.equal(key,EDITOR_SNAPSHOT_KEY);writes++;
   if(failCAS||options.onlyIf?.etagMatches!==String(etag))return null;
   state=JSON.parse(value);etag++;return {etag:String(etag)}
 }};
 const env={DB,EDITOR_BUCKET,ADMIN_PASSWORD_HASH:'c'.repeat(64)};
 const send=async(b,token=ADMIN,origin=SITE)=>{
  const r=await handlePrivateEditorCommand(request({celebration:'41',expectedRevision:state.version,...b},token,origin),env);
  return {status:r.status,...await r.json()}
 };
 const member=id=>handleCanonicalPrivatePage(new Request(SITE+'/private/page',{
  headers:{authorization:'Bearer '+PART}}),env,{pageId:id});
 const create=async()=>{
  const r=await send({action:'save',spaces:[space()],pages:[page('draft-page:root')]});
  assert.equal(r.status,200,JSON.stringify(r));return {sid:r.idMap['draft-space:1'],pid:r.idMap['draft-page:1'],root:r.idMap['draft-page:root']};
 };
 const publish=(kind,id,spaceId)=>send({action:'publish',kind,id,...(spaceId?{spaceId}:{})});
 const enroll=id=>db.prepare('INSERT INTO celebrations_directory_private_space_enrollments(person_id,celebration_id,space_id) VALUES(?,?,?)').run(P,41,id);
 return {db,env,send,member,create,publish,enroll,get state(){return state},get batches(){return batches},get writes(){return writes},
  set failD1(v){failD1=v},set failCAS(v){failCAS=v},close:()=>db.close()};
}
test('M012C: private drafts persist with server IDs; only explicit releases grant content and never enroll',async()=>{
 const f=await fixture();try{
  const ids=await f.create();
  assert.match(ids.sid,/^space:/);assert.match(ids.pid,/^page:/);
  assert.equal(f.state.publishedRevision,undefined);
  assert.deepEqual(f.state.published.privatePageReleases,{});
  assert.equal(await createCanonicalPrivateLoaders(f.env).loadPublishedPage(ids.root),null);
  assert.equal((await f.publish('page',ids.pid,ids.sid)).status,409);
  assert.equal((await f.publish('space',ids.sid)).status,200);
  assert.equal(await createCanonicalPrivateLoaders(f.env).loadPublishedPage(ids.pid),null);
  assert.equal((await f.publish('page',ids.pid,ids.sid)).status,200);
  assert.equal((await f.publish('page',ids.root)).status,200);
  assert.equal(f.db.prepare('SELECT count(*) n FROM celebrations_directory_private_space_enrollments').get().n,0);
  assert.equal((await f.member(ids.pid)).status,404);
  f.enroll(ids.sid);
  assert.equal((await f.member(ids.pid)).status,200);
  assert.equal((await f.member(ids.root)).status,200);
  assert.doesNotMatch(JSON.stringify(publicSnapshot(f.state,'41')),/PRIVATE_SECRET|PRIVATE_SPACE|privateRelease/);
  assert.equal(f.state.published.privatePageReleases[ids.pid].spaceId,ids.sid);
  assert.equal(f.state.published.privateSpaceReleases[ids.sid].celebrationId,'41');
  assert.equal(f.state.published.privateReleaseRevisions['41'].revision,f.state.publishedRevision);
 }finally{f.close()}
});
test('M012C: content changes are drafts; republish, unpublish, hide and delete revoke exact confirmations',async()=>{
 const f=await fixture();try{
  const ids=await f.create();
  assert.equal((await f.publish('space',ids.sid)).status,200);
  assert.equal((await f.publish('page',ids.pid,ids.sid)).status,200);f.enroll(ids.sid);
  const s=structuredClone(f.state.drafts['41'].spaces);
  s[0].pages[0].blocks=[{kind:'text',text:'NEW_DRAFT'}];
  assert.equal((await f.send({action:'save',spaces:s})).status,200);
  assert.match(await (await f.member(ids.pid)).text(),/PRIVATE_SECRET/);
  assert.equal((await f.publish('page',ids.pid,ids.sid)).status,200);
  assert.match(await (await f.member(ids.pid)).text(),/NEW_DRAFT/);
  assert.equal((await f.send({action:'unpublish',kind:'space',id:ids.sid})).status,200);
  assert.equal(f.state.published.privatePageReleases[ids.pid],undefined);
  assert.equal(f.state.published.privateSpaceReleases[ids.sid],undefined);
  assert.equal((await f.member(ids.pid)).status,404);
  assert.equal((await f.publish('space',ids.sid)).status,200);
  assert.equal((await f.member(ids.pid)).status,404,'space republish does not republish child');
  assert.equal((await f.publish('page',ids.root)).status,200);
  assert.equal((await f.send({action:'celebration-visibility',visibility:'hidden'})).status,200);
  assert.equal((await f.send({action:'celebration-visibility',visibility:'published'})).status,200);
  assert.equal((await f.member(ids.root)).status,404);
  assert.equal((await f.send({action:'delete',kind:'page',id:ids.root})).status,200);
  assert.equal(f.state.drafts['41'].pages.some(p=>p.id===ids.root),false);
 }finally{f.close()}
});
test('M012C: D1 failure after R2 commit denies the entire epoch; reconcile is idempotent',async()=>{
 const f=await fixture();try{
  const ids=await f.create();
  assert.equal((await f.publish('page',ids.root)).status,200);
  assert.equal((await f.member(ids.root)).status,200);
  f.failD1=true;
  const r=await f.publish('space',ids.sid);
  assert.equal(r.status,503);assert.equal(r.saved,true);
  assert.equal((await f.member(ids.root)).status,404);
  assert.equal(await createCanonicalPrivateLoaders(f.env).loadPublishedSpace(ids.sid),null);
  f.failD1=false;
  assert.equal((await f.send({action:'reconcile'})).status,200);
  assert.equal((await f.send({action:'reconcile'})).status,200);
  assert.equal((await f.member(ids.root)).status,200);
  f.failCAS=true;
  const prior=f.batches;
  assert.equal((await f.publish('page',ids.pid,ids.sid)).status,409);
  assert.equal(f.batches,prior,'failed CAS must never acknowledge D1');
 }finally{f.close()}
});
test('M012C: refuse cookie, participant, foreign origin, stale revision, forged ACL/IDs or client manifests',async()=>{
 const f=await fixture();try{
  const cmd={action:'save',spaces:[space()]};
  assert.equal((await f.send(cmd,null)).status,401);
  assert.equal((await f.send(cmd,PART)).status,401);
  assert.equal((await f.send(cmd,ADMIN,'https://evil.example')).status,403);
  assert.equal((await f.send({...cmd,expectedRevision:0})).status,409);
  assert.equal((await f.send({...cmd,privatePageReleases:{}})).status,400);
  assert.equal((await f.send({...cmd,spaces:[space('space:forged')]})).status,400);
  assert.equal((await f.send({...cmd,spaces:[space(undefined,undefined,{accessPolicy:{mode:'SELECTED_TYPES',typeIds:['member-type:missing']}})]})).status,400);
  assert.equal((await f.send({...cmd,spaces:[space(undefined,undefined,{celebrationId:'42'})]})).status,400);
  assert.equal(f.writes,0);
  const ids=await f.create();
  const s=structuredClone(f.state.drafts['41'].spaces);
  s[0].visibility='PUBLIC';s[0].accessPolicy=pubPolicy;
  assert.equal((await f.send({action:'save',spaces:s})).status,200);
  assert.equal(f.state.drafts['41'].spaces[0].visibility,'PUBLIC');
  assert.equal((await f.send({action:'save',pages:[{id:ids.root,accessPolicy:pubPolicy}]})).status,400);
 }finally{f.close()}
});
test('M012C: conversion of existing public page revokes public snapshot and policy edits revoke private release',async()=>{
 const f=await fixture();try{
  assert.equal((await f.send({action:'save',pages:[{id:'mercredi-41',accessPolicy:policy}]})).status,200);
  assert.equal(publicSnapshot(f.state,'41').record.pages.some(p=>p.id==='mercredi-41'),false);
  assert.equal((await f.publish('page','mercredi-41')).status,200);
  assert.equal((await f.member('mercredi-41')).status,200);
  assert.equal((await f.send({action:'save',pages:[{id:'mercredi-41',accessPolicy:{mode:'ALL_PRIVATE_TYPES'}}]})).status,200);
  assert.equal((await f.member('mercredi-41')).status,404);
 }finally{f.close()}
});
test('M012C: duplicate only detached M005 draft; no new ledger, registry or individual enrollment',async()=>{
 const f=await fixture();try{
  const ids=await f.create();
  assert.equal((await f.publish('space',ids.sid)).status,200);
  assert.equal((await f.publish('page',ids.pid,ids.sid)).status,200);f.enroll(ids.sid);
  const result=await f.send({action:'duplicate',targetCelebration:'42'});
  assert.equal(result.status,200,JSON.stringify(result));
  const clone=result.record.spaces[0],newId=clone.pages[0].id;
  assert.notEqual(clone.id,ids.sid);assert.notEqual(newId,ids.pid);
  assert.equal(clone.pages[0].publicationStatus,'draft');
  assert.equal(f.state.published.privatePageReleases[newId],undefined);
  assert.equal(f.state.published.privateSpaceReleases[clone.id],undefined);
  assert.equal(f.db.prepare('SELECT count(*) n FROM celebrations_directory_private_space_enrollments').get().n,1);
  assert.equal(f.db.prepare('SELECT count(*) n FROM celebrations_directory_private_spaces').get().n,1);
  assert.equal((await f.member(newId)).status,404);
 }finally{f.close()}
});
test('M012C: public spaces persist as M005 records, but never leak through the old public projection',async()=>{
 const f=await fixture();try{
  const r=await f.send({action:'save',spaces:[space(undefined,undefined,{visibility:'PUBLIC',accessPolicy:pubPolicy})]});
  assert.equal(r.status,200);const sid=r.idMap['draft-space:1'],pid=r.idMap['draft-page:1'];
  assert.equal((await f.publish('space',sid)).status,200);
  assert.equal((await f.publish('page',pid,sid)).status,200);
  assert.equal(f.state.published.drafts['41'].spaces[0].visibility,'PUBLIC');
  assert.doesNotMatch(JSON.stringify(publicSnapshot(f.state,'41')),/PRIVATE_SECRET|PRIVATE_SPACE/);
  assert.equal(f.db.prepare('SELECT count(*) n FROM celebrations_directory_private_spaces').get().n,0);
 }finally{f.close()}
});
test('M012C: old editor cookie does not disclose managed drafts or overwrite/release them',async()=>{
 const f=await fixture();try{
  const ids=await f.create();
  const stamp=Date.now()+'.'+'d'.repeat(32);
  const sig=createHmac('sha256',f.env.ADMIN_PASSWORD_HASH).update('site-editor-v1:'+stamp).digest('hex');
  const headers={cookie:'celebrations_editor_access='+stamp+'.'+sig,origin:SITE,'content-type':'application/json'};
  let r=await handleServerDraft(new Request(SITE+'/api/editor-open-draft?celebration=41',{headers}),f.env);
  assert.equal(r.status,200);assert.doesNotMatch(await r.text(),/PRIVATE_SECRET|PRIVATE_SPACE/);
  const publicPage={id:'mercredi-41',name:'Public edit',group:'celebration',blocks:[]};
  const save=()=>({celebration:'41',expectedRevision:f.state.version,record:{pages:[publicPage]},plans:[],shared:{pages:[],homeId:''}});
  r=await handleServerDraft(new Request(SITE+'/api/editor-open-draft',{method:'POST',headers,body:JSON.stringify(save())}),f.env);
  assert.equal(r.status,200,await r.clone().text());
  assert.equal(f.state.drafts['41'].spaces[0].id,ids.sid);
  assert.ok(f.state.drafts['41'].pages.some(p=>p.id===ids.root));
  const body=save();body.record.spaces=[];
  r=await handleServerDraft(new Request(SITE+'/api/editor-open-draft',{method:'POST',headers,body:JSON.stringify(body)}),f.env);
  assert.equal(r.status,403);
  r=await handleEditorPublication(new Request(SITE+'/api/editor-publication',{method:'POST',headers,body:JSON.stringify({
   kind:'celebration',celebration:'41',visibility:'hidden',expectedRevision:f.state.version})}),f.env);
  assert.equal(r.status,403);
 }finally{f.close()}
});

test('M019 ordinary shared page transitions revoke public snapshots and require live membership',async()=>{
 const f=await fixture();try{
  const id='neutral-550e8400-e29b-41d4-a716-446655440022';
  const normal={id,group:'page',name:'Ordinaire M019',visibility:'published',blocks:[{kind:'text',text:'ORDINARY_M019_SECRET'}]};
  f.state.shared.pages.push(normal);
  // Make a genuine public baseline, then revoke it via the authenticated ACL command.
  const changed=await f.send({action:'page-access',id,accessPolicy:{mode:'ALL_PRIVATE_TYPES'}});
  assert.equal(changed.status,200,JSON.stringify(changed));
  assert.equal(f.state.shared.pages.some(p=>p.id===id),false);
  assert.doesNotMatch(JSON.stringify(publicSnapshot(f.state,'41')),/ORDINARY_M019_SECRET/);
  assert.equal((await f.member(id)).status,404,'private draft is not a release');
  assert.equal((await f.publish('page',id)).status,200);
  assert.equal((await f.member(id)).status,200);
  f.db.prepare('DELETE FROM celebrations_directory_person_celebrations WHERE person_id=? AND celebration_id=41').run(P);
  assert.equal((await f.member(id)).status,404,'revocation takes effect without changing the session');
  const restored=await f.send({action:'page-access',id,accessPolicy:{mode:'PUBLIC'}});
  assert.equal(restored.status,200,JSON.stringify(restored));
  assert.equal(f.state.shared.pages.find(p=>p.id===id).visibility,'draft');
  assert.equal((await f.member(id)).status,404);
  assert.doesNotMatch(JSON.stringify(publicSnapshot(f.state,'41')),/ORDINARY_M019_SECRET/);
 }finally{f.close()}
});

test('M019 a true celebration copy has its own D1 identity, date and draft, with no copied grants; retries do not multiply copies',async()=>{
 const f=await fixture();try{
  await f.create();
  const args={action:'create-celebration',archangel:'Gabriel',date:'2026-10-07',title:'Gabriel octobre — copie',copy:true};
  const result=await f.send(args);assert.equal(result.status,200,JSON.stringify(result));
  const id=result.targetCelebration;assert.match(id,/^\d+$/);assert.notEqual(id,'41');
  assert.equal(f.db.prepare('SELECT status FROM celebrations_celebrations WHERE id=?').get(Number(id)).status,'draft');
  assert.equal(f.state.drafts[id].celebrationDates.wednesday,'2026-10-07');
  assert.equal(f.state.published.celebrationVisibility[id],'draft');
  assert.equal(f.db.prepare('SELECT count(*) n FROM celebrations_directory_person_celebrations WHERE celebration_id=?').get(Number(id)).n,0);
  assert.ok(f.state.drafts[id].spaces.every(s=>!s.accessPolicy.typeIds));
  const retry=await f.send(args);assert.equal(retry.status,200,JSON.stringify(retry));assert.equal(retry.targetCelebration,id);
  assert.equal(f.db.prepare('SELECT count(*) n FROM celebrations_celebrations').get().n,3);
  const recovery={...args,date:'2026-10-14'};f.failCAS=true;
  assert.equal((await f.send(recovery)).status,409);f.failCAS=false;
  assert.equal((await f.send(recovery)).status,200);
  assert.equal(f.db.prepare('SELECT count(*) n FROM celebrations_celebrations').get().n,4,'failed snapshot retry reuses its canonical draft');
 }finally{f.close()}
});
