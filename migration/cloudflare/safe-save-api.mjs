import {authorize} from "./auth-api.mjs";
const reply=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const ids=v=>Array.isArray(v)?[...new Set(v.map(String).filter(Boolean))]:[];
const text=v=>String(v??"");
const pick=(obj,fields)=>fields.map(k=>obj[k]??null);
// Cloudflare D1's free tier permits 50 SQL queries per Worker invocation.
// Group rows through D1-supported SQLite JSON functions, while retaining
// identical SQL conflict rules, one atomic batch, and a single bound JSON
// parameter per statement. No raw user-supplied SQL identifiers are accepted.
const insert=(table,fields,rows)=>{
 if(!rows.length)return [];
 const quoted=k=>'"'+k+'"';
 const cols=fields.map(quoted).join(",");
 const extracts=fields.map(k=>"json_extract(value, '$."+k+"')").join(",");
 const updated=fields.filter(k=>!["id","event_id","content_id","celebration_id","step_key"].includes(k));
 const conflict=updated.length
  ?"DO UPDATE SET "+updated.map(k=>quoted(k)+"=excluded."+quoted(k)).join(",")
  :"DO NOTHING";
 // WHERE true disambiguates SQLite's INSERT ... SELECT ... ON CONFLICT syntax.
 const sql='INSERT INTO "'+table+'" ('+cols+') SELECT '+extracts+' FROM json_each(?) WHERE true ON CONFLICT '+conflict;
 const out=[];
 let chunk=[],size=2;
 const flush=()=>{if(chunk.length){out.push({sql,args:[JSON.stringify(chunk)]});chunk=[];size=2}};
 for(const row of rows){
  const normalized=Object.fromEntries(fields.map(k=>[k,row[k]??null]));
  const encoded=JSON.stringify(normalized);
  if(chunk.length&&(chunk.length>=80||size+encoded.length+1>120000))flush();
  chunk.push(normalized);size+=encoded.length+1;
 }
 flush();
 return out;
};
export async function handleSafeSave(request,env){
 if(request.method!=="POST")return reply({ok:false,error:"Method not allowed"},405);
 if(!env.DB||!await authorize(request,env,true))return reply({ok:false,error:"Unauthorized"},401);
 let b;try{b=await request.json()}catch{return reply({ok:false,error:"Invalid JSON"},400)}
 // Explicit authenticated deletion, scoped to a single selected record.
 // All relational deletions are atomic; bytes in R2 are deliberately retained.
 if(b.action==="delete_event"||b.action==="delete_content"){
  const value=b.action==="delete_event"?b.event_id:b.content_id;
  if((typeof value!=="string"&&typeof value!=="number")||
     !String(value).trim()||String(value).length>128)
   return reply({ok:false,error:"Identifiant invalide."},400);
  const id=String(value);
  const event=b.action==="delete_event";
  const table=event?"celebrations_events":"celebrations_contents";
  try{
   const existing=await env.DB.prepare('SELECT id FROM "'+table+'" WHERE id=? LIMIT 1').bind(id).first();
   if(!existing)return reply({ok:false,error:"Élément introuvable. Rechargez la page."},404);
   const statements=event?[
    ["DELETE FROM celebrations_links WHERE event_id=?",id],
    ["DELETE FROM celebrations_event_contents WHERE event_id=?",id],
    ["DELETE FROM celebrations_events WHERE id=?",id]
   ]:[
    ["DELETE FROM celebrations_event_contents WHERE content_id=?",id],
    ["DELETE FROM celebrations_step_contents WHERE content_id=?",id],
    ["DELETE FROM celebrations_contents WHERE id=?",id]
   ];
   await env.DB.batch(statements.map(([sql,value])=>env.DB.prepare(sql).bind(value)));
   return reply({ok:true,deleted:true,kind:event?"event":"content",media_deleted:false});
  }catch{return reply({ok:false,error:"Suppression atomique impossible."},409)}
 }
 if(b.action==="unlink_event_content"){
  if(!b.event_id||!b.content_id)return reply({ok:false,error:"Invalid relation"},400);
  try{await env.DB.prepare("DELETE FROM celebrations_event_contents WHERE event_id=? AND content_id=?").bind(text(b.event_id),text(b.content_id)).run();return reply({ok:true,unlinked:true})}catch{return reply({ok:false,error:"Failed"},409)}
 }
 if(b.action!=="safe_merge"&&b.action!=="safe_merge_preview")return reply({ok:false,error:"Unknown action"},400);
 // A full snapshot is required: missing collections must never mean "empty".
 if(!b||typeof b!=="object"||!["contents","groups","celebrations","events"].every(k=>Array.isArray(b[k])))
  return reply({ok:false,error:"Sauvegarde refusée : données incomplètes."},400);
 const cs=Array.isArray(b.contents)?b.contents:[],gs=Array.isArray(b.groups)?b.groups:[],cels=Array.isArray(b.celebrations)?b.celebrations:[],evs=Array.isArray(b.events)?b.events:[];
 const celebrationIds=new Set(cels.map(c=>Number(c.id)));
 if(cels.some(c=>!Number.isSafeInteger(Number(c.id))||!Array.isArray(c.days))||evs.some(e=>!celebrationIds.has(Number(e.celebrationId))))
  return reply({ok:false,error:"Sauvegarde refusée : célébration ou événements incomplets."},400);
 if([cs,gs,cels,evs].some(a=>a.length>1500))return reply({ok:false,error:"Payload too large"},413);
 // The client submits a complete snapshot. Refuse malformed link arrays so a
 // partial payload cannot accidentally remove links during reconciliation.
 if(cels.some(c=>(c.days||[]).some(d=>!Array.isArray(d.links)))||evs.some(e=>!Array.isArray(e.links)))
  return reply({ok:false,error:"Snapshot de liens incomplet. Aucune modification enregistrée."},409);
 const normalizedLinks=[];
 for(const c of cels)for(const d of c.days||[]){
  for(const [i,l] of d.links.entries()){
   if(!l?.url||typeof l.url!=="string")return reply({ok:false,error:"Lien de journée invalide."},400);
   normalizedLinks.push({celebration_id:Number(c.id),step_key:text(d.key),event_id:null,label:text(l.label),url:l.url,link_type:text(l.kind||"link"),sort_order:i});
  }
 }
 for(const e of evs)for(const [i,l] of e.links.entries()){
  if(!l?.url||typeof l.url!=="string")return reply({ok:false,error:"Lien d’événement invalide."},400);
  normalizedLinks.push({celebration_id:Number(e.celebrationId),step_key:text(e.dayKey),event_id:text(e.id),label:text(l.label),url:l.url,link_type:text(l.kind||"link"),sort_order:i});
 }
 if(normalizedLinks.length>1500)return reply({ok:false,error:"Trop de liens."},413);
 const now=new Date().toISOString(),jobs=[];
 const add=(table,fields,rows)=>jobs.push(...insert(table,fields,rows));
 add("celebrations_groups",["id","name","sort_order","is_system","updated_at"],gs.map((g,i)=>({id:text(g.id),name:text(g.name),sort_order:i,is_system:["all","angel","nonangel"].includes(text(g.id))?1:0,updated_at:now})));
 add("celebrations_celebrations",["id","archangel","year","status","updated_at"],cels.map(c=>({id:Number(c.id),archangel:text(c.archangel),year:text(c.year),status:text(c.status||"planned"),updated_at:now})));
 add("celebrations_contents",["id","name","content_type","source_type","audience","storage_path","external_url","file_name","mime_type","has_cover","cover_storage_path","audio_kind","description","inline_text","category","cover_file_name","updated_at"],cs.map(c=>({id:text(c.id),name:text(c.name),content_type:text(c.type||c.content_type),source_type:text(c.sourceType||c.source_type),audience:text(c.audience||"all"),storage_path:c.storagePath||null,external_url:c.url||null,file_name:c.fileName||null,mime_type:c.mimeType||null,has_cover:c.hasCover?1:0,cover_storage_path:c.hasCover?c.coverStoragePath||null:null,audio_kind:c.audioKind||null,description:text(c.description),inline_text:text(c.text),category:text(c.category),cover_file_name:c.hasCover?c.coverFileName||null:null,updated_at:now})));
 const steps=cels.flatMap(c=>(c.days||[]).map((d,i)=>({celebration_id:Number(c.id),step_key:text(d.key),label:text(d.label),start_date:d.startDate||null,end_date:d.endDate||null,body_text:text(d.text),sort_order:i})));
 // Steps use an explicit unique (celebration_id,step_key) staging migration.
 add("celebrations_steps",["celebration_id","step_key","label","start_date","end_date","body_text","sort_order"],steps);
 add("celebrations_events",["id","celebration_id","step_key","title","event_time","description","audience","sort_order","updated_at"],evs.map((e,i)=>({id:text(e.id),celebration_id:Number(e.celebrationId),step_key:text(e.dayKey),title:text(e.title),event_time:e.time||null,description:text(e.description),audience:text(e.audience||"all"),sort_order:i,updated_at:now})));
 // Reconcile REMOVED associations as well as additions, preserving all
 // other celebrations/events and all library contents. Previously an admin
 // could press "Retirer" then "Enregistrer" but the stale D1 association
 // survived the upsert. Delete ONLY missing pairs belonging to the complete
 // submitted snapshot. All statements run in the SAME atomic batch.
 // Missing collections have already been rejected above; this never deletes
 // unrelated celebrations' associations or media in R2.
 const desiredDayLinks=cels.flatMap(c=>(c.days||[]).flatMap(d=>
  ids(d.contentIds).map(contentId=>({
   celebration_id:Number(c.id),step_key:text(d.key),content_id:contentId
  }))));
 const desiredEventLinks=evs.flatMap(e=>
  ids(e.contentIds).map(contentId=>({event_id:text(e.id),content_id:contentId})));
 if(cels.length){
  jobs.push({sql:"DELETE FROM celebrations_step_contents WHERE celebration_id IN (SELECT value FROM json_each(?)) AND NOT EXISTS (SELECT 1 FROM json_each(?) AS wanted WHERE CAST(json_extract(wanted.value,'$.celebration_id') AS INTEGER)=celebrations_step_contents.celebration_id AND json_extract(wanted.value,'$.step_key')=celebrations_step_contents.step_key AND json_extract(wanted.value,'$.content_id')=celebrations_step_contents.content_id)",
   args:[JSON.stringify(cels.map(c=>Number(c.id))),JSON.stringify(desiredDayLinks)]});
 }
 if(evs.length){
  jobs.push({sql:"DELETE FROM celebrations_event_contents WHERE event_id IN (SELECT value FROM json_each(?)) AND NOT EXISTS (SELECT 1 FROM json_each(?) AS wanted WHERE json_extract(wanted.value,'$.event_id')=celebrations_event_contents.event_id AND json_extract(wanted.value,'$.content_id')=celebrations_event_contents.content_id)",
   args:[JSON.stringify(evs.map(e=>text(e.id))),JSON.stringify(desiredEventLinks)]});
 }
 add("celebrations_step_contents",["celebration_id","step_key","content_id","sort_order"],cels.flatMap(c=>(c.days||[]).flatMap(d=>ids(d.contentIds).map((id,i)=>({celebration_id:Number(c.id),step_key:text(d.key),content_id:id,sort_order:i})))));
 add("celebrations_event_contents",["event_id","content_id","sort_order"],evs.flatMap(e=>ids(e.contentIds).map((id,i)=>({event_id:text(e.id),content_id:id,sort_order:i}))));
 // Replace only links belonging to celebrations included in this snapshot.
 // D1 batch commits deletions and inserts together, avoiding partial writes.
 for(const c of cels)jobs.push({sql:"DELETE FROM celebrations_links WHERE celebration_id=?",args:[Number(c.id)]});
 normalizedLinks.forEach(l=>jobs.push({sql:"INSERT INTO celebrations_links (celebration_id,step_key,event_id,label,url,link_type,sort_order) VALUES (?,?,?,?,?,?,?)",args:[l.celebration_id,l.step_key,l.event_id,l.label,l.url,l.link_type,l.sort_order]}));
 // Authorization already consumes one D1 query. Never send a batch that
 // would silently exceed the free-tier query budget (50 per invocation).
 if(jobs.length>48)return reply({ok:false,error:"Sauvegarde trop volumineuse pour Cloudflare : fractionnement nécessaire."},413);
 // Admin-only preflight: validate exactly the same serialized snapshot without
 // touching any programme, event, content, participant or media record.
 if(b.action==="safe_merge_preview")return reply({ok:true,dry_run:true,statements:jobs.length,
   counts:{groups:gs.length,celebrations:cels.length,events:evs.length,contents:cs.length,
    steps:steps.length,event_content_links:evs.reduce((n,e)=>n+ids(e.contentIds).length,0)}
 });
 try{
  // D1 batch is transactional: either all statements commit or none.
  await env.DB.batch(jobs.map(j=>env.DB.prepare(j.sql).bind(...j.args)));
  return reply({ok:true,safe:true,rows:jobs.length});
 }catch{return reply({ok:false,error:"Atomic merge failed"},409)}
}
