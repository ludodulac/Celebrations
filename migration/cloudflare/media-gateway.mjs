import {participantIdentity} from "./audience-api.mjs";
// Preview-only private R2 media gateway. No route deployed.
// Bind MEDIA_BUCKET (R2) and MEDIA_ACL (D1). No public R2 bucket.
const json=(message,status)=>new Response(JSON.stringify({error:message}),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const safeKey=(value)=>typeof value==="string"&&value.length>0&&value.length<1024&&!value.startsWith("/")&&!value.split("/").some(p=>!p||p==="."||p==="..")&&!value.includes("\\")&&!value.includes("\0");
export async function handleMedia(request,env){
 if(request.method!=="GET"&&request.method!=="HEAD")return json("Method not allowed",405);
 if(!env.MEDIA_BUCKET||!env.MEDIA_ACL)return json("Gateway unavailable",503);
 const u=new URL(request.url);
 const letter=u.pathname.startsWith("/letter/");
 if(!letter&&!u.pathname.startsWith("/media/"))return json("Not found",404);
 let key;try{key=decodeURIComponent(u.pathname.slice(letter?8:7))}catch{return json("Not found",404)}
 if(!safeKey(key))return json("Not found",404);
 // Public media requires an explicit, approved allowlist row.
 // Committee media requires a valid active slug. Never accept a raw committee key.
 const committee=letter;
 let authorized=false;
 if(committee){
  if(key.length>=160)return json("Not found",404);
  const row=await env.MEDIA_ACL.prepare("SELECT storage_path FROM committee_media WHERE slug=? AND revoked_at IS NULL AND published=1").bind(key).first();
  if(row&&safeKey(row.storage_path)&&row.storage_path.startsWith("committee/")){key=row.storage_path;authorized=true}
 }else{
  if(key.startsWith("committee/"))return json("Not found",404);
  const row=await env.MEDIA_ACL.prepare("SELECT 1 FROM public_media WHERE storage_path=? AND approved=1 AND revoked_at IS NULL").bind(key).first();
  authorized=!!row;
  if(!authorized&&env.DB){
   const bearer=request.headers.get("authorization")||"";
   const user=bearer.startsWith("Bearer ")?await participantIdentity(env,bearer.slice(7)):null;
   if(["angel","nonangel"].includes(user?.audience)){
    const match=await env.DB.prepare("SELECT 1 FROM celebrations_contents WHERE (storage_path=? OR cover_storage_path=?) AND audience=? LIMIT 1").bind(key,key,user.audience).first();
    authorized=!!match;
   }
  }
 }
 if(!authorized)return json("Not found",404);
 const range=request.headers.get("range");
 if(range&&!/^bytes=\d*-\d*$/.test(range))return json("Invalid range",416);
 let object;
 try{object=await env.MEDIA_BUCKET.get(key,range?{range:request.headers}:undefined)}
 catch{return json("Media unavailable",502)}
 if(!object)return json("Not found",404);
 const headers=new Headers();
 object.writeHttpMetadata?.(headers);
 headers.set("accept-ranges","bytes");
 headers.set("etag",object.httpEtag||"");
 headers.set("x-content-type-options","nosniff");
 headers.set("cache-control","no-store");
 if(range&&object.range){
  const offset=object.range.offset??0;
  const length=object.range.length??object.size;
  headers.set("content-range",`bytes ${offset}-${offset+length-1}/${object.size}`);
  headers.set("content-length",String(length));
 }else headers.set("content-length",String(object.size));
 return new Response(request.method==="HEAD"?null:object.body,{status:range&&object.range?206:200,headers});
}
export default {fetch:handleMedia};
