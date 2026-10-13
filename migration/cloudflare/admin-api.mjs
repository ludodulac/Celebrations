// Explicit admin-only D1 operations. Table and column allowlists prevent SQL injection.
// Write operations are deliberately bounded; no unauthenticated mutation route.
import {authorize} from "./auth-api.mjs";
const allowed={
 celebrations_contents:["id","name","content_type","source_type","audience","storage_path","external_url","file_name","mime_type","has_cover","cover_storage_path","audio_kind","description","inline_text","category","cover_file_name"],
 celebrations_events:["id","celebration_id","step_key","title","event_time","description","audience","sort_order"],
 celebrations_participants:["email","audience"],
 celebrations_public_settings:["id","show_other_celebrations"],
 celebrations_groups:["id","name","sort_order","is_system"],
 celebrations_committee_letters:["id","title","file_name","storage_path","mime_type","slug"],
 celebrations_celebrations:["id","archangel","year","status"],
 celebrations_steps:["id","celebration_id","step_key","label","start_date","end_date","body_text","sort_order"],
 celebrations_links:["id","celebration_id","step_key","event_id","label","url","sort_order","link_type"],
 celebrations_event_contents:["event_id","content_id","sort_order"],
 celebrations_step_contents:["celebration_id","step_key","content_id","sort_order"]
};
const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
export async function handleAdmin(request,env){
 if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
 if(!env.DB)return json({ok:false,error:"Database unavailable"},503);
 if(!await authorize(request,env,true))return json({ok:false,error:"Unauthorized"},401);
 let b;try{b=await request.json()}catch{return json({ok:false,error:"Invalid JSON"},400)}
 const table=String(b.table||""),action=String(b.action||"");
 if(!Object.hasOwn(allowed,table))return json({ok:false,error:"Table not allowed"},403);
 const fields=allowed[table],pk={celebrations_event_contents:["event_id","content_id"],celebrations_step_contents:["celebration_id","step_key","content_id"],celebrations_participants:["email"],celebrations_public_settings:["id"]}[table]||["id"];
 const data=b.data&&typeof b.data==="object"&&!Array.isArray(b.data)?b.data:{};
 const keys=Object.keys(data);
 if(keys.some(k=>!fields.includes(k))||keys.length>32)return json({ok:false,error:"Invalid columns"},400);
 if((action==="create"||action==="update")&&!keys.length)return json({ok:false,error:"Empty mutation"},400);
 const quoted=x=>'"'+x+'"';
 try{
  if(action==="list"){
   const rows=await env.DB.prepare(`SELECT * FROM "${table}" LIMIT 1000`).all();
   if(table==="celebrations_participants")return json({ok:true,items:(rows.results||[]).map(({email,audience})=>({email,audience}))});
   return json({ok:true,items:rows.results||[]});
  }
  if(!pk.every(k=>Object.hasOwn(b.key||{},k)))return json({ok:false,error:"Missing primary key"},400);
  const where=pk.map(k=>quoted(k)+"=?").join(" AND "),values=pk.map(k=>b.key[k]);
  if(action==="create"){
   if(!pk.every(k=>Object.hasOwn(data,k)))return json({ok:false,error:"Missing primary key fields"},400);
   await env.DB.prepare(`INSERT INTO "${table}" (${keys.map(quoted).join(",")}) VALUES (${keys.map(()=>"?").join(",")})`).bind(...keys.map(k=>data[k])).run();
  }else if(action==="update"){
   if(keys.some(k=>pk.includes(k)))return json({ok:false,error:"Cannot change primary key"},400);
   await env.DB.prepare(`UPDATE "${table}" SET ${keys.map(k=>quoted(k)+"=?").join(",")} WHERE ${where}`).bind(...keys.map(k=>data[k]),...values).run();
  }else if(action==="delete"){
   // Committee access is revoked first; object removal is a separately verified operation.
   if(table==="celebrations_committee_letters")return json({ok:false,error:"Use committee revoke endpoint"},409);
   await env.DB.prepare(`DELETE FROM "${table}" WHERE ${where}`).bind(...values).run();
  }else return json({ok:false,error:"Unknown action"},400);
  return json({ok:true});
 }catch{return json({ok:false,error:"Database operation failed"},409)}
}
