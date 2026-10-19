import {participantIdentity} from "./audience-api.mjs";
// Read-only public D1 API for isolated staging. NEVER exposes participant/session tables.
const tables=new Set(["celebrations_celebrations","celebrations_steps","celebrations_events","celebrations_contents","celebrations_event_contents","celebrations_step_contents","celebrations_links","celebrations_groups","celebrations_public_settings","celebrations_footer_drafts"]);
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
export async function handlePublicData(request,env){
 if(request.method!=="GET")return respond({error:"Method not allowed"},405);
 if(!env.DB)return respond({error:"Database unavailable"},503);
 const u=new URL(request.url),name=u.searchParams.get("table");
 if(!tables.has(name))return respond({error:"Not found"},404);
 const bearer=request.headers.get("authorization")||"";
 const identity=bearer.startsWith("Bearer ")?await participantIdentity(env,bearer.slice(7)):null;
 const audience=["angel","nonangel"].includes(identity?.audience)?identity.audience:null;
 const filter=audience?"('all','"+audience+"')":"('all')";
 let sql=name==="celebrations_public_settings"
  ? 'SELECT show_other_celebrations FROM celebrations_public_settings WHERE id=1 LIMIT 1'
  : name==="celebrations_footer_drafts"
  ? 'SELECT slug FROM celebrations_footer_drafts WHERE is_active=1 AND is_public=1'
  : 'SELECT * FROM "'+name+'"';
 if(name==="celebrations_contents"||name==="celebrations_events")sql+=" WHERE audience IN " + filter + "";
 if(name==="celebrations_event_contents")sql+=" WHERE content_id IN (SELECT id FROM celebrations_contents WHERE audience IN " + filter + ") AND event_id IN (SELECT id FROM celebrations_events WHERE audience IN " + filter + ")";
 if(name==="celebrations_links")sql+=" WHERE event_id IS NULL OR event_id IN (SELECT id FROM celebrations_events WHERE audience IN " + filter + ")";
 if(name==="celebrations_step_contents")sql+=" WHERE content_id IN (SELECT id FROM celebrations_contents WHERE audience IN " + filter + ")";
 try{
  const data=await env.DB.prepare(sql).all();
  return respond(data.results||[]);
 }catch{return respond({error:"Query unavailable"},503)}
}
