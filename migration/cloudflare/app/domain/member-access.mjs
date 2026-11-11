// M002 — Portable membership and authorization rules, deliberately NOT wired to
// any public route. Inputs are trusted records supplied by a future server
// adapter after session verification; never accept a client-asserted principal.
// No browser, Cloudflare binding, data store, network, clock, or crypto access.

export const ACCESS_MODES = Object.freeze({
 PUBLIC: 'PUBLIC',
 ALL_PRIVATE_TYPES: 'ALL_PRIVATE_TYPES',
 SELECTED_TYPES: 'SELECTED_TYPES'
});
export const SPACE_VISIBILITIES = Object.freeze({PUBLIC: 'PUBLIC', PRIVATE: 'PRIVATE'});

// Namespace future member types instead of silently converting historic
// celebrations_groups ids (all, angel, nonangel) into access entitlements.
const TYPE_ID = /^member-type:[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const identity = value => typeof value === 'string' && value.length > 0 &&
 value.length <= 254 && value === value.trim();
export const isMemberTypeId = id => typeof id === 'string' && TYPE_ID.test(id);

export function createMemberType({id, name} = {}) {
 if (!isMemberTypeId(id)) throw new TypeError('Stable member-type identifier required');
 if (typeof name !== 'string' || !name.trim() || name.trim().length > 120)
  throw new TypeError('A member type requires a non-empty name (max 120 characters)');
 return {id, name: name.trim()};
}

export function renameMemberType(type, name) {
 const renamed = createMemberType({id: type?.id, name});
 return {...type, name: renamed.name}; // preserve ID, metadata and existing links
}

// Build normalized association rows; the caller will eventually persist these
// in D1, not inside a page, translated content, or Cloudflare account metadata.
export function assignMemberTypes(memberId, typeIds, catalogue) {
 if (!identity(memberId) || !Array.isArray(typeIds) || !Array.isArray(catalogue))
  throw new TypeError('Member, type ids and catalogue required');
 const known = new Set(catalogue.filter(t => isMemberTypeId(t?.id)).map(t => t.id));
 const assigned = new Set();
 for (const id of typeIds) {
  if (!isMemberTypeId(id) || !known.has(id)) throw new TypeError('Unknown member type');
  assigned.add(id);
 }
 return [...assigned].map(typeId => ({memberId, typeId}));
}

export function enrollInSpace(memberId, spaceId) {
 if (!identity(memberId) || !identity(spaceId))
  throw new TypeError('Stable member and space ids required');
 return {memberId, spaceId};
}

const signedIn = principal => !!principal && principal.authenticated === true &&
 identity(principal.id);

function validPolicy(policy) {
 if (!policy || typeof policy !== 'object' || Array.isArray(policy)) return false;
 if (policy.mode === ACCESS_MODES.PUBLIC ||
     policy.mode === ACCESS_MODES.ALL_PRIVATE_TYPES) return true;
 return policy.mode === ACCESS_MODES.SELECTED_TYPES &&
  Array.isArray(policy.typeIds) && policy.typeIds.length > 0 &&
  policy.typeIds.every(isMemberTypeId);
}

function memberTypeIds(context) {
 const principal = context?.principal;
 if (!signedIn(principal) || !Array.isArray(context?.types) ||
     !Array.isArray(context?.memberships)) return new Set();
 const known = new Set(context.types.filter(type => isMemberTypeId(type?.id) &&
  type.disabled !== true).map(type => type.id));
 return new Set(context.memberships.filter(link =>
  link?.memberId === principal.id && known.has(link.typeId)).map(link => link.typeId));
}

export function canAccessPolicy(policy, context = {}) {
 if (!validPolicy(policy)) return false; // unknown/invalid policy: fail closed
 if (policy.mode === ACCESS_MODES.PUBLIC) return true;
 if (!signedIn(context.principal)) return false;
 const assigned = memberTypeIds(context);
 if (policy.mode === ACCESS_MODES.ALL_PRIVATE_TYPES) return assigned.size > 0;
 return policy.typeIds.some(id => assigned.has(id));
}

export function canAccessSpace(space, context = {}) {
 if (!space || !identity(space.id) || !identity(space.celebrationId) ||
     !Object.values(SPACE_VISIBILITIES).includes(space.visibility) ||
     !validPolicy(space.accessPolicy)) return false;
 if (space.visibility === SPACE_VISIBILITIES.PUBLIC) {
  // A public space must really be public; individual pages may still be private.
  return space.accessPolicy.mode === ACCESS_MODES.PUBLIC;
 }
 // Category-based variants reuse the existing celebration enrollment,
 // while historical invitation-only spaces keep their individual enrollments.
 if (!signedIn(context.principal)) return false;
 if (space.accessScope === 'CELEBRATION')
  return context.celebrationEnrolled === true &&
   canAccessPolicy(space.accessPolicy, context);
 if (!Array.isArray(context.enrollments)) return false;
 const enrolled = context.enrollments.some(link =>
  link?.memberId === context.principal.id && link.spaceId === space.id);
 return enrolled && canAccessPolicy(space.accessPolicy, context);
}

export function canAccessPage(page, context = {}) {
 if (!page || !identity(page.id)) return false;
 // Existing pages have no accessPolicy/spaceId: preserve PUBLIC access.
 // Explicit null, invalid modes or malformed type lists are NOT legacy pages.
 const policy = Object.hasOwn(page, 'accessPolicy') ? page.accessPolicy :
  {mode: ACCESS_MODES.PUBLIC};
 if (!canAccessPolicy(policy, context)) return false;
 const hasSpace = Object.hasOwn(page, 'spaceId');
 if (!hasSpace) return context.space == null; // no invented space for a legacy page
 const space = context.space;
 if (!identity(page.spaceId) || !space || page.spaceId !== space.id ||
     !identity(page.celebrationId) ||
     page.celebrationId !== space.celebrationId) return false;
 return canAccessSpace(space, context); // never bypass space via a direct page URL
}

// Publishing, media access, navigation and language selection remain separate.
// Future server handlers must authorize canonical page + canonical space BEFORE
// returning any content or media; translation variants must not carry ACLs.
