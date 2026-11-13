// SEVEN PROGRAMME PAGES DEMO: read-only staging import of already-public historical records.
// Historical demo content is read-only; isolated D1 administration requires an explicit separate session.
import {mayUseIsolatedMemberApi} from './app/security/editor-route-policy.mjs';
import {DEMO_CSS} from './editor-demo-style.mjs';
import {ADMIN_STAGE_LAYOUT} from './app/styles/admin/stage-layout.mjs';
import {DEMO_CLIENT} from './editor-demo-client.mjs';
import {MEMBER_SPACES_INLINE} from './app/admin/real-editor-member-spaces-inline.mjs';
import {TRIAL_AUDIO_CLIENT} from './editor-trial-audio-client.mjs';
// SERVER_EDITOR_SYNC is composed explicitly by editor-demo-client.mjs.
import {fiveColourways} from './editor-celebration-themes.mjs';
import {publicCelebrationEntries} from './app/domain/celebration-cycle-registry.mjs';
import {eligiblePublicPage,projectPublicPage,privatePublicationIds,allowedPublicLink}
 from './app/domain/editor-public-projection-security.mjs';
const HOST='celebrations-exit-staging.rondes.workers.dev';
export const STAGES=[
 {label:'Accueil de la célébration',slug:'accueil-celebration'},
 {label:'Préparation',slug:'preparation'},
 {label:'Mercredi',slug:'mercredi'},
 {label:'Jeudi',slug:'jeudi'},
 {label:'Vendredi',slug:'vendredi'},
 {label:'Samedi',slug:'samedi'},
 {label:'Dimanche',slug:'dimanche'},
 // Retain historical slug and its local edits; the requested visible name changes.
 {label:'Après célébration',slug:'apres-celebration',legacyLabel:'Après préparation'}
];
const clean=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const sort=(a,b)=>Number(a.sort_order??999)-Number(b.sort_order??999)||String(a.event_time??'').localeCompare(String(b.event_time??''),'fr')||String(a.id??'').localeCompare(String(b.id??''),'fr');
const asText=x=>String(x??'');
const validStorage=x=>typeof x==='string'&&x.length>0&&x.length<1024&&!x.startsWith('/')&&!x.startsWith('committee/')&&!/(?:^|\/)(?:committee|private|drafts?|members?)(?:\/|$)/i.test(x)&&!/^https?:/i.test(x)&&!x.split('/').some(p=>!p||p==='..'||p==='.')&&!/[\\\u0000-\u001f]/.test(x);
const safeLink=x=>{
 const v=String(x??'').trim();
 if(!v||v.length>1800||/[\u0000-\u001f\\]/.test(v))return '';
 if(v.startsWith('/')&&!v.startsWith('//'))return v;
 try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.toString():'';}catch{return '';}
};
const asset=x=>validStorage(x)?'/media/'+x.split('/').map(encodeURIComponent).join('/'):'';
const escapeHtml=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jsSafe=x=>JSON.stringify(x).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const noCache={'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex,nofollow,noarchive'};
async function rows(db,sql,...args){const r=await db.prepare(sql).bind(...args).all();return r.results||[];}
function toBlocks(celebration,step,events,eventContents,stepContents,links){
 let n=0;const blocks=[];const add=(kind,text,extra={})=>{
  if(text===null||text===undefined||String(text)==='')return;
  blocks.push({id:++n,kind,text:asText(text),align:kind==='heading'?'center':'left',...extra});
 };
 function resource(c){
  if(!c)return;
  add('heading',c.name||c.file_name||'Document',{align:'left'});
  if(c.description)add('text',c.description);
  if(c.inline_text)add('text',c.inline_text);
  const kind=clean(c.content_type),source=clean(c.source_type);
  if(kind==='image'&&source==='file'&&asset(c.storage_path))add('image',c.name||c.file_name||'Image',{src:asset(c.storage_path)});
  if(c.has_cover&&asset(c.cover_storage_path))add('image',c.cover_file_name||c.name||'Illustration',{src:asset(c.cover_storage_path)});
  const href=source==='file'?asset(c.storage_path):safeLink(c.external_url);
  if(href&&(kind==='audio'||/\.mp3$/i.test(c.storage_path||''))&&source==='file')add('audio',c.name||c.file_name||'Enregistrement MP3',{src:href});
  else if(href&&kind!=='image')add('button',kind.includes('vid')?'Voir : '+(c.name||'Vidéo'):kind==='pdf'?'Ouvrir le PDF : '+(c.name||'Document'):'Ouvrir : '+(c.name||'Document'),{href});
  else if(href&&kind==='image'&&source!=='file')add('button','Voir l’image : '+(c.name||'Image'),{href});
  if(!href&&c.external_url&&safeLink(c.external_url))add('button','Lien : '+(c.name||'Document'),{href:safeLink(c.external_url)});
 }
 add('heading',step.label||'Préparation');
 if(step.body_text)add('text',step.body_text);
 const attachedByEvent=new Map();
 for(const row of eventContents){const arr=attachedByEvent.get(String(row.event_id))||[];arr.push(row);attachedByEvent.set(String(row.event_id),arr);}
 const eventIds=new Set(events.map(x=>String(x.id)));
 for(const e of events.sort(sort)){
  add('heading',String(e.event_time?e.event_time+' — ':'')+asText(e.title),{align:'left'});
  if(e.description)add('text',e.description);
  for(const row of (attachedByEvent.get(String(e.id))||[]).sort(sort))resource(row);
  for(const l of links.filter(l=>String(l.event_id??'')===String(e.id)).sort(sort))if(safeLink(l.url))add('button',l.label||l.url,{href:safeLink(l.url)});
 }
 for(const l of links.filter(l=>!l.event_id).sort(sort))if(safeLink(l.url))add('button',l.label||l.url,{href:safeLink(l.url)});
 for(const c of stepContents.sort(sort))resource(c);
 return blocks;
}

// M030: no legacy date-generated plan identities or synthetic Wednesday pages.
// Inventory of PUBLIC resources actually attached to the selected celebration.
// R2 objects are never copied or promoted; committee/private content stays excluded.
function publicFileCatalogue(steps,events,eventContents,stepContents){
 const byKey=new Map();
 for(const step of steps){
  const stage=STAGES.find(t=>clean(t.label)===clean(step.label)||clean(t.legacyLabel||'')===clean(step.label)||String(step.step_key||'').startsWith(t.slug+'-'));
  byKey.set(String(step.step_key),stage?.label||step.label||'Célébration');
 }
 const entries=new Map();
 const add=(entry,page)=>{
  if(!entry||!page)return;
  const prev=entries.get(entry.id);
  if(prev){if(!prev.pages.includes(page))prev.pages.push(page);return}
  entries.set(entry.id,{...entry,pages:[page]});
 };
 const kind=(path,type)=>{
  const lower=String(path||'').toLowerCase().split('?')[0];
  const t=clean(type);
  if(/\.(?:png|jpe?g|gif|webp|svg|avif|bmp)$/.test(lower)||t==='image')return 'images';
  if(/\.pdf$/.test(lower)||t==='pdf')return 'pdf';
  if(/\.(?:mp3|wav|ogg|m4a|aac|flac|opus|wma)$/.test(lower)||t==='audio')return 'audios';
  return 'autres';
 };
 const addFile=(path,type,name,page)=>{
  const src=asset(path);if(!src)return;
  const category=kind(path,type);
  add({id:'file:'+path,category,name:String(name||path.split('/').at(-1)||'Fichier').slice(0,300),src},page);
 };
 // Page paragraphs and event descriptions remain on their pages, not in the file catalogue.
 const eventPage=new Map(events.map(e=>[String(e.id),byKey.get(String(e.step_key))]));
 for(const c of [...eventContents,...stepContents]){
  const page=c.event_id!=null?eventPage.get(String(c.event_id)):byKey.get(String(c.step_key));
  if(!page)continue; // not in any public page of this celebration
  if(clean(c.source_type)==='file')addFile(c.storage_path,c.content_type,c.name||c.file_name,page);
  // A public file can have a separate public cover; it is a reusable image.
  if(c.has_cover&&c.cover_storage_path)addFile(c.cover_storage_path,'image',c.cover_file_name||c.name||'Couverture',page);
  // Only actual stored files and their covers enter the media catalogue.
 }
 return [...entries.values()];
}

// The original site's large welcome illustration, copied to Cloudflare R2.
// This existing staging key contains the same verified original homepage JPG.
const HOME_IMAGE=asset('media/1791723108110/file-1791723109615-1000040461.jpg');
function generalHome(){
 return {id:'neutral-accueil-general',name:'Accueil général',group:'page',blocks:[
  {id:1,kind:'heading',text:'Bienvenue sur le site de la Ronde des Archanges Universelle',align:'center'},
  {id:2,kind:'text',text:'Retrouvez les célébrations, les psaumes et les ressources partagées.',align:'center'},
  {id:3,kind:'image',text:'Ronde des Archanges Universelle',src:HOME_IMAGE,align:'center'}
 ]};
}
function michaelHomeBlocks(contents){
 const ordered=[...contents].sort((a,b)=>{
  const rank=id=>String(id)==='home-intro-2026'?0:String(id)==='home-reliance-2026'?1:10;
  return rank(a.id)-rank(b.id)||String(a.name||'').localeCompare(String(b.name||''),'fr');
 });
 const blocks=[];let id=100000;
 const add=(kind,text,props={})=>{
  if(!String(text||'').trim())return;
  blocks.push({id:++id,kind,text:String(text),align:kind==='heading'?'center':'left',...props});
 };
 for(const c of ordered){
  if(clean(c.category)!=='accueil'||c.audience!=='all')continue;
  add('heading',c.name||'Accueil');
  add('text',c.inline_text||c.description||c.text||'');
  if(c.has_cover&&asset(c.cover_storage_path))add('image',c.cover_file_name||c.name||'Illustration',{src:asset(c.cover_storage_path)});
  if(clean(c.content_type)==='image'&&asset(c.storage_path))add('image',c.name||'Image',{src:asset(c.storage_path)});
  if(clean(c.source_type)==='file'&&clean(c.content_type)!=='image'&&asset(c.storage_path))
   add('button','Ouvrir : '+String(c.name||'Document'),{href:asset(c.storage_path)});
  else if(safeLink(c.external_url))add('button',String(c.name||'Lien'),{href:safeLink(c.external_url)});
 }
 return blocks;
}
function celebrationLibrary(events,eventContents,stepContents,steps){
 const labels=new Map(steps.map(st=>{
  const stage=STAGES.find(t=>clean(st.label)===clean(t.label)||clean(st.label)===clean(t.legacyLabel||'')||String(st.step_key).startsWith(t.slug+'-'));
  return [String(st.step_key),stage?.label||st.label];
 }));
 const eventPages=new Map(events.map(e=>[String(e.id),labels.get(String(e.step_key))]));
 const library=new Map();
 function add(c,page){
  if(!page||clean(c.category)==='accueil')return;
  const t=clean(c.content_type);
  const path=asset(c.storage_path),cover=asset(c.cover_storage_path);
  const external=safeLink(c.external_url);
  let type='';
  if(t.includes('video')||/\.(?:mp4|webm|mov)$/i.test(path))type='video';
  else if(t==='audio'||/\.(?:mp3|wav|m4a|ogg|opus|flac)$/i.test(path))type='audio';
  else if(t==='image'||/\.(?:png|jpe?g|webp|gif|svg)$/i.test(path))type='image';
  else if(t==='pdf'||/\.pdf$/i.test(path))type='pdf';
  // Inline page text and event descriptions are never media-library entries.
  if(!type)return;
  const id=String(c.id);
  if(library.has(id)){const old=library.get(id);if(!old.pages.includes(page))old.pages.push(page);return}
  if(['audio','video','image','pdf'].includes(type)&&!path&&!external&&!cover)return;
  library.set(id,{id,name:String(c.name||c.file_name||'Document').slice(0,280),
   description:String(c.description||'').slice(0,3000),
   type,src:path,cover,external,
   text:'',
   chant:clean(c.audio_kind||c.audioKind||c.category).includes('chant')||/^\s*chant\b/i.test(String(c.name||'')),
   pages:[page]});
 }
 for(const c of stepContents)add(c,labels.get(String(c.step_key)));
 for(const c of eventContents)add(c,eventPages.get(String(c.event_id)));
 for(const c of [...stepContents,...eventContents]){
  const page=c.event_id!=null?eventPages.get(String(c.event_id)):labels.get(String(c.step_key));
  if(!page||!c.has_cover||!asset(c.cover_storage_path)||clean(c.category)==='accueil')continue;
  const id='cover:'+String(c.cover_storage_path);
  if(library.has(id)){const entry=library.get(id);if(!entry.pages.includes(page))entry.pages.push(page);continue}
  library.set(id,{id,name:String(c.name||c.cover_file_name||'Illustration'),type:'image',
   description:'',src:asset(c.cover_storage_path),cover:'',external:'',text:'',chant:false,pages:[page]});
 }
 return [...library.values()];
}

// Public staging rows only. Shared with the site-shaped preview; never writes D1.
export async function loadSevenStageContent(env,selectedId,{publicOnly=false,publishedState=null}={}){
  const allCelebrations=await rows(env.DB,'SELECT id,archangel,year,status FROM celebrations_celebrations ORDER BY id');
  const pub=publishedState?.published||null;
  const visibility=pub?.celebrationVisibility||{};
  // One authoritative visibility: the explicitly published R2 decision.
  // D1 status is historical identification, not a second visibility switch.
  // This allows a prepared (D1 draft) year to be shown after intentional
  // publication, while no preallocated/hidden slot becomes public on its own.
  const visible=publicCelebrationEntries(allCelebrations,visibility,
   pub?.celebrationAccessPolicies||{});
  const celebrations=publicOnly?visible:allCelebrations;
  // Private labels may appear on the public list, but their pages never do.
  // Unpublished, hidden and duplicate historical identities are not routable.
  const publicRows=publicOnly?allCelebrations.filter(c=>
   visible.some(entry=>entry.id===String(c.id)&&!entry.titleOnly)):allCelebrations;
  const allowedIds=new Set(publicRows.map(c=>String(c.id)));
  // The only routable public identities are explicitly published canonical
  // D1 cycles. An old plan/date URL or duplicate no longer opens a page.
  const selected=selectedId;
  if(selected&&!allowedIds.has(String(selected)))throw new Error('Unknown celebration');
  const available=publicOnly?publicRows:allCelebrations;
  const celebration=available.find(c=>String(c.id)===(selected||'101'))||available[0];
  if(!celebration)throw new Error('No celebration');
  const steps=await rows(env.DB,'SELECT * FROM celebrations_steps WHERE celebration_id=? ORDER BY sort_order,id',celebration.id);
  // Historic D1 public steps may not republish a deliberately hidden page.
  const rawEditorPages=publishedState?.drafts?.[String(celebration.id)]?.pages||[];
  const publishedEditorPages=pub?.drafts?.[String(celebration.id)]?.pages||[];
  const releasedIds=new Set(publishedEditorPages.filter(eligiblePublicPage).map(p=>p.id));
  // Historical D1 stages are NOT allowed to bypass a restricted page policy.
  // A published page with private ACL must be withheld even if D1 holds text.
  const hiddenIds=new Set(publicOnly?[...rawEditorPages,...publishedEditorPages]
   .filter(p=>p&&typeof p.id==='string'&&(
     p.accessPolicy?.mode&&p.accessPolicy.mode!=='PUBLIC'||
     ['hidden','draft','private'].includes(String(p.visibility||'').toLowerCase())&&
     !releasedIds.has(p.id))).map(p=>p.id):[]);
  const stageOf=record=>STAGES.find(stage=>
   clean(record.label)===clean(stage.label)||
   (stage.legacyLabel&&clean(record.label)===clean(stage.legacyLabel))||
   clean(record.step_key)===stage.slug+'-'+celebration.id);
  const visibleSteps=publicOnly?steps.filter(record=>{
   const stage=stageOf(record);
   return !!stage&&!hiddenIds.has(stage.slug+'-'+celebration.id);
  }):steps;
  const visibleStepKeys=new Set(visibleSteps.map(record=>String(record.step_key)));
  // One bulk, read-only fetch per public content table, then exact step-key grouping.
  // No private audience, committee resources, D1 writes, publication or production calls.
  const hasMichaelHome=clean(celebration.archangel)==='michael'&&String(celebration.year||'').includes('2026');
  const [allEvents,allEvc,allStc,allLinks,homeContent]=await Promise.all([
   rows(env.DB,"SELECT * FROM celebrations_events WHERE celebration_id=? AND audience='all' ORDER BY sort_order,event_time,id",celebration.id),
   rows(env.DB,"SELECT ec.event_id,ec.sort_order,c.* FROM celebrations_event_contents ec JOIN celebrations_events e ON e.id=ec.event_id JOIN celebrations_contents c ON c.id=ec.content_id WHERE e.celebration_id=? AND e.audience='all' AND c.audience='all' ORDER BY e.sort_order,ec.sort_order,c.id",celebration.id),
   rows(env.DB,"SELECT sc.step_key,sc.sort_order,c.* FROM celebrations_step_contents sc JOIN celebrations_contents c ON c.id=sc.content_id WHERE sc.celebration_id=? AND c.audience='all' ORDER BY sc.step_key,sc.sort_order,c.id",celebration.id),
   rows(env.DB,"SELECT * FROM celebrations_links WHERE celebration_id=? OR event_id IN (SELECT id FROM celebrations_events WHERE celebration_id=? AND audience='all') ORDER BY sort_order,id",celebration.id,celebration.id),
   hasMichaelHome?rows(env.DB,"SELECT * FROM celebrations_contents WHERE audience='all' AND LOWER(category)='accueil' ORDER BY id") : Promise.resolve([])
  ]);
  const events=publicOnly?allEvents.filter(e=>visibleStepKeys.has(String(e.step_key))):allEvents;
  const eventIds=new Set(events.map(e=>String(e.id)));
  const evc=publicOnly?allEvc.filter(c=>eventIds.has(String(c.event_id))):allEvc;
  const stc=publicOnly?allStc.filter(c=>visibleStepKeys.has(String(c.step_key))):allStc;
  const links=publicOnly?allLinks.filter(l=>l.event_id?
   eventIds.has(String(l.event_id)):visibleStepKeys.has(String(l.step_key))):allLinks;
  const pages=STAGES.filter(stage=>!publicOnly||
   !hiddenIds.has(stage.slug+'-'+celebration.id)).map(stage=>{
   const record=visibleSteps.find(s=>clean(s.label)===clean(stage.label)||(stage.legacyLabel&&clean(s.label)===clean(stage.legacyLabel))||clean(s.step_key)===stage.slug+'-'+celebration.id);
   const id=stage.slug+'-'+celebration.id;
   if(!record)return {id,name:stage.label,group:'celebration',blocks:[{id:1,kind:'heading',text:stage.label,align:'center'}]};
   const key=record.step_key;
   const dayEvents=events.filter(e=>e.step_key===key).sort(sort);
   const allowedIds=new Set(dayEvents.map(e=>String(e.id)));
   const dayLinks=links.filter(l=>l.event_id?allowedIds.has(String(l.event_id)):(String(l.celebration_id)===String(celebration.id)&&l.step_key===key));
   const dayEventContents=evc.filter(c=>allowedIds.has(String(c.event_id)));
   const dayStepContents=stc.filter(c=>c.step_key===key);
   const blocks=toBlocks(celebration,record,dayEvents,dayEventContents,dayStepContents,dayLinks);if(blocks[0]?.kind==='heading'&&stage.legacyLabel)blocks[0].text=stage.label;return {id,name:stage.label,group:'celebration',blocks};
  });
  if(hasMichaelHome&&homeContent.length){
   const welcome=pages.find(p=>p.id==='accueil-celebration-'+celebration.id);
   if(welcome)welcome.blocks.push(...michaelHomeBlocks(homeContent));
  }
  // Neutral pages are intentionally separate from the celebration's colour identity.
  pages.unshift(generalHome());
  // All and only the public resources attached to this celebration.
  // Text is already public content of the fetched pages, not a new file in R2.
  const files=publicFileCatalogue(visibleSteps,events,evc,stc);
  const library=celebrationLibrary(events,evc,stc,visibleSteps);
  const publicAudio=files.filter(f=>f.category==='audios'&&/\.mp3$/i.test(f.src||''))
    .map(f=>({name:f.name,src:f.src,pages:f.pages}));
  const blocked=publicOnly&&publishedState?
   privatePublicationIds(publishedState,pub):[];
  const publicPages=publicOnly?pages.map(p=>projectPublicPage(p,blocked)).filter(Boolean):pages;
  const publicLibrary=publicOnly?library.filter(item=>
   (!item.src||allowedPublicLink(item.src,blocked))&&
   (!item.cover||allowedPublicLink(item.cover,blocked))&&
   (!item.external||allowedPublicLink(item.external,blocked))):library;
  const seed={celebrationId:celebration.id,archangel:celebration.archangel,year:celebration.year||'',
   palettes:fiveColourways(celebration.archangel),pages:publicPages,media:publicAudio,files,library:publicLibrary,celebrations};
  return {celebrations,celebration,seed};
}
export async function handlePreparationDemo(request,env){
 const url=new URL(request.url);
 if(url.hostname!==HOST&&!['ronde-des-archanges-universelle.eu','www.ronde-des-archanges-universelle.eu','celebrations-visual-candidate.rondes.workers.dev'].includes(url.hostname)&&!(env?.EDITOR_D1_SESSION_API_ENABLED==='true'&&mayUseIsolatedMemberApi(url,env)))return new Response('Not found',{status:404});
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 if(!env.DB)return new Response('Démonstration momentanément indisponible',{status:503});
 try{
  const {celebrations,celebration,seed}=await loadSevenStageContent(env,url.searchParams.get('celebration'));
  // A staging-only public-data manifest allows assigning a library file to the
  // correct local draft without navigating away from the global Files tab.
  if(url.searchParams.get('format')==='json'){
   return Response.json({ok:true,seed},{headers:{...noCache,'x-robots-tag':'noindex,nofollow,noarchive'}});
  }
  // Reuse the proven editor, but isolate its localStorage key from the fictional demo.
  // Production/staging modes are supported by the same editor source.
  // No request-time substitution of JavaScript function bodies is needed.
  const client=DEMO_CLIENT;
  const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
  const choices=celebrations.map(c=>'<option value="'+escapeHtml(c.id)+'"'+(String(c.id)===String(celebration.id)?' selected':'')+'>'+escapeHtml(c.archangel+' '+(c.year||''))+'</option>').join('');
  const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Pages de la célébration — atelier Célébrations</title><style nonce="'+nonce+'">'+DEMO_CSS+'</style></head><body>'+
  '<div class="shell stage-editor"><aside class="rail"><div class="brand"><div class="mark">✦</div><div><strong>Administration</strong></div></div><nav aria-label="Navigation"><button class="navbtn" data-tab="pages">▤ Pages</button><button class="navbtn" data-tab="footer">▤ Pages de bas de page</button><button class="navbtn active" data-tab="celebrations">✧ Célébrations</button><button class="navbtn" data-tab="media">▧ Médiathèque (administration)</button><button class="navbtn" data-tab="members-spaces">♧ Membres</button><button class="navbtn" data-tab="languages-categories" hidden style="display:none">◇ Catégories</button><button class="navbtn" data-tab="settings">⚙ Paramètres</button><button class="navbtn" data-tab="guide">ⓘ Mode d’emploi</button></nav></aside>'+
  '<div class="content"><header class="topbar"><div></div><div class="actions"><button id="preview-btn" class="btn sm" title="Voir la page en brouillon, sans publication">Aperçu du brouillon</button><button id="save-btn" class="btn primary">Enregistrer</button><a id="view-site-btn" class="btn view-site-btn" href="/__editor/voir-le-site" target="_blank" rel="noopener noreferrer">Voir le site</a></div></header>'+
  '<main class="main"><div id="workspace"></div><p class="status" id="status" role="status" aria-live="polite"></p></main></div></div>'+
  '<div id="editor-save-toast" class="editor-save-toast" role="status" aria-live="polite" hidden></div>'+ 
  '<input id="image-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>'+
  '<style nonce="'+nonce+'">'+ADMIN_STAGE_LAYOUT+'</style>'+
  '<script nonce="'+nonce+'">window.__PREPARATION_SEED__='+jsSafe(seed)+';</script>'+
  '<script nonce="'+nonce+'">'+TRIAL_AUDIO_CLIENT+'\n'+MEMBER_SPACES_INLINE+'\n'+client+'</script></body></html>';
  return new Response(request.method==='HEAD'?null:html,{headers:{...noCache,'content-security-policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; img-src 'self' data: blob: https:; media-src 'self' blob:; frame-src 'self' blob:; worker-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"}});
 }catch(e){const notFound=e?.message==='Unknown celebration'||e?.message==='No celebration';return new Response(notFound?'Célébration introuvable':'Données de préparation indisponibles',{status:notFound?404:503,headers:{'cache-control':'no-store'}});}
}
