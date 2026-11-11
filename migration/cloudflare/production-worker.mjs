// Production-candidate entrypoint: isolated workers.dev deployment allowed before cutover.
// Never attach a real custom domain before DNS/backup/rollback authorization.
import {handleMediaAdmin} from "./media-admin-api.mjs";
import {handleMedia} from "./media-gateway.mjs";
import {handleLegacyLink} from "./legacy-link-router.mjs";
import {handleAuth,authorize} from "./auth-api.mjs";
import {handleSiteIdentity} from "./site-identity-api.mjs";
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
import {handleEditorPublication,handleEditorMedia} from "./editor-publication-api.mjs";
import {handlePublicEditorUpload} from "./public-upload-gateway.mjs";
import {isBlockedPublicAssetPath,privatePublicAssetNotFound} from "./app/security/public-media-boundary.mjs";
import {isMemberAdminWorkerRoute,routeMemberAdminWorkerRequest} from "./app/security/member-admin-worker-routes.mjs";
import {mayUseIsolatedMemberApi} from "./app/security/editor-route-policy.mjs";
import {hasEditorAccess,editorAccessAction,editorLoginPage,editorLogout} from "./editor-site-access.mjs";
import {isOfficialEditorHost,isReadonlyCandidateHost,isM016AdminPreprodHost,isPrivateEditorPath,sameOriginEditorWrite} from "./app/security/editor-route-policy.mjs";
// Immutable public route aliases. Keep historical links unchanged.
const DIRECT_PAGES=new Map([
 ["/programme","preparation"],["/preparation","preparation"],
 ["/mercredi","mercredi"],["/jeudi","jeudi"],["/vendredi","vendredi"],
 ["/samedi","samedi"],["/dimanche","dimanche"],
 ["/apres-celebration","apres-celebration"],
 ["/bibliotheque","mediatheque"],["/mediatheque","mediatheque"],
 ["/mediatheque-generale","mediatheque-generale"]
]);
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  // Guard before ANY legacy alias, API, R2 or static-assets fallback.
  if(isBlockedPublicAssetPath(path))return privatePublicAssetNotFound();
  const workingPreprod=isM016AdminPreprodHost(url.hostname,env);
  // Do not serve ANY route if the exact new Worker loses its two opt-ins.
  if(url.hostname==='celebrations-m016-admin-preprod.rondes.workers.dev'&&!workingPreprod)
   return new Response('Preproduction unavailable',{status:503,headers:{'cache-control':'no-store','x-robots-tag':'noindex'}});
  // M021-A: while demo accounts exist, the ENTIRE M016 preview requires
  // the owner's EXISTING editor PIN cookie. The member login still checks
  // its own participant session and server-side category/celebration grants.
  // This boundary is never active for official or read-only domains.
  // Existing D1 admin calls deliberately omit the PIN cookie and send a
  // short-lived bearer instead. Validate that bearer server-side before bypass.
  // Raw bearer presence alone never opens the preproduction boundary.
  const m021VerifiedAdmin=workingPreprod&&path.startsWith('/api/admin/')&&
    request.headers.get('authorization')?.startsWith('Bearer ')&&
    !!(await authorize(request,env,true));
  if(workingPreprod&&env.M021_PREPROD_ACCESS_GATE_ENABLED==='true'&&
     path!=='/api/editor-access'&&!['/admin','/admin.html'].includes(path)&&
     !m021VerifiedAdmin&&!(await hasEditorAccess(request,env))){
    if((path==='/'||path==='/index.html')&&request.method==='GET')
     return Response.redirect(url.origin+'/admin',302);
    return new Response('Préproduction privée : code administrateur requis',{
     status:403,headers:{'cache-control':'no-store','x-robots-tag':'noindex,nofollow,noarchive',
      'x-content-type-options':'nosniff'}});
  }
  const isolated=isReadonlyCandidateHost(url.hostname);
  // Before domain cutover the independent candidate is READ-ONLY, by design.
  // This gate prevents public signups, analytics writes and admin mutations.
  if(isolated && request.method!=="GET" && request.method!=="HEAD")
   return new Response("Pre-cutover preview is read-only",{status:405,headers:{
    "x-robots-tag":"noindex,nofollow,noarchive","cache-control":"no-store"
   }});

  // Read-only candidate means PUBLIC read-only, not anonymous private GET.
  // This early route boundary runs before static asset fallback, D1 or R2.
  // Candidate workers.dev hosts must only expose PUBLIC read endpoints.
  // Never leak an unpublished /media/new/ UUID or an admin API by direct GET.
  if(isolated&&(isPrivateEditorPath(path)||path.startsWith('/media/new/')||
      path.startsWith('/__editor/')&&path!=='/__editor/voir-le-site'||
      path.startsWith('/api/')&&!['/api/editor-publication','/api/public-data'].includes(path)))
   return new Response("Introuvable",{status:404,headers:{
    "x-robots-tag":"noindex,nofollow,noarchive",
    "cache-control":"no-store","x-content-type-options":"nosniff"
   }});

  if(isolated && path==="/robots.txt")
   return new Response("User-agent: *\nDisallow: /\n",{
    headers:{"content-type":"text/plain; charset=utf-8","x-robots-tag":"noindex,nofollow,noarchive","cache-control":"no-store"}});
  // Gate the administration itself AND every server write. Public viewing and
  // old mailed PDF/media addresses remain accessible without signing in.
  const officialHost=isOfficialEditorHost(url.hostname);
  if(officialHost||workingPreprod){
   if(path==="/api/editor-access")return editorAccessAction(request,env);
   if(path==="/api/editor-logout"){
    if(request.method!=="POST")return new Response("Méthode interdite",{status:405});
    if(!sameOriginEditorWrite(request))return new Response("Origine interdite",{status:403});
    return editorLogout(request);
   }
   const editorPage=path==="/admin"||path==="/admin.html"||
    path==="/__editor/demo-preparation";
   if(editorPage&&!(await hasEditorAccess(request,env)))
    return editorLoginPage(request,env,url.searchParams.has("erreur"));
   if(path==="/api/editor-open-draft"&&!(await hasEditorAccess(request,env)))
    return Response.json({ok:false,error:"Code administrateur nécessaire."},{status:401,
     headers:{"cache-control":"no-store"}});
  }
  // M011-A: explicitly disabled unless two non-production opt-ins are configured.
  // Even then, the official and read-only hosts are permanently excluded here.
  if(isMemberAdminWorkerRoute(path))return routeMemberAdminWorkerRequest(request,env);
  // Render via the existing visitor, strictly behind isolated opt-ins.
  if(mayUseIsolatedMemberApi(url,env)&&env.MEMBER_PAGE_READ_API_ENABLED==='true'&&
      ['GET','HEAD'].includes(request.method)&&(path==='/'||path==='/__editor/voir-le-site'))
    return handleTrialSite(request,env);
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
  if(path.startsWith("/media/new/"))return handlePublicEditorUpload(request,env);
  if(path.startsWith("/media/")||path.startsWith("/letter/"))return handleMedia(request,env);
  // The two official domains now use the same visual visitor/editor interface.
  // All media, old emailed PDF, existing static assets and historic redirects
  // stay on their original production routes and production D1/R2 bindings.
  const visualCandidate=url.hostname==="celebrations-visual-candidate.rondes.workers.dev";
  if((officialHost||visualCandidate||isolated||workingPreprod)&&env.DB){
   if(path==="/api/editor-publication")return handleEditorPublication(request,env);
   if(path==="/api/editor-media")return handleEditorMedia(request,env);
   if(path==="/api/editor-open-draft")return handleServerDraft(request,env);
   if(path==="/__editor/demo-preparation"||path==="/admin"||path==="/admin.html")
    return handlePreparationDemo(request,env);
   if(path==="/__editor/voir-le-site")return handleTrialSite(request,env);
   // Routes are defined once at module load, not rebuilt on every request.
   const normalized=path.length>1?path.replace(/\/$/,""):path;
   if(path==="/"||path==="/index.html"||DIRECT_PAGES.has(normalized)){
    const page=DIRECT_PAGES.get(normalized);
    if(!page)return handleTrialSite(request,env);
    const viewUrl=new URL(request.url);viewUrl.searchParams.set("page",page);
    return handleTrialSite(new Request(viewUrl,request),env);
   }
  }
  if(path==="/api/site-identity")return handleSiteIdentity(request,env);
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
  if(isolated||workingPreprod){
   headers.set("x-robots-tag","noindex,nofollow,noarchive");
   headers.set("cache-control","no-store");
  }
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 }
};
