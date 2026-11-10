import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  PAGE_KINDS, ACCESS_MODES, pageKind, createMemberAdminState,
  addAdminMemberType, renameAdminMemberType, assignAdminMemberTypes,
  normalizeAdminPolicy, setAdminPagePolicy, previewAdminPageAccess,
  draftMemberAdminChanges
} from '../migration/cloudflare/app/admin/member-access-admin-model.mjs';
import {mountMemberAccessAdmin}
  from '../migration/cloudflare/app/admin/member-access-admin-ui.mjs';
import {canAccessPage, canAccessSpace}
  from '../migration/cloudflare/app/domain/member-access.mjs';

const T1 = 'member-type:choir';
const T2 = 'member-type:helpers';
const T3 = 'member-type:suspended';
const C = 'celebration-1';
const S = 'space-1';
const fixture = () => ({
  types: [{id: T1, name: 'Chorale'}, {id: T2, name: 'Bénévoles'},
    {id: T3, name: 'Ancien type', disabled: true}],
  members: [{id: 'person-1', name: 'Alice'}, {id: 'person-2', name: 'Bob'}],
  memberships: [{memberId: 'person-1', typeId: T1},
    {memberId: 'person-1', typeId: T3},
    {memberId: 'person-2', typeId: T2}],
  spaces: [{id: S, celebrationId: C, visibility: 'PRIVATE',
    accessPolicy: {mode: ACCESS_MODES.SELECTED_TYPES, typeIds: [T1]}}],
  enrollments: [{memberId: 'person-1', spaceId: S}],
  pages: [
    {id: 'general-1', group: 'page', name: 'Accueil', blocks: [{text: 'Public'}]},
    {id: 'footer-1', group: 'page', placement: 'footer', name: 'Mentions légales'},
    {id: 'celebration-1-page', group: 'celebration', name: 'Préparation'},
    {id: 'private-page', group: 'celebration', celebrationId: C, spaceId: S,
      name: 'Chapelle', translations: {en: {name: 'Chapel'}}}
  ]
});
const person = id => ({id, authenticated: true});
const all = (node) => [node, ...(node.children || []).flatMap(all)];
const makeDOM = () => {
  const document = {createElement: tag => {
    const element = {
      tagName: tag, ownerDocument: document, children: [], textContent: '',
      className: '', value: '', disabled: false, hidden: false, events: {},
      append(...children) {this.children.push(...children);},
      replaceChildren(...children) {this.children = [...children];},
      setAttribute(name, value) {this[name] = value;},
      addEventListener(name, fn) {this.events[name] = fn;}
    };
    return element;
  }};
  return {document, root: document.createElement('div')};
};
const submit = form => form.events.submit({preventDefault() {}});
const findForm = (root, labelText) => all(root).find(element =>
  element.tagName === 'form' && all(element).some(item =>
    item.tagName === 'button' && item.textContent === labelText));

test('M007-B initial state is detached, IDs are preserved and categories are distinct', () => {
  const input = fixture(), before = JSON.stringify(input);
  const state = createMemberAdminState(input);
  assert.equal(JSON.stringify(input), before);
  state.pages[0].blocks[0].text = 'local draft';
  assert.equal(input.pages[0].blocks[0].text, 'Public');
  assert.deepEqual(state.pages.map(pageKind), [
    PAGE_KINDS.ORDINARY, PAGE_KINDS.FOOTER, PAGE_KINDS.CELEBRATION,
    PAGE_KINDS.CELEBRATION
  ]);
  assert.equal(state.spaces[0].celebrationId, C);
  assert.equal(state.pages[3].spaceId, S);
});

test('M007-B add and rename use M002 stable ID without losing links or policies', () => {
  const base = createMemberAdminState(fixture());
  const plus = addAdminMemberType(base,
    {id: 'member-type:friends', name: '  Amis  '});
  assert.equal(plus.types.at(-1).name, 'Amis');
  assert.throws(() => addAdminMemberType(plus,
    {id: 'member-type:friends', name: 'Double'}), /already exists/);
  assert.throws(() => addAdminMemberType(base,
    {id: 'all', name: 'Legacy group'}), TypeError);
  const restricted = setAdminPagePolicy(plus, 'footer-1',
    {mode: ACCESS_MODES.SELECTED_TYPES, typeIds: [T1]});
  const renamed = renameAdminMemberType(restricted, T1, 'Chanteurs');
  assert.equal(renamed.types[0].id, T1);
  assert.equal(renamed.types[0].name, 'Chanteurs');
  assert.deepEqual(renamed.memberships, restricted.memberships);
  assert.deepEqual(renamed.pages[1].accessPolicy.typeIds, [T1]);
  assert.equal(base.types[0].name, 'Chorale');
  assert.throws(() => renameAdminMemberType(base, T2 + '-unknown', 'X'), /Unknown/);
});

test('M007-B multiple member types are assigned with independent person links', () => {
  const base = createMemberAdminState(fixture());
  const next = assignAdminMemberTypes(base, 'person-1', [T1, T2, T1]);
  assert.deepEqual(next.memberships.filter(link => link.memberId === 'person-1')
    .map(link => link.typeId), [T3, T1, T2]);
  assert.deepEqual(next.memberships.filter(link => link.memberId === 'person-2'),
    [{memberId: 'person-2', typeId: T2}]);
  assert.equal(next.enrollments.length, 1, 'independent space enrollment retained');
  assert.deepEqual(base.memberships.filter(link => link.memberId === 'person-1')
    .map(link => link.typeId), [T1, T3]);
  assert.throws(() => assignAdminMemberTypes(base, 'person-2', [T3]), /disabled/);
  assert.throws(() => assignAdminMemberTypes(base, 'unknown', [T1]), /Unknown person/);
  assert.throws(() => assignAdminMemberTypes(base, 'person-1',
    ['member-type:missing']), /Unknown/);
  const cleared = assignAdminMemberTypes(base, 'person-1', []);
  assert.deepEqual(cleared.memberships.filter(link => link.memberId === 'person-1'),
    [{memberId: 'person-1', typeId: T3}],
    'disabled historic link must not be silently revoked');
});

test('M007-B three page access modes work for ordinary, footer and celebration', () => {
  const base = createMemberAdminState(fixture());
  for (const id of ['general-1', 'footer-1', 'celebration-1-page']) {
    const pub = setAdminPagePolicy(base, id, {mode: ACCESS_MODES.PUBLIC});
    const allTypes = setAdminPagePolicy(base, id,
      {mode: ACCESS_MODES.ALL_PRIVATE_TYPES});
    const selected = setAdminPagePolicy(base, id,
      {mode: ACCESS_MODES.SELECTED_TYPES, typeIds: [T1, T2]});
    assert.equal(previewAdminPageAccess(pub, id, null), true);
    assert.equal(previewAdminPageAccess(allTypes, id, null), false);
    assert.equal(previewAdminPageAccess(allTypes, id, person('person-1')), true);
    assert.equal(previewAdminPageAccess(selected, id, person('person-2')), true);
    assert.equal(previewAdminPageAccess(selected, id, null), false);
    assert.equal(base.pages.find(page => page.id === id).accessPolicy, undefined);
    assert.equal(selected.pages.find(page => page.id === id).accessPolicy.mode,
      ACCESS_MODES.SELECTED_TYPES);
  }
  assert.equal(previewAdminPageAccess(base, 'general-1'), true,
    'existing implicit-public legacy page remains unchanged');
});

test('M007-B unknown, malformed, duplicate and disabled authorizations are rejected', () => {
  const base = createMemberAdminState(fixture());
  for (const policy of [
    null, {mode: 'UNKNOWN'}, {mode: ACCESS_MODES.SELECTED_TYPES, typeIds: []},
    {mode: ACCESS_MODES.SELECTED_TYPES, typeIds: [T1, 'angel']},
    {mode: ACCESS_MODES.SELECTED_TYPES, typeIds: [T1, T1]},
    {mode: ACCESS_MODES.SELECTED_TYPES, typeIds: [T3]},
    {mode: ACCESS_MODES.PUBLIC, typeIds: [T1]},
    {mode: ACCESS_MODES.ALL_PRIVATE_TYPES, typeIds: []}
  ]) {
    assert.throws(() => setAdminPagePolicy(base, 'general-1', policy), TypeError);
  }
  assert.throws(() => setAdminPagePolicy(base, 'missing', {mode: ACCESS_MODES.PUBLIC}),
    /Unknown page/);
  assert.throws(() => createMemberAdminState({
    ...fixture(), pages: [{id: 'a', group: 'UNSUPPORTED'}]
  }), TypeError);
  assert.throws(() => createMemberAdminState({
    ...fixture(), pages: [{id: 'a', group: 'celebration', spaceId: 'wrong',
      celebrationId: C}]
  }), /unknown or foreign/);
  assert.throws(() => createMemberAdminState({
    ...fixture(), memberships: [{memberId: 'person-1', typeId: 'all'}]
  }), /Unknown/);
  assert.throws(() => createMemberAdminState({
    ...fixture(), enrollments: [{memberId: 'person-1', spaceId: 'ghost'}]
  }), /Unknown celebration/);
  assert.deepEqual(normalizeAdminPolicy(
    {mode: ACCESS_MODES.SELECTED_TYPES, typeIds: [T1]}, base.types),
    {mode: ACCESS_MODES.SELECTED_TYPES, typeIds: [T1]});
});

test('M007-B individual enrollment and parent space restrictions cannot be bypassed', () => {
  const base = createMemberAdminState(fixture());
  const pagePublic = setAdminPagePolicy(base, 'private-page',
    {mode: ACCESS_MODES.PUBLIC});
  assert.equal(previewAdminPageAccess(pagePublic, 'private-page', null), false);
  assert.equal(previewAdminPageAccess(pagePublic, 'private-page', person('person-2')),
    false, 'type without individual enrollment is insufficient');
  assert.equal(previewAdminPageAccess(pagePublic, 'private-page', person('person-1')),
    true);
  assert.equal(previewAdminPageAccess({...pagePublic, enrollments:[]},
    'private-page', person('person-1')), false);
  assert.equal(previewAdminPageAccess({...pagePublic,
    pages: pagePublic.pages.map(page => page.id === 'private-page' ?
      {...page, celebrationId:'other'} : page)}, 'private-page', person('person-1')),
    false);
  const gated = setAdminPagePolicy(base, 'private-page',
    {mode: ACCESS_MODES.SELECTED_TYPES, typeIds: [T2]});
  assert.equal(previewAdminPageAccess(gated, 'private-page', person('person-1')),
    false, 'page authorization and private-space authorization are cumulative');
  assert.equal(canAccessSpace(base.spaces[0],
    {principal:person('person-1'),types:base.types,
      memberships:base.memberships,enrollments:base.enrollments}),true);
  assert.equal(canAccessPage(pagePublic.pages[3],
    {principal:person('person-1')}),false,
    'a direct URL cannot omit canonical space context');
});

test('M007-B language variants and editorial media never change authorization', () => {
  const base = createMemberAdminState(fixture());
  const protectedState = setAdminPagePolicy(base, 'private-page',
    {mode: ACCESS_MODES.SELECTED_TYPES, typeIds: [T1]});
  for (const language of ['fr', 'en', 'it']) {
    const localized = structuredClone(protectedState);
    localized.pages[3].language = language;
    assert.equal(previewAdminPageAccess(localized, 'private-page', person('person-1')),
      true);
    assert.equal(previewAdminPageAccess(localized, 'private-page', null),false);
  }
  assert.deepEqual(protectedState.pages[3].translations, {en:{name:'Chapel'}});
  const exported = draftMemberAdminChanges(protectedState);
  assert.deepEqual(exported.pagePolicies, [
    {pageId:'private-page',accessPolicy:
      {mode:ACCESS_MODES.SELECTED_TYPES,typeIds:[T1]}}
  ]);
  assert.deepEqual(exported.enrollments, base.enrollments);
  assert.equal('principal' in exported, false);
  assert.equal('blocks' in exported, false);
  assert.notEqual(exported.types, protectedState.types);
});

test('M007-B DOM component remains opt-in and renders accessible responsive controls', () => {
  const {root} = makeDOM(), events = [];
  const ui = mountMemberAccessAdmin(root, {
    initialState: fixture(), onChange: (state, detail) => events.push({state, detail})
  });
  let nodes = all(root);
  assert.ok(nodes.some(item => item.tagName === 'h2'));
  assert.ok(nodes.some(item => item.tagName === 'legend' &&
    item.textContent === 'Mode d’accès'));
  assert.ok(nodes.some(item => item.tagName === 'optgroup' &&
    item.label === 'Pages de bas de page'));
  assert.ok(nodes.some(item => item.textContent?.includes('aucune sauvegarde D1')));
  const createForm = findForm(root, 'Créer ce type');
  const inputs = all(createForm).filter(item => item.tagName === 'input');
  inputs[0].value = 'member-type:guests'; inputs[1].value = 'Invités';
  submit(createForm);
  assert.equal(ui.getState().types.at(-1).name, 'Invités');
  assert.equal(events.at(-1).detail.kind, 'type-created');
  const policyForm = findForm(root, 'Appliquer à cette page');
  const radios = all(policyForm).filter(item => item.type === 'radio');
  for (const radio of radios) radio.checked = radio.value === ACCESS_MODES.SELECTED_TYPES;
  const checks = all(policyForm).filter(item => item.type === 'checkbox');
  checks[0].checked = true;
  submit(policyForm);
  assert.deepEqual(ui.getState().pages[0].accessPolicy,
    {mode: ACCESS_MODES.SELECTED_TYPES, typeIds: [T1]});
  const css = readFileSync(new URL('../migration/cloudflare/app/admin/member-access-admin.css',
    import.meta.url), 'utf8');
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /:focus-visible/);
  ui.destroy();
  assert.deepEqual(root.children, []);
});

test('M007-B no automatic public changes, network, secrets or second permissions engine', () => {
  const paths = [
    '../migration/cloudflare/app/admin/member-access-admin-model.mjs',
    '../migration/cloudflare/app/admin/member-access-admin-ui.mjs'
  ];
  const code = paths.map(path => readFileSync(new URL(path, import.meta.url), 'utf8')
    .split('\n').filter(line => !line.trim().startsWith('//')).join('\n')).join('\n');
  for (const forbidden of ['fetch(', 'localStorage', 'sessionStorage', 'env.DB',
    'env.MEDIA_BUCKET', 'window.', 'R2Bucket', 'document.cookie',
    'innerHTML', 'eval(', 'api.cloudflare.com', 'addEventListener(\'load\'',
    'crypto.randomUUID(', 'publish(', 'deploy('])
    assert.equal(code.includes(forbidden),false,forbidden);
  assert.match(code, /canAccessPage\(/, 'the M002 engine is delegated to');
});
