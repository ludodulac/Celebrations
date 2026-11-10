// M007-B — isolated administrative draft model; no session, network or D1 writes.
// Canonical authorization remains in M002. Never authorize a request using
// data submitted by this UI: a future server adapter must reload trusted data.
import {
  ACCESS_MODES, SPACE_VISIBILITIES, isMemberTypeId,
  createMemberType, renameMemberType, assignMemberTypes, enrollInSpace,
  canAccessPage
} from '../domain/member-access.mjs';

export const PAGE_KINDS = Object.freeze({
  ORDINARY: 'ordinary', FOOTER: 'footer', CELEBRATION: 'celebration'
});
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const stable = id => typeof id === 'string' && id.length > 0 &&
  id.length <= 254 && id === id.trim();
const duplicate = value => structuredClone(value);
const list = (value, name) => {
  if (!Array.isArray(value)) throw new TypeError(name + ' must be an array');
  return value;
};
const uniqueRecords = (records, name, validator) => {
  const seen = new Set();
  for (const record of records) {
    if (!validator(record) || seen.has(record.id))
      throw new TypeError('Invalid or duplicate ' + name + ' identifier');
    seen.add(record.id);
  }
};
const knownMember = (state, memberId) => {
  if (!stable(memberId) || !state.members.some(m => m.id === memberId))
    throw new TypeError('Unknown person');
};
const knownType = (types, id, allowDisabled = false) => {
  const type = types.find(item => item.id === id);
  if (!isMemberTypeId(id) || !type || (!allowDisabled && type.disabled === true))
    throw new TypeError('Unknown or disabled member type');
};

export function normalizeAdminPolicy(policy, types, {allowDisabled = false} = {}) {
  list(types, 'Member type catalogue');
  if (!policy || typeof policy !== 'object' || Array.isArray(policy))
    throw new TypeError('Invalid access policy');
  if (policy.mode === ACCESS_MODES.PUBLIC ||
      policy.mode === ACCESS_MODES.ALL_PRIVATE_TYPES) {
    if (own(policy, 'typeIds'))
      throw new TypeError('Type selection is only allowed in SELECTED_TYPES');
    return {mode: policy.mode};
  }
  if (policy.mode !== ACCESS_MODES.SELECTED_TYPES ||
      !Array.isArray(policy.typeIds) || policy.typeIds.length === 0)
    throw new TypeError('Invalid or empty selected-type access policy');
  const ids = new Set();
  for (const id of policy.typeIds) {
    knownType(types, id, allowDisabled);
    if (ids.has(id)) throw new TypeError('Duplicate type in access policy');
    ids.add(id);
  }
  return {mode: ACCESS_MODES.SELECTED_TYPES, typeIds: [...ids]};
}

export function pageKind(page) {
  if (!page || !stable(page.id)) throw new TypeError('Permanent page ID required');
  if (page.group === 'page') {
    if (page.placement === 'footer') return PAGE_KINDS.FOOTER;
    if (page.placement === undefined || page.placement === null ||
        page.placement === 'page') return PAGE_KINDS.ORDINARY;
  }
  if (page.group === 'celebration') return PAGE_KINDS.CELEBRATION;
  throw new TypeError('Unsupported page category');
}

export function createMemberAdminState({
  types = [], members = [], memberships = [], pages = [], spaces = [],
  enrollments = []
} = {}) {
  const state = duplicate({
    types: list(types, 'Types'), members: list(members, 'People'),
    memberships: list(memberships, 'Memberships'), pages: list(pages, 'Pages'),
    spaces: list(spaces, 'Spaces'), enrollments: list(enrollments, 'Enrollments')
  });
  uniqueRecords(state.types, 'member type', type =>
    isMemberTypeId(type?.id) && createMemberType(type).name === type.name &&
    (type.disabled === undefined || typeof type.disabled === 'boolean'));
  uniqueRecords(state.members, 'person', member => stable(member?.id));
  uniqueRecords(state.pages, 'page', page => stable(page?.id) &&
    Object.values(PAGE_KINDS).includes(pageKind(page)));
  uniqueRecords(state.spaces, 'space', space =>
    stable(space?.id) && stable(space?.celebrationId) &&
    Object.values(SPACE_VISIBILITIES).includes(space?.visibility));
  for (const space of state.spaces) {
    const normalized = normalizeAdminPolicy(space.accessPolicy, state.types,
      {allowDisabled: true});
    if (space.visibility === SPACE_VISIBILITIES.PUBLIC &&
        normalized.mode !== ACCESS_MODES.PUBLIC)
      throw new TypeError('Public space requires a public policy');
  }
  for (const page of state.pages) {
    if (own(page, 'accessPolicy'))
      normalizeAdminPolicy(page.accessPolicy, state.types, {allowDisabled: true});
    if (own(page, 'spaceId')) {
      const space = state.spaces.find(item => item.id === page.spaceId);
      if (!space || page.celebrationId !== space.celebrationId)
        throw new TypeError('Page has an unknown or foreign celebration space');
    }
  }
  const seenMemberships = new Set();
  for (const link of state.memberships) {
    knownMember(state, link?.memberId);
    knownType(state.types, link?.typeId, true); // retain historic disabled links
    const key = JSON.stringify([link.memberId, link.typeId]);
    if (seenMemberships.has(key)) throw new TypeError('Duplicate membership');
    seenMemberships.add(key);
  }
  const seenEnrollments = new Set();
  for (const link of state.enrollments) {
    knownMember(state, link?.memberId);
    if (!state.spaces.some(space => space.id === link?.spaceId))
      throw new TypeError('Unknown celebration space enrollment');
    const key = JSON.stringify([link.memberId, link.spaceId]);
    if (seenEnrollments.has(key)) throw new TypeError('Duplicate enrollment');
    seenEnrollments.add(key);
  }
  return state;
}

export function addAdminMemberType(state, input) {
  const type = createMemberType(input);
  if (state.types.some(item => item.id === type.id))
    throw new TypeError('Member type identifier already exists');
  return createMemberAdminState({...state, types: [...state.types, type]});
}

export function renameAdminMemberType(state, id, name) {
  if (!state.types.some(type => type.id === id))
    throw new TypeError('Unknown member type');
  const types = state.types.map(type => type.id === id ?
    renameMemberType(type, name) : type);
  return createMemberAdminState({...state, types});
}

export function assignAdminMemberTypes(state, memberId, typeIds) {
  knownMember(state, memberId);
  list(typeIds, 'Type IDs');
  // Disabled historical memberships stay linked, but cannot be newly granted.
  const historic = state.memberships.filter(link => link.memberId === memberId &&
    state.types.some(type => type.id === link.typeId && type.disabled === true))
    .map(link => link.typeId);
  for (const id of typeIds) knownType(state.types, id, historic.includes(id));
  const links = assignMemberTypes(memberId, [...historic, ...typeIds], state.types);
  return createMemberAdminState({...state, memberships: [
    ...state.memberships.filter(link => link.memberId !== memberId), ...links
  ]});
}

export function setAdminPagePolicy(state, pageId, policy) {
  if (!stable(pageId) || !state.pages.some(page => page.id === pageId))
    throw new TypeError('Unknown page');
  const normalized = normalizeAdminPolicy(policy, state.types);
  return createMemberAdminState({...state, pages: state.pages.map(page =>
    page.id === pageId ? {...page, accessPolicy: normalized} : page)});
}

// Optional preview of the exact M002 rule. NOT a server authorization endpoint.
// A real server must fetch canonical page, type, membership and enrollment rows
// from trusted storage and verify the session BEFORE invoking canAccessPage.
export function previewAdminPageAccess(state, pageId, verifiedPrincipal = null) {
  const page = state.pages.find(item => item.id === pageId);
  if (!page) return false;
  const space = own(page, 'spaceId') ?
    state.spaces.find(item => item.id === page.spaceId) : undefined;
  return canAccessPage(page, {principal: verifiedPrincipal,
    types: state.types, memberships: state.memberships,
    enrollments: state.enrollments, space});
}

// For a future D1 writer, explicitly retain the distinct relations: type labels
// and IDs, memberships, page policies and individual space enrollments.
export function draftMemberAdminChanges(state) {
  const verified = createMemberAdminState(state);
  return duplicate({
    types: verified.types, memberships: verified.memberships,
    pagePolicies: verified.pages.filter(p => own(p, 'accessPolicy'))
      .map(p => ({pageId: p.id, accessPolicy: p.accessPolicy})),
    enrollments: verified.enrollments
  });
}

export {ACCESS_MODES};
