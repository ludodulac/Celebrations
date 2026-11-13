import {validHomeEntryButton,normalizeHomeEntryButton} from './app/domain/editor-home-entry-button.mjs';
// Separate published website from the admin draft. Do not modify original
// MEDIA_BUCKET or historic URLs. Both snapshots live in the existing editor R2.
import {legacyEditorView,legacyRecord,managedPage,managedPageId,managedCelebration} from './app/security/private-editor-boundary.mjs';
import {editorUploadFormat,editorUploadFilename,editorUploadPath,editorUploadResponseFormat} from './app/domain/editor-upload-formats.mjs';
import {hasEditorAccess} from './editor-site-access.mjs';
import {EDITOR_SNAPSHOT_LIMIT,expectedRevisionMatches} from './app/ports/editor-snapshot-contract.mjs';
import {readEditorSnapshot,putEditorSnapshot} from './app/adapters/editor-r2-repository.mjs';
import {isOfficialEditorHost,isReadonlyCandidateHost,isWritableEditorHost,sameOriginEditorWrite} from './app/security/editor-route-policy.mjs';
import {mergePublicMediaIndexed} from './app/domain/editor-public-media-merge.mjs';
import {projectPublishedLanguage,publishLanguageCommand} from './app/application/public-language-release.mjs';
import {
 eligiblePublicPage,projectPublicPage,projectPublicPages,projectPublicPlan,
 projectPublicMediaItem,privatePublicationIds
} from './app/domain/editor-public-projection-security.mjs';
import {indexCanonicalPublishedContent} from './app/persistence/private-canonical-content.mjs';
import {privateReleaseReady} from './app/persistence/private-release-fence.mjs';
import {canAccessPage,SPACE_VISIBILITIES,ACCESS_MODES} from './app/domain/member-access.mjs';
import {readLegacyMediaReferences,canSafelyDeleteMedia} from './app/domain/editor-media-usage-safety.mjs';
import {handleEditorMultipartUpload} from './app/application/editor-multipart-upload.mjs';
import {canShareStandaloneMedia} from './app/domain/editor-standalone-public-link.mjs';

const PREFIX='editor-trials/uploads/';
const SITE=new Set(['www.ronde-des-archanges-universelle.eu','ronde-des-archanges-universelle.eu']);
const PREVIEW='celebrations-visual-candidate.rondes.workers.dev';
const STAGING='celebrations-exit-staging.rondes.workers.dev';
const err=(message,status=400)=>Response.json({ok:false,error:message},{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const json=value=>Response.json(value,{headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const copy=x=>JSON.parse(JSON.stringify(x));
const m030PublicVersion=(state,celebration,languageId)=>
 (state.celebrationMetadata?.[String(celebration)]?.versions||[]).find(version=>
  version.key==='PUBLIC|'+languageId&&version.audience?.scope==='PUBLIC');

const validState=x=>x&&typeof x==='object'&&Number.isSafeInteger(x.version)&&x.drafts&&x.shared&&Array.isArray(x.plans);
const defaultState=()=>({version:0,drafts:{},plans:[],shared:{pages:[],homeId:''},mediaCatalogue:[]});
export async function readEditorState(bucket){
 return readEditorSnapshot(bucket,{empty:defaultState,validate:validState});
}
export async function writeEditorState(bucket,previous,state){
 state.version=previous.state.version+1;
 state.updatedAt=new Date().toISOString();
 const str=JSON.stringify(state);
 if(str.length>EDITOR_SNAPSHOT_LIMIT)throw Error('Editor snapshot size limit');
 return putEditorSnapshot(bucket,previous.etag,str);
}
const validWeb=url=>{
 const s=String(url||'').trim();
 if(s.length>650)return '';
 if(/^https:\/\//i.test(s)){try{const u=new URL(s);return u.username||u.password?'':u.href}catch{return ''}}
 return /^\/(?:media|letter|api\/editor-media\/file)\/[^?#\s.][^?#\s]*$/i.test(s)&&!s.includes('..')?s:'';
};
// A video link is media only when it targets a real video host or a real
// video file. Never promote arbitrary buttons or website navigation into media.
export function videoMediaUrl(value){
 const src=validWeb(value);
 if(!src)return '';
 if(/^\/(?:media|api\/editor-media\/file)\/[^?#]+\.(?:mp4|webm|mov|m4v|ogv)(?:[?#]|$)/i.test(src))return src;
 try{
  const u=new URL(src);
  if(u.protocol!=='https:')return '';
  const host=u.hostname.toLowerCase(),pathname=u.pathname.toLowerCase();
  if(/\.(?:mp4|webm|mov|m4v|ogv)$/.test(pathname))return src;
  if(['youtu.be','www.youtu.be'].includes(host))return /^\/[\w-]{11}(?:\/|$)/.test(u.pathname)?src:'';
  if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)){
   const id=u.searchParams.get('v')||(u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})(?:\/|$)/)||[])[1];
   return /^[\w-]{11}$/.test(id||'')?src:'';
  }
  if(['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(host))
   return /^\/(?:video\/)?\d{4,}(?:\/|$)/.test(u.pathname)?src:'';
  if(['dailymotion.com','www.dailymotion.com','dai.ly','www.dai.ly'].includes(host))
   return /^\/(?:video\/)?[a-zA-Z0-9]{5,}(?:\/|$)/.test(u.pathname)?src:'';
 }catch{}
 return '';
}
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
  if(videoMediaUrl(src))return 'video';
  if(/\.(?:txt|csv|docx?|odt|rtf|zip|epub)(?:[?#]|$)/i.test(src))return 'file';
 }
 return null;
}
const sourceOf=b=>b.kind==='video'||b.kind==='button'?b.href:b.src;
function mediaUsage(page,celebrationId,sectionVisibility='draft',published=false){
 const shared=page.group==='page';
 const suffix='-'+celebrationId;
 // A page in a saved draft is not necessarily visible to visitors.
 // Hidden wins within the same page; only an actual published snapshot
 // can prove visitor visibility.
 const status=page.visibility==='hidden'||sectionVisibility==='hidden'?'hidden':
  published&&page.visibility!=='draft'&&sectionVisibility!=='draft'?'published':'draft';
 return {pageId:page.id,pageName:String(page.name||'Page').slice(0,180),
  celebrationId:shared?'':celebrationId,usageStatus:status,
  slug:shared?page.id:(String(page.id).endsWith(suffix)?page.id.slice(0,-suffix.length):page.id),
  group:shared?'page':'celebration'};
}
function scanBlocks(blocks,into,page,celebrationId,sectionVisibility='draft',published=false){
 for(const block of blocks||[]){
  if(block.kind==='section'){
   for(const column of block.columns||[])scanBlocks(column,into,page,celebrationId,sectionVisibility,published);
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
   const use=mediaUsage(page,celebrationId,sectionVisibility,published);
   const existing=record.uses.find(x=>x.pageId===use.pageId&&x.celebrationId===use.celebrationId);
   if(!existing)record.uses.push(use);
   else if(({published:3,hidden:2,draft:1})[use.usageStatus]>
           ({published:3,hidden:2,draft:1})[existing.usageStatus||'draft'])
    Object.assign(existing,use);
  }
 }
}
export function discoverMedia(state){
 const index=new Map();
 for(const r of state.mediaCatalogue||[]){
  if(r&&['image','video','pdf','audio','file'].includes(r.type)&&validWeb(r.src)){
   const src=validWeb(r.src);
   index.set(r.type+'|'+src,{...r,id:r.type+'|'+src,uses:[]});
  }
 }
 for(const p of state.shared?.pages||[])
  if(!managedPage(p))scanBlocks(p.blocks,index,p,'','published',false);
 for(const [id,draft] of Object.entries(state.drafts||{})){
  const visibility=state.shared?.celebrationVisibility?.[id]||
   state.plans?.find(plan=>String(plan.id)===id)?.visibility||'draft';
  for(const p of draft?.pages||[])
   if(!managedPage(p))scanBlocks(p.blocks,index,p,id,visibility,false);
 }
 // Include previously released content: drafts alone never prove what a
 // visitor sees, and removing a draft reference doesn't remove a release.
 for(const p of state.published?.shared?.pages||[])
  if(!managedPage(p))scanBlocks(p.blocks,index,p,'','published',true);
 for(const [id,draft] of Object.entries(state.published?.drafts||{})){
  const visibility=state.published?.celebrationVisibility?.[id]||
   state.published?.plans?.find(plan=>String(plan.id)===id)?.visibility||'draft';
  for(const p of draft?.pages||[])
   if(!managedPage(p))scanBlocks(p.blocks,index,p,id,visibility,true);
 }
 return [...index.values()].slice(0,1800);
}
export function initialPublication(state){
 return {drafts:copy(Object.fromEntries(Object.entries(state.drafts||{}).map(([id,r])=>[id,legacyRecord(r)]))),
  shared:copy(legacyRecord(state.shared||{pages:[],homeId:''})),
  plans:copy(state.plans||[]),celebrationVisibility:copy(state.shared?.celebrationVisibility||{})};
}
const validVisibility=x=>['draft','published','hidden'].includes(x);
export function publiclyVisible(p){return p&&p.visibility!=='hidden'&&p.visibility!=='draft'}
export function publicSnapshot(state,celebration){
 const published=state.published||initialPublication(state);
 const privateIds=privatePublicationIds(state,published);
 const visibility=published.celebrationVisibility||{};
 const mayDisplayCelebration=id=>published.celebrationAccessPolicies?.[String(id)]?.mode===undefined||
  published.celebrationAccessPolicies[String(id)].mode==='PUBLIC';
 const original=published.drafts?.[celebration]||null;
 const plan=published.plans?.find(p=>p.id===celebration);
 const celebrationVisible=mayDisplayCelebration(celebration)&&celebrationVisibleFor(celebration,visibility,plan?.visibility)&&
  (!plan||!!projectPublicPlan(plan));
 const record=celebrationVisible&&original?{
  pages:projectPublicPages(original.pages,privateIds)
 }:null;
 const pages=projectPublicPages(published.shared?.pages,privateIds);
 const homeId=pages.some(p=>p.id===published.shared?.homeId)
  ?published.shared.homeId:(pages[0]?.id||'neutral-accueil-general');
 const shared={homeId,pages};
 const plans=(published.plans||[])
  .filter(p=>mayDisplayCelebration(p.id)&&celebrationVisibleFor(p.id,visibility,p.visibility))
  .map(projectPublicPlan).filter(Boolean);
 // Only explicitly visible private PLANS publish a minimal title. Never
 // include their pages, access policy, drafts, translations or media.
 const titleOnlyCelebrations=(published.plans||[])
  .filter(p=>['ALL_PRIVATE_TYPES','SELECTED_TYPES'].includes(
    published.celebrationAccessPolicies?.[String(p?.id)]?.mode)&&
    celebrationVisibleFor(p.id,visibility,p.visibility))
  .map(projectPublicPlan).filter(Boolean)
  .map(p=>({id:p.id,title:typeof p.title==='string'?p.title.slice(0,160):'',
    archangel:typeof p.archangel==='string'?p.archangel.slice(0,80):'',
    year:typeof p.year==='string'?p.year.slice(0,30):'',titleOnly:true}));
 // The visibility of a HIDDEN celebration is itself private metadata.
 const publicVisibility=Object.fromEntries(plans.map(p=>[p.id,'published']));
 if(celebrationVisible)publicVisibility[celebration]='published';
 return {ok:true,revision:state.publishedRevision??0,record,shared,plans,
  celebrationVisible,celebrationVisibility:publicVisibility,
  titleOnlyCelebrations,media:publishedMedia(state,privateIds),
  updatedAt:state.publishedAt||null};
}
// M014 — same canonical release index, fence and access rules as member reads.
// The visitor integration deliberately exposes only plain text blocks until
// space media and translations have their verified publication path.
const publicManagedId=(id,kind)=>typeof id==='string'&&new RegExp('^'+kind+':[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$').test(id);
function textOnlySpaceBlocks(blocks){
 return blocks.flatMap(block=>{
  if(block.kind==='section')return [{...block,columns:block.columns.map(textOnlySpaceBlocks)}];
  if(!['heading','text','divider','event'].includes(block.kind)||block.rich)return [];
  const {href,src,cover,...text}=block;return [text];
 });
}
export async function releasedPublicSpaces(state,cid,db){
 if(state.published?.celebrationAccessPolicies?.[cid]?.mode&&
    state.published.celebrationAccessPolicies[cid].mode!=='PUBLIC')return [];
 if(!Object.values(state.published?.privateSpaceReleases??{}).some(r=>r?.celebrationId===cid))return [];
 try{
  const data=indexCanonicalPublishedContent(state);
  if(!data)return [];
  const spaces=[...data.spaces.values()].filter(s=>s.celebrationId===cid);
  if(!spaces.length||!await privateReleaseReady(db,data.published,cid,state.publishedRevision,spaces))return [];
  const blocked=privatePublicationIds(state,data.published);
  return spaces.flatMap(space=>{
   if(space.visibility!==SPACE_VISIBILITIES.PUBLIC||space.accessPolicy.mode!==ACCESS_MODES.PUBLIC||
      !publicManagedId(space.id,'space')||typeof space.name!=='string'||!space.name.trim())return [];
   const pages=[...data.pages.values()].filter(page=>page.spaceId===space.id&&
     publicManagedId(page.id,'page')&&page.accessPolicy.mode===ACCESS_MODES.PUBLIC&&canAccessPage(page,{space}))
    .map(page=>{
     const {spaceId,...canonical}=page;
     const clean=projectPublicPage(canonical,blocked);
     return clean?{...clean,blocks:textOnlySpaceBlocks(clean.blocks)}:null;
    }).filter(Boolean);
   return pages.length?[{id:space.id,name:space.name.slice(0,120),visibility:'PUBLIC',
     publicationStatus:'published',pages}]:[];
  });
 }catch{return [];} // missing migration/invalid release cannot break legacy visitors
}
// An administrator may mark a file general=true after using it privately.
// Anonymous media must not inherit a private/draft page's previously listed
// asset, unless the SAME asset also appears on an actually published page.
function restrictedMediaSources(state,published){
 const restricted=new Set();
 for(const aggregate of [state,published]){
  const pages=[...(aggregate?.shared?.pages||[])];
  for(const draft of Object.values(aggregate?.drafts||{})){
   pages.push(...(draft?.pages||[]));
   for(const space of draft?.spaces||[])pages.push(...(space?.pages||[]));
  }
  for(const page of pages){
   if(eligiblePublicPage(page)&&!page.spaceId)continue;
   const scanned=new Map();
   scanBlocks(page?.blocks,scanned,null,'');
   for(const m of scanned.values())restricted.add(m.src);
  }
 }
 return restricted;
}
// The gallery is computed from sanitized public pages, not admin objects or
// the private media catalogue. Even general=true never overrides a private ACL.
export function publishedMedia(state,privateIds){
 const published=state.published||initialPublication(state);
 const blocked=privateIds||privatePublicationIds(state,published);
 const visibility=published.celebrationVisibility||{};
 const sharedPages=projectPublicPages(published.shared?.pages,blocked);
 const drafts={};
 for(const [id,record] of Object.entries(published.drafts||{})){
  const plan=published.plans?.find(x=>String(x.id)===String(id));
  if(published.celebrationAccessPolicies?.[id]?.mode&&
     published.celebrationAccessPolicies[id].mode!=='PUBLIC')continue;
  if(!celebrationVisibleFor(id,visibility,plan?.visibility)||
     plan&&!projectPublicPlan(plan))continue;
  drafts[id]={pages:projectPublicPages(record.pages,blocked)};
 }
 const visibleMedia=discoverMedia({shared:{pages:sharedPages},drafts});
 const publicSources=new Set(visibleMedia.map(m=>m.src));
 const restricted=restrictedMediaSources(state,published);
 const catalogue=(state.mediaCatalogue||[])
  .filter(m=>m?.general===true&&(!restricted.has(m.src)||publicSources.has(m.src)))
  .map(m=>projectPublicMediaItem(m,blocked)).filter(Boolean);
 const source={mediaCatalogue:catalogue,shared:{pages:sharedPages},drafts};
 return discoverMedia(source).map(m=>projectPublicMediaItem(m,blocked))
  .filter(m=>m&&(m.general===true||m.uses.length>0));
}
const historicMediaType=(source,kind='')=>{
 const path=String(source||'').split(/[?#]/)[0].toLowerCase();
 if(/\.(?:png|jpe?g|gif|webp|svg|avif|bmp)$/.test(path))return 'image';
 if(/\.pdf$/.test(path))return 'pdf';
 if(/\.(?:mp3|wav|m4a|ogg|opus|flac|aac|wma)$/.test(path))return 'audio';
 if(/\.(?:mp4|webm|mov|m4v|ogv)$/.test(path))return 'video';
 if(/\.(?:txt|csv|rtf|odt|doc|docx|xls|xlsx|ppt|pptx|epub|zip)$/.test(path))return 'file';
 const c=String(kind).toLowerCase();
 return ['image','audio','video','pdf'].includes(c)?c:'file';
};
const historicAsset=path=>{
 const s=String(path||'');
 if(!s||s.length>600||s.startsWith('/')||s.startsWith('committee/')||
  /^https?:/i.test(s)||/[\\\u0000-\u001f]/.test(s)||
  s.split('/').some(part=>!part||part==='.'||part==='..'))return '';
 const url='/media/'+s.split('/').map(encodeURIComponent).join('/');
 return validWeb(url);
};
// This is deliberately TWO public-only bulk database queries rather than
// fetching all celebration admin records or listing the R2 bucket.
export async function publicHistoricalMedia(db,state){
 if(!db||typeof db.prepare!=='function')return [];
 const sql=[
  "SELECT e.celebration_id AS celebration_id,e.step_key AS step_key,c.id AS id,c.name AS name,c.file_name AS file_name,c.content_type AS content_type,c.source_type AS source_type,c.storage_path AS storage_path,c.external_url AS external_url,c.has_cover AS has_cover,c.cover_storage_path AS cover_storage_path,c.cover_file_name AS cover_file_name FROM celebrations_event_contents ec JOIN celebrations_events e ON e.id=ec.event_id JOIN celebrations_contents c ON c.id=ec.content_id WHERE e.audience='all' AND c.audience='all' AND (c.source_type='file' OR c.has_cover=1 OR LOWER(c.content_type) LIKE '%vid%' OR c.external_url IS NOT NULL AND c.external_url <> '')",
  "SELECT sc.celebration_id AS celebration_id,sc.step_key AS step_key,c.id AS id,c.name AS name,c.file_name AS file_name,c.content_type AS content_type,c.source_type AS source_type,c.storage_path AS storage_path,c.external_url AS external_url,c.has_cover AS has_cover,c.cover_storage_path AS cover_storage_path,c.cover_file_name AS cover_file_name FROM celebrations_step_contents sc JOIN celebrations_contents c ON c.id=sc.content_id WHERE c.audience='all' AND (c.source_type='file' OR c.has_cover=1 OR LOWER(c.content_type) LIKE '%vid%' OR c.external_url IS NOT NULL AND c.external_url <> '')"
 ];
 const [events,steps]=await Promise.all(sql.map(q=>db.prepare(q).all()));
 const published=state.published||initialPublication(state);
 const visibility=published.celebrationVisibility||{};
 const blocked=privatePublicationIds(state,published);
 const pagesByCelebration=new Map();
 for(const [id,record] of Object.entries(published.drafts||{})){
  const plan=published.plans?.find(p=>String(p.id)===String(id));
  if(published.celebrationAccessPolicies?.[id]?.mode&&
     published.celebrationAccessPolicies[id].mode!=='PUBLIC')continue;
  if(!celebrationVisibleFor(id,visibility,plan?.visibility)||
     plan&&!projectPublicPlan(plan))continue;
  pagesByCelebration.set(String(id),new Map(
   projectPublicPages(record.pages,blocked).map(p=>[p.id,p])));
 }
 const media=new Map();
 function add(type,url,name,celebration,page){
  if(!url||!['image','audio','video','pdf','file'].includes(type))return;
  const id=type+'|'+url;
  if(!media.has(id))media.set(id,{id,type,src:url,
   name:String(name||url.split('/').at(-1)||'Fichier').slice(0,120),
   general:false,uses:[],source:'historical'});
  const item=media.get(id);
  if(!item.uses.some(u=>u.pageId===page.id&&u.celebrationId===celebration))
   item.uses.push(mediaUsage(page,celebration));
 }
 for(const row of [...(events.results||[]),...(steps.results||[])]){
  const cid=String(row.celebration_id||''),page=pagesByCelebration.get(cid)?.get(String(row.step_key||''));
  if(!page)continue;
  const file=historicAsset(row.storage_path);
  if(String(row.source_type||'').toLowerCase()==='file'&&file)
   add(historicMediaType(row.storage_path,row.content_type),file,row.name||row.file_name,cid,page);
  const cover=row.has_cover?historicAsset(row.cover_storage_path):'';
  if(cover)add('image',cover,row.cover_file_name||row.name||'Illustration',cid,page);
  // Actual YouTube/Vimeo/Dailymotion (or a video file), regardless of the
  // historical database content_type, which may simply say "lien" or "url".
  const video=videoMediaUrl(row.external_url);
  if(video)add('video',video,row.name||'Vidéo',cid,page);
 }
 return [...media.values()].map(m=>projectPublicMediaItem(m,blocked)).filter(Boolean);
}
export function mergePublicMedia(...catalogues){
 return mergePublicMediaIndexed(...catalogues);
}
function celebrationVisibleFor(id,map,planState){
 const status=map?.[id]??planState??(String(id).startsWith('plan-')?'draft':'published');
 return status==='published';
}
function hostCheck(request,env){
 const u=new URL(request.url);
 return isWritableEditorHost(u.hostname,env)||isReadonlyCandidateHost(u.hostname)||u.hostname===PREVIEW||u.hostname===STAGING;
}
async function protectedWrite(request,env){
 const url=new URL(request.url);
 if(isReadonlyCandidateHost(url.hostname)||url.hostname===STAGING)return err('Prévisualisation en lecture seule',405);
 if(!isWritableEditorHost(url.hostname,env))return err('Domaine non autorisé',404);
 if(!await hasEditorAccess(request,env))return err('Code administrateur nécessaire',401);
 if(!sameOriginEditorWrite(request))return err('Origine interdite',403);
 return null;
}
const pageIdOk=id=>typeof id==='string'&&id.length<=110&&
 /^(?:neutral-(?:accueil-general|[0-9a-f-]{30,45})|(?:accueil-celebration|preparation|mercredi|jeudi|vendredi|samedi|dimanche|apres-celebration|extra-[0-9a-f-]{30,45})-(?:[1-9][0-9]{0,7}|plan-(?:michael|gabriel|raphael|ouriel)-20[0-9]{2}-[0-9]{2}-[0-9]{2}))$/.test(id);
const celebrationIdOk=id=>typeof id==='string'&&/^(?:[1-9][0-9]{0,7}|plan-(?:michael|gabriel|raphael|ouriel)-20[0-9]{2}-[0-9]{2}-[0-9]{2})$/.test(id);
export async function handleEditorPublication(request,env){
 if(!hostCheck(request,env))return err('Introuvable',404);
 const url=new URL(request.url);
 if(!['GET','POST'].includes(request.method))return err('Méthode interdite',405);
 if(!env.EDITOR_BUCKET)return err('Stockage non disponible',503);
 if(request.method==='GET'){
  const id=url.searchParams.get('celebration');
  if(!celebrationIdOk(id))return err('Célébration invalide',400);
  const {state}=await readEditorState(env.EDITOR_BUCKET);
  const snapshot=publicSnapshot(state,id);
  if(snapshot.record){
   const spaces=await releasedPublicSpaces(state,id,env.DB);
   if(spaces.length)snapshot.record.spaces=spaces;
  }
  // Public D1 records have their own historic storage catalogue; include them
  // once per request without exposing unpublished editor drafts or private rows.
  const historic=await publicHistoricalMedia(env.DB,state);
  snapshot.media=mergePublicMedia(snapshot.media,historic);
  // Discover languages across the site through the SAME anonymous projection.
  // Hidden/private celebrations and their releases cannot advertise a language.
  const availablePages=[...(snapshot.shared?.pages||[])];
  for(const cid of Object.keys(state.published?.drafts||{})){
   const visible=publicSnapshot(state,cid);
   if(!visible.celebrationVisible)continue;
   availablePages.push(...(visible.record?.pages||[]));
   const spaces=cid===id?snapshot.record?.spaces||[]:await releasedPublicSpaces(state,cid,env.DB);
   availablePages.push(...spaces.flatMap(s=>s.pages||[]));
  }
  const availability={shared:{pages:availablePages}};
  return json(projectPublishedLanguage(snapshot,state.published,url.href,availability));
 }
 const denied=await protectedWrite(request,env);if(denied)return denied;
 let body;try{body=await request.json()}catch{return err('JSON invalide',400)}
 if(!body||!celebrationIdOk(body.celebration)||!Number.isSafeInteger(body.expectedRevision))return err('Commande invalide',400);
 if(!['page','page-menu-label','home-entry-button','celebration','media','translation','language-registry'].includes(body.kind))return err('Type invalide',400);
 if(body.kind==='translation'&&(!pageIdOk(body.pageId)||typeof body.languageId!=='string'||
    !/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(body.languageId)||
    !['published','draft'].includes(body.visibility)))return err('Traduction invalide',400);
 if(body.kind==='page'&&(!pageIdOk(body.pageId)||!validVisibility(body.visibility)))return err('Page ou visibilité invalide',400);
 if(body.kind==='page-menu-label'&&(!pageIdOk(body.pageId)||
    typeof body.menuLabel!=='string'||!body.menuLabel.trim()||body.menuLabel.trim().length>95||
    /[\\\u0000-\u001f\u007f]/.test(body.menuLabel)))
  return err('Nom du menu invalide',400);
 if(body.kind==='home-entry-button'&&(!pageIdOk(body.pageId)||!validHomeEntryButton(body.button)))
  return err('Bouton d’accueil invalide',400);
 if(body.kind==='celebration'&&!validVisibility(body.visibility))return err('Statut invalide',400);
 if(body.kind==='media'&&(typeof body.mediaId!=='string'||body.mediaId.length>720||typeof body.general!=='boolean'))return err('Média invalide',400);
 const current=await readEditorState(env.EDITOR_BUCKET);
 if(!expectedRevisionMatches(body.expectedRevision,current.state.version))return err('Une nouvelle version du serveur existe. Rechargez.',409);
 if((body.kind==='page'||body.kind==='page-menu-label'||body.kind==='translation')&&managedPageId(current.state,body.celebration,body.pageId)||
    body.kind==='celebration'&&managedCelebration(current.state,body.celebration))
  return err('Commande privée : session D1 et service dédiés requis',403);
 const state=copy(current.state),pub=state.published||initialPublication(state);
 if(body.kind==='home-entry-button'){
  // Update ONLY a known public home page style. Never publish any draft body,
  // change its rights or expose hidden content. Access requires official PIN.
  const homeId=state.shared?.homeId||'neutral-accueil-general';
  if(body.pageId!==homeId)return err('Cette commande concerne uniquement la page d’accueil',403);
  const original=state.shared?.pages?.find(p=>p.id===homeId&&p.group==='page');
  if(!original||original.privateManaged===true||original.accessPolicy&&
     original.accessPolicy.mode!=='PUBLIC')return err('Page d’accueil privée ou introuvable',403);
  const published=pub.shared?.pages?.find(p=>p.id===homeId&&p.group==='page');
  const normalized=normalizeHomeEntryButton(body.button);
  original.homeEntryButton=normalized;
  if(published)published.homeEntryButton=copy(normalized);
 }else if(body.kind==='page-menu-label'){
  const isShared=body.pageId.startsWith('neutral-');
  const draftPages=isShared?state.shared.pages:state.drafts[body.celebration]?.pages;
  const original=draftPages?.find(p=>p.id===body.pageId);
  if(!original||!['page','celebration'].includes(original.group))
   return err('Page non enregistrée dans la médiathèque des pages',404);
  if(!isShared&&(!original.id.endsWith('-'+body.celebration)))return err('Page incorrecte',403);
  const newName=body.menuLabel.trim();
  const siblings=(isShared?state.shared.pages:state.drafts[body.celebration].pages)
   .filter(p=>p.group===original.group&&(p.placement||'')===(original.placement||''));
  if(siblings.some(p=>p!==original&&
   String(p.menuLabel||p.name||'').trim().toLocaleLowerCase('fr')===newName.toLocaleLowerCase('fr')))
   return err('Ce nom est déjà utilisé dans ce menu',409);
  // Modify ONLY menu labels in draft and an ALREADY PUBLISHED page.
  // Never copy draft body, image, ACL or visibility to the public snapshot.
  original.menuLabel=newName;
  const publishedPages=isShared?pub.shared?.pages:pub.drafts?.[body.celebration]?.pages;
  const publishedPage=publishedPages?.find(p=>p.id===body.pageId);
  if(publishedPage)publishedPage.menuLabel=newName;
 }else if(body.kind==='page'){
  const isShared=body.pageId.startsWith('neutral-');
  const source=isShared?state.shared.pages:state.drafts[body.celebration]?.pages;
  const page=source?.find(p=>p.id===body.pageId);
  if(!page)return err('Page introuvable',404);
  page.visibility=body.visibility;
  const dest=isShared?pub.shared.pages:(pub.drafts[body.celebration]||={pages:[],celebrationDates:{},celebrationTimes:{}}).pages;
  const ix=dest.findIndex(p=>p.id===body.pageId);
  if(body.visibility==='published'){
   const publishedPage=copy(page);publishedPage.visibility='published';
   publishLanguageCommand(state,pub,{kind:'language-registry'});
   if(ix<0)dest.push(publishedPage);else dest[ix]=publishedPage;
   // One explicit page publication releases its authored active language versions.
   if(pub.translationReleases)delete pub.translationReleases[body.pageId];
   for(const language of state.localization?.registry?.languages??[]){
    if(language.active&&language.id!=='fr'&&
       !m030PublicVersion(state,body.celebration,language.id)&&
       state.localization?.pages?.[body.pageId]?.[language.id])
     publishLanguageCommand(state,pub,{...body,kind:'translation',languageId:language.id});
   }

   if(!isShared){
    const draft=state.drafts[body.celebration];
    pub.drafts[body.celebration].celebrationDates=copy(draft.celebrationDates||{});
    pub.drafts[body.celebration].celebrationTimes=copy(draft.celebrationTimes||{});
   }
  }else{
   if(ix>=0)dest.splice(ix,1);
   // Hiding the canonical page invalidates its previously released languages.
   if(pub.translationReleases)delete pub.translationReleases[body.pageId];
  }
 }else if(body.kind==='celebration'){
  state.shared.celebrationVisibility||={};
  state.shared.celebrationVisibility[body.celebration]=body.visibility;
  pub.celebrationVisibility||={};
  pub.celebrationVisibility[body.celebration]=body.visibility;
  if(body.visibility==='published'){
   const saved=state.drafts[body.celebration];
   if(saved&&!pub.drafts[body.celebration])
    pub.drafts[body.celebration]={...copy(legacyRecord(saved)),pages:[]};
  }
  // Explicit release must update the plan itself, not only the visibility index.
  // Otherwise the public projection correctly rejects the stale draft plan.
  const plan=state.plans.find(x=>x.id===body.celebration);
  if(plan){
   plan.visibility=body.visibility;
   const ix=pub.plans.findIndex(x=>x.id===plan.id);
   if(body.visibility==='published'){
    if(ix<0)pub.plans.push(copy(plan));else pub.plans[ix]=copy(plan);
   }else if(ix>=0)pub.plans.splice(ix,1);
  }
 }else if(body.kind==='translation'||body.kind==='language-registry'){
  // A named M030 public-language version is a whole-celebration draft. It
  // cannot be released piecemeal through legacy per-page publication.
  const named=body.kind==='translation'?
   m030PublicVersion(state,body.celebration,body.languageId):null;
  if(named&&body.visibility==='published'&&named.visibility!=='published')
   return err('Publiez la version entière depuis Célébrations, pas une page isolée',409);
  try{publishLanguageCommand(state,pub,body)}
  catch(e){return err(e?.message||'Publication de langue impossible',409)}
 }else{
  const catalogue=discoverMedia(state),entry=catalogue.find(x=>x.id===body.mediaId);
  if(!entry)return err('Média introuvable',404);
  if(body.general&&!projectPublicMediaItem({...entry,general:true},
      privatePublicationIds(state,pub)))
   return err('Média privé non publiable',409);
  entry.general=body.general;
  state.mediaCatalogue=catalogue;
 }
 state.published=pub;state.publishedAt=new Date().toISOString();
 state.publishedRevision=(state.publishedRevision||0)+1;
 if(!await writeEditorState(env.EDITOR_BUCKET,current,state))return err('Une sauvegarde simultanée a eu lieu',409);
 return json({ok:true,revision:state.version,visibility:body.visibility||null,
  ...(body.kind==='page-menu-label'?{pageId:body.pageId,menuLabel:body.menuLabel.trim()}:{}),
  ...(body.kind==='home-entry-button'?{pageId:body.pageId,button:normalizeHomeEntryButton(body.button)}:{}),
  general:body.general??null,updatedAt:state.updatedAt});
}

const allowedUrl=s=>typeof s==='string'&&s.length<=650&&validWeb(s)===s;
export async function handleEditorMedia(request,env){
 if(!hostCheck(request,env))return err('Introuvable',404);
 const url=new URL(request.url);
 if(!env.EDITOR_BUCKET)return err('Stockage non disponible',503);
 if(request.method==='GET'){
  if(!await hasEditorAccess(request,env))return err('Code administrateur nécessaire',401);
  const {state}=await readEditorState(env.EDITOR_BUCKET);
  const legacyRefs=await readLegacyMediaReferences(env.DB);
  // The UI can display DELETE only after the SERVER has established that the
  // item is absent from all saved drafts, publications, translations, private
  // versions, branding and historical D1 references. Unknown = protected.
  const items=discoverMedia(legacyEditorView(state)).map(item=>({
   ...item,canDelete:canSafelyDeleteMedia(item,state,legacyRefs)
  }));
  return json({ok:true,items});
 }
 if(request.method!=='POST')return err('Méthode interdite',405);
 const denied=await protectedWrite(request,env);if(denied)return denied;
 const action=url.searchParams.get('action');
 if(action?.startsWith('mpu-'))return handleEditorMultipartUpload(action,request,env,{
  readEditorState,writeEditorState,discoverMedia
 });
 // M032: independent media sharing is an EXPLICIT choice, unrelated to
 // publishing a page or a celebration. Never move/copy/rename the R2 object.
 // Only official admin-origin same-cookie writes can change this flag.
 if(action==='public-link'){
  let input;try{input=await request.json()}catch{return err('JSON invalide',400)}
  if(typeof input?.id!=='string'||input.id.length>720||
     typeof input?.publicLink!=='boolean'||!Number.isSafeInteger(input.expectedRevision))
   return err('Demande de partage invalide',400);
  const current=await readEditorState(env.EDITOR_BUCKET);
  if(!expectedRevisionMatches(input.expectedRevision,current.state.version))
   return err('La médiathèque a changé. Rechargez-la avant de réessayer.',409);
  const state=copy(current.state);
  const entry=(state.mediaCatalogue||[]).find(m=>m?.id===input.id);
  if(!entry||entry.source!=='uploaded'||!editorUploadPath(entry.src))
   return err('Seuls les fichiers importés sur ce site peuvent recevoir un lien public autonome.',403);
  if(input.publicLink&&!canShareStandaloneMedia(state,entry))
   return err('Ce fichier est lié à un contenu privé ou à un accès réservé : partage public refusé.',403);
  // If the R2 object was removed out-of-band, do not advertise a broken URL.
  if(input.publicLink&&!await env.EDITOR_BUCKET.head(PREFIX+entry.src.slice('/media/new/'.length)))
   return err('Fichier introuvable dans le stockage.',404);
  entry.publicLink=input.publicLink;
  if(!await writeEditorState(env.EDITOR_BUCKET,current,state))
   return err('Une autre modification est intervenue. Rechargez la médiathèque.',409);
  return json({ok:true,revision:state.version,
   item:{...entry,canDelete:false},publicLink:entry.publicLink});
 }
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
  const mime=String(file.type||'').toLowerCase(),format=editorUploadFormat(mime);
  if(!format||file.size<1||file.size>format.max)return err('Format ou taille non pris en charge (vidéos : lien externe)',415);
  const id=crypto.randomUUID()+format.extension;
  const path='/media/new/'+id,record={id:format.type+'|'+path,type:format.type,
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
  if(!expectedRevisionMatches(input.expectedRevision,current.state.version))
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
  if(managedPageId(state,input.celebration,input.pageId)||record.pages.some(managedPage)&&!state.drafts[input.celebration])
   return err('Commande privée : session D1 requise',403);
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
  // Use exactly the same reference policy as the media catalogue UI.
  // Refuse deletion whenever reference discovery is incomplete (D1, private
  // spaces, translations or site identity), rather than relying on a badge.
  const newUpload=entry.source==='uploaded'&&editorUploadPath(entry.src);
  if(entry.source==='uploaded'&&!newUpload)return err('Ce fichier historique est protégé',403);
  if(entry.source!=='uploaded'&&entry.source!=='link')return err('Lien historique protégé',403);
  const legacyRefs=await readLegacyMediaReferences(env.DB);
  if(!canSafelyDeleteMedia(entry,state,legacyRefs))
   return err('Fichier utilisé ou non vérifié : suppression refusée.',409);
  state.mediaCatalogue=discoverMedia(state).filter(r=>r.id!==entry.id);
  if(!await writeEditorState(env.EDITOR_BUCKET,current,state))return err('Modifications simultanées',409);
  if(newUpload)await env.EDITOR_BUCKET.delete(PREFIX+entry.src.split('/').pop());
  return json({ok:true,revision:state.version});
 }
 return err('Action inconnue',404);
}
export async function handleEditorMediaFile(request,env){
 if(!hostCheck(request,env)||!['GET','HEAD'].includes(request.method))return err('Introuvable',404);
 const url=new URL(request.url);
 const filename=url.pathname.slice('/media/new/'.length);
 if(!editorUploadFilename(filename))return err('Fichier inconnu',404);
 const format=editorUploadResponseFormat(filename);
 const bucket=env.EDITOR_BUCKET;if(!bucket)return err('Stockage indisponible',503);
 const range=request.headers.get('range');
 let selected=null;
 if(range){
  const match=/^bytes=(\d*)-(\d*)$/.exec(range);
  const meta=await bucket.head(PREFIX+filename);
  if(!meta)return err('Fichier introuvable',404);
  const invalid=()=>new Response(null,{status:416,headers:{'content-range':'bytes */'+meta.size,'cache-control':'no-store'}});
  if(!match||(!match[1]&&!match[2]))return invalid();
  const start=match[1]?Number(match[1]):Math.max(0,meta.size-Number(match[2]));
  const end=match[1]&&match[2]?Math.min(Number(match[2]),meta.size-1):meta.size-1;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=meta.size||end<start)return invalid();
  selected={offset:start,length:end-start+1,total:meta.size};
 }
 const o=await bucket.get(PREFIX+filename,selected?{range:{offset:selected.offset,length:selected.length}}:undefined);
 if(!o)return err('Fichier introuvable',404);
 const headers={'content-type':format.attachment?format.mime:(o.httpMetadata?.contentType||'application/octet-stream'),
  'cache-control':'public, max-age=3600','x-content-type-options':'nosniff',
  ...(format.attachment?{'content-disposition':'attachment'}:{})};
 headers['accept-ranges']='bytes';
 headers['content-length']=String(selected?selected.length:o.size);
 if(selected)headers['content-range']='bytes '+selected.offset+'-'+(selected.offset+selected.length-1)+'/'+selected.total;
 return new Response(request.method==='HEAD'?null:o.body,{status:selected?206:200,headers});
}
