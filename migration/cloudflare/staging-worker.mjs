// Isolated staging entrypoint. No production routes or bindings are changed.
import {handleMediaAdmin} from "./media-admin-api.mjs";
import {handleMedia} from "./media-gateway.mjs";
import {handleAuth} from "./auth-api.mjs";
import {handleAudience} from "./audience-api.mjs";
import {handleAdmin} from "./admin-api.mjs";
import {handlePublicData} from "./public-data-api.mjs";
export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path.startsWith("/media/")||path.startsWith("/letter/"))return handleMedia(request,env);
  if(path==="/api/auth")return handleAuth(request,env);
  if(path==="/api/audience")return handleAudience(request,env);
  if(path==="/api/media-admin")return handleMediaAdmin(request,env);
  if(path==="/api/admin")return handleAdmin(request,env);
  if(path==="/api/public-data")return handlePublicData(request,env);
  if((request.method==="GET"||request.method==="HEAD")&&env.ASSETS)return env.ASSETS.fetch(request);
  return new Response("Not found",{status:404,headers:{"cache-control":"no-store"}});
 }
};
