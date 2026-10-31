// PREPARATION DEMO: read-only staging import of already-public historical records.
// All modifications by the demo client stay in this browser; D1 is never written.
import {DEMO_CSS} from './editor-demo-style.mjs';
import {DEMO_CLIENT} from './editor-demo-client.mjs';
const HOST='celebrations-exit-staging.rondes.workers.dev';
const clean=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const sort=(a,b)=>Number(a.sort_order??999)-Number(b.sort_order??999)||String(a.event_time??'').localeCompare(String(b.event_time??''),'fr')||String(a.id??'').localeCompare(String(b.id??''),'fr');
const asText=x=>String(x??'');
const validStorage=x=>typeof x==='string'&&x.length>0&&x.length<1024&&!x.startsWith('/')&&!x.startsWith('committee/')&&!/^https?:/i.test(x)&&!x.split('/').some(p=>!p||p==='..'||p==='.')&&!/[\\\u0000-\u001f]/.test(x);
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
  if(href&&kind!=='image')add('button',kind==='audio'?'Écouter : '+(c.name||'Audio'):kind.includes('vid')?'Voir : '+(c.name||'Vidéo'):kind==='pdf'?'Ouvrir le PDF : '+(c.name||'Document'):'Ouvrir : '+(c.name||'Document'),{href});
  else if(href&&kind==='image'&&source!=='file')add('button','Voir l’image : '+(c.name||'Image'),{href});
  if(!href&&c.external_url&&safeLink(c.external_url))add('button','Lien : '+(c.name||'Document'),{href:safeLink(c.external_url)});
 }
 function date(x){return x?asText(x):'';}
 add('heading',step.label||'Préparation');
 if(step.start_date||step.end_date)add('text','Dates : '+date(step.start_date)+(step.end_date&&step.end_date!==step.start_date?' → '+date(step.end_date):''));
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
export async function handlePreparationDemo(request,env){
 const url=new URL(request.url);
 if(url.hostname!==HOST)return new Response('Not found',{status:404});
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 if(!env.DB)return new Response('Démonstration momentanément indisponible',{status:503});
 try{
  const celebrations=await rows(env.DB,'SELECT id,archangel,year,status FROM celebrations_celebrations ORDER BY id');
  const allowedIds=new Set(celebrations.map(c=>String(c.id)));
  const selected=url.searchParams.get('celebration');
  if(selected&&!allowedIds.has(selected))return new Response('Célébration introuvable',{status:404});
  const celebration=celebrations.find(c=>String(c.id)===(selected||'101'))||celebrations[0];
  if(!celebration)return new Response('Aucune célébration disponible',{status:404});
  const steps=await rows(env.DB,'SELECT * FROM celebrations_steps WHERE celebration_id=? ORDER BY sort_order,id',celebration.id);
  const step=steps.find(s=>clean(s.label)==='preparation'||clean(s.step_key)==='preparation-'+celebration.id);
  if(!step)return new Response('Étape Préparation absente de cet import',{status:404});
  const key=step.step_key;
  const [events,evc,stc,links]=await Promise.all([
   rows(env.DB,"SELECT * FROM celebrations_events WHERE celebration_id=? AND step_key=? AND audience='all' ORDER BY sort_order,event_time,id",celebration.id,key),
   rows(env.DB,"SELECT ec.event_id,ec.sort_order,c.* FROM celebrations_event_contents ec JOIN celebrations_events e ON e.id=ec.event_id JOIN celebrations_contents c ON c.id=ec.content_id WHERE e.celebration_id=? AND e.step_key=? AND e.audience='all' AND c.audience='all' ORDER BY e.sort_order,ec.sort_order,c.id",celebration.id,key),
   rows(env.DB,"SELECT sc.sort_order,c.* FROM celebrations_step_contents sc JOIN celebrations_contents c ON c.id=sc.content_id WHERE sc.celebration_id=? AND sc.step_key=? AND c.audience='all' ORDER BY sc.sort_order,c.id",celebration.id,key),
   rows(env.DB,"SELECT * FROM celebrations_links WHERE (celebration_id=? AND step_key=?) OR event_id IN (SELECT id FROM celebrations_events WHERE celebration_id=? AND step_key=? AND audience='all') ORDER BY sort_order,id",celebration.id,key,celebration.id,key)
  ]);
  const safeEventIds=new Set(events.map(e=>String(e.id)));
  const publicLinks=links.filter(l=>!l.event_id||safeEventIds.has(String(l.event_id)));
  const blocks=toBlocks(celebration,step,events,evc,stc,publicLinks);
  const seed={celebrationId:celebration.id,pages:[{id:'preparation-'+celebration.id,name:step.label||'Préparation',group:'celebration',blocks}]};
  // Reuse the proven editor, but isolate its localStorage key from the fictional demo.
  const client=DEMO_CLIENT
   .replace("const KEY='celebrations-demo-editor-v1'","const KEY='celebrations-demo-preparation-'+String(window.__PREPARATION_SEED__.celebrationId)")
   .replace("const clone=o=>JSON.parse(JSON.stringify(o));","seed.pages=window.__PREPARATION_SEED__.pages;\nconst clone=o=>JSON.parse(JSON.stringify(o));")
   .replace('z.innerText.slice(0,5000)','z.innerText.slice(0,50000)');
  if(!client.includes("window.__PREPARATION_SEED__.pages"))throw Error('Demo client adapter failed');
  const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
  const choices=celebrations.map(c=>'<option value="'+escapeHtml(c.id)+'"'+(String(c.id)===String(celebration.id)?' selected':'')+'>'+escapeHtml(c.archangel+' '+(c.year||''))+'</option>').join('');
  const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Préparation réelle — atelier Célébrations</title><style nonce="'+nonce+'">'+DEMO_CSS+'</style></head><body>'+
  '<div class="shell"><aside class="rail"><div class="brand"><div class="mark">✦</div><div><strong>Célébrations</strong><small>Atelier visuel</small></div></div><nav aria-label="Navigation"><a class="navbtn active" style="text-decoration:none" href="/__editor/demo">← Atelier principal</a><span class="navbtn active">▤ Préparation existante</span></nav><div class="bottom"><b>Copie de démonstration</b><br>Lecture uniquement des données publiques présentes dans la base de test. Aucun changement sur le site officiel.</div></aside>'+
  '<div class="content"><header class="topbar"><div><h1 id="section-title">Préparation — '+escapeHtml(celebration.archangel)+' '+escapeHtml(celebration.year||'')+'</h1><p>Les blocs reprennent les textes, rendez-vous, documents et liens publics de la base de test.</p></div><div class="actions"><span class="badge">DÉMONSTRATION</span><button id="preview-btn" class="btn sm">Aperçu</button><button id="save-btn" class="btn primary">Enregistrer</button></div></header>'+
  '<main class="main"><div class="notice"><b>ⓘ Exemple réel en lecture seule du serveur.</b> Seuls les contenus accessibles au public sont repris. Les contenus réservés nécessitent un accès authentifié. Vos modifications restent sur cet appareil, sans toucher au site officiel ni aux 47 pages historiques.</div><label for="celebration-choice"><b>Choisir la célébration :</b></label> <select id="celebration-choice" class="btn" style="max-width:350px;margin-bottom:20px">'+choices+'</select><div id="workspace"></div><p class="status" id="status" role="status" aria-live="polite"></p></main></div></div>'+
  '<input id="image-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>'+
  '<script nonce="'+nonce+'">window.__PREPARATION_SEED__='+jsSafe(seed)+';document.getElementById("celebration-choice").addEventListener("change",e=>location.assign("/__editor/demo-preparation?celebration="+encodeURIComponent(e.target.value)));</script>'+
  '<script nonce="'+nonce+'">'+client+'</script></body></html>';
  return new Response(request.method==='HEAD'?null:html,{headers:{...noCache,'content-security-policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; img-src 'self' data: blob:; connect-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"}});
 }catch{return new Response('Données de préparation indisponibles',{status:503,headers:{'cache-control':'no-store'}});}
}
