// Mission D: isolated, admin-only, server-rendered historical draft preview.
// NEVER connected to the official domain, public routes, or publication pipeline.
import {authorize,sha256} from './auth-api.mjs';
import {D2_STYLE} from './editor-d2-style.mjs';
const HOST='celebrations-exit-staging.rondes.workers.dev';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=x=>esc(x).replace(/\r?\n/g,'<br>');
const valid=(s)=>typeof s==='string'&&s.length<=180;
const safeUrl=v=>{
 const x=String(v||'').trim();
 if(!x||x.length>1800||/[\u0000-\u001f\\]/.test(x))return '';
 if(x.startsWith('/')&&!x.startsWith('//'))return x;
 try{const u=new URL(x);return ['https:','http:'].includes(u.protocol)?u.toString():''}catch{return ''}
};
const mediaUrl=key=>{
 const k=String(key||'').trim();
 if(!k||k.length>=1024||k.startsWith('/')||k.startsWith('committee/')||k.split('/').some(x=>!x||x==='..'||x==='.')||/[\\\u0000-\u001f]/.test(k))return '';
 return '/media/'+k.split('/').map(encodeURIComponent).join('/');
};
const publicAsset=row=>row?.audience==='all'&&row?.storage_path&&!String(row.storage_path).startsWith('committee/');
const caption=(label,value)=>value?'<div class="meta">'+esc(label)+': '+esc(value)+'</div>':'';
const link=(url,label,cls='resource-link')=>{
 const href=safeUrl(url);return href?'<a class="'+cls+'" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>':'';
};
const pageHref=k=>'/__editor/preview?key='+encodeURIComponent(k);
const go=(k,label,active=false)=>'<a class="d-chip'+(active?' active':'')+'" href="'+esc(pageHref(k))+'">'+esc(label)+'</a>';
function strippedLegacy(html){
 // Parse selected textual elements and linked resources; NEVER send an old tag
 // or attribute to the browser. This is an intentionally limited, read-only
 // representation, not the original executable DOM.
 const raw=String(html||'').slice(0,230000)
  .replace(/<(script|style|template|svg|iframe|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
  .replace(/<script\b[^>]*\/\s*>/gi,' ');
 const plain=v=>String(v||'').replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"')
  .replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
 let body='',count=0;
 const elements=/<(h1|h2|h3|h4|p|li|blockquote|a|button|img)\b([^>]*?)(?:\/?>)(?:([\s\S]*?)<\/\1>)?/gi;
 for(const m of raw.matchAll(elements)){
  if(count++>500)break;
  const tag=m[1].toLowerCase(),attrs=m[2]||'';
  const value=plain(m[3]||'');
  if(tag==='img'){
   const src=attrs.match(/\bsrc\s*=\s*(["'])(.*?)\1/i)?.[2]||'';
   const url=safeUrl(src);
   if(url&&(url.startsWith('/')||url.startsWith('https://celebrations-exit-staging.rondes.workers.dev/'))){
    const alt=attrs.match(/\balt\s*=\s*(["'])(.*?)\1/i)?.[2]||'Image historique';
    body+='<img src="'+esc(url)+'" alt="'+esc(alt)+'" loading="lazy">';
   }else body+='<p class="meta">Image historique externe non chargée automatiquement : '+esc(plain(attrs.match(/\balt\s*=\s*(["'])(.*?)\1/i)?.[2]||''))+'</p>';
   continue;
  }
  if(!value)continue;
  if(tag==='a'){
   const href=attrs.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2]||'';
   body+=link(href,value,'resource-link d-static-link')||'<p>'+esc(value)+'</p>';
  }else if(tag==='button')body+='<span class="d-muted-chip">'+esc(value)+'</span>';
  else if(tag==='li')body+='<p>• '+esc(value)+'</p>';
  else if(tag==='blockquote')body+='<blockquote>'+esc(value)+'</blockquote>';
  else if(tag.startsWith('h'))body+='<h2>'+esc(value)+'</h2>';
  else body+='<p>'+esc(value)+'</p>';
 }
 const fullText=plain(raw);
 // Text in custom div/span wrappers is not always covered by the whitelist.
 // Provide an explicit complete readable fallback, without executing any HTML.
 body+='<details><summary>Texte historique complet (lecture sécurisée)</summary><p>'+esc(fullText.slice(0,130000))+'</p></details>';
 if(raw.length>=230000)body+='<div class="d-gap-warning">Document historique très long : lecture complémentaire du fichier source requise.</div>';
 return body;
}
const when=d=>{
 const s=d?.start_date,e=d?.end_date;
 if(!s)return '';
 const fmt=x=>{const t=Date.parse(String(x).slice(0,10)+'T12:00:00Z');return Number.isNaN(t)?String(x):new Date(t).toLocaleDateString('fr-FR',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'})};
 return fmt(s)+(e&&e!==s?' → '+fmt(e):'');
};
const label=r=>String(r.name||r.file_name||r.title||r.id||'Document');
function media(r,{gallery=false}={}){
 const kind=String(r.content_type||r.type||'').toLowerCase();
 const source=String(r.source_type||'').toLowerCase();
 const display=label(r);
 const doc='<h3>'+esc(display)+'</h3>'+(r.description?'<p>'+text(r.description)+'</p>':'');
 const cover=mediaUrl(r.cover_storage_path);
 const thumbnail=r.has_cover&&r.audience==='all'&&cover?'<img class="d-cover" alt="" loading="lazy" src="'+esc(cover)+'">':'';
 if(r.audience!=='all')return '<article class="d-resource restricted">'+doc+'<p class="meta">Accès réservé : '+esc(r.audience)+' — document conservé, non exposé dans cette prévisualisation.</p></article>';
 const href=source==='file'?mediaUrl(r.storage_path):safeUrl(r.external_url);
 if(kind==='image'&&href&&source==='file')
  return '<figure class="d-image"><a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer"><img loading="lazy" src="'+esc(href)+'" alt="'+esc(display)+'"></a><figcaption>'+esc(display)+'</figcaption></figure>';
 if(kind==='audio'&&source==='file'&&href)return '<article class="d-resource">'+thumbnail+doc+'<audio controls preload="none" src="'+esc(href)+'"></audio></article>';
 if((kind==='video'||kind==='vidéo')&&source==='file'&&href)return '<article class="d-resource">'+thumbnail+doc+'<video controls preload="none" src="'+esc(href)+'"></video></article>';
 if(kind==='texte'&&source==='text')return '<article class="d-resource">'+doc+'<p>'+text(r.inline_text||'')+'</p></article>';
 const linkHtml=href?link(href,(kind==='pdf'?'Ouvrir le PDF':kind.includes('vid')?'Ouvrir la vidéo':'Ouvrir le document')):'';
 return '<article class="d-resource">'+thumbnail+doc+(linkHtml?'<div class="resources">'+linkHtml+'</div>':'<p class="meta">Aucun média accessible depuis cette référence.</p>')+'</article>';
}
async function getContent(db,id){
 const item=await db.prepare('SELECT * FROM celebrations_contents WHERE id=?').bind(String(id)).first();
 return item||null;
}
async function item(block,db,context){
 const d=block.data||{}, r=d.record||{};
 switch(block.kind){
 case 'title':return '<h2>'+text(d.text)+'</h2>';
 case 'text':return '<p>'+text(d.text)+'</p>';
 case 'banner':return '<aside class="d-banner">'+text(d.text)+'</aside>';
 case 'button':return link(d.url,d.text,'d-btn');
 case 'static_html_snapshot':
  return context.key==='home'?'':('<section class="d-static">'+strippedLegacy(d.html)+(d.html?'<small>Version historique sécurisée : aucun script original exécuté.</small>':'<small>Page statique référencée, sans contenu HTML archivé.</small>')+'</section>');
 case 'celebration_record':
  return '<section class="d-card d-celebration-title"><h2>Archange '+esc(r.archangel)+' '+esc(r.year)+'</h2><p class="d-date">'+esc(context.celebrationDate||'')+'</p><p class="meta">Statut historique : '+esc(r.status||'')+'</p>'+go('celebration:'+r.id+':step:Préparation','Programme et sept étapes')+'</section>';
 case 'legacy_day':
  return '<section class="d-day"><h2>'+esc(r.label)+'</h2>'+caption('Dates',when(r))+(r.body_text?'<p>'+text(r.body_text)+'</p>':'')+'</section>';
 case 'legacy_event':{
  const event=r;
  let resources='';
  for(const a of d.ordered_content_refs||[]){
   const content=await getContent(db,a.content_id);
   resources+=content?media(content):'<p class="meta">Référence introuvable : '+esc(a.content_id)+'</p>';
  }
  const links=(d.links||[]).map(l=>link(l.url,l.label||l.url)).join('');
  return '<article class="d-event"><div class="d-time">'+esc(event.event_time||'—')+'</div><div><h3>'+esc(event.title)+'</h3>'+(event.description?'<p>'+text(event.description)+'</p>':'')+(event.audience!=='all'?'<div class="d-notice">Rendez-vous réservé : '+esc(event.audience)+'</div>':'')+(event.audience==='all'?resources:'<p class="meta">Ressources masquées : audience restreinte.</p>')+(event.audience==='all'?'<div class="resources">'+links+'</div>':'')+'</div></article>';
 }
 case 'legacy_step_content_ref':{
  const c=await getContent(db,d.content_id);return c?media(c):'<p class="meta">Contenu absent : '+esc(d.content_id)+'</p>';
 }
 case 'legacy_featured_content':{
  const c=await getContent(db,d.content_id);return c?'<section class="d-editorial">'+media(c)+'</section>':'';
 }
 case 'legacy_resource':return media(r);
 case 'legacy_link':
 case 'legacy_link_unassigned':return link(r.url,r.label||r.url)||'<p class="meta">Lien externe non valide</p>';
 case 'legal_draft':
 case 'legal_draft_unassigned':
  return '<section class="d-legal"><h2>'+esc(r.title)+'</h2>'+caption('Version',r.draft_number)+(!r.is_public?'<p class="d-notice">Brouillon légal non public</p>':'')+'<div class="d-legal-text">'+text(r.content)+'</div></section>';
 case 'committee_unlisted_pdf':
  return '<article class="d-resource restricted"><h3>'+esc(r.title)+'</h3><p class="meta">PDF comité — accès exclusivement par son lien historique ; jamais listé publiquement.</p></article>';
 case 'visibility_setting':return '<p class="meta">Autres célébrations visibles sur le site actuel : '+(Number(r.show_other_celebrations)===1?'oui':'non')+'</p>';
 case 'library_index':return '<p>Catalogue historique : '+esc(d.total)+' contenus. Choisir une section ci-dessous.</p>';
 case 'legacy_event_unassigned':
 case 'legacy_unassigned_event_attachment':
 case 'legacy_unassigned_step_attachment':
 case 'missing_stage':return '<div class="d-notice">Élément historique à réexaminer : '+esc(block.source_id||block.kind)+'</div>';
 default:return '<div class="d-notice">Bloc non rendu (« '+esc(block.kind)+' ») : données conservées, traitement manuel nécessaire.</div>';
 }
}
const CSS=`
:root{--accent:#b42318;--ink:#172033;--line:#dfe3e8;--soft:#f7f8fa}
*{box-sizing:border-box}
body{margin:0;font-family:Arial,"Helvetica Neue",sans-serif;color:var(--ink);background:#fff;line-height:1.5}
a{color:var(--ink)}a:focus-visible,button:focus-visible{outline:3px solid #173b70}
.d-bar{position:sticky;top:0;z-index:50;background:#172033;color:#fff;padding:10px 18px;display:flex;justify-content:space-between;gap:15px;align-items:center;flex-wrap:wrap}
.d-bar strong{font-size:.88rem}.d-bar small{opacity:.82}.d-bar a{color:#fff}
.d-shell{max-width:1180px;margin:auto;padding:22px 20px 70px}
.d-heading{border-bottom:1px solid var(--line);padding:10px 0 16px}
.d-heading h1{font-size:clamp(1.8rem,5vw,3.2rem);line-height:1.1;margin:.3em 0}
.d-nav{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}
.d-chip,.d-btn,.resource-link{display:inline-flex;align-items:center;padding:9px 13px;background:#fff;border:1px solid var(--line);border-radius:12px;text-decoration:none;font-size:.9rem}
.d-chip.active,.d-btn:hover{background:var(--accent);color:#fff}
.d-content{display:grid;gap:18px;margin-top:24px}
.d-card,.d-resource,.d-event,.d-day,.d-static,.d-legal,.d-editorial{border:1px solid var(--line);border-radius:16px;padding:20px;background:#fff;overflow-wrap:anywhere}
.d-card h2,.d-resource h3,.d-event h3{margin-top:0}
.d-day{border-left:5px solid var(--accent)}
.d-event{display:grid;grid-template-columns:88px minmax(0,1fr);gap:16px}
.d-time{font-weight:800;font-size:1.1rem}
.d-resource{margin:8px 0;max-width:100%}
.d-cover{width:96px;height:96px;object-fit:cover;border-radius:10px;float:left;margin-right:16px}
.d-resource audio,.d-resource video{width:100%;max-width:100%}
.d-image{display:inline-grid;width:min(100%,410px);margin:8px 0;gap:5px}
.d-image img{display:block;max-width:100%;max-height:350px;border-radius:12px;object-fit:contain}
.d-image figcaption{color:#667085;font-size:.9rem}
.d-gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.d-gallery .d-resource{margin:0}
.d-notice,.d-banner{border-left:4px solid var(--accent);padding:12px;background:var(--soft);margin:7px 0}
.meta,small{color:#667085;font-size:.85rem}
.resources{display:flex;flex-wrap:wrap;gap:8px}
.d-static small{display:block;margin-top:15px}
.d-legal-text{white-space:normal}
.d-footer{border-top:1px solid var(--line);margin-top:45px;text-align:center;padding-top:20px;color:#667085}
@media(max-width:680px){.d-shell{padding:14px 12px 36px}.d-event{grid-template-columns:58px minmax(0,1fr);gap:10px;padding:12px}.d-gallery{grid-template-columns:1fr}.d-card,.d-resource,.d-day,.d-legal,.d-static,.d-editorial{padding:14px}.d-bar{position:relative}.d-nav{gap:5px}.d-chip{font-size:.8rem;padding:7px}.d-heading h1{font-size:1.7rem}}
`;
const response=(body,status=200,kind='text/html; charset=utf-8')=>new Response(body,{status,headers:{
 'content-type':kind,'cache-control':'no-store','x-robots-tag':'noindex,nofollow,noarchive',
 'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
 'content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; media-src 'self'; font-src 'none'; script-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
 'x-frame-options':'DENY'
}});
const forbidden=()=>response('Preview requires authorized staging access',401,'text/plain; charset=utf-8');
function same(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
 let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}

// D2: a short-lived HTTP-only navigation cookie is tied to an ACTIVE, existing
// admin session. The cookie alone cannot outlive a revoked session. No D1 writes.
const en=new TextEncoder();
function readCookie(request){
 const match=(request.headers.get('cookie')||'').match(/(?:^|;\s*)d2_preview=([^;]+)/);
 return match?.[1]||'';
}
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
async function mac(input,env){
 if(!env.EDITOR_D_PREVIEW_TOKEN||env.EDITOR_D_PREVIEW_TOKEN.length<48)throw Error('Preview secret unavailable');
 const k=await crypto.subtle.importKey('raw',en.encode(env.EDITOR_D_PREVIEW_TOKEN),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',k,en.encode(input)));
}
async function validateCookie(request,env){
 const match=readCookie(request).match(/^(\d{13})\.([a-f0-9]{64})\.([a-f0-9]{24})\.([a-f0-9]{64})$/i);
 if(!match||!env.DB||Number(match[1])<=Date.now()||Number(match[1])>Date.now()+20*60*1000)return false;
 const message=match[1]+'.'+match[2]+'.'+match[3];
 if(!same(match[4],await mac(message,env)))return false;
 const session=await env.DB.prepare('SELECT expires_at FROM celebrations_admin_sessions WHERE token_hash=?').bind(match[2]).first();
 return !!session&&Date.parse(session.expires_at)>Date.now();
}
export async function handleEditorDSession(request,env){
 if(new URL(request.url).hostname!==HOST)return response('Not found',404,'text/plain');
 if(request.method!=='POST')return response('Method not allowed',405,'text/plain');
 if(!env.DB||!env.EDITOR_D_PREVIEW_TOKEN)return response('Unavailable',503,'text/plain');
 if(!await authorize(request,env,true))return forbidden();
 const token=request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
 if(!token)return forbidden();
 const hash=await sha256(token);
 const until=String(Date.now()+20*60*1000);
 const nonce=hex(crypto.getRandomValues(new Uint8Array(12)));
 const message=until+'.'+hash+'.'+nonce;
 const cookie=message+'.'+await mac(message,env);
 const res=response('Session de prévisualisation établie.',200,'text/plain');
 res.headers.set('set-cookie','d2_preview='+cookie+'; Path=/__editor/; Max-Age=1200; Secure; HttpOnly; SameSite=Strict');
 return res;
}
export async function handleEditorDEntry(request,env){
 if(new URL(request.url).hostname!==HOST)return response('Not found',404,'text/plain');
 if(request.method!=='GET')return response('Method not allowed',405,'text/plain');
 // Bootstrap is trusted authored code ONLY, never an historical HTML input.
 const nonce=hex(crypto.getRandomValues(new Uint8Array(16)));
 const js=`(async()=>{const status=document.getElementById('message');const token=localStorage.getItem('celebrations-admin-token')||'';if(!token){status.textContent='Connectez-vous d’abord à l’ancienne administration de test.';return}try{const r=await fetch('/__editor/session',{method:'POST',headers:{authorization:'Bearer '+token},credentials:'same-origin'});if(!r.ok){status.textContent='Session administrateur expirée : reconnectez-vous à l’administration staging.';return}location.replace('/__editor/preview?key=home')}catch{status.textContent='Prévisualisation temporairement indisponible.'}})();`;
 const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prévisualisation administrateur</title></head><body><main><h1>Ouverture de la prévisualisation sécurisée</h1><p id="message">Vérification de votre session administrateur…</p><a href="/admin.html?staging=1">Retour à l’administration staging</a></main><script nonce="'+nonce+'">'+js+'</script></body></html>';
 const res=response(html);
 res.headers.set('content-security-policy',"default-src 'none'; script-src 'nonce-"+nonce+"'; connect-src 'self'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
 return res;
}

export async function canPreview(request,env){
 if(env.EDITOR_D_PREVIEW_TOKEN&&env.EDITOR_D_PREVIEW_TOKEN.length>=48&&
  same(request.headers.get('x-editor-d-preview-token'),env.EDITOR_D_PREVIEW_TOKEN))return true;
 if(env.DB&&await authorize(request,env,true))return true;
 return !!(env.DB&&await validateCookie(request,env));
}
export async function handleEditorD(request,env){
 const url=new URL(request.url);
 if(url.hostname!==HOST)return response('Not found',404,'text/plain');
 if(request.method!=='GET'&&request.method!=='HEAD')return response('Method not allowed',405,'text/plain');
 if(!env.DB)return response('Unavailable',503,'text/plain');
 if(!await canPreview(request,env))return forbidden();
 const key=url.searchParams.get('key')||'home';
 if(!valid(key))return response('Not found',404,'text/plain');
 const imp=await env.DB.prepare('SELECT page_id,source_key,original_route,imported_version FROM editor_c_imports WHERE source_key=?').bind(key).first();
 if(!imp)return response('Not found',404,'text/plain');
 const p=await env.DB.prepare('SELECT id,celebration_id,step_key,draft_version,published_version FROM editor_b_pages WHERE id=?').bind(imp.page_id).first();
 if(!p)return response('Not found',404,'text/plain');
 const rev=await env.DB.prepare('SELECT title FROM editor_b_revisions WHERE page_id=? AND version=?').bind(p.id,p.draft_version).first();
 if(!rev)return response('Unavailable',503,'text/plain');
 const [standard,legacy,allImports]=await Promise.all([
  env.DB.prepare('SELECT block_id,kind,data_json,position FROM editor_b_blocks WHERE page_id=? AND version=? ORDER BY position').bind(p.id,p.draft_version).all(),
  env.DB.prepare('SELECT block_id,legacy_kind,source_table,source_id,data_json,position FROM editor_c_blocks WHERE page_id=? AND version=? ORDER BY position').bind(p.id,p.draft_version).all(),
  env.DB.prepare('SELECT source_key FROM editor_c_imports ORDER BY source_key').all()
 ]);
 const blocks=[...(standard.results||[]).map(b=>({kind:b.kind,position:b.position,data:JSON.parse(b.data_json)})),
  ...(legacy.results||[]).map(b=>({kind:b.legacy_kind,position:b.position,data:JSON.parse(b.data_json),source_table:b.source_table,source_id:b.source_id}))]
  .sort((a,b)=>a.position-b.position);
 const known=new Set((allImports.results||[]).map(x=>x.source_key));
 let navigation=go('home','Accueil',key==='home');
 const celebrationKeys=[...(allImports.results||[])].map(x=>x.source_key).filter(x=>/^celebration:\\d+$/.test(x)).sort((a,b)=>a.localeCompare(b));
 for(const name of celebrationKeys){const c=await env.DB.prepare('SELECT archangel,year,status FROM celebrations_celebrations WHERE id=?').bind(Number(name.split(':')[1])).first();
  if(c)navigation+=go(name,c.archangel+' '+(c.year||''),key===name);
 }
 if(key.startsWith('celebration:')){
  const id=key.split(':')[1];
  const steps=['Préparation','Mercredi','Jeudi','Vendredi','Samedi','Dimanche','Après célébration'];
  navigation+='<div class="d-nav">'+steps.filter(n=>known.has('celebration:'+id+':step:'+n)).map(n=>go('celebration:'+id+':step:'+n,n,key==='celebration:'+id+':step:'+n)).join('')+'</div>';
 }
 navigation+=go('programme','Programme',key==='programme')+go('bibliotheque','Médiathèque',key==='bibliotheque');
 if(key==='bibliotheque'||key.startsWith('catalogue-part:')){
  navigation+='<div class="d-nav">'+[...(allImports.results||[])].map(x=>x.source_key).filter(x=>x.startsWith('catalogue-part:')).map((k,i)=>go(k,'Fichiers '+(i+1),key===k)).join('')+'</div>';
 }
 if(key==='home'||key.startsWith('legal:'))navigation+=go('legal:mentions-legales','Mentions légales',key==='legal:mentions-legales')+go('legal:confidentialite','Confidentialité',key==='legal:confidentialite')+go('legal:cookies','Cookies',key==='legal:cookies');
 let html='';
 let celebrationDate='';
 if(p.celebration_id!==null){const dates=await env.DB.prepare('SELECT MIN(start_date) AS first, MAX(end_date) AS last FROM celebrations_steps WHERE celebration_id=?').bind(p.celebration_id).first();celebrationDate=dates?.first?when({start_date:dates.first,end_date:dates.last}):'';}
 for(const b of blocks){
  const fragment=await item(b,env.DB,{key,celebrationDate});
  html+='<div class="d-block" data-kind="'+esc(b.kind)+'">'+fragment+'</div>';
 }
 if(key==='home'){
  const hero='<div class="d-home-banner"><strong>INFORMATION IMPORTANTE — Le travail des psaumes a repris !</strong> Pensez à vérifier vos spams : nos messages, oracles et informations sur la Ronde des Archanges et Gabriel arrivent désormais depuis ronde-des-archanges@nation-essenienne.eu.</div>'+
   '<section class="d-welcome"><h1>Bienvenue sur le site de la Ronde des Archanges Universelle</h1><p>Retrouvez les célébrations, les psaumes et les ressources partagées.</p>'+
   '<img src="/media/media/celebrations-staging-welcome-autumn-2026.jpg" alt="Ronde des Archanges — coordonnées et couleurs d’automne">'+
   '<div class="d-welcome-actions">'+go('celebration:101','Accéder aux célébrations')+'<span class="d-muted-chip">Facebook · Bientôt disponible</span><span class="d-muted-chip">Instagram · Bientôt disponible</span></div></section>';
  html=hero+html;
 }
 if(key==='bibliotheque'){
   html+='<div class="d-choice-grid">'+[...(allImports.results||[])].map(x=>x.source_key)
    .filter(k=>k.startsWith('catalogue-part:')).map((k,i)=>'<a class="d-choice" href="'+esc(pageHref(k))+'">Ressources et images — '+(i+1)+'</a>').join('')+'</div>';
 }
 if(key==='programme'){
   const e=await env.DB.prepare('SELECT id,archangel,year FROM celebrations_celebrations ORDER BY year,id').all();
   html+='<section class="d-card"><h2>Les sept étapes et les rendez-vous</h2><div class="d-choice-grid">'+(e.results||[]).map(c=>'<a class="d-choice" href="'+esc(pageHref('celebration:'+c.id+':step:Mercredi'))+'">Archange '+esc(c.archangel)+' '+esc(c.year||'')+'</a>').join('')+'</div></section>';
 }
 if(key.startsWith('catalogue-part:'))html='<div class="d-gallery">'+html+'</div>';
 const page='< !doctype html>'.replace(' ','')+'<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>'+esc(rev.title)+' — Prévisualisation Célébrations</title><style>'+CSS+D2_STYLE+'</style></head><body class="'+(key==='home'?'d-home':'d-other')+'">'+
 '<div class="d-bar"><strong>PRÉVISUALISATION ADMINISTRATEUR — BROUILLON</strong><small>Non publié · staging uniquement · aucune modification possible ici</small></div>'+
 '<main class="d-shell"><div class="d-heading"><small>Ronde des Archanges Universelle / '+esc(imp.original_route)+'</small><h1>'+esc(rev.title)+'</h1></div>'+
 '<nav class="d-nav" aria-label="Navigation">'+navigation+'</nav><section class="d-content">'+html+'</section>'+
 '<footer class="d-footer">Célébrations — prévisualisation de travail, version historique non publiée.</footer></main></body></html>';
 return response(request.method==='HEAD'?null:page);
}
