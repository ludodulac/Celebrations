// E1: minimal visual editing of TWO actual C-imported historical pages.
// No publication, no changes to celebrations_* source tables, no new tables.
// Reuses B/C revision snapshots; rich source payloads remain intact.
import {authorize} from './auth-api.mjs';
import {snapshot,save} from './editor-b-api.mjs';
const HOST='celebrations-exit-staging.rondes.workers.dev';
const PILOTS=new Set(['home','celebration:101:step:Mercredi']);
const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store',
 'x-content-type-options':'nosniff','x-robots-tag':'noindex,nofollow'
}});
const err=(message,status=400)=>json({ok:false,error:message},status);
const text=(v,max=3000)=>typeof v==='string'&&v.length<=max&&
 !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v);
const url=v=>typeof v==='string'&&v.length<800&&
 ((v.startsWith('/')&&!v.startsWith('//')&&!v.includes('\\'))||/^https:\/\/[^\s"'<>]+$/i.test(v));
const allowedFields={
 'static_html_snapshot':['heading','subtitle','banner','button_label','button_href','hero_image_id'],
 'legacy_event':['title','description'],
 'legacy_day':['body_text'],
 'title':['text'],
 'text':['text'],
 'button':['text','url']
};
const sourceValues=(b)=>{
 const overlay=b.data?.e1||{};
 switch(b.kind){
 case 'static_html_snapshot':return {heading:overlay.heading??'Bienvenue sur le site de la Ronde des Archanges Universelle',
  subtitle:overlay.subtitle??'Retrouvez les célébrations, les psaumes et les ressources partagées.',
  banner:overlay.banner??'INFORMATION IMPORTANTE — Le travail des psaumes a repris !',
  button_label:overlay.button_label??'Accéder aux célébrations',
  button_href:overlay.button_href??'/__editor/preview?key=celebration%3A101',
  hero_image_id:overlay.hero_image_id??''};
 case 'legacy_event':return {title:overlay.title??b.data?.record?.title??'',description:overlay.description??b.data?.record?.description??''};
 case 'legacy_day':return {body_text:overlay.body_text??b.data?.record?.body_text??''};
 case 'title':case 'text':return {text:overlay.text??b.data?.text??''};
 case 'button':return {text:overlay.text??b.data?.text??'',url:overlay.url??b.data?.url??''};
 default:return null;
 }
};
function editable(b,key){
 if(key==='home')return (b.kind==='static_html_snapshot'&&b.source_table==='static')||
  (b.kind==='text'&&!b.source_table&&!b.source_id); // B draft only: never an imported historical text.
 if(key==='celebration:101:step:Mercredi')return ['legacy_event','legacy_day','title','text','button'].includes(b.kind);
 return false;
}
async function context(db,key){
 if(!PILOTS.has(key))return null;
 const imp=await db.prepare('SELECT page_id FROM editor_c_imports WHERE source_key=?').bind(key).first();
 if(!imp)return null;
 const page=await db.prepare('SELECT id,head_version,draft_version,published_version FROM editor_b_pages WHERE id=?').bind(imp.page_id).first();
 return page||null;
}
async function view(db,key,page){
 const snap=await snapshot(db,page.id,page.draft_version);
 if(!snap)return null;
 return {ok:true,key,title:snap.title,version:page.head_version,published:false,
  editable:snap.blocks.filter(b=>editable(b,key)).map(b=>({
   id:b.block_id,kind:b.kind,values:sourceValues(b),label:b.kind==='legacy_event'?'Rendez-vous':b.kind==='legacy_day'?'Texte du jour':'Accueil'
  }))};
}
const validate=(kind,values)=>{
 if(!values||typeof values!=='object'||Array.isArray(values))return false;
 const valid=allowedFields[kind];
 if(!valid||Object.keys(values).some(k=>!valid.includes(k)))return false;
 for(const [key,value] of Object.entries(values)){
  if(!text(value,key==='description'||key==='body_text'?3800: key==='banner'?1600: key==='subtitle'?1600:800))return false;
  if((key==='button_href'||key==='url')&&!url(value))return false;
  if(key==='hero_image_id'&&value.length>160)return false;
 }
 return true;
};
export async function handleEditorE1(request,env){
 const u=new URL(request.url);
 if(u.hostname!==HOST)return err('Not found',404);
 if(!env.DB)return err('Test unavailable',503);
 // Real active administrator session required. The preview's technical QA
 // token and its viewer cookie are NOT sufficient to edit data.
 const admin=await authorize(request,env,true);
 if(!admin)return err('Connexion administrateur nécessaire',401);
 const key=request.method==='GET'?u.searchParams.get('key'):null;
 if(request.method==='GET'){
  const p=await context(env.DB,key);
  if(!p)return err('Cette page n’est pas encore modifiable',404);
  const action=u.searchParams.get('action')||'page';
  if(action==='page')return json(await view(env.DB,key,p));
  if(action==='versions'){
   const list=await env.DB.prepare('SELECT version,operation,created_at,source_version FROM editor_b_revisions WHERE page_id=? ORDER BY version DESC LIMIT 25').bind(p.id).all();
   return json({ok:true,key,version:p.head_version,versions:list.results||[]});
  }
  if(action==='images'&&key==='home'){
   const imgs=await env.DB.prepare("SELECT id,name,content_type FROM celebrations_contents WHERE audience='all' AND source_type='file' AND LOWER(content_type)='image' AND storage_path IS NOT NULL ORDER BY name LIMIT 70").all();
   return json({ok:true,images:(imgs.results||[]).map(x=>({id:x.id,name:x.name||'Image existante'}))});
  }
  return err('Action non disponible',404);
 }
 if(request.method!=='POST')return err('Méthode non autorisée',405);
 const raw=await request.text();
 if(raw.length>14000)return err('Modifications trop longues',413);
 let b;try{b=JSON.parse(raw)}catch{return err('Demande invalide')};
 if(!b||!PILOTS.has(b.key))return err('Cette page n’est pas encore modifiable',404);
 const p=await context(env.DB,b.key);
 if(!p)return err('Page introuvable',404);
 if(!Number.isSafeInteger(b.expected_version)||b.expected_version!==p.head_version)return err('Page modifiée ailleurs. Rechargez-la avant d’enregistrer.',409);
 const snap=await snapshot(env.DB,p.id,p.draft_version);
 if(!snap)return err('Brouillon introuvable',503);
 let blocks=snap.blocks.map(x=>({...x}));
 if(b.action==='restore'){
  if(!Number.isSafeInteger(b.source_version)||b.source_version<1||b.source_version>p.head_version)return err('Version inconnue',400);
  const historical=await snapshot(env.DB,p.id,b.source_version);
  if(!historical)return err('Version introuvable',404);
  blocks=historical.blocks;
  const restored=await save(env.DB,p,b.expected_version,historical.title,blocks,'restore',b.source_version);
  return restored;
 }
 if(b.action!=='save')return err('Action non autorisée',400);
 const changes=b.changes;
 // E2A: permit exactly ONE new paragraph per save on the imported home page.
 // Never mutate historic rows, associations or source blocks.
 const adding=Object.hasOwn(b,'paragraph_text');
 if(adding&&(b.key!=='home'||!text(b.paragraph_text,4000)||!b.paragraph_text.trim()))
  return err('Saisissez le texte du paragraphe sur l’accueil.',400);
 if(!Array.isArray(changes)||changes.length>30||(!changes.length&&!adding))
  return err('Sélectionnez un texte à modifier',400);
 const ids=new Set();
 for(const entry of changes){
  if(!entry||typeof entry.id!=='string'||ids.has(entry.id))return err('Bloc invalide');
  ids.add(entry.id);
  const blk=blocks.find(x=>x.block_id===entry.id);
  if(!blk||!editable(blk,b.key)||!validate(blk.kind,entry.values))return err('Ce contenu ne peut pas être modifié ici',400);
  if(entry.values.hero_image_id){
   const im=await env.DB.prepare("SELECT id FROM celebrations_contents WHERE id=? AND audience='all' AND source_type='file' AND LOWER(content_type)='image' AND storage_path IS NOT NULL").bind(entry.values.hero_image_id).first();
   if(!im)return err('Image indisponible',400);
  }
  const base=sourceValues(blk);
  const values={...base,...entry.values};
  // Preserve data.record, original source IDs, associations, links and order.
  blk.data={...blk.data,e1:values};
 }
 if(adding){
  if(blocks.length>=64)return err('Cette page a atteint le nombre maximal de blocs.',400);
  blocks.push({block_id:crypto.randomUUID(),kind:'text',data:{text:b.paragraph_text.trim()}});
 }
 // B/C transactional revision copies historic blocks intact, adding only
 // the new text block to the staging draft. Never publishes.
 return save(env.DB,p,b.expected_version,snap.title,blocks,'edit');
}
