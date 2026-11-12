// M021-A: preserve the existing editor snapshot, media library and PIN.
import {hasEditorAccess} from './editor-site-access.mjs';
import {isWritableEditorHost,sameOriginEditorWrite} from './app/security/editor-route-policy.mjs';
import {readEditorState,writeEditorState,discoverMedia} from './editor-publication-api.mjs';
import {isPrivateMediaRecord,isPrivateMediaReference} from './app/security/public-media-boundary.mjs';
import {navigationPreference,validNavigationPreference} from './app/domain/editor-site-preferences.mjs';
const langs=['fr','en','es','de','pt','it','ar','zh'];
const trim=(s,max)=>typeof s==='string'?s.trim().slice(0,max):'';
const empty=()=>({title:'',imageSrc:'',imageAlt:'',positionX:50,positionY:50,titles:{}});
export function normalizedSiteIdentity(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return empty();
 const titles={};
 for(const lang of langs){const title=trim(raw.titles?.[lang],110);if(title)titles[lang]=title}
 const pos=n=>Number.isInteger(n)&&n>=0&&n<=100?n:50;
 return {title:trim(raw.title,110),imageSrc:trim(raw.imageSrc,650),
  imageAlt:trim(raw.imageAlt,180),positionX:pos(raw.positionX),
  positionY:pos(raw.positionY),titles};
}
function allowedSrc(state,src){
 if(!src)return true;
 if(!src.startsWith('/media/')||src.includes('..')||src.includes('?')||
     src.includes('#')||src.includes('\\')||isPrivateMediaReference(src))return false;
 return discoverMedia(state).some(item=>item.src===src&&item.type==='image'&&!isPrivateMediaRecord(item));
}
const reply=(body,status=200)=>Response.json(body,{status,headers:{
 'cache-control':'private, no-store','x-content-type-options':'nosniff',
 'x-robots-tag':'noindex,nofollow,noarchive','vary':'Cookie'}});
export async function handleSiteIdentity(request,env){
 const url=new URL(request.url);
 if(!isWritableEditorHost(url.hostname,env)||!env?.EDITOR_BUCKET)
  return reply({ok:false,error:'Introuvable'},404);
 if(!['GET','POST'].includes(request.method))return reply({ok:false,error:'Méthode refusée'},405);
 if(!await hasEditorAccess(request,env))return reply({ok:false,error:'Administrateur requis'},401);
 if(request.method==='POST'&&!sameOriginEditorWrite(request))return reply({ok:false,error:'Origine refusée'},403);
 try{
  const current=await readEditorState(env.EDITOR_BUCKET);
  if(request.method==='GET')return reply({ok:true,revision:current.state.version,
   identity:normalizedSiteIdentity(current.state.siteIdentity),
   navigation:navigationPreference(current.state.navigation),
   memberAccessUiEnabled:current.state.adminMode?.memberAccessUiEnabled===true});
  const text=await request.text();
  if(text.length>2600)return reply({ok:false,error:'Requête trop longue'},413);
  const body=JSON.parse(text),raw=body?.identity;
  if(!Number.isSafeInteger(body?.expectedRevision))return reply({ok:false,error:'Requête invalide'},400);
  if(current.state.version!==body.expectedRevision)return reply({ok:false,error:'Modifications récentes : rechargez les paramètres.'},409);
  // M027: a visible desktop navigation label only; never change access rights.
  if(Object.prototype.hasOwnProperty.call(body,'navigation')){
   if(raw!==undefined||body.memberAccessUiEnabled!==undefined||
      !validNavigationPreference(body.navigation))
    return reply({ok:false,error:'Titre ou position invalide'},400);
   const state=structuredClone(current.state);
   state.navigation=navigationPreference(body.navigation);
   if(!await writeEditorState(env.EDITOR_BUCKET,current,state))
    return reply({ok:false,error:'Un autre enregistrement a eu lieu'},409);
   return reply({ok:true,revision:state.version,navigation:state.navigation});
  }
  // M021-B: UI preference only. Never touch published content, private ACLs,
  // enrollments or sessions. Off is the default for sites not yet configured.
  if(Object.prototype.hasOwnProperty.call(body,'memberAccessUiEnabled')){
   if(typeof body.memberAccessUiEnabled!=='boolean'||raw!==undefined)
    return reply({ok:false,error:'Mode invalide'},400);
   const state=structuredClone(current.state);
   state.adminMode={...(state.adminMode||{}),memberAccessUiEnabled:body.memberAccessUiEnabled};
   if(!await writeEditorState(env.EDITOR_BUCKET,current,state))
    return reply({ok:false,error:'Une autre sauvegarde a eu lieu'},409);
   return reply({ok:true,revision:state.version,memberAccessUiEnabled:state.adminMode.memberAccessUiEnabled});
  }
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return reply({ok:false,error:'Requête invalide'},400);
  const identity=normalizedSiteIdentity(raw);
  if(raw.title!==identity.title||raw.imageSrc!==identity.imageSrc||
     raw.imageAlt!==identity.imageAlt||(raw.positionX??50)!==identity.positionX||
     (raw.positionY??50)!==identity.positionY||!allowedSrc(current.state,identity.imageSrc))
   return reply({ok:false,error:'Titre, image ou cadrage invalide'},400);
  if(raw.titles&&(!Array.isArray(raw.titles)&&typeof raw.titles!=='object'))
   return reply({ok:false,error:'Titres invalides'},400);
  for(const [lang,title] of Object.entries(raw.titles||{})){
   if(!langs.includes(lang)||typeof title!=='string'||title!==trim(title,110))
    return reply({ok:false,error:'Titre linguistique invalide'},400);
  }
  const state=structuredClone(current.state);
  state.siteIdentity=identity;
  if(!await writeEditorState(env.EDITOR_BUCKET,current,state))
   return reply({ok:false,error:'Une autre sauvegarde a eu lieu'},409);
  return reply({ok:true,revision:state.version,identity});
 }catch{return reply({ok:false,error:'Paramètres momentanément indisponibles'},503)}
}
