// Isolated staging entrypoint. No production routes or bindings are changed.
import {handleMediaAdmin} from "./media-admin-api.mjs";
import {handleMedia} from "./media-gateway.mjs";
import {handleAuth} from "./auth-api.mjs";
import {handleAudience} from "./audience-api.mjs";
import {handleSafeSave} from "./safe-save-api.mjs";
import {handleAdmin} from "./admin-api.mjs";
import {handlePublicData} from "./public-data-api.mjs";
import {handleFooterAdmin} from "./footer-admin-api.mjs";
import {handleParticipantsAdmin} from "./participants-admin-api.mjs";
import {handleStats} from "./stats-api.mjs";
import {handleEditorB} from "./editor-b-api.mjs";
import {handleEditorD,handleEditorDSession,handleEditorDEntry} from "./editor-d-preview.mjs";
import {handleEditorDMedia} from "./editor-d2-media.mjs";
import {setupPage,accessConfig,accessLogout} from "./editor-permanent-access.mjs";
import {handleEditorD4Access,handleEditorD4Login} from "./editor-d4-access.mjs";
import {handleEditorE1} from "./editor-e1-api.mjs";
import {handleEditorE1Page,handleEditorE1Client} from "./editor-e1-page.mjs";
// The old disconnected demo redirects to the new visual editor; code remains available in GitHub.
import {handlePreparationDemo} from "./editor-demo-preparation-page.mjs";
import {handleTrialSite} from "./editor-trial-site-page.mjs";
import {handleTrialAudio} from "./editor-trial-audio-api.mjs";
import {handleServerDraft} from "./editor-server-draft-api.mjs";
import {handleEditorPublication} from "./editor-publication-api.mjs";
import {handlePublicEditorUpload} from "./public-upload-gateway.mjs";
import {isBlockedPublicAssetPath,privatePublicAssetNotFound} from "./app/security/public-media-boundary.mjs";
import {isMemberAdminWorkerRoute,routeMemberAdminWorkerRequest} from "./app/security/member-admin-worker-routes.mjs";
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(isBlockedPublicAssetPath(path))return privatePublicAssetNotFound();
  // FINALISATION 2: the obsolete staging hostname is now PUBLIC-ONLY.
  // Its editor has moved to the official authenticated domain. Keep public
  // visitors and historic media working, but deny every private/admin route
  // BEFORE any D1, R2, asset fallback or legacy handler is consulted.
  const obsoleteStaging=url.hostname==='celebrations-exit-staging.rondes.workers.dev';
  if(obsoleteStaging){
   const denied={'cache-control':'no-store','x-robots-tag':'noindex,nofollow,noarchive',
    'x-content-type-options':'nosniff'};
   if(request.method!=='GET'&&request.method!=='HEAD')
    return new Response('Lecture seule',{status:405,headers:denied});
   if(path==='/admin'||path==='/admin.html'||path.startsWith('/media/new/')||
    path.startsWith('/__editor/')&&path!=='/__editor/voir-le-site'||
    path.startsWith('/api/')&&!['/api/public-data','/api/editor-publication'].includes(path))
    return new Response('Introuvable',{status:404,headers:denied});
  }
  // M011-A: same protected, default-OFF API boundary as the other Worker.
  // The obsolete staging hostname remains read-only and cannot opt in.
  if(isMemberAdminWorkerRoute(path))return routeMemberAdminWorkerRequest(request,env);
  if((path==="/"||path==="/index.html"||path==="/admin.html"||path==="/admin")&&!url.searchParams.has("staging")){
   url.searchParams.set("staging","1");
   return Response.redirect(url.toString(),302);
  }
  // Guard application uploads BEFORE the broad historical /media/ prefix.
  // Uploaded editor files require publication/privileged preview checks before legacy /media.
  if(path.startsWith("/media/new/"))return handlePublicEditorUpload(request,{...env,EDITOR_BUCKET:env.MEDIA_BUCKET});
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
  if(path==="/api/editor-b")return handleEditorB(request,env);
  if(path==="/__editor/preview")return handleEditorD(request,env);
  if(path==="/__editor/session")return handleEditorDSession(request,env);
  if(path==="/__editor/entry")return handleEditorDEntry(request,env);
  if(path==="/__editor/media")return handleEditorDMedia(request,env);
  if(path==="/__editor/access")return handleEditorD4Access(request);
  if(path==="/__editor/access/setup")return setupPage(request);
  if(path==="/__editor/access/config")return accessConfig(request,env);
  if(path==="/__editor/access/session")return handleEditorD4Login(request,env);
  if(path==="/__editor/access/logout")return accessLogout(request,env);
  if(path==="/api/editor-e1")return handleEditorE1(request,env);
  if(path==="/api/editor-trial-audio")return handleTrialAudio(request,env);
  if(path==="/api/editor-publication"&&request.method==="GET")
   return handleEditorPublication(request,{...env,EDITOR_BUCKET:env.MEDIA_BUCKET});
  if(path==="/api/editor-server-draft")return handleServerDraft(request,env);
  if(path==="/api/editor-open-draft"){
   // Shared production content must not remain writable through this old test host.
   // Public preview GET still works, but changes are made on the official domain.
   if(request.method!=="GET")return Response.json({ok:false,
     error:"Les modifications se font désormais sur le site officiel."},
     {status:403,headers:{"cache-control":"no-store"}});
   return handleServerDraft(request,env);
  }
  if(path==="/__editor/demo")return Response.redirect(new URL("/__editor/demo-preparation",url).toString(),302);
  if(path==="/__editor/demo-preparation")return handlePreparationDemo(request,env);
  if(path==="/__editor/voir-le-site")return handleTrialSite(request,env);
  if(path==="/__editor/edit")return handleEditorE1Page(request,env);
  if(path==="/__editor/e1-client.js")return handleEditorE1Client(request,env);
  if((request.method==="GET"||request.method==="HEAD")&&env.ASSETS)return env.ASSETS.fetch(request);
  return new Response("Not found",{status:404,headers:{"cache-control":"no-store"}});
 }
};
