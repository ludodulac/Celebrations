// M005 — Pure, portable domain model for celebration spaces and draft copies.
// No storage, network, Cloudflare, publication or administration integration.
// IDs are allocated by the future trusted caller, never inferred from labels.
// Authorization is delegated to M002; translations are delegated to M003.
import {
  ACCESS_MODES, SPACE_VISIBILITIES, isMemberTypeId,
  canAccessSpace, canAccessPage
} from './member-access.mjs';
import {setCelebrationSpaceTranslation, resolveCelebrationSpaceTranslation}
  from './editor-localization.mjs';

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const stable = value => typeof value === 'string' && value.length > 0 &&
  value.length <= 254 && value === value.trim();
const identity = value => stable(value) ||
  (typeof value === 'number' && Number.isSafeInteger(value));
const asId = value => String(value);

// These individual associations must be obtained afresh from the authoritative
// member store. They are not part of an editorial template or copied entitlement.
const INDIVIDUAL_LINKS = new Set([
  'enrollments', 'spaceEnrollments', 'memberEnrollments',
  'memberships', 'memberAssignments', 'memberTypeAssignments',
  'participantEnrollments', 'participantAccess', 'invitedMembers',
  'memberIds', 'participantIds'
]);

function copyJSON(value) {
  // Editor snapshots / R2 manifests must contain JSON data, not live objects.
  const json = JSON.stringify(value);
  if (json === undefined) throw new TypeError('Expected portable JSON content');
  return JSON.parse(json);
}
function stripIndividualLinks(value) {
  if (Array.isArray(value)) return value.map(stripIndividualLinks);
  if (!value || typeof value !== 'object') return value;
  const clean = {};
  for (const [key, item] of Object.entries(value)) {
    if (!INDIVIDUAL_LINKS.has(key)) Object.defineProperty(clean, key, {
      value: stripIndividualLinks(item), enumerable: true, writable: true,
      configurable: true
    });
  }
  return clean;
}
function portable(value) {
  return stripIndividualLinks(copyJSON(value));
}
function requireCelebration(celebration) {
  if (!celebration || typeof celebration !== 'object' ||
      Array.isArray(celebration) || !identity(celebration.id))
    throw new TypeError('Celebration with a permanent ID required');
  if (own(celebration, 'spaces') && !Array.isArray(celebration.spaces))
    throw new TypeError('Invalid spaces collection');
  if (own(celebration, 'pages') && !Array.isArray(celebration.pages))
    throw new TypeError('Invalid pages collection');
  return celebration;
}
function policyShape(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return false;
  if (policy.mode === ACCESS_MODES.PUBLIC ||
      policy.mode === ACCESS_MODES.ALL_PRIVATE_TYPES) return true;
  return policy.mode === ACCESS_MODES.SELECTED_TYPES &&
    Array.isArray(policy.typeIds) && policy.typeIds.length > 0 &&
    policy.typeIds.every(isMemberTypeId);
}
function requireSpace(space) {
  if (!space || typeof space !== 'object' || Array.isArray(space) ||
      !stable(space.id) || !stable(space.celebrationId) ||
      !Object.values(SPACE_VISIBILITIES).includes(space.visibility) ||
      !policyShape(space.accessPolicy) ||
      (space.visibility === SPACE_VISIBILITIES.PUBLIC &&
       space.accessPolicy.mode !== ACCESS_MODES.PUBLIC) ||
      !Array.isArray(space.pages))
    throw new TypeError('Invalid canonical celebration space or access policy');
  const seen = new Set();
  for (const page of space.pages) {
    if (!page || !identity(page.id) || seen.has(asId(page.id)) ||
        page.celebrationId !== space.celebrationId ||
        page.spaceId !== space.id)
      throw new TypeError('Invalid, duplicate or unbound space page');
    seen.add(asId(page.id));
  }
  return space;
}
function requireUnique(newId, oldId, used, label) {
  if (!stable(newId) || asId(newId) === asId(oldId) || used.has(newId))
    throw new TypeError('Distinct permanent ' + label + ' ID required');
  used.add(newId);
}
function mappedId(ids, oldId, used, label) {
  const key = asId(oldId);
  if (!ids || !own(ids, key)) throw new TypeError('Missing ' + label + ' ID for ' + key);
  const value = ids[key];
  requireUnique(value, oldId, used, label);
  return value;
}
function allPageIds(celebration) {
  const ids = new Set();
  for (const page of celebration.pages ?? []) {
    if (!identity(page?.id) || ids.has(asId(page.id)))
      throw new TypeError('Invalid or duplicate celebration page ID');
    ids.add(asId(page.id));
  }
  for (const space of celebration.spaces ?? []) {
    requireSpace(space);
    if (space.celebrationId !== asId(celebration.id))
      throw new TypeError('Space belongs to another celebration');
    for (const page of space.pages) {
      if (ids.has(asId(page.id))) throw new TypeError('Page ID reused across spaces');
      ids.add(asId(page.id));
    }
  }
  return ids;
}
function draft(value, isSpace = false) {
  const item = portable(value);
  if (!isSpace) item.visibility = 'draft'; // editor's existing publication lifecycle
  item.publicationStatus = 'draft'; // additive state; never a publication command
  if (own(item, 'status')) item.status = 'draft';
  if (own(item, 'published')) item.published = false;
  if (own(item, 'isPublished')) item.isPublished = false;
  for (const field of ['publishedAt', 'publishedRevision', 'publishedVersion',
    'publishedSnapshot', 'publishedContent', 'publicationId']) {
    if (own(item, field)) delete item[field];
  }
  return item;
}
function remapPageTargets(value, map) {
  if (Array.isArray(value)) {
    value.forEach(child => remapPageTargets(child, map));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      // Explicit page-ID relations only. Keep href/url/src, media keys,
      // block IDs, dates and any free-form legacy metadata unchanged.
      if (['pageId', 'targetPageId', 'linkedPageId'].includes(key) &&
          (typeof child === 'string' || typeof child === 'number') &&
          map.has(asId(child))) value[key] = map.get(asId(child));
      else remapPageTargets(child, map);
    }
  }
}
function clonePage(source, newId, celebrationId, spaceId, pageMap) {
  if (!identity(source?.id)) throw new TypeError('Source page ID required');
  const page = draft(source);
  page.id = newId;
  page.celebrationId = celebrationId;
  if (spaceId) page.spaceId = spaceId;
  else if (own(page, 'spaceId'))
    throw new TypeError('A root page cannot retain an orphan space binding');
  remapPageTargets(page, pageMap);
  return page;
}

// M002 PRIVATE spaces always require individual enrollment, even if the
// accessPolicy mode is PUBLIC (invitation-only). Public is always explicit.
export function createCelebrationSpace({
  id, celebrationId, visibility = SPACE_VISIBILITIES.PRIVATE,
  accessPolicy = {mode: ACCESS_MODES.PUBLIC}, pages = [], ...content
} = {}) {
  if (!stable(id) || !identity(celebrationId) || !Array.isArray(pages))
    throw new TypeError('Stable space/celebration ID and pages required');
  const ownerId = asId(celebrationId);
  const space = portable({...content, id, celebrationId: ownerId,
    visibility, accessPolicy, pages: pages.map(page => {
      if (!identity(page?.id) ||
          (own(page, 'celebrationId') && page.celebrationId !== ownerId) ||
          (own(page, 'spaceId') && page.spaceId !== id))
        throw new TypeError('Page belongs to another space or celebration');
      return {...page, celebrationId: ownerId, spaceId: id};
    })});
  return requireSpace(space);
}

// Adds spaces to ONE existing main celebration, never creates a second
// celebration or changes legacy pages, stage IDs, dates or media.
export function addSpaceToCelebration(celebration, space) {
  requireCelebration(celebration);
  requireSpace(space);
  if (space.celebrationId !== asId(celebration.id))
    throw new TypeError('Cannot attach a space to another celebration');
  const used = allPageIds(celebration);
  if ((celebration.spaces ?? []).some(existing => existing.id === space.id))
    throw new TypeError('Space ID already exists');
  for (const page of space.pages) {
    if (used.has(asId(page.id))) throw new TypeError('Page ID already exists');
    used.add(asId(page.id));
  }
  const result = portable(celebration);
  result.spaces = [...(result.spaces ?? []), portable(space)];
  return result;
}
export function getCelebrationSpaces(celebration) {
  requireCelebration(celebration);
  allPageIds(celebration);
  return portable(celebration.spaces ?? []);
}
export function canReadSpacePage(celebration, spaceId, pageId, context = {}) {
  try {
    requireCelebration(celebration);
    if (!stable(spaceId) || !identity(pageId)) return false;
    const space = (celebration.spaces ?? []).find(item => item.id === spaceId);
    if (!space) return false;
    requireSpace(space);
    if (space.celebrationId !== asId(celebration.id)) return false;
    const page = space.pages.find(item => asId(item.id) === asId(pageId));
    // Delegate ALL access evaluation to the canonical M002 functions.
    return !!page && canAccessSpace(space, context) &&
      canAccessPage(page, {...context, space});
  } catch {
    return false; // invalid or missing canonical data fails closed
  }
}
export function translateCelebrationSpace(space, registry, languageId, content) {
  requireSpace(space);
  return setCelebrationSpaceTranslation(space, registry, languageId, content);
}
export function resolveSpaceLanguage(space, registry, languageId) {
  requireSpace(space);
  return resolveCelebrationSpaceTranslation(space, registry, languageId);
}

function copySpace(source, {id, celebrationId, pageIds, usedPages, pageMap}) {
  requireSpace(source);
  const target = draft(source, true);
  remapPageTargets(target, pageMap); // also rebind internal links in space translations/blocks
  target.id = id;
  target.celebrationId = celebrationId;
  // Inherit PRIVATE/PUBLIC and its type policy unchanged. Never inherit people.
  target.visibility = source.visibility;
  target.accessPolicy = portable(source.accessPolicy);
  target.pages = source.pages.map(page => clonePage(page,
    mappedId(pageIds, page.id, usedPages, 'page'), celebrationId, id, pageMap));
  return requireSpace(target);
}

// Requires distinct IDs supplied by the caller. No R2 copy is made; all
// media/document URLs are portable references within detached JSON objects.
export function duplicateCelebrationSpace(space, {
  id, pageIds = {}, reservedPageIds = []
} = {}) {
  requireSpace(space);
  const usedSpaces = new Set([space.id]);
  requireUnique(id, space.id, usedSpaces, 'space');
  const usedPages = new Set([...space.pages.map(page => asId(page.id)),
    ...reservedPageIds.map(asId)]);
  const pageMap = new Map(Object.entries(pageIds));
  return copySpace(space, {id, celebrationId: space.celebrationId,
    pageIds, usedPages, pageMap});
}

// Copies the entire editor aggregate, not published state or member grants.
// The new celebration is distinct; stages, dates and opaque legacy fields are
// retained until the future editor explicitly changes them.
export function duplicateCelebration(celebration, {
  id, spaceIds = {}, pageIds = {}, reservedSpaceIds = [], reservedPageIds = []
} = {}) {
  requireCelebration(celebration);
  const oldPages = allPageIds(celebration);
  const spaces = celebration.spaces ?? [];
  const usedSpaces = new Set([...spaces.map(space => space.id), ...reservedSpaceIds]);
  requireUnique(id, celebration.id, new Set([asId(celebration.id)]), 'celebration');
  const usedPages = new Set([...oldPages, ...reservedPageIds.map(asId)]);
  const pageMap = new Map(Object.entries(pageIds));
  const copied = draft(celebration);
  remapPageTargets(copied, pageMap); // also rebind links in celebration-level content
  copied.id = id;
  copied.pages = (celebration.pages ?? []).map(page =>
    clonePage(page, mappedId(pageIds, page.id, usedPages, 'page'), id, null, pageMap));
  copied.spaces = spaces.map(space => copySpace(space, {
    id: mappedId(spaceIds, space.id, usedSpaces, 'space'),
    celebrationId: id, pageIds, usedPages, pageMap
  }));
  // Existing historical fields remain serialized as provided; no D1/R2 writes.
  return copied;
}
