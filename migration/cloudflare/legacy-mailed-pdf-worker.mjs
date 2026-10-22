// Mission 06: retain ALL the original historic Worker static assets/URLs.
// Only ?lettre=... and the four existing document shorthand URLs go through
// the Cloudflare D1/R2 compatibility router. No production admin, no writes.
// The assets come from the PINNED original GitHub main, NOT the migration UI.
import {handleLegacyLink} from "./legacy-link-router.mjs";
export default {
 async fetch(request,env){
  const legacy=await handleLegacyLink(request,env);
  if(legacy)return legacy;
  // Never expose Git repository files, CI configuration or maintenance scripts.
  const pathname=new URL(request.url).pathname;
  if(/^\/(?:\.git|\.github|scripts|tests|migration|node_modules)(?:\/|$)/.test(pathname))
   return new Response("Not found",{status:404,headers:{"cache-control":"no-store"}});
  if(!env.ASSETS)return new Response("Site temporairement indisponible",{status:503});
  return env.ASSETS.fetch(request);
 }
};
