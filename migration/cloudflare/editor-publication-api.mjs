// Separate published website from the admin draft. Do not modify original
// MEDIA_BUCKET or historic URLs. Both snapshots live in the existing editor R2.
import {hasEditorAccess} from './editor-site-access.mjs';

const KEY='editor-trials/server-drafts-v1.json';
const PREFIX='editor-trials/uploads/';
const SITE=new Set(['www.ronde-des-archanges-universelle.eu','ronde-des-archanges-universelle.eu']);
const PREVIEW='celebrations-visual-candidate.rondes.workers.dev';
const STAGING='celebrations-exit-staging.rondes.workers.dev';
const err=(message,status=400)=>Response.json({ok:false,error:message},{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const json=value=>Response.json(value,{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const copy=x=>JSON.parse(JSON.stringify(x));
const validState=x=>x&&typeof x==='object'&&Number.isSafeInteger(x.version)&&x.drafts&&x.shared&&Array.isArray(x.plans);
const defaultState=()=>({version:0,drafts:{},plans:[],shared:{pages:[],homeId:''},mediaCatalogue:[]});
export async function readEditorState(bucket){
 const blob=await bucket.get(KEY);
 if(!blob)return {state:defaultState(),etag:null};
 const state=JSON.parse(await blob.text());
 if(!validState(state))throw Error('Editor snapshot invalid');
 return {state,etag:blob.etag};
}
export async function writeEditorState(bucket,previous,state){
 state.version=previous.state.version+1;
 state.updatedAt=new Date().toISOString();
 const str=JSON.stringify(state);
 if(str.length>5_000_000)throw Error('Editor snapshot size limit');
 const put=await bucket.put(KEY,str,{
  httpMetadata:{contentType:'application/json'},
  onlyIf:previous.etag?{etagMatches:previous.etag}:{etagDoesNotMatch:'*'}
 });
 return !!put;
}
const validWeb=url=>{
 const s=String(url||'').trim();
 if(s.length>650)return '';
 if(/^https:\/\//i.test(s)){try{const u=new URL(s);return u.username||u.password?'':u.href}catch{return ''}}
 return /^\/(?:media|letter|api\/editor-media\/file)\/[^?#\s.][^?#\s]*$/i.test(s)&&!s.includes('..')?s:'';
};
// Only actual files and video/image/audio resources belong in the media library.
// Navigation links and arbitrary buttons are content, never separate media.
function classify(block,src){
 if(block.kind==='video')return 'video';
 if(block.kind==='image')return 'image';
 if(block.kind==='audio')return 'audio';
 if(block.kind==='button'){
  if(/\.pdf(?:[?#]|$)/i.test(src))return 'pdf';
  if(/\.(?:mp3|wav|ogg|m4a|opus|flac)(?:[?#]|$)/i.test(src))return 'audio';
  if(/\.(?:jpe?g|png|webp|gif|svg|avif)(?:[?#]|$)/i.test(src))return 'image';
  if(/\.(?:mp4|webm|mov)(?:[?#]|$)/i.test(src))return 'video';
 }
 return null;
}
const sourceOf=b=>b.kind==='video'||b.kind==='button'?b.href:b.src;
function mediaUsage(page,celebrationId){
 const shared=page.group==='page';
 const suffix='-'+celebrationId;
 return {pageId:page.id,pageName:String(page.name||'Page').slice(0,180),
  celebrationId:shared?'':celebrationId,
  slug:shared?page.id:(String(page.id).endsWith(suffix)?page.id.slice(0,-suffix.length):page.id),
  group:shared?'page':'celebration'};
}
function scanBlocks(blocks,into,page,celebrationId){
 for(const block of blocks||[]){
  if(block.kind==='section'){
   for(const column of block.columns||[])scanBlocks(column,into,page,celebrationId);
   continue;
  }
  const url=validWeb(sourceOf(block)),type=classify(block,url);
  if(!url||!type)continue;
  const key=type+'|'+url;
  let record=into.get(key);
  if(!record){
   record={id:key,type,src:url,
    name:String(block.text||block.title||url.split('/').pop()||'Média').slice(0,120),
    source:url.startsWith('/media/new/')?'uploaded':url.startsWith('/media/')?'historical':'link',
    general:false,uses:[]};
   into.set(key,record);
  }
  if(page&&page.id){
   const use=mediaUsage(page,celebrationId);
   if(!record.uses.some(x=>x.pageId===use.pageId&&x.celebrationId===use.celebrationId))
    record.uses.push(use);
  }
 }
}
export function discoverMedia(state){
 const index=new Map();
 for(const r of state.mediaCatalogue||[]){
  if(r&&['image','video','pdf','audio'].includes(r.type)&&validWeb(r.src)){
   const src=validWeb(r.src);
   index.set(r.type+'|'+src,{...r,id:r.type+'|'+src,uses:[]});
  }
 }
 for(const p of state.shared?.pages||[])scanBlocks(p.blocks,index,p,'');
 for(const [id,draft] of Object.entries(state.drafts||{}))
  for(const p of draft?.pages||[])scanBlocks(p.blocks,index,p,id);
 // An older published revision can still display a file removed from its draft.
 // Count this use too, so files visible to visitors are never marked 'unused'.
 for(const p of state.published?.shared?.pages||[])scanBlocks(p.blocks,index,p,'');
 for(const [id,draft] of Object.entries(state.published?.drafts||{}))
  for(const p of draft?.pages||[])scanBlocks(p.blocks,index,p,id);
 return [...index.values()].slice(0,1800);
}
export function initialPublication(state){
 return {drafts:copy(state.drafts||{}),shared:copy(state.shared||{pages:[],homeId:''}),
  plans:copy(state.plans||[]),celebrationVisibility:copy(state.shared?.celebrationVisibility||{})};
}
const validVisibility=x=>['draft','published','hidden'].includes(x);
export function publiclyVisible(p){return p&&p.visibility!=='hidden'&&p.visibility!=='draft'}
export function publicSnapshot(state,celebration){
 const published=state.published||initialPublication(state);
 const visibility=published.celebrationVisibility||{};
 const original=published.drafts?.[celebration]||null;
 const plan=published.plans?.find(p=>p.id===celebration);
 const celebrationVisible=celebrationVisibleFor(celebration,visibility,plan?.visibility);
 const record=celebrationVisible&&original?{
  ...original,pages:(original.pages||[]).filter(publiclyVisible)
 }:null;
 const shared=copy(published.shared||{pages:[],homeId:''});
 shared.pages=(shared.pages||[]).filter(publiclyVisible);
 if(!shared.pages.some(p=>p.id===shared.homeId))
  shared.homeId=shared.pages[0]?.id||'neutral-accueil-general';
 delete shared.celebrationVisibility;
 const plans=(published.plans||[]).filter(p=>celebrationVisibleFor(p.id,visibility,p.visibility));
 return {ok:true,revision:state.version,record,shared,plans,
  celebrationVisible,celebrationVisibility:visibility,
  media:discoverMedia(state).filter(r=>r.general===true),
  updatedAt:state.publishedAt||state.updatedAt||null};
}
function celebrationVisibleFor(id,map,planState){
 return (map[id]||planState||'published')==='published';
}
function hostCheck(request){
 const u=new URL(request.url);
 return SITE.has(u.hostname)||u.hostname===PREVIEW||u.hostname===STAGING;
}
async function protectedWrite(request,env){
 const url=new URL(request.url);
 if(url.hostname===PREVIEW||url.hostname===STAGING)return err('Prévisualisation en lecture seule',405);
 if(!SITE.has(url.hostname))return err('Domaine non autorisé',404);
 if(!await hasEditorAccess(request,env))return err('Code administrateur nécessaire',401);
 if(request.headers.get('origin')!=='https://'+url.hostname)return err('Origine interdite',403);
 return null;
}
const pageIdOk=id=>typeof id==='string'&&id.length<=110&&
 /^(?:neutral-(?:accueil-general|[0-9a-f-]{30,45})|(?:accueil-celebration|preparation|mercredi|jeudi|vendredi|samedi|dimanche|apres-celebration|extra-[0-9a-f-]{30,45})-(?:[1-9][0-9]{0,7}|plan-(?:michael|gabriel|raphael|ouriel)-20[0-9]{2}-[0-9]{2}-[0-9]{2}))$/.test(id);
const celebrationIdOk=id=>typeof id==='string'&&/^(?:[1-9][0-9]{0,7}|plan-(?:michael|gabriel|raphael|ouriel)-20[0-9]{2}-[0-9]{2}-[0-9]{2})$/.test(id);
export async function handleEditorPublication(request,env){
 if(!hostCheck(request))return err('Introuvable',404);
 const url=new URL(request.url);
 if(!['GET','POST'].includes(request.method))return err('Méthode interdite',405);
 if(!env.EDITOR_BUCKET)return err('Stockage non disponible',503);
 if(request.method==='GET'){
  const id=url.searchParams.get('celebration');
  if(!celebrationIdOk(id))return err('Célébration invalide',400);
  const {state}=await readEditorState(env.EDITOR_BUCKET);
  return json(publicSnapshot(state,id));
 }
 const denied=await protectedWrite(request,env);if(denied)return denied;
 let body;try{body=await request.json()}catch{return err('JSON invalide',400)}
 if(!body||!celebrationIdOk(body.celebration)||!Number.isSafeInteger(body.expectedRevision))return err('Commande invalide',400);
 if(!['page','celebration','media'].includes(body.kind))return err('Type invalide',400);
 if(body.kind==='page'&&(!pageIdOk(body.pageId)||!validVisibility(body.visibility)))return err('Page ou visibilité invalide',400);
 if(body.kind==='celebration'&&!validVisibility(body.visibility))return err('Statut invalide',400);
 if(body.kind==='media'&&(typeof body.mediaId!=='string'||body.mediaId.length>720||typeof body.general!=='boolean'))return err('Média invalide',400);
 const current=await readEditorState(env.EDITOR_BUCKET);
 if(current.state.version!==body.expectedRevision)return err('Une nouvelle version du serveur existe. Rechargez.',409);
 const state=copy(current.state),pub=state.published||initialPublication(state);
 if(body.kind==='page'){
  const isShared=body.pageId.startsWith('neutral-');
  const source=isShared?state.shared.pages:state.drafts[body.celebration]?.pages;
  const page=source?.find(p=>p.id===body.pageId);
  if(!page)return err('Page introuvable',404);
  page.visibility=body.visibility;
  const dest=isShared?pub.shared.pages:(pub.drafts[body.celebration]||={pages:[],celebrationDates:{},celebrationTimes:{}}).pages;
  const ix=dest.findIndex(p=>p.id===body.pageId);
  if(body.visibility==='published'){
   const publishedPage=copy(page);publishedPage.visibility='published';
   if(ix<0)dest.push(publishedPage);else dest[ix]=publishedPage;
   if(!isShared){
    const draft=state.drafts[body.celebration];
    pub.drafts[body.celebration].celebrationDates=copy(draft.celebrationDates||{});
    pub.drafts[body.celebration].celebrationTimes=copy(draft.celebrationTimes||{});
   }
  }else if(ix>=0)dest.splice(ix,1);
 }else if(body.kind==='celebration'){
  state.shared.celebrationVisibility||={};
  state.shared.celebrationVisibility[body.celebration]=body.visibility;
  pub.celebrationVisibility||={};
  pub.celebrationVisibility[body.celebration]=body.visibility;
  if(body.visibility==='published'){
   const saved=state.drafts[body.celebration];
   if(saved&&!pub.drafts[body.celebration])
    pub.drafts[body.celebration]={...copy(saved),pages:[]};
   const plan=state.plans.find(x=>x.id===body.celebration);
   if(plan&&!pub.plans.some(x=>x.id===plan.id))pub.plans.push(copy(plan));
  }
 }else{
  const catalogue=discoverMedia(state),entry=catalogue.find(x=>x.id===body.mediaId);
  if(!entry)return err('Média introuvable',404);
  entry.general=body.general;
  state.mediaCatalogue=catalogue;
 }
 state.published=pub;state.publishedAt=new Date().toISOString();
 if(!await writeEditorState(env.EDITOR_BUCKET,current,state))return err('Une sauvegarde simultanée a eu lieu',409);
 return json({ok:true,revision:state.version,visibility:body.visibility||null,general:body.general??null,updatedAt:state.updatedAt});
}

const mediaMime=new Map([['image/jpeg','.jpg'],['image/png','.png'],['image/webp','.webp'],
 ['application/pdf','.pdf'],['audio/mpeg','.mp3'],['audio/wav','.wav']]);
const mediaType=mime=>mime.startsWith('image/')?'image':mime==='application/pdf'?'pdf':'audio';
const allowedUrl=s=>typeof s==='string'&&s.length<=650&&validWeb(s)===s;
function mimeOfFile(file){
 const type=String(file.type||'').toLowerCase();
 return mediaMime.has(type)?type:null;
}
export async function handleEditorMedia(request,env){
 if(!hostCheck(request))return err('Introuvable',404);
 const url=new URL(request.url);
 if(!env.EDITOR_BUCKET)return err('Stockage non disponible',503);
 if(request.method==='GET'){
  if(!await hasEditorAccess(request,env))return err('Code administrateur nécessaire',401);
  const {state}=await readEditorState(env.EDITOR_BUCKET);
  return json({ok:true,items:discoverMedia(state)});
 }
 if(request.method!=='POST')return err('Méthode interdite',405);
 const denied=await protectedWrite(request,env);if(denied)return denied;
 const action=url.searchParams.get('action');
 if(action==='external'){
  let input;try{input=await request.json()}catch{return err('JSON invalide',400)}
  if(!input||!allowedUrl(input.src)||!['image','video','pdf','audio'].includes(input.type))return err('Lien invalide',400);
  const current=await readEditorState(env.EDITOR_BUCKET);
  const state=copy(current.state);
  const items=discoverMedia(state),id=input.type+'|'+input.src;
  if(!items.some(x=>x.id===id))items.push({id,type:input.type,src:input.src,
   name:String(input.name||input.src).slice(0,120),source:'link',general:false});
  state.mediaCatalogue=items;
  if(!await writeEditorState(env.EDITOR_BUCKET,current,state))return err('Une sauvegarde simultanée existe',409);
  return json({ok:true,revision:state.version,item:items.find(x=>x.id===id)});
 }
 if(action==='upload'){
  const size=Number(request.headers.get('content-length')||0);
  if(size>26_000_000)return err('Fichier trop volumineux',413);
  let data;try{data=await request.formData()}catch{return err('Fichier illisible',400)}
  const file=data.get('file');
  if(!(file instanceof File))return err('Fichier manquant',400);
  const mime=mimeOfFile(file);
  const max=mime==='application/pdf'?25_000_000:mime?.startsWith('image/')?8_000_000:25_000_000;
  if(!mime||file.size<1||file.size>max)return err('Format ou taille non pris en charge',415);
  const id=crypto.randomUUID()+mediaMime.get(mime);
  const path='/media/new/'+id,record={id:mediaType(mime)+'|'+path,type:mediaType(mime),
   src:path,name:String(file.name||id).slice(0,120),source:'uploaded',general:false};
  const current=await readEditorState(env.EDITOR_BUCKET),state=copy(current.state);
  await env.EDITOR_BUCKET.put(PREFIX+id,await file.arrayBuffer(),{httpMetadata:{contentType:mime}});
  try{
   state.mediaCatalogue=discoverMedia(state).concat(record);
   if(!await writeEditorState(env.EDITOR_BUCKET,current,state)){
    await env.EDITOR_BUCKET.delete(PREFIX+id);
    return err('Une sauvegarde simultanée a eu lieu. Réessayez.',409);
   }
  }catch(e){await env.EDITOR_BUCKET.delete(PREFIX+id);throw e}
  return json({ok:true,item:record,revision:state.version});
 }
 if(action==='insert'){
  let input;try{input=await request.json()}catch{return err('JSON invalide',400)}
  if(!celebrationIdOk(input?.celebration)||typeof input.pageId!=='string'||
    !input.pageId.endsWith('-'+input.celebration)||!pageIdOk(input.pageId)||
    !['image','video','pdf','audio','link'].includes(input.mediaType)||
    !allowedUrl(input.src)||typeof input.name!=='string'||input.name.length>120||
    (input.atTime&&!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(input.atTime)))
   return err('Insertion invalide',400);
  const current=await readEditorState(env.EDITOR_BUCKET),state=copy(current.state);
  if(!Number.isSafeInteger(input.expectedRevision)||current.state.version!==input.expectedRevision)
   return err('Version obsolète, rechargez l’administration',409);
  state.published||=initialPublication(state);
  let record=state.drafts[input.celebration];
  if(!record){
   const candidate=input.baseRecord;
   if(!candidate||!Array.isArray(candidate.pages)||candidate.pages.length>50||
      !candidate.pages.every(p=>p&&p.group==='celebration'&&
       typeof p.id==='string'&&p.id.endsWith('-'+input.celebration)&&
       Array.isArray(p.blocks)&&p.blocks.length<300))return err('Pages non enregistrées',400);
   record={pages:copy(candidate.pages),celebrationDates:{},celebrationTimes:{}};
  }
  const page=record.pages.find(p=>p.id===input.pageId&&p.group==='celebration');
  if(!page||page.blocks.length>=290)return err('Page introuvable ou pleine',404);
  const mediaKind=input.mediaType==='image'?'image':input.mediaType==='audio'?'audio':
    input.mediaType==='video'?'video':'button';
  const b={id:'block-'+crypto.randomUUID(),kind:mediaKind,align:'left',
   text:mediaKind==='button'?'Ouvrir : '+input.name:input.name};
  if(mediaKind==='image'||mediaKind==='audio')b.src=input.src;
  else b.href=input.src;
  if(input.atTime)b.atTime=input.atTime;
  page.blocks.push(b);
  state.drafts[input.celebration]=record;
  state.mediaCatalogue=discoverMedia(state);
  if(!await writeEditorState(env.EDITOR_BUCKET,current,state))return err('Insertion simultanée',409);
  return json({ok:true,revision:state.version,block:b});
 }
 if(action==='delete'){
  let body;try{body=await request.json()}catch{return err('JSON invalide',400)}
  if(typeof body?.id!=='string')return err('Média invalide',400);
  const current=await readEditorState(env.EDITOR_BUCKET),state=copy(current.state);
  const entry=discoverMedia(state).find(x=>x.id===body.id);
  if(!entry)return err('Média introuvable',404);
  // Only delete uploads owned by this application and not referenced in ANY
  // draft, published snapshot, or public gallery. Legacy mail URLs are untouchable.
  const newUpload=entry.source==='uploaded'&&/^\/media\/new\/[0-9a-f-]{36}\.(?:jpg|png|webp|pdf|mp3|wav)$/.test(entry.src);
  if(entry.source==='uploaded'&&!newUpload)return err('Ce fichier historique est protégé',403);
  if(entry.source!=='uploaded'&&entry.source!=='link')return err('Lien historique protégé',403);
  const originals=JSON.stringify([state.drafts,state.shared?.pages,state.published]);
  if(originals.includes(entry.src)||entry.general)return err('Fichier encore utilisé ou visible : retirez ses références avant la suppression.',409);
  state.mediaCatalogue=discoverMedia(state).filter(r=>r.id!==entry.id);
  if(!await writeEditorState(env.EDITOR_BUCKET,current,state))return err('Modifications simultanées',409);
  if(newUpload)await env.EDITOR_BUCKET.delete(PREFIX+entry.src.split('/').pop());
  return json({ok:true,revision:state.version});
 }
 return err('Action inconnue',404);
}
export async function handleEditorMediaFile(request,env){
 if(!hostCheck(request)||!['GET','HEAD'].includes(request.method))return err('Introuvable',404);
 const url=new URL(request.url);
 const filename=url.pathname.slice('/media/new/'.length);
 if(!/^[0-9a-f-]{36}\.(?:jpg|png|webp|pdf|mp3|wav)$/.test(filename))return err('Fichier inconnu',404);
 const bucket=env.EDITOR_BUCKET;if(!bucket)return err('Stockage indisponible',503);
 const o=await bucket.get(PREFIX+filename);
 if(!o)return err('Fichier introuvable',404);
 const headers={'content-type':o.httpMetadata?.contentType||'application/octet-stream',
  'cache-control':'public, max-age=3600','x-content-type-options':'nosniff'};
 return new Response(request.method==='HEAD'?null:o.body,{headers});
}
