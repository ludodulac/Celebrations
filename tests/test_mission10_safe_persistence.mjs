import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {readFileSync} from 'node:fs';
import {EDITOR_SNAPSHOT_KEY,EDITOR_SNAPSHOT_LIMIT,expectedRevisionMatches} from '../migration/cloudflare/app/ports/editor-snapshot-contract.mjs';
import {readEditorSnapshot,putEditorSnapshot} from '../migration/cloudflare/app/adapters/editor-r2-repository.mjs';
import {createEditorSyncPolicy} from '../migration/cloudflare/app/application/editor-sync-policy.mjs';
import {handleServerDraft} from '../migration/cloudflare/editor-server-draft-api.mjs';
import {readEditorState,writeEditorState,handleEditorPublication,publicSnapshot} from '../migration/cloudflare/editor-publication-api.mjs';
import {SERVER_EDITOR_SYNC} from '../migration/cloudflare/editor-server-sync-client.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';

const clone=o=>JSON.parse(JSON.stringify(o));
const sample=()=>({version:1,drafts:{'101':{pages:[
 {id:'mercredi-101',name:'Mercredi',group:'celebration',visibility:'published',
  blocks:[{id:'a',kind:'text',text:'Déjà publié'}]},
 {id:'extra-123e4567-e89b-12d3-a456-426614174000-101',name:'Prochaine page',group:'celebration',
  visibility:'draft',blocks:[{id:'b',kind:'text',text:'Brouillon privé'}]}
 ],celebrationDates:{},celebrationTimes:{}}},
 plans:[],shared:{pages:[{id:'neutral-accueil-general',group:'page',name:'Accueil',visibility:'published',blocks:[]}],
 homeId:'neutral-accueil-general'},mediaCatalogue:[]});
class MemoryBucket{
 constructor(value){this.serial=0;this.data=value===undefined?null:JSON.stringify(value);
  this.recorded=[];this.injectOtherWrite=false;this.failRead=false;this.failWrite=false;}
 async get(key){assert.equal(key,EDITOR_SNAPSHOT_KEY);
  if(this.failRead)throw Error('R2 GET offline');
  return this.data===null?null:{etag:String(this.serial),body:true,text:async()=>this.data};}
 async put(key,serialized,options={}){
  assert.equal(key,EDITOR_SNAPSHOT_KEY);
  this.recorded.push({key,options});
  if(this.failWrite)throw Error('R2 PUT offline');
  if(this.injectOtherWrite){
   // Two clients read the same ETag before another browser commits.
   this.injectOtherWrite=false;this.serial++;
   this.data=JSON.stringify({...JSON.parse(this.data),version:this.serial+1,otherDevice:true});
  }
  const guard=options.onlyIf||{};
  if(guard.etagDoesNotMatch==='*'){
   if(this.data!==null)return null;
  }else if(guard.etagMatches!==undefined){
   if(this.data===null||String(this.serial)!==String(guard.etagMatches))return null;
  }else throw Error('Unsafe unconditional PUT');
  this.serial++;this.data=serialized;
  return {etag:String(this.serial)};
 }
 async snapshot(){return this.data===null?null:JSON.parse(this.data)}
}
const policy=createEditorSyncPolicy();
const origin='https://celebrations-exit-staging.rondes.workers.dev';
const host='https://www.ronde-des-archanges-universelle.eu';
const SECRET='a'.repeat(64);
const env=bucket=>({MEDIA_BUCKET:bucket,EDITOR_BUCKET:bucket,DB:{
 prepare:()=>({bind:()=>({first:async()=>({email:'owner@localhost',expires_at:'2099-01-01T00:00:00.000Z'})})})
},ADMIN_PASSWORD_HASH:SECRET});
const req=(target,payload,header={})=>new Request(target,{
 method:'POST',headers:{origin:new URL(target).origin,'content-type':'application/json',...header},
 body:JSON.stringify(payload)
});
const draftPayload=(version=1)=>{const s=sample();return {
 celebration:'101',expectedRevision:version,record:clone(s.drafts['101']),
 plans:clone(s.plans),shared:clone(s.shared)
}};
async function signedCookie(){
 const payload=String(Date.now())+'.'+'b'.repeat(32);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(SECRET),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signed=await crypto.subtle.sign('HMAC',key,
  new TextEncoder().encode('site-editor-v1:'+payload));
 return 'celebrations_editor_access='+payload+'.'+Buffer.from(signed).toString('hex');
}
test('M10: same immutable key and revision contract are shared by both server APIs',()=>{
 assert.equal(EDITOR_SNAPSHOT_KEY,'editor-trials/server-drafts-v1.json');
 assert.equal(EDITOR_SNAPSHOT_LIMIT,5000000);
 for(const bad of [undefined,null,'1',-1,1.5,Number.MAX_SAFE_INTEGER+1])
  assert.equal(expectedRevisionMatches(bad,1),false,String(bad));
 assert.equal(expectedRevisionMatches(0,0),true);
 assert.equal(expectedRevisionMatches(3,3),true);
 assert.equal(expectedRevisionMatches(3,4),false);
});
test('M10: empty R2 creation can only use etagDoesNotMatch *, then etagMatches',async()=>{
 const b=new MemoryBucket();
 const empty=await readEditorSnapshot(b,{empty:()=>({version:0}),validate:s=>true});
 assert.equal(empty.etag,null);assert.equal(empty.state.version,0);
 assert.equal(await putEditorSnapshot(b,empty.etag,JSON.stringify({version:1})),true);
 assert.deepEqual(b.recorded[0].options.onlyIf,{etagDoesNotMatch:'*'});
 assert.equal(b.recorded[0].options.httpMetadata.contentType,'application/json');
 assert.equal(await putEditorSnapshot(b,null,JSON.stringify({version:2})),false,
  'cannot blind-create over existing object');
 assert.deepEqual(await b.snapshot(),{version:1});
 const first=await readEditorSnapshot(b,{empty:()=>({}),validate:()=>true});
 assert.equal(await putEditorSnapshot(b,first.etag,JSON.stringify({version:2})),true);
 assert.deepEqual(b.recorded.at(-1).options.onlyIf,{etagMatches:'1'});
 assert.deepEqual(await b.snapshot(),{version:2});
});
test('M10: two-device concurrent snapshot updates cannot silently overwrite',async()=>{
 const b=new MemoryBucket(sample()),empty=()=>({version:0});
 const first=await readEditorSnapshot(b,{empty,validate:()=>true});
 const second=await readEditorSnapshot(b,{empty,validate:()=>true});
 assert.equal(first.etag,second.etag);
 const a=clone(first.state);a.drafts['101'].pages[0].blocks[0].text='Téléphone';
 const z=clone(second.state);z.drafts['101'].pages[0].blocks[0].text='Ordinateur';
 assert.equal(await putEditorSnapshot(b,first.etag,JSON.stringify(a)),true);
 assert.equal(await putEditorSnapshot(b,second.etag,JSON.stringify(z)),false);
 assert.equal((await b.snapshot()).drafts['101'].pages[0].blocks[0].text,'Téléphone');
 assert.deepEqual(b.recorded.map(x=>x.options.onlyIf),[{etagMatches:'0'},{etagMatches:'0'}]);
});
test('M10: another write between revision check and PUT is rejected by R2 ETag',async()=>{
 const b=new MemoryBucket(sample()),fresh=await readEditorState(b);
 const changed=clone(fresh.state);changed.drafts['101'].pages[0].blocks[0].text='Ne pas publier';
 b.injectOtherWrite=true;
 assert.equal(await writeEditorState(b,fresh,changed),false);
 const still=await b.snapshot();
 assert.equal(still.otherDevice,true);
 assert.equal(still.drafts['101'].pages[0].blocks[0].text,'Déjà publié');
 assert.equal(b.recorded.at(-1).options.onlyIf.etagMatches,'0');
});
test('M10: corrupt snapshot is refused rather than replaced with an empty document',async()=>{
 const b=new MemoryBucket(sample());b.data='{"version":99,"drafts":null}';
 await assert.rejects(()=>readEditorState(b),/Editor snapshot invalid/);
 await assert.rejects(()=>readEditorSnapshot(b,{empty:()=>sample(),validate:s=>s?.drafts&&false,
  invalidMessage:'Stored draft invalid',requireBody:true}),/Stored draft invalid/);
 const before=b.data;
 assert.equal(b.recorded.length,0);
 assert.equal(b.data,before);
});
test('M10: transport failures cannot report a successful R2 save',async()=>{
 const b=new MemoryBucket(sample());const fresh=await readEditorState(b);
 b.failWrite=true;
 await assert.rejects(()=>writeEditorState(b,fresh,clone(fresh.state)),/R2 PUT offline/);
 assert.equal(b.recorded.length,1);
 b.failRead=true;
 await assert.rejects(()=>readEditorState(b),/R2 GET offline/);
});
test('M10: browser policy prevents stale readback success even with HTTP 200',()=>{
 const record=clone(sample().drafts['101']),shared=clone(sample().shared);
 const selected='mercredi-101';
 const actual={revision:5,record:clone(record),shared:clone(shared)};
 assert.equal(policy.readbackConfirmed(actual,5,selected,record,shared),true);
 assert.equal(policy.readbackConfirmed(actual,6,selected,record,shared),false);
 actual.record.pages[0].blocks[0].text='Ancienne version';
 assert.equal(policy.readbackConfirmed(actual,5,selected,record,shared),false);
 actual.record.pages=[];
 assert.equal(policy.readbackConfirmed(actual,5,selected,record,shared),false,
  'selected page missing on server must not count as a verified save');
 assert.equal(policy.readbackConfirmed(actual,5,'not-a-real-page',record,shared),false);
 assert.equal(policy.readbackConfirmed({revision:7},7,null,record,shared),true);
 assert.equal(policy.readbackConfirmed(null,1,null,record,shared),false);
 assert.equal(policy.readbackConfirmed({},1,null,record,shared),false,
  'a missing server revision is never proof of a save');
 assert.equal(policy.readbackConfirmed({revision:'7'},7,null,record,shared),false,
  'a non-numeric server revision is rejected');
});
test('M10: baseline conflict detection compares private, shared and planned documents',()=>{
 const record=clone(sample().drafts['101']),shared=clone(sample().shared),plans=[];
 const fresh={record:clone(record),shared:clone(shared),plans:clone(plans)};
 assert.equal(policy.unchangedRemote(fresh,record,shared,plans),true);
 assert.equal(policy.noNewEdits(7,7),true);
 assert.equal(policy.noNewEdits(7,8),false);
 fresh.record.pages[0].blocks[0].text='Modifié sur un autre téléphone';
 assert.equal(policy.unchangedRemote(fresh,record,shared,plans),false);
 fresh.record=clone(record);fresh.shared.pages[0].blocks.push({id:'private',kind:'text',text:'Nouvel accueil'});
 assert.equal(policy.unchangedRemote(fresh,record,shared,plans),false);
 fresh.shared=clone(shared);fresh.plans.push({id:'plan-michael-2028-05-10'});
 assert.equal(policy.unchangedRemote(fresh,record,shared,plans),false);
 assert.equal(policy.same(undefined,null),true,'legacy null equality maintained');
});
test('M10: API two-device conflict returns 409 and preserves the winner',async()=>{
 const b=new MemoryBucket(sample()),e=env(b);
 const a=draftPayload(1);a.record.pages[0].blocks[0].text='Premier appareil';
 const z=draftPayload(1);z.record.pages[0].blocks[0].text='Second appareil';
 const r1=await handleServerDraft(req(origin+'/api/editor-open-draft',a),e);
 assert.equal(r1.status,200);
 assert.equal((await r1.json()).revision,2);
 const r2=await handleServerDraft(req(origin+'/api/editor-open-draft',z),e);
 assert.equal(r2.status,409);
 const snapshot=await b.snapshot();
 assert.equal(snapshot.drafts['101'].pages[0].blocks[0].text,'Premier appareil');
 assert.equal(snapshot.version,2);
 assert.equal(b.recorded.length,1,'stale second request never writes');
});
test('M10: API ETag race returns 409 with existing contents intact',async()=>{
 const b=new MemoryBucket(sample());b.injectOtherWrite=true;
 const payload=draftPayload(1);payload.record.pages[0].blocks[0].text='Stale device';
 const response=await handleServerDraft(req(origin+'/api/editor-open-draft',payload),env(b));
 assert.equal(response.status,409);
 const saved=await b.snapshot();
 assert.equal(saved.otherDevice,true);
 assert.equal(saved.drafts['101'].pages[0].blocks[0].text,'Déjà publié');
});
test('M10: failed network PUT returns HTTP 503 and no draft is overwritten',async()=>{
 const b=new MemoryBucket(sample()),initial=await b.snapshot();
 b.failWrite=true;
 const payload=draftPayload(1);payload.record.pages[0].blocks[0].text='Never saved';
 const response=await handleServerDraft(req(origin+'/api/editor-open-draft',payload),env(b));
 assert.equal(response.status,503);
 assert.deepEqual(await b.snapshot(),initial);
});
test('M10: creating a new draft must not publish it on the visitor snapshot',async()=>{
 const b=new MemoryBucket(sample());const payload=draftPayload(1);
 payload.record.pages[1].blocks[0].text='Privé et sauvegardé';
 const saved=await handleServerDraft(req(origin+'/api/editor-open-draft',payload),env(b));
 assert.equal(saved.status,200);
 const copyOfState=await b.snapshot();
 assert.equal(copyOfState.drafts['101'].pages[1].visibility,'draft');
 const published=publicSnapshot(copyOfState,'101');
 assert.ok(!published.record?.pages?.some(x=>x.id===payload.record.pages[1].id));
 assert.ok(!JSON.stringify(published).includes('Privé et sauvegardé'));
});
test('M10: explicit public command uses same revision and ETag; no implicit publication',async()=>{
 const b=new MemoryBucket(sample()),cookie=await signedCookie(),e=env(b);
 const pageId='extra-123e4567-e89b-12d3-a456-426614174000-101';
 const reqPub=(revision,visibility)=>req(host+'/api/editor-publication',
  {celebration:'101',expectedRevision:revision,kind:'page',pageId,visibility},{cookie});
 const initial=publicSnapshot(await b.snapshot(),'101');
 assert.ok(!initial.record.pages.some(p=>p.id===pageId));
 const done=await handleEditorPublication(reqPub(1,'published'),e);
 assert.equal(done.status,200);
 const newState=await b.snapshot();
 assert.equal(newState.version,2);
 assert.ok(publicSnapshot(newState,'101').record.pages.some(p=>p.id===pageId));
 const stale=await handleEditorPublication(reqPub(1,'hidden'),e);
 assert.equal(stale.status,409);
 assert.ok(publicSnapshot(await b.snapshot(),'101').record.pages.some(p=>p.id===pageId));
 assert.deepEqual(b.recorded.map(x=>x.options.onlyIf),[{etagMatches:'0'}]);
});
test('M10: a client save policy is included once in the CSP editor and does not auto-publish',()=>{
 new Script(DEMO_CLIENT);
 assert.equal(DEMO_CLIENT.split('function createEditorSyncPolicy(').length-1,1);
 assert.ok(DEMO_CLIENT.includes("const editorSyncPolicy=createEditorSyncPolicy()"));
 assert.ok(DEMO_CLIENT.includes("editorSyncPolicy.unchangedRemote("));
 assert.ok(DEMO_CLIENT.includes("editorSyncPolicy.readbackConfirmed("));
 assert.ok(DEMO_CLIENT.includes("serverPublish({kind:'page'"));
 assert.ok(SERVER_EDITOR_SYNC.includes('db._serverPending=true'));
 const source=readFileSync('migration/cloudflare/app/application/editor-sync-policy.mjs','utf8');
 for(const danger of ['fetch(', 'localStorage','serverPublish(', 'serverSave(', 'window.', 'document.'])
  assert.ok(!source.includes(danger),'policy must be pure: '+danger);
});
