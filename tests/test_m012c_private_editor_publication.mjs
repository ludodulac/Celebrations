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

test('M030 one planned yearly slot has one unique D1 identity and NO obligatory Wednesday date',async()=>{
 const f=await fixture();try{
  await f.create();
  const slot={action:'create-celebration',archangel:'Michaël',cycleYear:2026};
  assert.equal((await f.send(slot)).status,409,
   'Never create arbitrary identities before protected UNIQUE migration');
  f.db.exec('CREATE UNIQUE INDEX idx_celebrations_archangel_year_unique ON celebrations_celebrations(archangel,year)');
  assert.equal((await f.send({action:'create-celebration',archangel:'Gabriel',date:'2026-10-07',title:'Copie',copy:true})).status,400,
   'Old free-copy command must no longer exist');
  const created=await f.send(slot);assert.equal(created.status,200,JSON.stringify(created));
  const id=created.targetCelebration;assert.match(id,/^\d+$/);
  assert.equal(f.db.prepare('SELECT year FROM celebrations_celebrations WHERE id=?').get(Number(id)).year,'2026');
  assert.deepEqual(f.state.drafts[id].celebrationDates,{});
  assert.equal(f.state.published.celebrationVisibility[id],'hidden');
  assert.equal(f.db.prepare('SELECT count(*) n FROM celebrations_directory_person_celebrations WHERE celebration_id=?').get(Number(id)).n,0);
  const retry=await f.send(slot);assert.equal(retry.status,200,JSON.stringify(retry));
  assert.equal(retry.targetCelebration,id,'Retry must reuse canonical ID');
  assert.equal(f.db.prepare('SELECT count(*) n FROM celebrations_celebrations').get().n,3);
  f.failCAS=true;
  const another={action:'create-celebration',archangel:'Gabriel',cycleYear:2026};
  assert.equal((await f.send(another)).status,409);
  f.failCAS=false;
  const recovered=await f.send(another);assert.equal(recovered.status,200,JSON.stringify(recovered));
  assert.equal(f.state.drafts[recovered.targetCelebration].celebrationDates.wednesday,undefined);
  assert.equal(f.db.prepare('SELECT count(*) n FROM celebrations_celebrations').get().n,4);
 }finally{f.close()}
});

test('M020-B moving a category/language variant is atomic, revokes releases, rejects collision and stale edits',async()=>{
 const f=await fixture();try{
  f.state.localization={registry:{version:1,defaultLanguageId:'fr',languages:[{id:'fr',name:'Français',flag:'',active:true},{id:'en',name:'Anglais',flag:'',active:true}]},pages:{}};
  const ids=await f.create();
  await f.publish('space',ids.sid);await f.publish('page',ids.pid,ids.sid);
  const oldRevision=f.state.version;
  const move={action:'change-version',spaceId:ids.sid,pageId:ids.pid,languageId:'fr',targetLanguageId:'en',typeIds:[]};
  const result=await f.send(move);assert.equal(result.status,200,JSON.stringify(result));
  const moved=f.state.drafts['41'].spaces.find(s=>s.accessPolicy.mode==='PUBLIC');
  assert.equal(moved.pages[0].translations.en.blocks[0].text,'PRIVATE_SECRET');
  assert.equal(f.state.published.privatePageReleases[ids.pid],undefined);
  assert.equal((await f.member(ids.pid)).status,404);
  assert.equal((await f.send({...move,expectedRevision:oldRevision})).status,409);
  const saved=structuredClone(f.state);
  const duplicate={...moved.pages[0],id:'draft-page:duplicate'};delete duplicate.spaceId;
  const collision=await f.send({action:'save',spaces:f.state.drafts['41'].spaces.map(s=>s.id===moved.id?{...s,pages:[...s.pages,duplicate]}:s)});
  assert.equal(collision.status,409);assert.deepEqual(f.state,saved);
  const denied=await f.send({...move,pageId:moved.pages[0].id,spaceId:moved.id,languageId:'en',targetLanguageId:'fr'},PART);
  assert.equal(denied.status,401);
 }finally{f.close()}
});

test('M030 invalid calendar years and second identical version are refused server-side',async()=>{
 const f=await fixture();try{
  for(const year of [2025,2040,'2026-01-01',null]){
   const r=await f.send({action:'create-celebration',archangel:'Gabriel',cycleYear:year});
   assert.ok([400,409].includes(r.status),JSON.stringify(r));
  }
  const publicFrench=await f.send({action:'duplicate-version',
   name:'Gabriel 2026 — another French',scope:'PUBLIC',categoryId:'',languageId:'fr'});
  assert.equal(publicFrench.status,409,'Cannot duplicate original public French');
  const invalid=await f.send({action:'duplicate-version',name:'No category',
   scope:'SELECTED_TYPES',categoryId:'not-real',languageId:'fr'});
  assert.equal(invalid.status,409,'Cannot invent an absent category');
 }finally{f.close()}
});
test('M030 one celebration has public EN plus private FR/EN versions, never new D1 IDs or publication grants',async()=>{
 const f=await fixture();try{
  const beforeIds=f.db.prepare('SELECT count(*) n FROM celebrations_celebrations').get().n;
  const en={action:'duplicate-version',name:'Gabriel — English public',
   scope:'PUBLIC',categoryId:'',languageId:'en'};
  const a=await f.send(en);assert.equal(a.status,200,JSON.stringify(a));
  assert.equal(a.createdVersion.key,'PUBLIC|en');
  assert.equal(a.createdVersion.visibility,'draft');
  assert.ok(f.state.localization.pages['mercredi-41']?.en);
  assert.equal((await f.send({...en,name:'Different English'})).status,409,
   'Same audience/language is reserved even when name differs');
  const fr={action:'duplicate-version',name:'Gabriel — chant français',
   scope:'SELECTED_TYPES',categoryId:TYPE,languageId:'fr'};
  const b=await f.send(fr);assert.equal(b.status,200,JSON.stringify(b));
  assert.equal(b.createdVersion.key,'category:'+TYPE+'|fr');
  assert.equal(f.state.drafts['41'].spaces.length,1);
  const privateSpace=f.state.drafts['41'].spaces[0];
  assert.equal(privateSpace.accessPolicy.mode,'SELECTED_TYPES');
  assert.deepEqual(privateSpace.accessPolicy.typeIds,[TYPE]);
  assert.equal(privateSpace.pages[0].publicationStatus,'draft');
  assert.equal((await f.send({...fr,name:'Second chant français'})).status,409);
  const enPrivate=await f.send({...fr,name:'Gabriel — chant English',languageId:'en'});
  assert.equal(enPrivate.status,200,JSON.stringify(enPrivate));
  assert.equal(f.state.drafts['41'].spaces.length,1,'Reuse canonical category space');
  assert.ok(f.state.drafts['41'].spaces[0].pages[0].translations.en);
  assert.equal(f.db.prepare('SELECT count(*) n FROM celebrations_celebrations').get().n,beforeIds);
  assert.equal(f.db.prepare('SELECT count(*) n FROM celebrations_directory_person_celebrations WHERE celebration_id=41').get().n,1);
  assert.equal(f.state.published?.privatePageReleases?.[privateSpace.pages[0].id],undefined);
  assert.equal(f.state.published?.privateTranslationReleases?.[privateSpace.pages[0].id],undefined);
  assert.equal((await f.send({...en,name:'Unauthorized'},PART)).status,401);
 }finally{f.close()}
});

test('M020-B hidden and draft remain distinct from private access after reload',async()=>{
 const f=await fixture();try{
  const ids=await f.create();await f.publish('space',ids.sid);await f.publish('page',ids.pid,ids.sid);
  const result=await f.send({action:'unpublish',kind:'page',id:ids.pid,spaceId:ids.sid,visibility:'hidden'});
  assert.equal(result.status,200);const page=result.record.spaces.find(s=>s.id===ids.sid).pages.find(p=>p.id===ids.pid);
  assert.equal(page.visibility,'hidden');assert.equal(page.accessPolicy.mode,'PUBLIC');
  assert.equal((await f.member(ids.pid)).status,404);
  assert.equal((await f.publish('page',ids.pid,ids.sid)).status,200);
  const draft=await f.send({action:'unpublish',kind:'page',id:ids.pid,spaceId:ids.sid,visibility:'draft'});
  assert.equal(draft.record.spaces.find(s=>s.id===ids.sid).pages.find(p=>p.id===ids.pid).visibility,'draft');
 }finally{f.close()}
});
