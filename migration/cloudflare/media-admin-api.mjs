// Staging-only R2 write operations; private bucket, admin session required.
import {authorize} from "./auth-api.mjs";
const json=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
const safe=k=>typeof k==="string"&&k.length>0&&k.length<512&&/^(media|committee)\/[a-zA-Z0-9_./-]+$/.test(k)&&!k.split("/").some(p=>p===".."||p===".") ;
// Only safe, non-executable media formats. In particular, SVG and HTML
// must not be served from the site's own origin as user-uploaded scripts.
const mimeAllowed=new Set([
 "application/pdf","application/msword",
 "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
 "application/vnd.oasis.opendocument.text","application/rtf",
 "text/plain","text/markdown","text/csv","text/rtf",
 "image/jpeg","image/png","image/gif","image/webp","image/avif",
 "audio/mpeg","audio/mp3","audio/ogg","audio/wav","audio/x-wav","audio/mp4","audio/aac","audio/webm",
 "video/mp4","video/webm","video/quicktime","video/ogg"
]);
export async function handleMediaAdmin(request,env){
 if(!env.DB||!env.MEDIA_BUCKET)return json({ok:false,error:"Unavailable"},503);
 if(!await authorize(request,env,true))return json({ok:false,error:"Unauthorized"},401);
 if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
 const url=new URL(request.url),action=url.searchParams.get("action");
 try{
  if(action==="upload"){
   const key=url.searchParams.get("key"),type=(request.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
   if(!safe(key)||!mimeAllowed.has(type)||(key.startsWith("committee/")&&type!=="application/pdf"))return json({ok:false,error:"Format non autorisé"},400);
   const length=Number(request.headers.get("content-length"));
   if(!Number.isSafeInteger(length)||length<=0||length>20*1024*1024)return json({ok:false,error:"Invalid size"},413);
   const data=await request.arrayBuffer();
   if(data.byteLength!==length)return json({ok:false,error:"Size mismatch"},400);
   if(type==="application/pdf"&&new TextDecoder().decode(data.slice(0,5))!=="%PDF-")return json({ok:false,error:"PDF invalide"},400);
   if(await env.MEDIA_BUCKET.head(key))return json({ok:false,error:"Already exists"},409);
   await env.MEDIA_BUCKET.put(key,data,{httpMetadata:{contentType:type},onlyIf:{etagDoesNotMatch:"*"}});
   const stored=await env.MEDIA_BUCKET.head(key);
   if(!stored||stored.size!==length)return json({ok:false,error:"Upload not verified"},503);
   return json({ok:true,key,size:length});
  }
  if(action==="committee-finish"){
   const id=url.searchParams.get("id"),slug=url.searchParams.get("slug"),key=url.searchParams.get("key"),name=url.searchParams.get("name")||"document.pdf";
   if(!id||id.length>128||!slug||slug.length>160||!safe(key)||!key.startsWith("committee/")||name.length>255)return json({ok:false,error:"Invalid document"},400);
   const object=await env.MEDIA_BUCKET.head(key);
   if(!object||object.size<=0||object.httpMetadata?.contentType!=="application/pdf")return json({ok:false,error:"PDF not verified"},409);
   await env.DB.batch([
    env.DB.prepare("INSERT INTO celebrations_committee_letters(id,title,file_name,storage_path,mime_type,slug) VALUES(?,?,?,?,?,?)").bind(id,name.replace(/\\.pdf$/i,""),name,key,"application/pdf",slug),
    env.DB.prepare("INSERT INTO committee_media(slug,storage_path,published,revoked_at) VALUES(?,?,1,NULL)").bind(slug,key)
   ]);
   return json({ok:true,id,slug});
  }
  if(action==="revoke-committee"){
   const slug=url.searchParams.get("slug");
   if(!slug||slug.length>160)return json({ok:false,error:"Invalid slug"},400);
   const update=await env.DB.prepare("UPDATE committee_media SET published=0,revoked_at=? WHERE slug=? AND revoked_at IS NULL").bind(new Date().toISOString(),slug).run();
   if(!update.meta?.changes)return json({ok:false,error:"Not found or already revoked"},404);
   // Deliberately do not delete bytes here. Access is revoked at the ACL layer.
   return json({ok:true,revoked:true,storage_deleted:false});
  }
  if(action==="delete"){
   const key=url.searchParams.get("key");
   if(!safe(key)||key.startsWith("committee/"))return json({ok:false,error:"Committee requires revocation"},400);
   const row=await env.DB.prepare("SELECT 1 FROM public_media WHERE storage_path=? AND approved=1 AND revoked_at IS NULL").bind(key).first();
   if(row)return json({ok:false,error:"Revoke access before deletion"},409);
   const used=await env.DB.prepare("SELECT 1 FROM celebrations_contents WHERE storage_path=? OR cover_storage_path=? LIMIT 1").bind(key,key).first();
   if(used)return json({ok:false,error:"Unlink content before deleting media"},409);
   await env.MEDIA_BUCKET.delete(key);
   if(await env.MEDIA_BUCKET.head(key))return json({ok:false,error:"Storage deletion not verified"},503);
   return json({ok:true,deleted:true});
  }
  return json({ok:false,error:"Unknown action"},400);
 }catch{return json({ok:false,error:"Media operation failed"},503)}
}
