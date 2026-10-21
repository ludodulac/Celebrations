// PUBLIC-READ-ONLY PREVIEW over PRODUCTION D1/R2 data.
// This is a separate workers.dev Worker. No admin/auth/stats mutation routes,
// even if a visitor knows a valid Bearer token. Never attach a custom domain.
import {handlePublicData} from "./public-data-api.mjs";
import {handleMedia} from "./media-gateway.mjs";

const noIndex=response=>{
 const headers=new Headers(response.headers);
 headers.set("X-Robots-Tag","noindex, nofollow, noarchive");
 headers.set("Cache-Control","no-store");
 headers.set("X-Content-Type-Options","nosniff");
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
};
const deny=(status,message)=>noIndex(new Response(message,{
 status,headers:{"Content-Type":"text/plain; charset=utf-8"}}));
export default {
 async fetch(request,env){
  const {pathname}=new URL(request.url);
  if(request.method!=="GET"&&request.method!=="HEAD")
   return deny(405,"Lecture seule : aucune modification autorisée");
  if(pathname==="/robots.txt")
   return noIndex(new Response("User-agent: *\nDisallow: /\n",{
    headers:{"content-type":"text/plain; charset=utf-8"}}));
  if(pathname.startsWith("/api/")){
   if(pathname==="/api/public-data"&&request.method==="GET")
    return noIndex(await handlePublicData(request,env));
   return deny(404,"Not found");
  }
  if(pathname.startsWith("/media/")||pathname.startsWith("/letter/"))
   return noIndex(await handleMedia(request,env));
  if(!env.ASSETS)return deny(503,"Static assets unavailable");
  return noIndex(await env.ASSETS.fetch(request));
 }
};
