// Testing candidate: exact production app behavior, with noindex and
// a different hostname. NEVER deploy this wrapper as the emailed host or
// the official public domain. It reads isolated D1/R2 and uses genuine
// secret-based admin authentication.
import production from "./production-worker.mjs";

export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==="/robots.txt"){
   return new Response("User-agent: *\nDisallow: /\n",{status:200,headers:{
    "content-type":"text/plain;charset=utf-8",
    "x-robots-tag":"noindex,nofollow,noarchive",
    "cache-control":"no-store"
   }});
  }
  const response=await production.fetch(request,env);
  const headers=new Headers(response.headers);
  headers.set("X-Robots-Tag","noindex,nofollow,noarchive");
  headers.set("Cache-Control","no-store");
  headers.set("X-Content-Type-Options","nosniff");
  return new Response(response.body,{status:response.status,headers});
 }
};
