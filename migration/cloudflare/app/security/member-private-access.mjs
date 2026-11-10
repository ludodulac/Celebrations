// M008-C — read-only, fail-closed member authorization for FUTURE Cloudflare routes.
// NOT imported by production/staging entrypoints: no private endpoint is enabled.
// Reuse the existing participant session verifier and M002 domain rules.
import {resolveExplicitMemberIdentity} from './member-identity-links.mjs';
import {canAccessPage, ACCESS_MODES, SPACE_VISIBILITIES, isMemberTypeId}
  from '../domain/member-access.mjs';


const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const stable = value => typeof value === 'string' && value.length > 0 &&
  value.length <= 254 && value === value.trim();
const privateKey = value => typeof value === 'string' &&
  value.startsWith('private-members/') && value.length < 1024 &&
  !value.includes('\\') && !/[\u0000-\u001f]/.test(value) &&
  value.split('/').every(segment => segment && segment !== '.' && segment !== '..');

const SECURITY_HEADERS = Object.freeze({
  'cache-control': 'private, no-store, max-age=0',
  'pragma': 'no-cache',
  'vary': 'Authorization, Cookie',
  'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'referrer-policy': 'no-referrer'
});

function secure(response, method) {
  if (!(response instanceof Response)) throw new TypeError('Handler must return Response');
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  // Prevent a renderer/R2 metadata from accidentally turning a private page into a redirect
  // or a shared-cacheable response. No 304/ETag/Last-Modified for protected content.
  for (const name of ['etag', 'last-modified', 'expires', 'surrogate-control',
    'cdn-cache-control', 'cloudflare-cdn-cache-control', 'location']) headers.delete(name);
  return new Response(method === 'HEAD' ? null : response.body, {
    status: response.status, statusText: response.statusText, headers
  });
}
export const privateNotFound = () => secure(new Response('Introuvable', {status: 404}), 'GET');
const unavailable = () => secure(new Response('Service indisponible', {status: 503}), 'GET');
const methodDenied = () => secure(new Response('Méthode interdite', {status: 405}), 'GET');

// The single identity trust boundary: M009-B verifies a participant (never an
// administrator) session, its expiry, and an independently reviewed permanent
// person/account link in D1. Matching email addresses alone grant NO identity.
// Keep the M008-C public name for existing server callers; do not replicate
// session or linkage logic here.
export async function resolveVerifiedMember(request, env) {
  return resolveExplicitMemberIdentity(request, env);
}

// Security read view of proposed M007-A tables. M008-B retains ownership of
// writes/schema; its adapter can replace these SELECT implementations once ready.
// Every grant is resolved afresh for each request (no stale cross-user cache).
async function loadTrustedGrants(db, principal, space) {
  const rows = await db.prepare(
    'SELECT t.id AS type_id, t.disabled AS disabled ' +
    'FROM celebrations_directory_person_types pt ' +
    'JOIN celebrations_directory_member_types t ON t.id=pt.type_id ' +
    'WHERE pt.person_id=?'
  ).bind(principal.id).all();
  if (!Array.isArray(rows?.results)) throw Error('Invalid D1 grants');
  const types = [], memberships = [];
  for (const row of rows.results) {
    if (!isMemberTypeId(row?.type_id) || ![0, 1, false, true].includes(row.disabled))
      throw Error('Invalid member grant');
    types.push({id: row.type_id, disabled: row.disabled === 1 || row.disabled === true});
    memberships.push({memberId: principal.id, typeId: row.type_id});
  }
  const enrollments = [];
  if (space?.visibility === SPACE_VISIBILITIES.PRIVATE) {
    const celebrationId = Number(space.celebrationId);
    if (!Number.isSafeInteger(celebrationId) || celebrationId < 1 ||
        String(celebrationId) !== space.celebrationId) throw Error('Invalid celebration');
    const enrolled = await db.prepare(
      'SELECT 1 AS enrolled FROM celebrations_directory_private_space_enrollments e ' +
      'JOIN celebrations_directory_private_spaces s ' +
      'ON s.space_id=e.space_id AND s.celebration_id=e.celebration_id ' +
      'JOIN celebrations_directory_person_celebrations pc ' +
      'ON pc.person_id=e.person_id AND pc.celebration_id=e.celebration_id ' +
      'WHERE e.person_id=? AND e.space_id=? AND e.celebration_id=? LIMIT 1'
    ).bind(principal.id, space.id, celebrationId).first();
    if (enrolled?.enrolled === 1) enrollments.push({
      memberId: principal.id, spaceId: space.id
    });
  }
  return {principal, types, memberships, enrollments, space: space ?? null};
}

function releasedPage(page, id) {
  return page && stable(id) && page.id === id &&
    page.visibility === 'published' &&
    (page.publicationStatus == null || page.publicationStatus === 'published') &&
    (!own(page, 'published') || page.published === true) &&
    (!own(page, 'isPublished') || page.isPublished === true) &&
    own(page, 'accessPolicy') && !!page.accessPolicy &&
    typeof page.accessPolicy === 'object';
}

// Only an explicitly restricted page or a page inside a PRIVATE space can
// enter a private handler. A missing policy and a legacy PUBLIC page are NOT
// evidence of a private release (they belong to established public routes).
function needsPrivateGate(page, space) {
  if (page.spaceId !== undefined) {
    if (!stable(page.spaceId) || !space || space.id !== page.spaceId) return false;
    if (space.visibility === SPACE_VISIBILITIES.PRIVATE) return true;
  }
  return page.accessPolicy.mode === ACCESS_MODES.ALL_PRIVATE_TYPES ||
    page.accessPolicy.mode === ACCESS_MODES.SELECTED_TYPES;
}

// All data loaders MUST be server-owned and consult authoritative PUBLISHED
// records. They must never read request-supplied page/policy/grants or editor
// drafts. Generic ID is only a lookup key, never proof of permission.
async function evaluate(request, env, {pageId, loadPublishedPage, loadPublishedSpace}) {
  if (!stable(pageId) || typeof loadPublishedPage !== 'function' ||
      typeof loadPublishedSpace !== 'function') return null;
  const principal = await resolveVerifiedMember(request, env);
  if (!principal) return null;
  const page = await loadPublishedPage(pageId, env);
  if (!releasedPage(page, pageId)) return null;
  const space = own(page, 'spaceId')
    ? await loadPublishedSpace(page.spaceId, env) : null;
  if (!needsPrivateGate(page, space)) return null;
  const context = await loadTrustedGrants(env.DB, principal, space);
  if (!canAccessPage(page, context)) return null;
  return {page, space, personId: principal.id};
}

// The ONLY HTTP-facing page wrapper: authorize before calling render.
// Even language variants, links, search matches and nested media must be
// assembled strictly after this gate; never return a raw editorial snapshot.
export async function handlePrivatePage(request, env, options = {}) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return methodDenied();
  try {
    const decision = await evaluate(request, env, options);
    if (!decision) return privateNotFound(); // same result for all denials
    if (typeof options.render !== 'function') return unavailable();
    return secure(await options.render(decision, request, env), request.method);
  } catch {
    return unavailable(); // no exception/SQL/person metadata in response
  }
}

// PRIVATE_MEMBER_BUCKET is a dedicated non-public R2 binding, NOT the
// existing public MEDIA_BUCKET or EDITOR_BUCKET. The authoritative lookup
// must bind each media record to exactly one published canonical owner page.
// A guessed storage key, translated URL or "general" gallery flag never grants.
export async function handlePrivateMedia(request, env, options = {}) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return methodDenied();
  try {
    if (!env?.PRIVATE_MEMBER_BUCKET || typeof options.loadPrivateMedia !== 'function' ||
        !stable(options.mediaId) || !stable(options.pageId)) return unavailable();
    const decision = await evaluate(request, env, options);
    if (!decision) return privateNotFound();
    const media = await options.loadPrivateMedia(options.mediaId, env);
    if (!media || media.id !== options.mediaId || media.pageId !== decision.page.id ||
        media.visibility !== 'private' || !privateKey(media.storageKey))
      return privateNotFound();
    // Do not serve if a client supplied an arbitrary key in query/body. Always
    // use the canonical record's key after its owner's authorization.
    const range = request.headers.get('range');
    if (range && !/^bytes=\d*-\d+$/.test(range))
      return secure(new Response(null, {status: 416}), request.method);
    const object = await env.PRIVATE_MEMBER_BUCKET.get(media.storageKey,
      range ? {range: request.headers} : undefined);
    if (!object) return privateNotFound();
    const headers = new Headers();
    object.writeHttpMetadata?.(headers);
    headers.set('content-type', stable(media.mimeType) ? media.mimeType : 'application/octet-stream');
    headers.set('content-disposition', 'attachment');
    headers.set('content-security-policy', "default-src 'none'; sandbox");
    headers.set('accept-ranges', 'bytes');
    headers.set('content-length', String(object.range?.length ?? object.size));
    if (range && object.range) {
      const start = object.range.offset ?? 0;
      headers.set('content-range', `bytes ${start}-${start + object.range.length - 1}/${object.size}`);
    }
    return secure(new Response(request.method === 'HEAD' ? null : object.body, {
      status: range && object.range ? 206 : 200, headers
    }), request.method);
  } catch { return unavailable(); }
}

// Search/navigation/translations: return ONLY authorized canonical IDs.
// Call this BEFORE looking up localized content/snippets/media. It never
// returns unauthorized page objects, titles, translations or existence flags.
export async function allowedPrivatePageIds(request, env, pageIds, loaders) {
  if (!Array.isArray(pageIds) || pageIds.length > 1000) throw TypeError('Invalid page list');
  const ids = [];
  for (const pageId of new Set(pageIds)) {
    const response = await handlePrivatePage(request, env, {
      ...loaders, pageId,
      render: () => new Response(null, {status: 204})
    });
    if (response.status === 503) throw Error('Private search unavailable');
    if (response.status === 204) ids.push(pageId);
  }
  return ids;
}
