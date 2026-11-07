// Isolated staging server drafts: no publication, no historical D1 writes.
// Authenticated JSON snapshots are persisted in the staging-only R2 bucket.
import {authorize} from './auth-api.mjs';
import {hasEditorAccess} from './editor-site-access.mjs';
import {initialPublication,discoverMedia,publiclyVisible} from './editor-publication-api.mjs';
const HOST='celebrations-exit-staging.rondes.workers.dev';
const PUBLISHED_HOSTS=new Set(['ronde-des-archanges-universelle.eu','www.ronde-des-archanges-universelle.eu']);
const PREVIEW_HOST='celebrations-visual-candidate.rondes.workers.dev';
const KEY='editor-trials/server-drafts-v1.json';
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
 const item=await bucket.get(KEY);
 if(!item)return {etag:null,state:{version:0,drafts:{},plans:[],shared:{pages:[],homeId:''}}};
 if(!item.body)throw Error('Draft inaccessible');
 const state=JSON.parse(await item.text());
 if(!object(state)||!object(state.drafts)||!Number.isSafeInteger(state.version)||state.version<1||
 !Array.isArray(state.plans)||!object(state.shared))throw Error('Stored draft invalid');
 return {etag:item.etag,state};
}
export async function handleServerDraft(request,env){
 const url=new URL(request.url);
 const open=url.pathname==='/api/editor-open-draft';
 if(!open&&url.pathname!=='/api/editor-server-draft')return error('Introuvable',404);
 if(!PUBLISHED_HOSTS.has(url.hostname)&&url.hostname!==PREVIEW_HOST&&url.hostname!==HOST)return error('Introuvable',404);
 if(!open&&url.hostname!==HOST)return error('Introuvable',404);
 if(!['GET','POST'].includes(request.method))return error('Méthode interdite',405);
 if(url.hostname===PREVIEW_HOST&&request.method!=='GET')return error('Aperçu non modifiable',405);
 if(open&&PUBLISHED_HOSTS.has(url.hostname)&&request.method==='POST'&&
    !await hasEditorAccess(request,env))return error('Code administrateur nécessaire',401);
 // Official pages use the same shared editor snapshot as the verified staging editor;
 // production MEDIA_BUCKET stays unchanged to preserve all original media URLs.
 const draftBucket=(PUBLISHED_HOSTS.has(url.hostname)||url.hostname===PREVIEW_HOST)?env.EDITOR_BUCKET:env.MEDIA_BUCKET;
 if(!env.DB||!draftBucket)return error('Sauvegarde serveur indisponible',503);
 // The owner explicitly allows open editing during this temporary publishing phase.
 // The original authenticated route is intentionally unchanged for compatibility.
 if(!open&&!await authorize(request,env,true))return error('Connexion administrateur nécessaire',401);
 if(open&&request.method==='POST'&&request.headers.get('origin')!=='https://'+url.hostname)
  return error('Écriture autorisée seulement depuis cet éditeur',403);
 try{
  if(request.method==='GET'){
   const id=url.searchParams.get('celebration');
   if(!goodId(id))return error('Célébration invalide',400);
   const {state}=await stored(draftBucket);
   return json({ok:true,revision:state.version,record:state.drafts[id]||null,plans:state.plans,shared:state.shared,
    mediaCatalogue:discoverMedia(state),updatedAt:state.updatedAt||null});
  }
  if((request.headers.get('content-type')||'').split(';')[0]!=='application/json')return error('Format invalide',415);
  const raw=await request.text();
  if(raw.length>MAX_BODY)return error('Brouillon trop volumineux',413);
  let body;try{body=JSON.parse(raw)}catch{return error('JSON invalide',400)}
  if(!object(body)||!goodId(body.celebration)||!goodPlans(body.plans)||!goodShared(body.shared)||
   !Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)return error('Données de sauvegarde invalides',400);
  const record=sanitizeRecord(body.record,body.celebration);
  if(!record)return error('Pages invalides',400);
  // The selected page must belong to the authenticated celebration/shared pages.
  // An invalid or stale page must never be silently recorded as published.
  const publishPageId=body.publishPageId;
  if(publishPageId!==undefined&&
   (typeof publishPageId!=='string'||publishPageId.length>110||
    !record.pages.some(p=>p.id===publishPageId)&&!body.shared.pages.some(p=>p.id===publishPageId)))
   return error('Page à mettre à jour introuvable',400);
  const current=await stored(draftBucket);
  if(body.expectedRevision!==current.state.version)return error('Une version plus récente existe sur le serveur. Rechargez sans effacer votre brouillon local.',409);
  const drafts=Object.assign(Object.create(null),current.state.drafts);
  drafts[body.celebration]=record;
  const updatedAt=new Date().toISOString(),version=current.state.version+1;
  // Keep unrelated published pages intact. The selected already-public page
  // gets updated atomically with the private draft on the OFFICIAL domain only.
  const previouslyPublished=current.state.published||initialPublication(current.state);
  const catalogue=discoverMedia({...current.state,drafts,plans:body.plans,shared:body.shared});
  const state={...current.state,version,updatedAt,drafts,plans:body.plans,
   shared:body.shared,published:previouslyPublished,mediaCatalogue:catalogue};
  const publishedPageId=open&&PUBLISHED_HOSTS.has(url.hostname)&&publishPageId&&
   refreshAlreadyPublishedPage(state,record,body.shared,body.celebration,publishPageId)
    ?publishPageId:null;
  if(publishedPageId)state.publishedAt=updatedAt;
  const serialized=JSON.stringify(state);
  if(serialized.length>5_000_000)return error('Capacité de brouillon dépassée',413);
  const options={httpMetadata:{contentType:'application/json'},onlyIf:current.etag?
   {etagMatches:current.etag}:{etagDoesNotMatch:'*'}};
  const result=await draftBucket.put(KEY,serialized,options);
  if(!result)return error('Une autre sauvegarde vient de modifier le serveur. Votre brouillon local est conservé.',409);
  return json({ok:true,revision:version,updatedAt,publishedPageId});
 }catch{return error('Enregistrement serveur indisponible. Votre copie locale est conservée.',503)}
}
