// Staging-only visit and resource statistics stored exclusively in Cloudflare D1.
// No IP addresses, cookies, accounts or email addresses are saved.
// Public recording requires same-origin JSON; summaries require admin session.
import {authorize} from "./auth-api.mjs";
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{
 "content-type":"application/json; charset=utf-8","cache-control":"no-store",
 "x-content-type-options":"nosniff","access-control-allow-origin":"none"
}});
const str=(v,max)=>typeof v==="string"?v.trim().slice(0,max):"";
const nonempty=(v,max)=>str(v,max)||null;
function originSafe(request){
 const url=new URL(request.url);
 const origin=request.headers.get("origin");
 // Same-origin POST by fetch() always carries Origin on modern browsers.
 return origin===url.origin;
}
export async function handleStats(request,env){
 if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
 if(!env.DB)return json({ok:false,error:"Database unavailable"},503);
 const bytes=Number(request.headers.get("content-length")||0);
 if(bytes>4096||request.headers.get("content-type")?.split(";")[0]?.trim()!=="application/json")
  return json({ok:false,error:"Invalid payload"},400);
 let body;
 try{body=await request.json()}catch{return json({ok:false,error:"Invalid JSON"},400)}
 if(!body||typeof body!=="object"||Array.isArray(body))return json({ok:false,error:"Invalid payload"},400);
 if(body.action==="summary"){
  if(!await authorize(request,env,true))return json({ok:false,error:"Unauthorized"},401);
  try{
   const [totals, pages, clicks] = await Promise.all([
    env.DB.prepare("SELECT COUNT(DISTINCT visitor_id) AS visitors, SUM(CASE WHEN target_kind='page-view' THEN 1 ELSE 0 END) AS visits FROM celebrations_clicks").first(),
    env.DB.prepare("SELECT COALESCE(page_path,'/') AS page, COUNT(*) AS cnt,COUNT(DISTINCT visitor_id) AS visitors FROM celebrations_clicks WHERE target_kind='page-view' GROUP BY COALESCE(page_path,'/') ORDER BY cnt DESC LIMIT 100").all(),
    env.DB.prepare("SELECT target_kind,target_label,COUNT(*) AS click_count,MAX(clicked_at) AS last_clicked_at FROM celebrations_clicks WHERE target_kind<>'page-view' GROUP BY target_kind,target_label ORDER BY click_count DESC LIMIT 100").all()
   ]);
   return json({ok:true,visits:{visitors:Number(totals?.visitors||0),visits:Number(totals?.visits||0),pages:pages.results||[]},clicks:clicks.results||[]});
  }catch{return json({ok:false,error:"Stats unavailable"},503)}
 }
 if(body.action!=="track")return json({ok:false,error:"Unknown action"},400);
 if(!originSafe(request))return json({ok:false,error:"Cross-origin tracking denied"},403);
 const visitor=str(body.visitor_id,120);
 const kind=str(body.target_kind,80);
 if(!/^[a-zA-Z0-9_-]{12,120}$/.test(visitor)||!kind||!["page-view","link","pdf","audio-play","youtube","content","image","video","other"].includes(kind))
  return json({ok:false,error:"Invalid event"},400);
 const numeric=body.celebration_id==null?null:Number(body.celebration_id);
 if(numeric!==null&&!Number.isSafeInteger(numeric))return json({ok:false,error:"Invalid celebration"},400);
 try{
  await env.DB.prepare(
   "INSERT INTO celebrations_clicks(celebration_id,content_id,target_kind,target_label,target_url,page_path,step_key,event_id,visitor_id) VALUES (?,?,?,?,?,?,?,?,?)"
  ).bind(numeric,nonempty(body.content_id,160),kind,nonempty(body.target_label,500),
   nonempty(body.target_url,1500),nonempty(body.page_path,800),
   nonempty(body.step_key,120),nonempty(body.event_id,240),visitor).run();
  return json({ok:true});
 }catch{return json({ok:false,error:"Stats unavailable"},503)}
}
