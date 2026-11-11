// M012-C — canonical editor persistence; no route or deployment is enabled here.
import {authorize,sha256} from '../../auth-api.mjs';
import {readEditorState,writeEditorState,initialPublication} from '../../editor-publication-api.mjs';
import {expectedRevisionMatches,EDITOR_SNAPSHOT_LIMIT} from '../ports/editor-snapshot-contract.mjs';
import {ACCESS_MODES,SPACE_VISIBILITIES,isMemberTypeId} from '../domain/member-access.mjs';
import {createCelebrationSpace,getCelebrationSpaces,duplicateCelebration} from '../domain/celebration-spaces.mjs';
import {createPreparedLanguageRegistry as createLanguageRegistry,setPageTranslation,setCelebrationSpaceTranslation} from '../domain/editor-localization.mjs';
import {managedPage} from '../security/private-editor-boundary.mjs';
import {acknowledgePrivateRelease,privateReleaseReady,validCelebrationId} from '../persistence/private-release-fence.mjs';
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const own=(x,k)=>Object.hasOwn(x??{},k);
const copy=x=>structuredClone(x);
const stable=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9:._-]{0,253}$/.test(x)&&
 !['constructor','prototype','__proto__'].includes(x);
const q=(db,sql,...args)=>db.prepare(sql).bind(...args);
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
const invalid=()=>fail(400,'Commande ou modèle invalide');
const conflict=()=>fail(409,'Conflit ou version obsolète. Rechargez.');
const missing=()=>fail(404,'Célébration ou contenu inconnu');
const name=(x,max)=>{if(typeof x!=='string'||!x.trim()||x.length>max)invalid();return x.trim()};
const forbidden=new Set(['privatePageReleases','privateSpaceReleases','privateReleaseRevisions',
 'privateTranslationReleases','privateMedia','translationReleases','enrollments','spaceEnrollments',
 'memberEnrollments','memberships','memberAssignments','memberTypeAssignments','participantEnrollments',
 'participantAccess','invitedMembers','memberIds','participantIds','principal','isAdmin','actor',
 'actorEmail','permissions','verified','storageKey','remoteKey','__proto__','constructor','prototype']);
function safeJSON(x,depth=0){
 if(depth>24)invalid();
 if(Array.isArray(x)){if(x.length>1000)invalid();x.forEach(v=>safeJSON(v,depth+1));}
 else if(obj(x))for(const [k,v] of Object.entries(x)){
  if(forbidden.has(k))invalid();safeJSON(v,depth+1);
 }
}
function keysOnly(x,keys){if(!obj(x)||Object.keys(x).some(k=>!keys.includes(k)))invalid()}
async function catalogue(db,cid){
 if(!validCelebrationId(cid))invalid();
 const c=await q(db,'SELECT id FROM celebrations_celebrations WHERE id=?',Number(cid)).first();
 if(c?.id!==Number(cid))missing();
 // Do not write R2 if the proposed D1 schema is not ready.
 await q(db,'SELECT revision,token FROM celebrations_private_release_fences WHERE celebration_id=?',Number(cid)).first();
 const rows=await q(db,'SELECT id,disabled FROM celebrations_directory_member_types').all();
 if(!Array.isArray(rows?.results))fail(503,'Catalogue indisponible');
 return new Set(rows.results.filter(r=>r.disabled===0&&isMemberTypeId(r.id)).map(r=>r.id));
}
function policy(raw,known){
 if(!obj(raw)||!Object.values(ACCESS_MODES).includes(raw.mode))invalid();
 if(raw.mode!==ACCESS_MODES.SELECTED_TYPES){
  keysOnly(raw,['mode']);return {mode:raw.mode};
 }
 keysOnly(raw,['mode','typeIds']);
 if(!Array.isArray(raw.typeIds)||!raw.typeIds.length||raw.typeIds.length>100||
  new Set(raw.typeIds).size!==raw.typeIds.length||
  raw.typeIds.some(t=>!isMemberTypeId(t)||!known.has(t)))invalid();
 return {mode:raw.mode,typeIds:[...raw.typeIds].sort()};
}
function blocks(value,depth=0){
 if(depth>12||!Array.isArray(value)||value.length>300)invalid();
 for(const b of value){
  if(!obj(b)||typeof b.kind!=='string'||!b.kind||b.kind.length>32)invalid();
  if(b.kind==='section'){
   if(!Array.isArray(b.columns)||b.columns.length>6)invalid();
   b.columns.forEach(c=>blocks(c,depth+1));
  }
 }
 return copy(value);
}
function pageDraft(input,old,id,cid,sid,known,registry){
 if(!obj(input)||own(input,'celebrationId')&&input.celebrationId!==cid||
    own(input,'spaceId')&&input.spaceId!==sid)invalid();
 const accessPolicy=policy(input.accessPolicy??old?.accessPolicy,known);
 if(!sid&&accessPolicy.mode===ACCESS_MODES.PUBLIC)invalid(); // no implicit private -> public
 let page={id,celebrationId:cid,group:input.group==='page'||old?.group==='page'?'page':'celebration',
  ...(input.placement==='footer'||old?.placement==='footer'?{placement:'footer'}:{}),
  name:name(input.name??input.title??old?.name??old?.title,180),
  blocks:blocks(input.blocks??old?.blocks??[]),accessPolicy,
  privateManaged:true,visibility:'draft',publicationStatus:'draft'};
 if(sid)page.spaceId=sid;
 const versions=input.translations??old?.translations;
 if(versions!==undefined){
  if(!obj(versions)||Object.keys(versions).length>30)invalid();
  for(const [lang,variant] of Object.entries(versions)){
   blocks(variant?.blocks);page=setPageTranslation(page,registry,lang,variant);
  }
 }
 return page;
}
function spaceDraft(input,old,id,cid,pages,known,registry){
 if(!obj(input)||own(input,'celebrationId')&&input.celebrationId!==cid||
  !Object.values(SPACE_VISIBILITIES).includes(input.visibility))invalid();
 // Switching Public/Private is allowed in DRAFT only; saved published
 // visibility, policy and release ledgers must be revoked before re-publish.
 const accessPolicy=policy(input.accessPolicy,known);
 if(input.visibility===SPACE_VISIBILITIES.PUBLIC&&accessPolicy.mode!==ACCESS_MODES.PUBLIC)invalid();
 let out=createCelebrationSpace({id,celebrationId:cid,name:name(input.name,120),
  visibility:input.visibility,accessScope:input.accessScope??old?.accessScope??'INDIVIDUAL',
  accessPolicy,pages,publicationStatus:'draft'});
 const versions=input.translations??old?.translations;
 if(versions!==undefined){
  if(!obj(versions)||Object.keys(versions).length>30)invalid();
  for(const [lang,variant] of Object.entries(versions))
   out=setCelebrationSpaceTranslation(out,registry,lang,variant);
 }
 return out;
}
function indexIds(state){
 const pages=new Set(),spaces=new Set();
 for(const aggregate of [state,state.published]){
  for(const p of aggregate?.shared?.pages??[])pages.add(p.id);
  for(const r of Object.values(aggregate?.drafts??{})){
   for(const p of r?.pages??[])pages.add(p.id);
   for(const s of r?.spaces??[]){
    spaces.add(s.id);for(const p of s.pages??[])pages.add(p.id);
   }
  }
 }
 return {pages,spaces};
}
function assertUnique(state){
 for(const aggregate of [state,state.published]){
  const pages=new Set(),spaces=new Set();
  const add=(set,id)=>{if(!stable(id)||set.has(id))invalid();set.add(id)};
  for(const p of aggregate?.shared?.pages??[])add(pages,p.id);
  for(const [cid,r] of Object.entries(aggregate?.drafts??{})){
   for(const p of r?.pages??[]){add(pages,p.id);if(p.privateManaged&&p.celebrationId!==cid)invalid()}
   for(const s of r?.spaces??[]){
    add(spaces,s.id);if(s.celebrationId!==cid)invalid();
    for(const p of s.pages??[]){add(pages,p.id);if(p.celebrationId!==cid||p.spaceId!==s.id)invalid()}
   }
  }
 }
}
function allocate(input,kind,old,used,idMap){
 if(old){if(input!==old.id)invalid();return old.id}
 if(!stable(input)||!input.startsWith('draft-'+kind+':')||own(idMap,input))invalid();
 const id=kind+':'+crypto.randomUUID();
 if(used.has(id))conflict();
 used.add(id);idMap[input]=id;return id;
}
function remap(value,ids){
 if(Array.isArray(value))value.forEach(v=>remap(v,ids));
 else if(obj(value))for(const [k,v] of Object.entries(value)){
  if(['pageId','targetPageId','linkedPageId','spaceId'].includes(k)&&typeof v==='string'&&own(ids,v))value[k]=ids[v];
  else remap(v,ids);
 }
}
const emptyRecord=()=>({pages:[],spaces:[],celebrationDates:{},celebrationTimes:{}});
function manifests(pub){
 for(const k of ['privatePageReleases','privateSpaceReleases','privateReleaseRevisions'])
  if(!obj(pub[k]))pub[k]={};
}
function clearPageExtras(pub,id){
 if(pub.privateTranslationReleases)delete pub.privateTranslationReleases[id];
 if(pub.translationReleases)delete pub.translationReleases[id];
 if(Array.isArray(pub.privateMedia))pub.privateMedia=pub.privateMedia.filter(m=>m.pageId!==id);
}
function removePage(pub,cid,id){
 const r=pub.drafts?.[cid];
 if(r){r.pages=(r.pages??[]).filter(p=>p.id!==id);
  for(const s of r.spaces??[])s.pages=s.pages.filter(p=>p.id!==id)}
 delete pub.privatePageReleases[id];clearPageExtras(pub,id);
}
function removeSpace(pub,cid,id){
 const r=pub.drafts?.[cid],s=r?.spaces?.find(x=>x.id===id);
 for(const p of [...(s?.pages??[])])removePage(pub,cid,p.id);
 for(const [pid,e] of Object.entries(pub.privatePageReleases))
  if(e.spaceId===id&&e.celebrationId===cid)removePage(pub,cid,pid);
 if(r)r.spaces=(r.spaces??[]).filter(x=>x.id!==id);
 delete pub.privateSpaceReleases[id];
}
function revokeCelebration(pub,cid){
 for(const [id,e] of Object.entries(pub.privateSpaceReleases))
  if(e.celebrationId===cid)removeSpace(pub,cid,id);
 for(const [id,e] of Object.entries(pub.privatePageReleases))
  if(e.celebrationId===cid)removePage(pub,cid,id);
 const r=pub.drafts?.[cid];
 if(r){for(const p of [...(r.pages??[])])if(managedPage(p))removePage(pub,cid,p.id);r.spaces=[]}
}
const samePolicy=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function releasedSpaces(pub,cid){
 return (pub.drafts?.[cid]?.spaces??[]).filter(s=>
  pub.privateSpaceReleases?.[s.id]?.celebrationId===cid&&
  pub.privateSpaceReleases[s.id].publication==='published');
}
function upsert(list,value){const at=list.findIndex(p=>p.id===value.id);
 if(at<0)list.push(value);else list[at]=value}
function getPage(r,id,sid){
 if(sid)return r.spaces?.find(s=>s.id===sid)?.pages?.find(p=>p.id===id);
 return r.pages?.find(p=>p.id===id);
}
function publishedChange(state,cid){
 const revision=(state.publishedRevision??0)+1;
 if(!Number.isSafeInteger(revision)||revision<1)invalid();
 state.publishedRevision=revision;state.publishedAt=new Date().toISOString();
 state.published.privateReleaseRevisions[cid]={revision,token:crypto.randomUUID()};
}
function ensurePublished(pub,cid){
 const r=pub.drafts[cid]??(pub.drafts[cid]=emptyRecord());
 r.pages??=[];r.spaces??=[];return r;
}
function saveDraft(state,cid,b,known,registry,idMap){
 const r=state.drafts[cid]??(state.drafts[cid]=emptyRecord()),pub=state.published,used=indexIds(state);
 let revoked=false;
 if(own(b,'spaces')){
  if(!Array.isArray(b.spaces)||b.spaces.length>75)invalid();
  const oldSpaces=r.spaces??[],next=[],seen=new Set();
  for(const input of b.spaces){
   if(!obj(input)||!stable(input.id)||seen.has(input.id)||!Array.isArray(input.pages)||input.pages.length>100)invalid();
   seen.add(input.id);
   const old=oldSpaces.find(s=>s.id===input.id);
   const id=allocate(input.id,'space',old,used.spaces,idMap),pages=[],seenPages=new Set();
   for(const p of input.pages){
    if(!obj(p)||!stable(p.id)||seenPages.has(p.id)||own(p,'spaceId')&&p.spaceId!==input.id)invalid();
    seenPages.add(p.id);
    const prev=old?.pages.find(x=>x.id===p.id);
    const pid=allocate(p.id,'page',prev,used.pages,idMap);
    pages.push(pageDraft({...p,spaceId:id},prev,pid,cid,id,known,registry));
   }
   const s=spaceDraft(input,old,id,cid,pages,known,registry);
   const released=pub.drafts?.[cid]?.spaces?.find(x=>x.id===id);
   if(released&&(released.visibility!==s.visibility||released.accessScope!==s.accessScope||
      !samePolicy(released.accessPolicy,s.accessPolicy))){
    removeSpace(pub,cid,id);revoked=true;
   }else if(released)for(const prior of [...released.pages]){
    const np=s.pages.find(p=>p.id===prior.id);
    if(!np||!samePolicy(np.accessPolicy,prior.accessPolicy)){
     removePage(pub,cid,prior.id);revoked=true;
    }
   }
   next.push(s);
  }
  for(const old of oldSpaces)if(!next.some(s=>s.id===old.id)){
   if(pub.privateSpaceReleases[old.id]||pub.drafts?.[cid]?.spaces?.some(s=>s.id===old.id)){
    removeSpace(pub,cid,old.id);revoked=true;
   }
  }
  r.spaces=next;
 }
 if(own(b,'pages')){
  if(!Array.isArray(b.pages)||b.pages.length>75)invalid();
  const seen=new Set();
  for(const input of b.pages){
   if(!obj(input)||!stable(input.id)||seen.has(input.id))invalid();
   seen.add(input.id);
   const old=r.pages.find(p=>p.id===input.id);
   const id=allocate(input.id,'page',old,used.pages,idMap);
   const p=pageDraft(input,old,id,cid,null,known,registry);
   const released=pub.drafts?.[cid]?.pages?.find(x=>x.id===id);
   if(released&&(!managedPage(released)||!samePolicy(p.accessPolicy,released.accessPolicy))){
    removePage(pub,cid,id);revoked=true;
   }
   upsert(r.pages,p);
  }
 }
 remap(r,idMap);getCelebrationSpaces({...r,id:cid});return revoked;
}
function duplicateDraft(state,cid,target,known,registry){
 const source=state.drafts[cid];
 if(!source||state.drafts[target]||state.published.drafts[target])conflict();
 const used=indexIds(state),spaceIds={},pageIds={};
 const alloc=(set,id)=>{if(set.has(id))conflict();set.add(id);return id};
 for(const p of source.pages??[]){
  // Retain existing legacy stage syntax for ordinary pages; private IDs
  // are freshly allocated and never copied from a browser.
  if(!managedPage(p)&&!p.id.endsWith('-'+cid))invalid();
  pageIds[p.id]=alloc(used.pages,managedPage(p)?'page:'+crypto.randomUUID():p.id.slice(0,-cid.length)+target);
 }
 for(const s of source.spaces??[]){
  spaceIds[s.id]=alloc(used.spaces,'space:'+crypto.randomUUID());
  for(const p of s.pages)pageIds[p.id]=alloc(used.pages,'page:'+crypto.randomUUID());
 }
 const copied=duplicateCelebration({...source,id:cid},{id:target,spaceIds,pageIds});
 const next={...emptyRecord(),celebrationDates:copy(copied.celebrationDates??{}),
  celebrationTimes:copy(copied.celebrationTimes??{})};
 for(const p of copied.pages){
  if(!managedPage(p))next.pages.push({...p,visibility:'draft',publicationStatus:'draft'});
  else next.pages.push(pageDraft(p,null,p.id,target,null,known,registry));
 }
 for(const s of copied.spaces){
  const pages=s.pages.map(p=>pageDraft(p,null,p.id,target,s.id,known,registry));
  next.spaces.push(spaceDraft(s,null,s.id,target,pages,known,registry));
 }
 getCelebrationSpaces({...next,id:target});state.drafts[target]=next;
 return {spaceIds,pageIds};
}
function publishOrRevoke(state,cid,b,known,registry){
 const r=state.drafts[cid],pub=state.published;if(!r)missing();
 const target=ensurePublished(pub,cid);
 if(b.action==='celebration-access'){
  pub.celebrationAccessPolicies??={};
  pub.celebrationAccessPolicies[cid]=policy(b.accessPolicy,known);
  return;
 }
 if(b.action==='celebration-visibility'){
  if(!['published','draft','hidden'].includes(b.visibility))invalid();
  pub.celebrationVisibility??={};pub.celebrationVisibility[cid]=b.visibility;
  state.shared.celebrationVisibility??={};state.shared.celebrationVisibility[cid]=b.visibility;
  if(b.visibility!=='published')revokeCelebration(pub,cid);
  return;
 }
 const isSpace=b.kind==='space';
 if(!isSpace&&b.kind!=='page'||!stable(b.id)||own(b,'spaceId')&&(!stable(b.spaceId)||isSpace))invalid();
 const item=isSpace?r.spaces?.find(s=>s.id===b.id):getPage(r,b.id,b.spaceId);
 if(!item||!isSpace&&!managedPage(item))missing();
 if(b.action==='publish'){
  if(pub.celebrationVisibility?.[cid]!=='published')conflict();
  if(isSpace){
   const old=target.spaces.find(s=>s.id===item.id);
   const clean=spaceDraft(item,item,item.id,cid,[],known,registry);
   delete clean.translations;
   upsert(target.spaces,{...clean,publicationStatus:'published',pages:old?.pages??[]});
   pub.privateSpaceReleases[item.id]={spaceId:item.id,celebrationId:cid,publication:'published'};
  }else{
   let dest=target.pages;
   if(b.spaceId){
    const s=target.spaces.find(s=>s.id===b.spaceId);
    if(!s||pub.privateSpaceReleases[b.spaceId]?.celebrationId!==cid)conflict();
    policy(s.accessPolicy,known);dest=s.pages;
   }
   const clean=pageDraft(item,item,item.id,cid,b.spaceId??null,known,registry);
   // Only this explicit publication releases manually edited language
   // versions. No machine translation and no draft variant is exposed.
   delete clean.translations;clearPageExtras(pub,item.id);
   if(obj(item.translations)&&Object.keys(item.translations).length){
    pub.privateTranslationReleases??={};
    pub.privateTranslationReleases[item.id]={
     pageId:item.id,publication:'published',variants:copy(item.translations)
    };
   }
   upsert(dest,{...clean,visibility:'published',publicationStatus:'published'});
   pub.languageRegistry=copy(registry);
   pub.privatePageReleases[item.id]={pageId:item.id,celebrationId:cid,
    ...(b.spaceId?{spaceId:b.spaceId}:{}),publication:'published'};
  }
 }else{
  if(isSpace)removeSpace(pub,cid,item.id);else removePage(pub,cid,item.id);
  if(b.action==='delete'){
   if(isSpace)r.spaces=r.spaces.filter(s=>s.id!==item.id);
   else if(b.spaceId){const s=r.spaces.find(s=>s.id===b.spaceId);s.pages=s.pages.filter(p=>p.id!==item.id)}
   else r.pages=r.pages.filter(p=>p.id!==item.id);
  }
 }
}
const reply=(body,status=200)=>Response.json(body,{status,headers:{
 'cache-control':'private, no-store','x-content-type-options':'nosniff','vary':'Authorization, Cookie',
 'x-robots-tag':'noindex, nofollow, noarchive','referrer-policy':'no-referrer'}});
function readResult(state,cid){
 const pub=state.published??{};
 return {ok:true,revision:state.version,publishedRevision:state.publishedRevision??0,
  record:copy(state.drafts[cid]??emptyRecord()),
  pageReleases:Object.values(pub.privatePageReleases??{}).filter(e=>e.celebrationId===cid),
  spaceReleases:Object.values(pub.privateSpaceReleases??{}).filter(e=>e.celebrationId===cid),
  celebrationVisibility:pub.celebrationVisibility?.[cid]??'draft',
  celebrationAccessPolicy:pub.celebrationAccessPolicies?.[cid]??{mode:ACCESS_MODES.PUBLIC},
  languageRegistry:createLanguageRegistry(state.localization?.registry??pub.languageRegistry)};
}
// Create a real canonical celebration using the existing D1 identity and R2
// snapshot. The audit key makes retries recover the same draft after a CAS fault.
async function createCanonicalCelebration(env,current,source,b,actor,known,registry){
 if(!['Michaël','Gabriel','Raphaël','Ouriel'].includes(b.archangel)||
    typeof b.date!=='string'||!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(b.date)||
    typeof b.copy!=='boolean')invalid();
 const date=new Date(b.date+'T12:00:00Z');
 if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==b.date||date.getUTCDay()!==3)invalid();
 const title=name(b.title,100),auditId='audit:m019-create:'+await sha256(b.archangel+'|'+b.date);
 const prior=await q(env.DB,'SELECT target_id FROM celebrations_directory_admin_audit WHERE id=? AND action=?',auditId,'create_celebration').first();
 let id=prior?.target_id;
 if(!id){
  const next=await q(env.DB,'SELECT COALESCE(max(id),0)+1 AS next_id FROM celebrations_celebrations').first();
  id=String(next?.next_id);if(!validCelebrationId(id))fail(409,'Création indisponible. Réessayez.');
  await env.DB.batch([
   q(env.DB,'INSERT INTO celebrations_celebrations(id,archangel,year,status) VALUES(?,?,?,?)',Number(id),b.archangel,b.date.slice(0,4),'draft'),
   q(env.DB,'INSERT INTO celebrations_directory_admin_audit(id,actor_email,action,target_id) VALUES(?,?,?,?)',auditId,actor,'create_celebration',id)
  ]);
 }
 const state=copy(current.state);state.published??=initialPublication(state);manifests(state.published);
 if(state.drafts[id])return reply({...readResult(state,id),targetCelebration:id,existing:true});
 if(b.copy&&state.drafts[source]){
  const original=state.drafts[source];state.drafts[source]=copy(original);
  for(const space of state.drafts[source].spaces??[]){space.accessPolicy={mode:ACCESS_MODES.PUBLIC};for(const page of space.pages)page.accessPolicy={mode:ACCESS_MODES.PUBLIC};}
  for(const page of state.drafts[source].pages??[])if(managedPage(page))page.accessPolicy={mode:ACCESS_MODES.ALL_PRIVATE_TYPES};
  const ids=duplicateDraft(state,source,id,known,registry);state.drafts[source]=original;
  for(const [old,fresh]of Object.entries(ids.pageIds))if(state.localization?.pages?.[old])
   state.localization.pages[fresh]=copy(state.localization.pages[old]);
  // Content copies do not carry a category grant or individual enrollment.
  for(const space of state.drafts[id].spaces??[]){
   space.visibility=SPACE_VISIBILITIES.PRIVATE;space.accessScope='CELEBRATION';space.accessPolicy={mode:ACCESS_MODES.PUBLIC};
   for(const page of space.pages)page.accessPolicy={mode:ACCESS_MODES.PUBLIC};
  }
  for(const page of state.drafts[id].pages)if(managedPage(page))page.accessPolicy={mode:ACCESS_MODES.ALL_PRIVATE_TYPES};
 }else{
  const labels=[['accueil-celebration','Accueil de la célébration'],['preparation','Préparation'],['mercredi','Mercredi'],['jeudi','Jeudi'],['vendredi','Vendredi'],['samedi','Samedi'],['dimanche','Dimanche'],['apres-celebration','Après célébration']];
  state.drafts[id]={...emptyRecord(),pages:labels.map(([slug,name])=>({id:slug+'-'+id,name,group:'celebration',visibility:'draft',blocks:[]}))};
 }
 state.drafts[id].celebrationDates={wednesday:b.date,preparationDates:[]};
 state.shared.celebrationVisibility={...state.shared.celebrationVisibility,[id]:'draft'};
 state.published.celebrationVisibility={...state.published.celebrationVisibility,[id]:'draft'};
 state.celebrationMetadata={...state.celebrationMetadata,[id]:{title,date:b.date}};
 assertUnique(state);
 if(!await writeEditorState(env.EDITOR_BUCKET,current,state))conflict();
 return reply({...readResult(state,id),targetCelebration:id});
}
// Route owner A must gate the isolated host and feature flag. This service
// independently checks the real D1 admin session and same-origin mutations.
export async function handlePrivateEditorCommand(request,env){
 try{
  const url=new URL(request.url);
  if(url.protocol!=='https:'||!['GET','POST'].includes(request.method))return reply({ok:false,error:'Méthode interdite'},405);
  const origin=request.headers.get('origin');
  if(origin&&origin!==url.origin||request.method==='POST'&&origin!==url.origin||
    request.headers.get('sec-fetch-site')==='cross-site')return reply({ok:false,error:'Origine refusée'},403);
  if(!env?.DB||!env?.EDITOR_BUCKET)return reply({ok:false,error:'Service indisponible'},503);
  const actor=await authorize(request,env,true);
  if(typeof actor!=='string'||!actor.trim())return reply({ok:false,error:'Administrateur D1 requis'},401);
  const current=await readEditorState(env.EDITOR_BUCKET);
  if(request.method==='GET'){
   const cid=url.searchParams.get('celebration');await catalogue(env.DB,cid);
   const result=readResult(current.state,cid),pub=current.state.published??{};
   result.privateReleaseReady=await privateReleaseReady(env.DB,pub,cid,current.state.publishedRevision,releasedSpaces(pub,cid));
   return reply(result);
  }
  if((request.headers.get('content-type')??'').split(';')[0]!=='application/json')return reply({ok:false,error:'Format invalide'},415);
  const raw=await request.text();if(raw.length>EDITOR_SNAPSHOT_LIMIT)fail(413,'Commande trop volumineuse');
  let b;try{b=JSON.parse(raw)}catch{invalid()}
  if(!obj(b)||!['save','publish','unpublish','delete','celebration-visibility','celebration-access','duplicate','reconcile','page-access','create-celebration'].includes(b.action))invalid();
  safeJSON(b);
  const fields={save:['spaces','pages'],publish:['kind','id','spaceId'],unpublish:['kind','id','spaceId'],
   delete:['kind','id','spaceId'],'celebration-visibility':['visibility'],'celebration-access':['accessPolicy'],duplicate:['targetCelebration'],reconcile:[],'page-access':['id','accessPolicy'],'create-celebration':['archangel','date','title','copy']};
  keysOnly(b,['action','celebration','expectedRevision',...fields[b.action]]);
  if(!expectedRevisionMatches(b.expectedRevision,current.state.version))conflict();
  const cid=b.celebration,known=await catalogue(env.DB,cid);
  if(b.action==='celebration-access'&&b.accessPolicy?.mode!==ACCESS_MODES.PUBLIC){
    const record=await q(env.DB,'SELECT archangel FROM celebrations_celebrations WHERE id=?',
      Number(cid)).first();
    if(String(record?.archangel||'').normalize('NFD')
       .replace(/[\u0300-\u036f]/g,'').toLowerCase().includes('michael'))
      fail(403,'Michaël doit rester public');
  }
  const state=copy(current.state);state.published??=initialPublication(state);manifests(state.published);
  const registry=createLanguageRegistry(state.localization?.registry??state.published.languageRegistry);
  if(b.action==='create-celebration')return await createCanonicalCelebration(env,current,cid,b,actor,known,registry);
  const idMap=Object.create(null);let changed=false,duplicate;
  if(b.action==='reconcile'){
   // Only the current trusted canonical snapshot can be acknowledged.
   await acknowledgePrivateRelease(env.DB,state.published,cid,state.publishedRevision,releasedSpaces(state.published,cid));
   return reply({...readResult(state,cid),privateReleaseReady:true});
  }
  if(b.action==='page-access'){
   if(!stable(b.id))invalid();
   const access=policy(b.accessPolicy,known),r=state.drafts[cid]??=emptyRecord();
   const shared=state.shared.pages.find(p=>p.id===b.id);
   const prior=shared??r.pages.find(p=>p.id===b.id);
   if(!prior)missing();
   if(prior.spaceId)invalid();
   // Revoke every old public/private release in the SAME conditional snapshot.
   // The next release still requires the explicit Publish action.
   removePage(state.published,cid,b.id);
   state.published.shared.pages=state.published.shared.pages.filter(p=>p.id!==b.id);
   state.shared.pages=state.shared.pages.filter(p=>p.id!==b.id);
   r.pages=r.pages.filter(p=>p.id!==b.id);
   if(access.mode===ACCESS_MODES.PUBLIC){
    const clean={...copy(prior),visibility:'draft',publicationStatus:'draft'};
    for(const key of ['accessPolicy','privateManaged','celebrationId','spaceId'])delete clean[key];
    if(prior.group==='page')state.shared.pages.push(clean);else r.pages.push(clean);
   }else{
    const original={...copy(prior),celebrationId:cid,accessPolicy:access};
    const draft=pageDraft(original,prior,b.id,cid,null,known,registry);
    const variants=state.localization?.pages?.[b.id];
    if(variants)for(const [lang,content] of Object.entries(variants)){
     Object.assign(draft,setPageTranslation(draft,registry,lang,content));
    }
    r.pages.push(draft);
   }
   changed=true;
  }else if(b.action==='save'){
   if(!own(b,'spaces')&&!own(b,'pages'))invalid();
   changed=saveDraft(state,cid,b,known,registry,idMap);
  }else if(b.action==='duplicate'){
   const targetKnown=await catalogue(env.DB,b.targetCelebration);
   duplicate=duplicateDraft(state,cid,b.targetCelebration,targetKnown,registry);
  }else{publishOrRevoke(state,cid,b,known,registry);changed=true}
  assertUnique(state);
  if(changed)publishedChange(state,cid);
  if(JSON.stringify(state).length>EDITOR_SNAPSHOT_LIMIT)fail(413,'Capacité dépassée');
  if(!await writeEditorState(env.EDITOR_BUCKET,current,state))conflict();
  // R2 is now durable. This is NOT a transaction shared with D1.
  if(changed){
   try{await acknowledgePrivateRelease(env.DB,state.published,cid,state.publishedRevision,releasedSpaces(state.published,cid))}
   catch{return reply({ok:false,error:'Snapshot enregistré; confirmation D1 incomplète. Accès privé bloqué. Rechargez puis réconciliez.',
    saved:true,revision:state.version,publishedRevision:state.publishedRevision,idMap},503)}
  }
  const target=b.action==='duplicate'?b.targetCelebration:cid,result=readResult(state,target);
  result.privateReleaseReady=await privateReleaseReady(env.DB,state.published,target,state.publishedRevision,releasedSpaces(state.published,target));
  return reply({...result,idMap,...(duplicate?{duplicate}:{})});
 }catch(e){return reply({ok:false,error:e.status?e.message:e instanceof TypeError?'Modèle invalide':'Service indisponible'},e.status??(e instanceof TypeError?400:503))}
}
