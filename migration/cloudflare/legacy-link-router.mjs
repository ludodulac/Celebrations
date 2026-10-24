// Preserve the FULL ORIGINAL URL of committee invitations already sent by
// email. GET https://<same-host>/?lettre=<existing-slug> returns the original
// PDF bytes inline, without redirecting to a different host or changing the
// recipient's browser address. D1 committee_media enforces original slugs.
import {handleMedia} from "./media-gateway.mjs";

const externalDocuments=new Map([
 ["/communique","https://drive.google.com/file/d/1miL0VVVLOgGDv4qg591Um8IkZ8xF_xjI/view?usp=sharing"],
 ["/rituel-court","https://drive.google.com/file/d/1OJvlrmwii9PWbblZxfbisxQUjwj15yJ2/view?usp=sharing"],
 ["/rituel-long","https://drive.google.com/file/d/14FEjGxU7mVMS6h6LgGlxR_aVz70LNk55/view?usp=sharing"],
 ["/preparation","https://drive.google.com/file/d/1zR2V73wAkqnK_ot2MG1Hq1jegOS1aQyr/view?usp=sharing"]
]);
const error=(status)=>new Response("Document introuvable",{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
export async function handleLegacyLink(request,env){
 const url=new URL(request.url);
 if(url.pathname==="/"&&url.searchParams.has("lettre")){
  if(!["GET","HEAD"].includes(request.method))return error(405);
  const slug=url.searchParams.get("lettre")||"";
  if(slug.length<8||slug.length>=160||!/^[\p{L}\p{N}_-]+$/u.test(slug))
   return error(404);
  const target=new URL("/letter/"+encodeURIComponent(slug),url);
  // No 301/302: the recipient's original ?lettre= URL stays EXACTLY as sent.
  // Only the internal request pathname is normalized, never the browser URL.
  return handleMedia(new Request(target.toString(),request),env);
 }
 // Historical /lettres/<slug> browser links also resolve through the same
 // private D1 slug allowlist, never through an external Supabase endpoint.
 const oldLetter=url.pathname.match(/^\/lettres\/([^/]+)\/?$/);
 if(oldLetter){
  if(!["GET","HEAD"].includes(request.method))return error(405);
  let slug;try{slug=decodeURIComponent(oldLetter[1])}catch{return error(404)}
  if(slug.length<8||slug.length>=160||!/^[\p{L}\p{N}_-]+$/u.test(slug))return error(404);
  const target=new URL("/letter/"+encodeURIComponent(slug),url);
  return handleMedia(new Request(target.toString(),request),env);
 }
 const destination=externalDocuments.get(url.pathname);
 if(destination){
  if(!["GET","HEAD"].includes(request.method))return error(405);
  return new Response(null,{status:302,headers:{
   location:destination,"cache-control":"no-store",
   "x-robots-tag":"noindex,nofollow"
  }});
 }
 return null;
}
