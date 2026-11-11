// M14 — server route boundaries, without DB, browser or Cloudflare dependencies.
// A read-only candidate must NOT expose the official admin UI, private draft
// documents, private media catalogue, login/logout actions, or their API routes.
export const OFFICIAL_EDITOR_HOSTS=Object.freeze([
 'ronde-des-archanges-universelle.eu',
 'www.ronde-des-archanges-universelle.eu'
]);
export const READONLY_CANDIDATE_HOSTS=Object.freeze([
 'celebrations-exit-production.rondes.workers.dev',
 'celebrations-visual-candidate.rondes.workers.dev',
 'celebrations-m015-public-preprod.rondes.workers.dev'
]);
const official=new Set(OFFICIAL_EDITOR_HOSTS);
const readonly=new Set(READONLY_CANDIDATE_HOSTS);
const privatePaths=new Set([
 '/admin','/admin.html','/__editor/demo-preparation',
 '/__editor/edit','/__editor/e1-client.js',
 '/api/editor-open-draft','/api/editor-server-draft',
 '/api/editor-media','/api/editor-access','/api/editor-logout'
]);
export function isOfficialEditorHost(host){return official.has(host)}
export function isReadonlyCandidateHost(host){return readonly.has(host)}
export function isPrivateEditorPath(path){return privatePaths.has(path)}
export function sameOriginEditorWrite(request){
 const url=new URL(request.url);
 return url.protocol==='https:'&&request.headers.get('origin')===url.origin;
}

// Shared explicit HTTPS gate for isolated member administration and visual editor.
export function mayUseIsolatedMemberApi(url,env){
 return env?.MEMBER_DIRECTORY_API_ENABLED==='true' &&
  typeof env.MEMBER_DIRECTORY_API_HOST==='string' &&
  env.MEMBER_DIRECTORY_API_HOST===url.hostname && url.protocol==='https:' &&
  !isOfficialEditorHost(url.hostname) && !isReadonlyCandidateHost(url.hostname) &&
  url.hostname!=='celebrations-exit-staging.rondes.workers.dev';
}
