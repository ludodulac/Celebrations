// Isolated staging entrypoint. No production routes or bindings are changed.
import {handleMedia} from "./media-gateway.mjs";
import {handlePublicData} from "./public-data-api.mjs";
export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path.startsWith("/media/")||path.startsWith("/letter/"))return handleMedia(request,env);
  if(path==="/api/public-data")return handlePublicData(request,env);
  return new Response("Not found",{status:404,headers:{"cache-control":"no-store"}});
 }
};
