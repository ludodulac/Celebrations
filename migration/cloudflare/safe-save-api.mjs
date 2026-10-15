import {authorize} from "./auth-api.mjs";
const reply=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const ids=v=>Array.isArray(v)?[...new Set(v.map(String).filter(Boolean))]:[];
const text=v=>String(v??"");
const pick=(obj,fields)=>fields.map(k=>obj[k]??null);
const insert=(table,fields,rows)=>rows.map(row=>({sql:`INSERT INTO "${table}" (${fields.map(k=>'"'+k+'"').join(",")}) VALUES (${fields.map(()=>"?").join(",")}) ON CONFLICT DO UPDATE SET ${fields.filter(k=>!["id","event_id","content_id","celebration_id","step_key"].includes(k)).map(k=>'"'+k+'"=excluded."'+k+'"').join(",")}`,args:pick(row,fields)}));
export async function handleSafeSave(request,env){
 if(request.method!=="POST")return reply({ok:false,error:"Method not allowed"},405);
 if(!env.DB||!await authorize(request,env,true))return reply({ok:false,error:"Unauthorized"},401);
 let b;try{b=await request.json()}catch{return reply({ok:false,error:"Invalid JSON"},400)}
 if(b.action==="unlink_event_content"){
  if(!b.event_id||!b.content_id)return reply({ok:false,error:"Invalid relation"},400);
  try{await env.DB.prepare("DELETE FROM celebrations_event_contents WHERE event_id=? AND content_id=?").bind(text(b.event_id),text(b.content_id)).run();return reply({ok:true,unlinked:true})}catch{return reply({ok:false,error:"Failed"},409)}
 }
 if(b.action!=="safe_merge")return reply({ok:false,error:"Unknown action"},400);
 const cs=Array.isArray(b.contents)?b.contents:[],gs=Array.isArray(b.groups)?b.groups:[],cels=Array.isArray(b.celebrations)?b.celebrations:[],evs=Array.isArray(b.events)?b.events:[];
 if([cs,gs,cels,evs].some(a=>a.length>1500))return reply({ok:false,error:"Payload too large"},413);
 // Staging safety: never report a successful save when links are present but
 // their synchronization is not implemented. This prevents silent data loss.
 const linkCount=cels.reduce((n,c)=>n+(c.days||[]).reduce((m,d)=>m+(d.links||[]).length,0),0)+evs.reduce((n,e)=>n+(e.links||[]).length,0);
 if(linkCount)return reply({ok:false,error:"Sauvegarde bloquée : la synchronisation des liens n’est pas encore disponible sur le site de test. Aucune modification enregistrée."},409);
 // Even an empty incoming link list cannot prove that the database has no
 // links: a stale/incomplete client snapshot must never silently bypass guard.
 try{
  const existing=await env.DB.prepare("SELECT COUNT(*) AS count FROM celebrations_links").first();
  if(Number(existing?.count||0)>0)return reply({ok:false,error:"Sauvegarde bloquée : des liens existent dans la base Cloudflare et leur synchronisation doit être terminée avant toute modification."},409);
 }catch{return reply({ok:false,error:"Vérification des liens indisponible. Aucune modification enregistrée."},503)}
 const now=new Date().toISOString(),jobs=[];
 const add=(table,fields,rows)=>jobs.push(...insert(table,fields,rows));
 add("celebrations_groups",["id","name","sort_order","is_system","updated_at"],gs.map((g,i)=>({id:text(g.id),name:text(g.name),sort_order:i,is_system:["all","angel","nonangel"].includes(text(g.id))?1:0,updated_at:now})));
 add("celebrations_celebrations",["id","archangel","year","status","updated_at"],cels.map(c=>({id:Number(c.id),archangel:text(c.archangel),year:text(c.year),status:text(c.status||"planned"),updated_at:now})));
 add("celebrations_contents",["id","name","content_type","source_type","audience","storage_path","external_url","file_name","mime_type","has_cover","cover_storage_path","audio_kind","description","inline_text","category","cover_file_name","updated_at"],cs.map(c=>({id:text(c.id),name:text(c.name),content_type:text(c.type||c.content_type),source_type:text(c.sourceType||c.source_type),audience:text(c.audience||"all"),storage_path:c.storagePath||null,external_url:c.url||null,file_name:c.fileName||null,mime_type:c.mimeType||null,has_cover:c.hasCover?1:0,cover_storage_path:c.hasCover?c.coverStoragePath||null:null,audio_kind:c.audioKind||null,description:text(c.description),inline_text:text(c.text),category:text(c.category),cover_file_name:c.hasCover?c.coverFileName||null:null,updated_at:now})));
 const steps=cels.flatMap(c=>(c.days||[]).map((d,i)=>({celebration_id:Number(c.id),step_key:text(d.key),label:text(d.label),start_date:d.startDate||null,end_date:d.endDate||null,body_text:text(d.text),sort_order:i})));
 // Steps use an explicit unique (celebration_id,step_key) staging migration.
 add("celebrations_steps",["celebration_id","step_key","label","start_date","end_date","body_text","sort_order"],steps);
 add("celebrations_events",["id","celebration_id","step_key","title","event_time","description","audience","sort_order","updated_at"],evs.map((e,i)=>({id:text(e.id),celebration_id:Number(e.celebrationId),step_key:text(e.dayKey),title:text(e.title),event_time:e.time||null,description:text(e.description),audience:text(e.audience||"all"),sort_order:i,updated_at:now})));
 add("celebrations_step_contents",["celebration_id","step_key","content_id","sort_order"],cels.flatMap(c=>(c.days||[]).flatMap(d=>ids(d.contentIds).map((id,i)=>({celebration_id:Number(c.id),step_key:text(d.key),content_id:id,sort_order:i})))));
 add("celebrations_event_contents",["event_id","content_id","sort_order"],evs.flatMap(e=>ids(e.contentIds).map((id,i)=>({event_id:text(e.id),content_id:id,sort_order:i}))));
 if(jobs.length>2000)return reply({ok:false,error:"Too many changes"},413);
 try{
  // D1 batch is transactional: either all statements commit or none.
  await env.DB.batch(jobs.map(j=>env.DB.prepare(j.sql).bind(...j.args)));
  return reply({ok:true,safe:true,rows:jobs.length});
 }catch{return reply({ok:false,error:"Atomic merge failed"},409)}
}
