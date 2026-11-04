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
import {handlePreparationDemo} from "./editor-demo-preparation-page.mjs";
import {handleTrialSite} from "./editor-trial-site-page.mjs";
import {handleServerDraft} from "./editor-server-draft-api.mjs";
import {handleEditorPublication,handleEditorMedia,handleEditorMediaFile} from "./editor-publication-api.mjs";
import {hasEditorAccess,editorAccessAction,editorLoginPage,editorLogout} from "./editor-site-access.mjs";
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  const isolated=["celebrations-exit-production.rondes.workers.dev","celebrations-visual-candidate.rondes.workers.dev"].includes(url.hostname);
  // Before domain cutover the independent candidate is READ-ONLY, by design.
  // This gate prevents public signups, analytics writes and admin mutations.
  if(isolated && request.method!=="GET" && request.method!=="HEAD")
   return new Response("Pre-cutover preview is read-only",{status:405,headers:{
    "x-robots-tag":"noindex,nofollow,noarchive","cache-control":"no-store"
   }});

  if(isolated && path==="/robots.txt")
   return new Response("User-agent: *\nDisallow: /\n",{
    headers:{"content-type":"text/plain; charset=utf-8","x-robots-tag":"noindex,nofollow,noarchive","cache-control":"no-store"}});
  // Gate the administration itself AND every server write. Public viewing and
  // old mailed PDF/media addresses remain accessible without signing in.
  const officialHost=url.hostname==="ronde-des-archanges-universelle.eu"||
   url.hostname==="www.ronde-des-archanges-universelle.eu";
  if(officialHost){
   if(path==="/api/editor-access")return editorAccessAction(request,env);
   if(path==="/api/editor-logout"){
    if(request.method!=="POST")return new Response("Méthode interdite",{status:405});
    if(request.headers.get("origin")!=="https://"+url.hostname)return new Response("Origine interdite",{status:403});
    return editorLogout();
   }
   const editorPage=path==="/admin"||path==="/admin.html"||
    path==="/__editor/demo-preparation";
   if(editorPage&&!(await hasEditorAccess(request,env)))
    return editorLoginPage(request,env,url.searchParams.has("erreur"));
   if(path==="/api/editor-open-draft"&&!(await hasEditorAccess(request,env)))
    return Response.json({ok:false,error:"Code administrateur nécessaire."},{status:401,
     headers:{"cache-control":"no-store"}});
  }
  const handleRoute=async()=>{

  // The displayed Préparation day links to /preparation via client routing.
  // Never hijack this actual site page as an orphan Google Drive alias.
  const isPreparationPage=path==="/preparation"||path==="/preparation/";
  const legacy=isPreparationPage?null:await handleLegacyLink(request,env);
  if(legacy)return legacy;
  // The homepage editor draft used a staging-only nickname for the original
  // publicly approved welcome photograph. Serve that exact historic image
  // under the nickname too, without changing either URL, D1, or R2 objects.
  if(path==="/media/media/celebrations-staging-welcome-autumn-2026.jpg"){
   const imageUrl=new URL(request.url);
   imageUrl.pathname="/media/media/1791723108110/file-1791723109615-1000040461.jpg";
   return handleMedia(new Request(imageUrl,request),env);
  }
  // Application-owned new uploads live in EDITOR_BUCKET, never MEDIA_BUCKET.
  // Historic /media/ and /letter/ routes remain byte-for-byte untouched.
  if(path.startsWith("/media/new/"))return handleEditorMediaFile(request,env);
  if(path.startsWith("/media/")||path.startsWith("/letter/"))return handleMedia(request,env);
  // The two official domains now use the same visual visitor/editor interface.
  // All media, old emailed PDF, existing static assets and historic redirects
  // stay on their original production routes and production D1/R2 bindings.
  const official=url.hostname==="ronde-des-archanges-universelle.eu"||
   url.hostname==="www.ronde-des-archanges-universelle.eu";
  const visualCandidate=url.hostname==="celebrations-visual-candidate.rondes.workers.dev";
  if((official||visualCandidate)&&env.DB){
   if(path==="/api/editor-publication")return handleEditorPublication(request,env);
   if(path==="/api/editor-media")return handleEditorMedia(request,env);
   if(path==="/api/editor-open-draft")return handleServerDraft(request,env);
   if(path==="/__editor/demo-preparation"||path==="/admin"||path==="/admin.html")
    return handlePreparationDemo(request,env);
   if(path==="/__editor/voir-le-site")return handleTrialSite(request,env);
   const directPages=new Map([
    ["/programme","preparation"],["/preparation","preparation"],
    ["/mercredi","mercredi"],["/jeudi","jeudi"],["/vendredi","vendredi"],
    ["/samedi","samedi"],["/dimanche","dimanche"],
    ["/apres-celebration","apres-celebration"],
    ["/bibliotheque","mediatheque"],["/mediatheque","mediatheque"],
    ["/mediatheque-generale","mediatheque-generale"]
   ]);
   const normalized=path.length>1?path.replace(/\/$/,""):path;
   if(path==="/"||path==="/index.html"||directPages.has(normalized)){
    const page=directPages.get(normalized);
    if(!page)return handleTrialSite(request,env);
    const viewUrl=new URL(request.url);viewUrl.searchParams.set("page",page);
    return handleTrialSite(new Request(viewUrl,request),env);
   }
  }
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
  const headers=new Headers(response.headers);
  // These protections apply to the future official domain as well as previews.
  // SAMEORIGIN permits legitimate same-site PDF frames without clickjacking.
  headers.set("x-content-type-options","nosniff");
  headers.set("referrer-policy","strict-origin-when-cross-origin");
  headers.set("x-frame-options","SAMEORIGIN");
  if(isolated){
   headers.set("x-robots-tag","noindex,nofollow,noarchive");
   headers.set("cache-control","no-store");
  }
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 }
};
