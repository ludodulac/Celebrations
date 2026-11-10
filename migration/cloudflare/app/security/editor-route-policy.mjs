// M14 — server route boundaries, without DB, browser or Cloudflare dependencies.
// A read-only candidate must NOT expose the official admin UI, private draft
// documents, private media catalogue, login/logout actions, or their API routes.
export const OFFICIAL_EDITOR_HOSTS=Object.freeze([
 'ronde-des-archanges-universelle.eu',
 'www.ronde-des-archanges-universelle.eu'
]);
export const READONLY_CANDIDATE_HOSTS=Object.freeze([
 'celebrations-exit-production.rondes.workers.dev',
 'celebrations-visual-candidate.rondes.workers.dev'
]);
const official=new Set(OFFICIAL_EDITOR_HOSTS);
const readonly=new Set(READONLY_CANDIDATE_HOSTS);
const privatePaths=new Set([
 '/admin','/admin.html','/__editor/demo-preparation',
 '/__editor/edit','/__editor/e1-client.js',
 '/api/editor-open-draft','/api/editor-server-draft',
 '/api/editor-media','/api/editor-access','/api/editor-logout'
]);
// One canonical allowlist for the historical staging editor and current visitor/admin
// rendering hosts. The retired production workers.dev hostname is NOT allowed.
const editorPageHosts=new Set([
 ...OFFICIAL_EDITOR_HOSTS,
 'celebrations-exit-staging.rondes.workers.dev',
 'celebrations-visual-candidate.rondes.workers.dev'
]);
export function isAllowedEditorPageHost(host){return editorPageHosts.has(host)}
export function isOfficialEditorHost(host){return official.has(host)}
export function isReadonlyCandidateHost(host){return readonly.has(host)}
export function isPrivateEditorPath(path){return privatePaths.has(path)}
export function sameOriginEditorWrite(request){
 const url=new URL(request.url);
 return url.protocol==='https:'&&request.headers.get('origin')===url.origin;
}
