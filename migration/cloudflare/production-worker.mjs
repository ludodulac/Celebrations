// Production-candidate entrypoint: isolated workers.dev deployment allowed before cutover.
// Never attach a real custom domain before DNS/backup/rollback authorization.
import {handleMediaAdmin} from "./media-admin-api.mjs";
import {handleMedia} from "./media-gateway.mjs";
import {handleLegacyLink} from "./legacy-link-router.mjs";
import {handleAuth} from "./auth-api.mjs";
import {handleAudience} from "./audience-api.mjs";
import {handleSafeSave} from "./safe-save-api.mjs";
import {handleAdmin} from "./admin-api.mjs";
import {handlePublicData} from "./public-data-api.mjs";
import {handleFooterAdmin} from "./footer-admin-api.mjs";
import {handleParticipantsAdmin} from "./participants-admin-api.mjs";
import {handleStats} from "./stats-api.mjs";
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  const isolated=url.hostname==="celebrations-exit-production.rondes.workers.dev";
  // Before domain cutover the independent candidate is READ-ONLY, by design.
  // This gate prevents public signups, analytics writes and admin mutations.
  if(isolated && request.method!=="GET" && request.method!=="HEAD")
   return new Response("Pre-cutover preview is read-only",{status:405,headers:{
    "x-robots-tag":"noindex,nofollow,noarchive","cache-control":"no-store"
   }});

  if(isolated && path==="/robots.txt")
   return new Response("User-agent: *\nDisallow: /\n",{
    headers:{"content-type":"text/plain; charset=utf-8","x-robots-tag":"noindex,nofollow,noarchive","cache-control":"no-store"}});
  const handleRoute=async()=>{

  // The displayed Préparation day links to /preparation via client routing.
  // Never hijack this actual site page as an orphan Google Drive alias.
  const isPreparationPage=path==="/preparation"||path==="/preparation/";
  const legacy=isPreparationPage?null:await handleLegacyLink(request,env);
  if(legacy)return legacy;
  if(path.startsWith("/media/")||path.startsWith("/letter/"))return handleMedia(request,env);
  if(path==="/api/auth")return handleAuth(request,env);
  if(path==="/api/audience")return handleAudience(request,env);
  if(path==="/api/media-admin")return handleMediaAdmin(request,env);
  if(path==="/api/safe-save")return handleSafeSave(request,env);
  if(path==="/api/admin")return handleAdmin(request,env);
  if(path==="/api/public-data")return handlePublicData(request,env);
  if(path==="/api/footer-admin")return handleFooterAdmin(request,env);
  if(path==="/api/participants-admin")return handleParticipantsAdmin(request,env);
  if(path==="/api/stats")return handleStats(request,env);
  if((request.method==="GET"||request.method==="HEAD")&&env.ASSETS)return env.ASSETS.fetch(request);
  return new Response("Not found",{status:404,headers:{"cache-control":"no-store"}});
  };
  const response=await handleRoute();
  if(!isolated)return response;
  const headers=new Headers(response.headers);
  headers.set("x-robots-tag","noindex,nofollow,noarchive");
  headers.set("cache-control","no-store");
  headers.set("x-content-type-options","nosniff");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 }
};
