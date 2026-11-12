// Isolated staging server drafts: no publication, no historical D1 writes.
// Authenticated JSON snapshots are persisted in the staging-only R2 bucket.
import {legacyEditorView,mergeLegacyRecord,managedPageId} from './app/security/private-editor-boundary.mjs';
import {authorize} from './auth-api.mjs';
import {hasEditorAccess} from './editor-site-access.mjs';
import {createLanguageRegistry,setPageTranslation} from './app/domain/editor-localization.mjs';
import {EDITOR_SNAPSHOT_LIMIT,expectedRevisionMatches} from './app/ports/editor-snapshot-contract.mjs';
import {readEditorSnapshot,putEditorSnapshot} from './app/adapters/editor-r2-repository.mjs';
import {initialPublication,discoverMedia,publiclyVisible} from './editor-publication-api.mjs';
import {isOfficialEditorHost,isReadonlyCandidateHost,isWritableEditorHost,sameOriginEditorWrite} from './app/security/editor-route-policy.mjs';
const HOST='celebrations-exit-staging.rondes.workers.dev';
const PREVIEW_HOST='celebrations-visual-candidate.rondes.workers.dev';
const ID=/^(?:[1-9][0-9]{0,7}|plan-(?:michael|gabriel|raphael|ouriel)-20[0-9]{2}-[0-9]{2}-[0-9]{2})$/;
const MAX_BODY=4500000;
const secure={'cache-control':'no-store','x-robots-tag':'noindex,nofollow,noarchive','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const json=(value,status=200)=>Response.json(value,{status,headers:secure});
const error=(message,status)=>json({ok:false,error:message},status);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const goodId=x=>typeof x==='string'&&ID.test(x)&&x.length<=46;
const goodPage=(p,id)=>object(p)&&typeof p.id==='string'&&typeof p.name==='string'&&p.name.length<=180&&
 Array.isArray(p.blocks)&&p.blocks.length<=300&&p.blocks.every(b=>object(b)&&typeof b.kind==='string'&&b.kind.length<30)&&
 (p.group==='celebration'&&p.id.endsWith('-'+id)&&/^(?:accueil-celebration|preparation|mercredi|jeudi|vendredi|samedi|dimanche|apres-celebration|extra-[0-9a-f-]{30,45})-/.test(p.id)||
  p.group==='page'&&(p.id==='neutral-accueil-general'||/^neutral-[0-9a-f-]{30,45}$/.test(p.id)));
const goodPlans=x=>Array.isArray(x)&&x.length<=100&&x.every(p=>object(p)&&goodId(p.id)&&p.id.startsWith('plan-')&&
 typeof p.title==='string'&&p.title.length<=100&&typeof p.archangel==='string'&&p.archangel.length<=25&&
 typeof p.date==='string'&&/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(p.date));
const goodShared=x=>object(x)&&Array.isArray(x.pages)&&x.pages.length<=60&&x.pages.every(p=>goodPage(p,'unused')&&p.group==='page')&&
 typeof x.homeId==='string'&&x.homeId.length<=80&&
 (x.deletedPageIds===undefined||(Array.isArray(x.deletedPageIds)&&x.deletedPageIds.length<=100&&
 x.deletedPageIds.every(id=>typeof id==='string'&&/^neutral-[0-9a-f-]{30,45}$/.test(id))));

// The registry and ordinary/footer/celebration variants belong only to the authenticated
// private editor snapshot. Never put translations in public shared pages.
function goodLocalization(input,shared,record,storedState,selectedCelebration){
 if(!object(input)||!object(input.registry)||!object(input.pages))return false;
 const ids=Object.keys(input.pages);
 if(ids.length>60)return false;
 let registry;try{registry=createLanguageRegistry(input.registry)}catch{return false}
 if(registry.languages.length>30)return false;
 // The authenticated editor has ONE multilingual catalogue across ALL celebrations.
 // A save of Michaël must keep translations belonging to Gabriel/Raphaël/Ouriel.
 // Only pages already recorded on the server are considered (private managed
 // pages remain excluded by legacyEditorView). Never accept arbitrary IDs.
 const legacy=legacyEditorView(storedState);
 const otherCelebrationPages=Object.entries(legacy.drafts||{})
  .filter(([id])=>id!==selectedCelebration)
  .flatMap(([,entry])=>entry?.pages||[]);
 const canonical=new Map([...otherCelebrationPages,...shared.pages,...record.pages]
  .map(page=>[page.id,page]));
 for(const id of ids){
  const page=canonical.get(id),versions=input.pages[id];
  if(!page||!['page','celebration'].includes(page.group)||!object(versions))return false;
  for(const [lang,content] of Object.entries(versions)){
   if(lang==='fr'||!object(content)||!Array.isArray(content.blocks)||
      content.blocks.length>300||!content.blocks.every(b=>object(b)&&
       typeof b.kind==='string'&&b.kind.length<30))return false;
   try{setPageTranslation(page,registry,lang,content)}catch{return false}
  }
 }
 return true;
}
function sanitizeRecord(record,id){
 if(!object(record)||!Array.isArray(record.pages)||record.pages.length>75||
 !record.pages.every(p=>goodPage(p,id))||
 (record.celebrationDates!==undefined&&!object(record.celebrationDates))||
 (record.celebrationTimes!==undefined&&!object(record.celebrationTimes)))return null;
 return {pages:record.pages,celebrationDates:record.celebrationDates||{},
  celebrationTimes:record.celebrationTimes||{},siteHomeId:String(record.siteHomeId||'').slice(0,80)};
}
// Enregistrer updates the already-public page in the SAME conditional R2 write.
// New drafts, hidden pages and pages of a hidden celebration stay private.
// Only the authenticated official-domain route may call this helper.
export function refreshAlreadyPublishedPage(state,record,shared,celebration,pageId){
 if(!pageId||!state.published)return false;
 const isGeneral=/^neutral-(?:accueil-general|[0-9a-f-]{30,45})$/.test(pageId);
 const sourcePages=isGeneral?shared.pages:record.pages;
 const targetPages=isGeneral?state.published.shared?.pages:state.published.drafts?.[celebration]?.pages;
 const source=sourcePages?.find(p=>p.id===pageId);
 const prior=targetPages?.find(p=>p.id===pageId);
 if(!source||!prior||!publiclyVisible(source)||!publiclyVisible(prior))return false;
 if(!isGeneral){
  const visibility=state.published.celebrationVisibility?.[celebration]||
   state.published.plans?.find(p=>p.id===celebration)?.visibility;
  if(visibility==='hidden'||visibility==='draft')return false;
 }
 const replacement=JSON.parse(JSON.stringify(source));
 replacement.visibility='published';
 const at=targetPages.findIndex(p=>p.id===pageId);
 targetPages[at]=replacement;
 if(isGeneral){
  // A new home may only become public after that page has been published.
  if(targetPages.some(p=>p.id===shared.homeId&&publiclyVisible(p)))
   state.published.shared.homeId=shared.homeId;
 }else{
  const publishedRecord=state.published.drafts[celebration];
  publishedRecord.celebrationDates=JSON.parse(JSON.stringify(record.celebrationDates||{}));
  publishedRecord.celebrationTimes=JSON.parse(JSON.stringify(record.celebrationTimes||{}));
 }
 return true;
}
async function stored(bucket){
 return readEditorSnapshot(bucket,{
  empty:()=>({version:0,drafts:{},plans:[],shared:{pages:[],homeId:''}}),
  requireBody:true,invalidMessage:'Stored draft invalid',
  validate:state=>object(state)&&object(state.drafts)&&
   Number.isSafeInteger(state.version)&&state.version>=1&&
   Array.isArray(state.plans)&&object(state.shared)
 });
}
export async function handleServerDraft(request,env){
 const url=new URL(request.url);
 const open=url.pathname==='/api/editor-open-draft';
 if(!open&&url.pathname!=='/api/editor-server-draft')return error('Introuvable',404);
 if(!isWritableEditorHost(url.hostname,env)&&url.hostname!==PREVIEW_HOST&&url.hostname!==HOST)return error('Introuvable',404);
 if(!open&&url.hostname!==HOST)return error('Introuvable',404);
 if(!['GET','POST'].includes(request.method))return error('Méthode interdite',405);
 if(url.hostname===PREVIEW_HOST&&request.method!=='GET')return error('Aperçu non modifiable',405);
 // The candidate site is PUBLIC-only. A previous GET leaked private drafts,
 // planned celebrations, shared admin pages and unpublished media metadata.
 if(isReadonlyCandidateHost(url.hostname))return error('Introuvable',404);
 // Enforce in the API handler itself, not solely at Worker route dispatch:
 // the authenticated OFFICIAL GET is as sensitive as the POST.
 if(open&&isWritableEditorHost(url.hostname,env)&&
    !await hasEditorAccess(request,env))return error('Code administrateur nécessaire',401);
 // Official pages use the same shared editor snapshot as the verified staging editor;
 // production MEDIA_BUCKET stays unchanged to preserve all original media URLs.
 const draftBucket=isWritableEditorHost(url.hostname,env)?env.EDITOR_BUCKET:env.MEDIA_BUCKET;
 if(!env.DB||!draftBucket)return error('Sauvegarde serveur indisponible',503);
 // The owner explicitly allows open editing during this temporary publishing phase.
 // The original authenticated route is intentionally unchanged for compatibility.
 if(!open&&!await authorize(request,env,true))return error('Connexion administrateur nécessaire',401);
 if(open&&request.method==='POST'&&!sameOriginEditorWrite(request))
  return error('Écriture autorisée seulement depuis cet éditeur',403);
 try{
  if(request.method==='GET'){
   const id=url.searchParams.get('celebration');
   if(!goodId(id))return error('Célébration invalide',400);
   const {state}=await stored(draftBucket);
   const view=legacyEditorView(state);
   return json({ok:true,revision:state.version,record:view.drafts[id]||null,plans:state.plans,shared:view.shared,
    localization:view.localization||null,celebrationMetadata:state.celebrationMetadata??{},
    mediaCatalogue:discoverMedia(view),updatedAt:state.updatedAt||null});
  }
  if((request.headers.get('content-type')||'').split(';')[0]!=='application/json')return error('Format invalide',415);
  const raw=await request.text();
  if(raw.length>MAX_BODY)return error('Brouillon trop volumineux',413);
  let body;try{body=JSON.parse(raw)}catch{return error('JSON invalide',400)}
  if(!object(body)||!goodId(body.celebration)||!goodPlans(body.plans)||!goodShared(body.shared)||
   !Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)return error('Données de sauvegarde invalides',400);
  let record=sanitizeRecord(body.record,body.celebration);
  if(!record)return error('Pages invalides',400);
  // The selected page must belong to the authenticated celebration/shared pages.
  // An invalid or stale page must never be silently recorded as published.
  const publishPageId=body.publishPageId;
  if(publishPageId!==undefined&&
   (typeof publishPageId!=='string'||publishPageId.length>110||
    !record.pages.some(p=>p.id===publishPageId)&&!body.shared.pages.some(p=>p.id===publishPageId)))
   return error('Page à mettre à jour introuvable',400);
  const current=await stored(draftBucket);
  if(!expectedRevisionMatches(body.expectedRevision,current.state.version))return error('Une version plus récente existe sur le serveur. Rechargez sans effacer votre brouillon local.',409);
  if(body.localization!==undefined&&
     !goodLocalization(body.localization,body.shared,record,current.state,body.celebration))
   return error('Traductions ou registre multilingue invalides',400);
  // Legacy saves cannot replace private pages, spaces, or their ACLs.
  try{
   if(Object.hasOwn(body.record,'spaces')||
     record.pages.some(p=>managedPageId(current.state,body.celebration,p.id))||
     body.shared.pages.some(p=>managedPageId(current.state,body.celebration,p.id))||
     publishPageId&&managedPageId(current.state,body.celebration,publishPageId))
    throw Error('private command');
   record=mergeLegacyRecord(current.state.drafts[body.celebration],record);
   body.shared=mergeLegacyRecord(current.state.shared,body.shared);
  }catch{return error('Commande privée : session D1 et service dédiés requis',403)}
  const drafts=Object.assign(Object.create(null),current.state.drafts);
  drafts[body.celebration]=record;
  const updatedAt=new Date().toISOString(),version=current.state.version+1;
  // Keep unrelated published pages intact. The selected already-public page
  // gets updated atomically with the private draft on the OFFICIAL domain only.
  const previouslyPublished=current.state.published||initialPublication(current.state);
  const catalogue=discoverMedia(legacyEditorView({...current.state,drafts,plans:body.plans,shared:body.shared}));
  const state={...current.state,version,updatedAt,drafts,plans:body.plans,
   shared:body.shared,published:previouslyPublished,mediaCatalogue:catalogue,
   ...(body.localization!==undefined?{localization:body.localization}:{})};
  // Language availability and names are settings, never a release of draft text.
  // The page's explicit Publish action still owns every translated content release.
  if(body.localization)state.published.languageRegistry=createLanguageRegistry(body.localization.registry);
  const publishedPageId=open&&isWritableEditorHost(url.hostname,env)&&publishPageId&&
   refreshAlreadyPublishedPage(state,record,body.shared,body.celebration,publishPageId)
    ?publishPageId:null;
  if(publishedPageId)state.publishedAt=updatedAt;
  const serialized=JSON.stringify(state);
  if(serialized.length>EDITOR_SNAPSHOT_LIMIT)return error('Capacité de brouillon dépassée',413);
  const result=await putEditorSnapshot(draftBucket,current.etag,serialized);
  if(!result)return error('Une autre sauvegarde vient de modifier le serveur. Votre brouillon local est conservé.',409);
  return json({ok:true,revision:version,updatedAt,publishedPageId});
 }catch{return error('Enregistrement serveur indisponible. Votre copie locale est conservée.',503)}
}
