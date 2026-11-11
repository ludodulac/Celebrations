// M011-B — opt-in private reads. All HTTP authorization runs through M008-C
// (and M010-A explicit identity + live D1 grants). Used by isolated Worker routes.
import {handlePrivatePage,handlePrivateMedia,allowedPrivatePageIds,privateNotFound}
  from '../security/member-private-access.mjs';
import {createCanonicalPrivateLoaders}
  from '../persistence/private-canonical-content.mjs';
import {createLanguageRegistry,setPageTranslation,resolvePageTranslation}
  from '../domain/editor-localization.mjs';
import {allowedPublicLink} from '../domain/editor-public-projection-security.mjs';
import {isPrivateMediaReference}
  from '../security/public-media-boundary.mjs';

const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const validId=x=>typeof x==='string'&&x.length>0&&x.length<=254&&x.trim()===x;
const language=x=>typeof x==='string'&&/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(x);
const VARY='Authorization, Cookie';
const headers={'cache-control':'private, no-store, max-age=0','pragma':'no-cache',
  'vary':VARY,'x-content-type-options':'nosniff','x-robots-tag':'noindex, nofollow, noarchive',
  'referrer-policy':'no-referrer'};
function noService(method){
  return new Response(method==='HEAD'?null:'Service indisponible',
    {status:503,headers});
}
function secureJson(payload,method) {
  return new Response(method==='HEAD'?null:JSON.stringify(payload),{
    status:200,headers:{...headers,'content-type':'application/json; charset=utf-8'}
  });
}
const privateBucketSafe=env=>!!env?.PRIVATE_MEMBER_BUCKET&&
  typeof env.PRIVATE_MEMBER_BUCKET.get==='function'&&
  env.PRIVATE_MEMBER_BUCKET!==env.MEDIA_BUCKET&&
  env.PRIVATE_MEMBER_BUCKET!==env.EDITOR_BUCKET;

// Explicit safe renderer: no editor snapshots, ACLs, person IDs, private R2
// storage keys, internal link indexes, unpublished translations or draft fields.
// Media references are canonical opaque IDs; bytes use handlePrivateMedia.
const fields=['id','kind','text','rich','bold','italic','color','size','align',
  'widthPct','layout','presentation','thickness','displayAsButton','atTime'];
async function safeBlock(block,pageId,loaders,blockedIds,depth=0) {
  if(!obj(block)||depth>12||typeof block.kind!=='string'||block.kind.length>40||
      block.hideOnSite===true)return null;
  const copy={};
  for(const key of fields)
    if(['string','number','boolean'].includes(typeof block[key])&&
        (typeof block[key]!=='string'||block[key].length<=50000))
      copy[key]=block[key];
  if(block.kind==='section'){
    if(!Array.isArray(block.columns)||block.columns.length>6)return null;
    copy.columns=[];
    for(const column of block.columns){
      if(!Array.isArray(column)||column.length>300)return null;
      const children=await Promise.all(column.map(x=>safeBlock(x,pageId,loaders,blockedIds,depth+1)));
      copy.columns.push(children.filter(Boolean));
    }
  }else{
    if(validId(block.mediaId)){
      const media=await loaders.loadPrivateMedia(block.mediaId);
      if(!media||media.pageId!==pageId)return null;
      copy.mediaId=block.mediaId;
    }
    for(const key of ['href','src','cover']){
      if(typeof block[key]!=='string')continue;
      if(isPrivateMediaReference(block[key])||!allowedPublicLink(block[key],blockedIds))
        return null; // never publish a raw private key or public gateway bypass
      copy[key]=block[key];
    }
    // An object pretending to be private media without a canonical ID is
    // unusable; storageKey, remoteKey and assetId are NEVER copied.
    if(block.private===true&&!copy.mediaId)return null;
  }
  return copy;
}
async function pageView(page,loaders,languageId) {
  const published=await loaders.publishedLanguageData();
  if(!published)return null;
  let registry;
  try{registry=createLanguageRegistry(published.languageRegistry)}
  catch{registry=createLanguageRegistry();}
  let working={...page};
  delete working.translations; // no draft/editor translations
  const release=published.privateTranslationReleases?.[page.id];
  if(obj(release)&&release.publication==='published'&&release.pageId===page.id&&
      obj(release.variants)){
    for(const [id,variant] of Object.entries(release.variants)){
      if(!registry.languages.some(l=>l.id===id&&l.active))continue;
      // Only title/content changes. M003 forbids changes to accessPolicy,
      // canonical page ID, space, celebration, visibility and publication.
      try{working=setPageTranslation(working,registry,id,variant)}
      catch{/* invalid variant is never rendered */}
    }
  }
  let selected;
  try{selected=resolvePageTranslation(working,registry,language(languageId)?languageId:'fr');}
  catch{return null;}
  if(!selected)return null;
  const source=selected.content;
  if(!Array.isArray(source.blocks)||source.blocks.length>1000)return null;
  // Until managed page-to-page links have an authorization-aware resolver,
  // do not disclose ANY managed page or space ID through editorial URLs.
  const blockedIds=await loaders.blockedLinkIds();
  const blocks=await Promise.all(source.blocks.map(b=>safeBlock(b,page.id,loaders,blockedIds)));
  return {id:page.id,celebrationId:page.celebrationId,
    ...(page.spaceId?{spaceId:page.spaceId}:{}),
    name:typeof source.name==='string'?source.name.slice(0,200):
      typeof page.name==='string'?page.name.slice(0,200):'',
    languageId:selected.languageId,usedFallback:selected.usedFallback,
    blocks:blocks.filter(Boolean)};
}

// HTTP-facing Worker contracts: route owner must pass ONLY path IDs and
// desired language; all content, identities, policies and grants are loaded
// afresh from the trusted bindings. No browser-provided ACLs are accepted.
export function canonicalPrivatePageOptions(env,pageId,{languageId}={}) {
  const loaders=createCanonicalPrivateLoaders(env);
  return {...loaders,pageId,
    render:async({page})=>{
      const view=await pageView(page,loaders,languageId);
      return view?Response.json(view):privateNotFound();
    }};
}
export async function handleCanonicalPrivatePage(request,env,{pageId,languageId}={}) {
  return handlePrivatePage(request,env,canonicalPrivatePageOptions(env,pageId,{languageId}));
}
export async function handleCanonicalPrivateMedia(request,env,{pageId,mediaId}={}) {
  if(request.method!=='GET'&&request.method!=='HEAD')return privateNotFound();
  if(!privateBucketSafe(env))return noService(request.method);
  return handlePrivateMedia(request,env,{
    ...createCanonicalPrivateLoaders(env),pageId,mediaId
  });
}

// Authorization precedes name/snippet filtering AND localization. Never return
// total candidate counts, denied IDs, or timing/existence metadata to callers.
// This pure result can be reused by search, menus, navigation and lists.
export async function listAuthorizedPrivatePages(request,env,{
  celebrationId,languageId,search='',limit=50
}={}) {
  if(!validId(celebrationId)||typeof search!=='string'||search.length>150||
      !Number.isSafeInteger(limit)||limit<1||limit>100)
    throw TypeError('Invalid private list parameters');
  const loaders=createCanonicalPrivateLoaders(env);
  const candidates=await loaders.candidatePageIds(celebrationId);
  if(candidates.length>1000)throw Error('Private list too large');
  const authorized=await allowedPrivatePageIds(request,env,candidates,loaders);
  const results=[],query=search.trim().toLocaleLowerCase();
  for(const id of authorized){
    const page=await loaders.loadPublishedPage(id);
    if(!page)continue;
    const view=await pageView(page,loaders,languageId); // only after the gate
    if(!view)continue;
    const searchable=[view.name,...view.blocks.map(x=>x.text||'')].join(' ').toLocaleLowerCase();
    if(query&&!searchable.includes(query))continue;
    // Only obtain the space label after this particular page passed the gate.
    // No list of candidate spaces or labels from inaccessible/empty spaces.
    const space=view.spaceId?await loaders.loadPublishedSpace(view.spaceId):null;
    const spaceName=space&&typeof space.name==='string'?space.name.slice(0,120):null;
    results.push({id:view.id,name:view.name,celebrationId:view.celebrationId,
      ...(view.spaceId?{spaceId:view.spaceId,...(spaceName?{spaceName}:{})}:{}),languageId:view.languageId});
    if(results.length>=limit)break;
  }
  return results;
}
export async function handleCanonicalPrivateList(request,env,options={}) {
  if(request.method!=='GET'&&request.method!=='HEAD')return privateNotFound();
  try{return secureJson({pages:await listAuthorizedPrivatePages(request,env,options)},request.method)}
  catch{return noService(request.method)}
}
