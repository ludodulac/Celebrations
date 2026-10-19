// Isolated staging footer administration: D1 only, admin bearer required.
// Edits only the three known footer pages, never participants or production.
import {authorize} from "./auth-api.mjs";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const slugs=new Set(["mentions-legales","confidentialite","cookies"]);
const allowed=s=>typeof s==="string"&&slugs.has(s);
const now=()=>new Date().toISOString();
export async function handleFooterAdmin(request,env){
 if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
 if(!env.DB||!await authorize(request,env,true))return json({ok:false,error:"Unauthorized"},401);
 let body;try{body=await request.json()}catch{return json({ok:false,error:"Invalid JSON"},400)}
 const action=body?.action;
 try{
  if(action==="admin_footer_drafts"){
   const rows=await env.DB.prepare(
    "SELECT slug,draft_number,title,content,is_active,is_public,updated_at FROM celebrations_footer_drafts WHERE slug IN ('mentions-legales','confidentialite','cookies') ORDER BY slug,draft_number DESC LIMIT 150"
   ).all();
   return json({ok:true,drafts:rows.results||[]});
  }
  if(action==="admin_publish_footer"){
   const {slug,content,title}=body;
   const draftNumber=Number(body.draft_number);
   if(!allowed(slug)||!Number.isSafeInteger(draftNumber)||draftNumber<1||draftNumber>10000||
      typeof title!=="string"||title.length<1||title.length>180||
      typeof content!=="string"||content.length>100000)
    return json({ok:false,error:"Invalid footer draft"},400);
   const existing=await env.DB.prepare(
    "SELECT id FROM celebrations_footer_drafts WHERE slug=? AND draft_number=? ORDER BY id DESC LIMIT 1"
   ).bind(slug,draftNumber).first();
   const edits=[];
   // D1 batch is atomic; deactivate earlier versions only if new version is saved.
   edits.push(env.DB.prepare("UPDATE celebrations_footer_drafts SET is_active=0,updated_at=? WHERE slug=?").bind(now(),slug));
   if(existing){
    edits.push(env.DB.prepare(
     "UPDATE celebrations_footer_drafts SET title=?,content=?,is_active=1,updated_at=? WHERE id=? AND slug=?"
    ).bind(title,content,now(),existing.id,slug));
   }else{
    edits.push(env.DB.prepare(
     "INSERT INTO celebrations_footer_drafts(slug,draft_number,title,content,is_active,is_public,updated_at) VALUES(?,?,?,?,1,0,?)"
    ).bind(slug,draftNumber,title,content,now()));
   }
   await env.DB.batch(edits);
   return json({ok:true,saved:true});
  }
  if(action==="admin_set_footer_public"){
   const {slug}=body;
   if(!allowed(slug)||typeof body.is_public!=="boolean")
    return json({ok:false,error:"Invalid footer visibility"},400);
   const updated=await env.DB.prepare(
    "UPDATE celebrations_footer_drafts SET is_public=?,updated_at=? WHERE slug=? AND is_active=1"
   ).bind(body.is_public?1:0,now(),slug).run();
   if(!updated.meta?.changes)return json({ok:false,error:"No active footer draft"},409);
   return json({ok:true,is_public:body.is_public});
  }
  return json({ok:false,error:"Unknown action"},400);
 }catch{return json({ok:false,error:"Footer operation unavailable"},503)}
}
