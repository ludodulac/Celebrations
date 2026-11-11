// M011-A — server routing for M010-B administration and M009-B identity claims.
// Imported by existing Workers but DENIED BY DEFAULT. Isolated page reads opt in separately; no private media route.
// Uses the historical D1-backed admin/participant bearer sessions; the site-editor
// cookie and browser-supplied roles are NEVER accepted as API authorization.
import {authorize,handleEditorAdminSession} from '../../auth-api.mjs';
import {hasEditorAccess} from '../../editor-site-access.mjs';
import {
  handleMemberDirectoryAdmin,handleMemberIdentityClaim
} from '../application/member-directory-admin-service.mjs';
import {handlePrivateEditorCommand} from '../application/private-editor-publication-service.mjs';
import {handleCanonicalPrivatePage,handleCanonicalPrivateList} from '../application/private-content-read-service.mjs';
import {createCanonicalPrivateLoaders} from '../persistence/private-canonical-content.mjs';
import {mayUseIsolatedMemberApi} from './editor-route-policy.mjs';

export const MEMBER_DIRECTORY_ADMIN_PATH='/api/admin/member-directory';
export const PRIVATE_EDITOR_PATH='/api/admin/private-editor';
export const EDITOR_ADMIN_SESSION_PATH='/api/admin/editor-session';
export const MEMBER_IDENTITY_CLAIM_PATH='/api/participant/identity-claim';
export const MEMBER_PAGE_PATH='/api/participant/space-page';
export const MEMBER_PAGES_PATH='/api/participant/space-pages';
const securityHeaders={
  'cache-control':'private, no-store, max-age=0',
  'pragma':'no-cache',
  'vary':'Authorization, Cookie',
  'x-content-type-options':'nosniff',
  'x-robots-tag':'noindex, nofollow, noarchive',
  'referrer-policy':'no-referrer'
};
function denied(status,message) {
  return Response.json({ok:false,error:message},{
    status,headers:{...securityHeaders,'content-type':'application/json; charset=utf-8'}
  });
}
export function isMemberAdminWorkerRoute(path) {
  return path===MEMBER_DIRECTORY_ADMIN_PATH || path===MEMBER_IDENTITY_CLAIM_PATH || path===EDITOR_ADMIN_SESSION_PATH || path===PRIVATE_EDITOR_PATH || path===MEMBER_PAGE_PATH || path===MEMBER_PAGES_PATH;
}
function acceptedOrigin(request,url) {
  const origin=request.headers.get('origin');
  if(origin && origin!==url.origin)return false;
  if(request.headers.get('sec-fetch-site')==='cross-site')return false;
  // Browser API mutations must carry an explicit SAME-ORIGIN Origin header.
  // No wildcard CORS and no cookie/CSRF fallback to the admin session.
  if(request.method==='POST' && origin!==url.origin)return false;
  return true;
}
export async function routeMemberAdminWorkerRequest(request,env,{
  resolveCanonicalSpace
}={}) {
  const url=new URL(request.url);
  if(!isMemberAdminWorkerRoute(url.pathname))return null;
  if(!mayUseIsolatedMemberApi(url,env))return denied(404,'Introuvable');
  const memberRead=url.pathname===MEMBER_PAGE_PATH||url.pathname===MEMBER_PAGES_PATH;
  if(memberRead){
    if(env.MEMBER_PAGE_READ_API_ENABLED!=='true')return denied(404,'Introuvable');
    if(!['GET','HEAD'].includes(request.method))return denied(405,'Méthode interdite');
    if(!acceptedOrigin(request,url))return denied(403,'Origine refusée');
    if(!env.DB||!env.EDITOR_BUCKET)return denied(503,'Service indisponible');
    // The existing read service performs explicit identity, release fence, and
    // live M002 grant checks. This isolated route never enables private media
    // or translated variants, nor accepts policies or principals from clients.
    const pageId=url.searchParams.get('pageId');
    const celebrationId=url.searchParams.get('celebration');
    if(url.pathname===MEMBER_PAGE_PATH)
      return handleCanonicalPrivatePage(request,env,{pageId,languageId:'fr'});
    if(!/^[1-9][0-9]{0,7}$/.test(celebrationId||''))return denied(404,'Introuvable');
    return handleCanonicalPrivateList(request,env,{celebrationId,languageId:'fr'});
  }
  const editorSession=url.pathname===EDITOR_ADMIN_SESSION_PATH;
  if(editorSession && env.EDITOR_D1_SESSION_API_ENABLED!=='true')return denied(404,'Introuvable');
  const privateEditor=url.pathname===PRIVATE_EDITOR_PATH;
  const admin=url.pathname===MEMBER_DIRECTORY_ADMIN_PATH||privateEditor;
  if(admin && request.method!=='GET' && request.method!=='POST' ||
     !admin && request.method!=='POST')
    return denied(405,'Méthode interdite');
  if(!acceptedOrigin(request,url))return denied(403,'Origine refusée');
  if(!env?.DB || typeof env.DB.prepare!=='function' ||
     typeof env.DB.batch!=='function')
    return denied(503,'Service indisponible');
  try {
    if(editorSession)return await handleEditorAdminSession(request,env,{hasEditorAccess});
    if(privateEditor)return await handlePrivateEditorCommand(request,env);
    // Check the correct historical session before service invocation; the
    // service checks it AGAIN at the actual read/write boundary.
    // An admin token cannot submit participant claims, and vice versa.
    if(!await authorize(request,env,admin))
      return denied(401,admin?'Administrateur requis':'Participant requis');
    if(admin) {
      // Per-request canonical published loader; denies unacknowledged releases.
      // No browser-provided space, policy or membership is trusted.
      const resolver=resolveCanonicalSpace??createCanonicalPrivateLoaders(env).loadPublishedSpace;
      return await handleMemberDirectoryAdmin(request,env,{resolveCanonicalSpace:resolver});
    }
    return await handleMemberIdentityClaim(request,env);
  } catch {
    return denied(503,'Service indisponible');
  }
}
