import {participantIdentity} from "./audience-api.mjs";
import {authorize} from "./auth-api.mjs";
import {privateNotFound} from "./app/security/member-private-access.mjs";
import {isPrivateMediaReference,publicMediaBindingsSafe} from "./app/security/public-media-boundary.mjs";
import {readEditorState} from "./editor-publication-api.mjs";
import {hasEditorAccess} from "./editor-site-access.mjs";
import {pdfIsPrivate} from "./app/domain/editor-site-preferences.mjs";
// Preview-only private R2 media gateway. No route deployed.
// Bind MEDIA_BUCKET (R2) and MEDIA_ACL (D1). No public R2 bucket.
const json=(message,status)=>new Response(JSON.stringify({error:message}),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const safeKey=(value)=>typeof value==="string"&&value.length>0&&value.length<1024&&!value.startsWith("/")&&!value.split("/").some(p=>!p||p==="."||p==="..")&&!value.includes("\\")&&!value.includes("\0");
export async function handleMedia(request,env){
 if(request.method!=="GET"&&request.method!=="HEAD")return json("Method not allowed",405);
 if(!env.MEDIA_BUCKET||!env.MEDIA_ACL||!publicMediaBindingsSafe(env))return json("Gateway unavailable",503);
 const u=new URL(request.url);
 const letter=u.pathname.startsWith("/letter/");
 if(!letter&&!u.pathname.startsWith("/media/"))return json("Not found",404);
 let key;try{key=decodeURIComponent(u.pathname.slice(letter?8:7))}catch{return json("Not found",404)}
 if(!safeKey(key))return json("Not found",404);
 // The legacy public gateway NEVER serves a future private-member namespace,
 // irrespective of ACL rows, audience labels, admin tokens or R2 key guesses.
 if(isPrivateMediaReference(key))return privateNotFound();
 // Public media requires an explicit, approved allowlist row.
 // Committee media requires a valid active slug. Never accept a raw committee key.
 const committee=letter;
 let authorized=false;
 if(committee){
  if(key.length>=160)return json("Not found",404);
  const row=await env.MEDIA_ACL.prepare("SELECT storage_path FROM committee_media WHERE slug=? AND revoked_at IS NULL AND published=1").bind(key).first();
  if(row&&safeKey(row.storage_path)&&row.storage_path.startsWith("committee/")&&
     !isPrivateMediaReference(row.storage_path)){key=row.storage_path;authorized=true}
 }else{
  if(key.startsWith("committee/"))return json("Not found",404);
  const row=await env.MEDIA_ACL.prepare("SELECT approved,revoked_at FROM public_media WHERE storage_path=?").bind(key).first();
  authorized=!!row&&row.approved===1&&!row.revoked_at;
  if(!row&&env.DB){
   const publicContent=await env.DB.prepare("SELECT 1 FROM celebrations_contents c WHERE (c.storage_path=? OR c.cover_storage_path=?) AND c.audience='all' AND (EXISTS (SELECT 1 FROM celebrations_event_contents ec JOIN celebrations_events e ON e.id=ec.event_id WHERE ec.content_id=c.id AND e.audience='all') OR EXISTS (SELECT 1 FROM celebrations_step_contents sc WHERE sc.content_id=c.id)) LIMIT 1").bind(key,key).first();
   authorized=!!publicContent;
  }
  if(!authorized&&!row&&env.DB){
   const bearer=request.headers.get("authorization")||"";
   const user=bearer.startsWith("Bearer ")?await participantIdentity(env,bearer.slice(7)):null;
   if(["angel","nonangel"].includes(user?.audience)){
    const match=await env.DB.prepare("SELECT 1 FROM celebrations_contents WHERE (storage_path=? OR cover_storage_path=?) AND audience=? LIMIT 1").bind(key,key,user.audience).first();
    authorized=!!match;
   }
  }
  // Admin may preview *referenced* draft/private content before publication.
  // Explicit ACL denial/revocation still wins, and committee paths stay blocked.
  if(!authorized&&!row&&env.DB&&request.headers.get("authorization")?.startsWith("Bearer ")
    &&await authorize(request,env,true)){
   const match=await env.DB.prepare(
    "SELECT 1 FROM celebrations_contents WHERE storage_path=? OR cover_storage_path=? LIMIT 1"
   ).bind(key,key).first();
   authorized=!!match;
  }
 }
 if(!authorized||isPrivateMediaReference(key))return privateNotFound();
 // Site-owned historic PDFs can be marked private from the SAME media
 // library, including PDF URLs previously mailed to visitors. The original
 // D1 authorization/revocation and all committee restrictions still apply.
 if(/\.pdf$/i.test(key)&&env.EDITOR_BUCKET){
  let state;
  try{({state}=await readEditorState(env.EDITOR_BUCKET))}
  catch{return json("PDF momentanément indisponible",503)}
  const src='/media/'+key.split('/').map(encodeURIComponent).join('/');
  if(pdfIsPrivate(state,src)&&!await hasEditorAccess(request,env))
   return privateNotFound();
 }
 const range=request.headers.get("range");
 if(range&&!/^bytes=\d*-\d*$/.test(range))return json("Invalid range",416);
 let object;
 try{object=await env.MEDIA_BUCKET.get(key,range?{range:request.headers}:undefined)}
 catch{return json("Media unavailable",502)}
 if(!object)return json("Not found",404);
 const headers=new Headers();
 object.writeHttpMetadata?.(headers);
 if(!headers.has("content-type")){const ext=key.split(".").pop()?.toLowerCase();const mime={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",gif:"image/gif",svg:"image/svg+xml",pdf:"application/pdf",mp3:"audio/mpeg",mp4:"video/mp4",ogg:"audio/ogg",wav:"audio/wav"};headers.set("content-type",mime[ext]||"application/octet-stream")}
 headers.set("accept-ranges","bytes");
 headers.set("etag",object.httpEtag||"");
 headers.set("x-content-type-options","nosniff");
 headers.set("cache-control","no-store");
 headers.set("vary","Authorization, Cookie");
 headers.set("referrer-policy","no-referrer");
 headers.set("cdn-cache-control","no-store");
 headers.set("x-robots-tag","noindex, nofollow, noarchive");
 // A mailed committee PDF is a bearer-capability URL, never a CDN resource.
 if(committee){headers.delete("etag");headers.delete("last-modified");}
 if(!/^(?:image\/(?:jpeg|png|webp|gif|svg\+xml)|application\/pdf|audio\/(?:mpeg|ogg|wav)|video\/mp4|application\/octet-stream)$/.test(headers.get("content-type")||"")){
  headers.set("content-type","application/octet-stream");
  headers.set("content-disposition","attachment");
 }
 if((headers.get("content-type")||"").includes("svg+xml"))
  headers.set("content-security-policy","default-src 'none'; sandbox");
 if(range&&object.range){
  const offset=object.range.offset??0;
  const length=object.range.length??object.size;
  headers.set("content-range",`bytes ${offset}-${offset+length-1}/${object.size}`);
  headers.set("content-length",String(length));
 }else headers.set("content-length",String(object.size));
 return new Response(request.method==="HEAD"?null:object.body,{status:range&&object.range?206:200,headers});
}
export default {fetch:handleMedia};
