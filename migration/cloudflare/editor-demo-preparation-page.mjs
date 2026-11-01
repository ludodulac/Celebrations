// SEVEN PROGRAMME PAGES DEMO: read-only staging import of already-public historical records.
// All modifications by the demo client stay in this browser; D1 is never written.
import {DEMO_CSS} from './editor-demo-style.mjs';
import {DEMO_CLIENT} from './editor-demo-client.mjs';
const HOST='celebrations-exit-staging.rondes.workers.dev';
export const STAGES=[
 {label:'Préparation',slug:'preparation'},
 {label:'Mercredi',slug:'mercredi'},
 {label:'Jeudi',slug:'jeudi'},
 {label:'Vendredi',slug:'vendredi'},
 {label:'Samedi',slug:'samedi'},
 {label:'Dimanche',slug:'dimanche'},
 {label:'Après célébration',slug:'apres-celebration'}
];
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
// Public staging rows only. Shared with the site-shaped preview; never writes D1.
export async function loadSevenStageContent(env,selectedId){
  const celebrations=await rows(env.DB,'SELECT id,archangel,year,status FROM celebrations_celebrations ORDER BY id');
  const allowedIds=new Set(celebrations.map(c=>String(c.id)));
  const selected=selectedId;
  if(selected&&!allowedIds.has(selected))throw new Error('Unknown celebration');
  const celebration=celebrations.find(c=>String(c.id)===(selected||'101'))||celebrations[0];
  if(!celebration)throw new Error('No celebration');
  const steps=await rows(env.DB,'SELECT * FROM celebrations_steps WHERE celebration_id=? ORDER BY sort_order,id',celebration.id);
  // One bulk, read-only fetch per public content table, then exact step-key grouping.
  // No private audience, committee resources, D1 writes, publication or production calls.
  const [events,evc,stc,links]=await Promise.all([
   rows(env.DB,"SELECT * FROM celebrations_events WHERE celebration_id=? AND audience='all' ORDER BY sort_order,event_time,id",celebration.id),
   rows(env.DB,"SELECT ec.event_id,ec.sort_order,c.* FROM celebrations_event_contents ec JOIN celebrations_events e ON e.id=ec.event_id JOIN celebrations_contents c ON c.id=ec.content_id WHERE e.celebration_id=? AND e.audience='all' AND c.audience='all' ORDER BY e.sort_order,ec.sort_order,c.id",celebration.id),
   rows(env.DB,"SELECT sc.step_key,sc.sort_order,c.* FROM celebrations_step_contents sc JOIN celebrations_contents c ON c.id=sc.content_id WHERE sc.celebration_id=? AND c.audience='all' ORDER BY sc.step_key,sc.sort_order,c.id",celebration.id),
   rows(env.DB,"SELECT * FROM celebrations_links WHERE celebration_id=? OR event_id IN (SELECT id FROM celebrations_events WHERE celebration_id=? AND audience='all') ORDER BY sort_order,id",celebration.id,celebration.id)
  ]);
  const pages=STAGES.map(stage=>{
   const record=steps.find(s=>clean(s.label)===clean(stage.label)||clean(s.step_key)===stage.slug+'-'+celebration.id);
   const id=stage.slug+'-'+celebration.id;
   if(!record)return {id,name:stage.label,group:'celebration',blocks:[{id:1,kind:'heading',text:stage.label,align:'center'},{id:2,kind:'text',text:'Aucun contenu historique enregistré pour cette étape.',align:'left'}]};
   const key=record.step_key;
   const dayEvents=events.filter(e=>e.step_key===key).sort(sort);
   const allowedIds=new Set(dayEvents.map(e=>String(e.id)));
   const dayLinks=links.filter(l=>l.event_id?allowedIds.has(String(l.event_id)):(String(l.celebration_id)===String(celebration.id)&&l.step_key===key));
   const dayEventContents=evc.filter(c=>allowedIds.has(String(c.event_id)));
   const dayStepContents=stc.filter(c=>c.step_key===key);
   return {id,name:stage.label,group:'celebration',blocks:toBlocks(celebration,record,dayEvents,dayEventContents,dayStepContents,dayLinks)};
  });
  const seed={celebrationId:celebration.id,pages};
  return {celebrations,celebration,seed};
}
export async function handlePreparationDemo(request,env){
 const url=new URL(request.url);
 if(url.hostname!==HOST)return new Response('Not found',{status:404});
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 if(!env.DB)return new Response('Démonstration momentanément indisponible',{status:503});
 try{
  const {celebrations,celebration,seed}=await loadSevenStageContent(env,url.searchParams.get('celebration'));
  // Reuse the proven editor, but isolate its localStorage key from the fictional demo.
  const client=DEMO_CLIENT
   .replace("const KEY='celebrations-demo-editor-v1'","const KEY='celebrations-demo-preparation-'+String(window.__PREPARATION_SEED__.celebrationId)")
   .replace("const clone=o=>JSON.parse(JSON.stringify(o));","seed.pages=window.__PREPARATION_SEED__.pages;\nconst clone=o=>JSON.parse(JSON.stringify(o));")
   // Preserve earlier local edits to Préparation, while inserting the six other historical pages.
   .replace("if(!db||!Array.isArray(db.pages))db=clone(seed);",
            "if(!db||!Array.isArray(db.pages))db=clone(seed);\nfor(const archived of seed.pages){if(!db.pages.some(p=>p.id===archived.id))db.pages.push(clone(archived));}")
   .replace("Choisir une page d’exemple","Les sept étapes de la célébration")
   .replace("function render(){","function render(){const see=document.getElementById('view-site-btn');if(see){const current=page();const stage=String(current.id).slice(0,String(current.id).lastIndexOf('-'));see.href='/__editor/voir-le-site?celebration='+encodeURIComponent(window.__PREPARATION_SEED__.celebrationId)+'&page='+encodeURIComponent(stage);}")
   .replace("el('save-btn').onclick=save;","el('save-btn').onclick=save;const see=document.getElementById('view-site-btn');if(see)see.onclick=()=>{if(dirty)save()};")
   .replace('z.innerText.slice(0,5000)','z.innerText.slice(0,50000)');
  if(!client.includes("window.__PREPARATION_SEED__.pages")||!client.includes("for(const archived of seed.pages)"))throw Error('Demo client adapter failed');
  const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
  const choices=celebrations.map(c=>'<option value="'+escapeHtml(c.id)+'"'+(String(c.id)===String(celebration.id)?' selected':'')+'>'+escapeHtml(c.archangel+' '+(c.year||''))+'</option>').join('');
  const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Les sept étapes — atelier Célébrations</title><style nonce="'+nonce+'">'+DEMO_CSS+'</style></head><body>'+
  '<div class="shell stage-editor"><aside class="rail"><div class="brand"><div class="mark">✦</div><div><strong>Célébrations</strong><small>Atelier visuel</small></div></div><nav aria-label="Navigation"><a class="navbtn active" style="text-decoration:none" href="/__editor/demo">← Atelier principal</a><button class="navbtn active" data-tab="pages">▤ Les sept étapes</button><button class="navbtn" data-tab="media">▧ Fichiers</button></nav><div class="bottom"><b>Copie de démonstration</b><br>Lecture uniquement des données publiques présentes dans la base de test. Aucun changement sur le site officiel.</div></aside>'+
  '<div class="content"><header class="topbar"><div><h1 id="section-title">Les sept étapes — '+escapeHtml(celebration.archangel)+' '+escapeHtml(celebration.year||'')+'</h1><p>Les sept pages reprennent les textes, rendez-vous, documents et liens publics de la base de test.</p></div><div class="actions"><span class="badge">DÉMONSTRATION</span><button id="preview-btn" class="btn sm">Aperçu</button><button id="save-btn" class="btn primary">Enregistrer</button><a id="view-site-btn" class="btn view-site-btn" href="/__editor/voir-le-site" target="_blank" rel="noopener noreferrer">Voir le site ↗</a></div></header>'+
  '<main class="main"><div class="notice"><b>ⓘ Contenus historiques de test, sans modification du serveur.</b> Les contenus publics sont repris depuis la copie de test du site. Les contenus réservés et les changements plus récents du site officiel ne sont pas inclus. Vos modifications restent sur cet appareil, sans toucher au site officiel ni aux 47 pages historiques.</div><label for="celebration-choice"><b>Choisir la célébration :</b></label> <select id="celebration-choice" class="btn" style="max-width:350px;margin-bottom:20px">'+choices+'</select><div id="workspace"></div><p class="status" id="status" role="status" aria-live="polite"></p></main></div></div>'+
  '<input id="image-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>'+
  '<style nonce="'+nonce+'">.stage-editor .list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;overflow:visible}.stage-editor .list .item{white-space:normal;min-height:44px}.stage-editor .layout{grid-template-columns:minmax(210px,260px) minmax(0,1fr)}@media(max-width:850px){.stage-editor .layout{grid-template-columns:1fr}.stage-editor .list{grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}}</style>'+
  '<script nonce="'+nonce+'">window.__PREPARATION_SEED__='+jsSafe(seed)+';document.getElementById("celebration-choice").addEventListener("change",e=>location.assign("/__editor/demo-preparation?celebration="+encodeURIComponent(e.target.value)));</script>'+
  '<script nonce="'+nonce+'">'+client+'</script></body></html>';
  return new Response(request.method==='HEAD'?null:html,{headers:{...noCache,'content-security-policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; img-src 'self' data: blob:; connect-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"}});
 }catch(e){const notFound=e?.message==='Unknown celebration'||e?.message==='No celebration';return new Response(notFound?'Célébration introuvable':'Données de préparation indisponibles',{status:notFound?404:503,headers:{'cache-control':'no-store'}});}
}
