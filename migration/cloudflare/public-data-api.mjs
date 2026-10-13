// Read-only public D1 API for isolated staging. NEVER exposes participant/session tables.
const tables=new Set(["celebrations_celebrations","celebrations_steps","celebrations_events","celebrations_contents","celebrations_event_contents","celebrations_step_contents","celebrations_links","celebrations_groups"]);
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
export async function handlePublicData(request,env){
 if(request.method!=="GET")return respond({error:"Method not allowed"},405);
 if(!env.DB)return respond({error:"Database unavailable"},503);
 const u=new URL(request.url),name=u.searchParams.get("table");
 if(!tables.has(name))return respond({error:"Not found"},404);
 let sql='SELECT * FROM "'+name+'"';
 if(name==="celebrations_contents"||name==="celebrations_events")sql+=" WHERE audience='all'";
 if(name==="celebrations_event_contents")sql+=" WHERE content_id IN (SELECT id FROM celebrations_contents WHERE audience='all') AND event_id IN (SELECT id FROM celebrations_events WHERE audience='all')";
 if(name==="celebrations_step_contents")sql+=" WHERE content_id IN (SELECT id FROM celebrations_contents WHERE audience='all')";
 try{
  const data=await env.DB.prepare(sql).all();
  return respond(data.results||[]);
 }catch{return respond({error:"Query unavailable"},503)}
}
