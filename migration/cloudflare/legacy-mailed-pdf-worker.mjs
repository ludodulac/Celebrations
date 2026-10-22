// Mission 06 — ONLY the original emailed PDF links move to Cloudflare D1/R2.
// All other visitor pages/assets come from the sanitized PINNED GitHub main.
// Deliberately no administration or mutation APIs on this historic Worker.
import {handleLegacyLink} from "./legacy-link-router.mjs";
const stamp=response=>{
 const h=new Headers(response.headers);
 h.set("x-celebrations-legacy-pdf-bridge","mission06-safe-v2");
 return new Response(response.body,{
   status:response.status,statusText:response.statusText,headers:h
 });
};
export default {
 async fetch(request,env){
  const pathname=new URL(request.url).pathname;
  // Avoid serving repository internals even on SPA fallback requests.
  if(/^\/(?:\.git|\.github|scripts|tests|migration|node_modules)(?:\/|$)/.test(pathname))
   return stamp(new Response("Not found",{status:404,headers:{"cache-control":"no-store"}}));
  const legacy=await handleLegacyLink(request,env);
  if(legacy)return stamp(legacy);
  if(!env.ASSETS)return stamp(new Response("Site indisponible",{status:503}));
  return stamp(await env.ASSETS.fetch(request));
 }
};
