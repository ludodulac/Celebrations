// M011-A — server routing for M010-B administration and M009-B identity claims.
// Imported by existing Workers but DENIED BY DEFAULT. No private page/media routes.
// Uses the historical D1-backed admin/participant bearer sessions; the site-editor
// cookie and browser-supplied roles are NEVER accepted as API authorization.
import {authorize,handleEditorAdminSession} from '../../auth-api.mjs';
import {
  handleMemberDirectoryAdmin,handleMemberIdentityClaim
} from '../application/member-directory-admin-service.mjs';
import {handlePrivateEditorCommand} from '../application/private-editor-publication-service.mjs';
import {createCanonicalPrivateLoaders} from '../persistence/private-canonical-content.mjs';
import {isOfficialEditorHost,isReadonlyCandidateHost} from './editor-route-policy.mjs';

export const MEMBER_DIRECTORY_ADMIN_PATH='/api/admin/member-directory';
export const PRIVATE_EDITOR_PATH='/api/admin/private-editor';
export const EDITOR_ADMIN_SESSION_PATH='/api/admin/editor-session';
export const MEMBER_IDENTITY_CLAIM_PATH='/api/participant/identity-claim';
const OBSOLETE_STAGING='celebrations-exit-staging.rondes.workers.dev';
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
  return path===MEMBER_DIRECTORY_ADMIN_PATH || path===MEMBER_IDENTITY_CLAIM_PATH || path===EDITOR_ADMIN_SESSION_PATH || path===PRIVATE_EDITOR_PATH;
}
function mayUseIsolatedMemberApi(url,env) {
  // Both switches must be set by a future operator on a deliberately
  // isolated HTTPS host. No flag or host defaults, even in staging.
  // Deployment on an official or existing preview hostname cannot enable it.
  return env?.MEMBER_DIRECTORY_API_ENABLED==='true' &&
    typeof env.MEMBER_DIRECTORY_API_HOST==='string' &&
    env.MEMBER_DIRECTORY_API_HOST===url.hostname &&
    url.protocol==='https:' &&
    !isOfficialEditorHost(url.hostname) &&
    !isReadonlyCandidateHost(url.hostname) &&
    url.hostname!==OBSOLETE_STAGING;
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
    if(editorSession)return await handleEditorAdminSession(request,env);
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
