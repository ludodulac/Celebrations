// Preview-only private R2 media gateway. No route deployed.
// Bind MEDIA_BUCKET (R2) and MEDIA_ACL (D1). No public R2 bucket.
const json=(message,status)=>new Response(JSON.stringify({error:message}),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const safeKey=(value)=>typeof value==="string"&&value.length>0&&value.length<1024&&!value.startsWith("/")&&!value.split("/").some(p=>!p||p==="."||p==="..")&&!value.includes("\\")&&!value.includes("\0");
export async function handleMedia(request,env){
 if(request.method!=="GET"&&request.method!=="HEAD")return json("Method not allowed",405);
 if(!env.MEDIA_BUCKET||!env.MEDIA_ACL)return json("Gateway unavailable",503);
 const u=new URL(request.url);
 if(!u.pathname.startsWith("/media/"))return json("Not found",404);
 let key;try{key=decodeURIComponent(u.pathname.slice(7))}catch{return json("Not found",404)}
 if(!safeKey(key))return json("Not found",404);
 // Public media requires an explicit, approved allowlist row.
 // Committee media requires a valid active slug. Never accept a raw committee key.
 const committee=key.startsWith("committee/");
 let authorized=false;
 if(committee){
  const slug=u.searchParams.get("letter");
  if(slug&&slug.length<160){
   const row=await env.MEDIA_ACL.prepare("SELECT 1 FROM committee_media WHERE storage_path=? AND slug=? AND revoked_at IS NULL AND published=1").bind(key,slug).first();
   authorized=!!row;
  }
 }else{
  const row=await env.MEDIA_ACL.prepare("SELECT 1 FROM public_media WHERE storage_path=? AND approved=1 AND revoked_at IS NULL").bind(key).first();
  authorized=!!row;
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
 headers.set("cache-control",committee?"no-store":"private, max-age=60");
 if(range&&object.range){
  const offset=object.range.offset??0;
  const length=object.range.length??object.size;
  headers.set("content-range",`bytes ${offset}-${offset+length-1}/${object.size}`);
  headers.set("content-length",String(length));
 }else headers.set("content-length",String(object.size));
 return new Response(request.method==="HEAD"?null:object.body,{status:range&&object.range?206:200,headers});
}
export default {fetch:handleMedia};
