// M007-C — Cross-construction contract tests only. No external systems or D1 writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDirectoryPerson, planDirectoryMemberTypes, planDirectoryCelebration,
  planDirectoryPrivateEnrollment
} from '../migration/cloudflare/app/domain/contact-directory.mjs';
import {
  createMemberType, ACCESS_MODES, SPACE_VISIBILITIES
} from '../migration/cloudflare/app/domain/member-access.mjs';
import {
  createCelebrationSpace, canReadSpacePage
} from '../migration/cloudflare/app/domain/celebration-spaces.mjs';
import {
  createMemberAdminState, renameAdminMemberType, previewAdminPageAccess
} from '../migration/cloudflare/app/admin/member-access-admin-model.mjs';
import {
  createLanguageRegistry, addLanguage, setLanguageActive
} from '../migration/cloudflare/app/domain/editor-localization.mjs';
import {
  preparePublicLanguageNavigation
} from '../migration/cloudflare/app/domain/public-language-navigation.mjs';

const PERSON = 'person:550e8400-e29b-41d4-a716-446655440000';
const TYPE = 'member-type:chorale';
const CELEBRATION = 43;
const SITE = 'https://www.ronde-des-archanges-universelle.eu';

function fixture() {
  const person = createDirectoryPerson({
    id: PERSON, email: ' Alice@Example.org ', givenName: 'Alice'
  });
  const type = createMemberType({id: TYPE, name: 'Chorale'});
  const space = createCelebrationSpace({
    id: 'space:43:chapelle', celebrationId: CELEBRATION,
    visibility: SPACE_VISIBILITIES.PRIVATE,
    accessPolicy: {mode: ACCESS_MODES.SELECTED_TYPES, typeIds: [TYPE]},
    pages: [{
      id: 'page:43:chapelle', group: 'celebration', name: 'Chapelle',
      accessPolicy: {mode: ACCESS_MODES.PUBLIC}
    }]
  });
  const membership = planDirectoryMemberTypes(person.id, [TYPE], [type]);
  return {person, type, space, membership, page: space.pages[0]};
}

test('M007-C: one permanent person and type ID across D1 directory, M002, M005 and M007-B', () => {
  const {person, type, space, membership, page} = fixture();
  assert.equal(person.emailNormalized, 'alice@example.org');
  assert.deepEqual(planDirectoryCelebration(person.id, CELEBRATION), {
    personId: PERSON, celebrationId: CELEBRATION
  });
  assert.deepEqual(membership, [{memberId: PERSON, typeId: TYPE}]);
  // M005 canonical JSON uses a string; D1 requires the real integer celebration key.
  assert.equal(space.celebrationId, String(CELEBRATION));
  assert.throws(() => planDirectoryPrivateEnrollment(PERSON, space), TypeError);
  const d1Link = planDirectoryPrivateEnrollment(PERSON, {
    ...space, celebrationId: CELEBRATION
  });
  assert.deepEqual(d1Link, {
    personId: PERSON, celebrationId: CELEBRATION, spaceId: space.id
  });
  const enrollments = [{memberId: d1Link.personId, spaceId: d1Link.spaceId}];
  const principal = {id: PERSON, authenticated: true};
  const context = {
    principal, types: [type], memberships: membership, enrollments
  };
  const celebration = {id: CELEBRATION, pages: [], spaces: [space]};
  assert.equal(canReadSpacePage(celebration, space.id, page.id, context), true);
  assert.equal(canReadSpacePage(celebration, space.id, page.id, {
    ...context, enrollments: []
  }), false);
  assert.equal(canReadSpacePage(celebration, space.id, page.id, {
    ...context, memberships: []
  }), false);

  const admin = createMemberAdminState({
    types: [type], members: [{id: PERSON, name: 'Alice'}],
    memberships: membership, spaces: [space], pages: [page], enrollments
  });
  assert.equal(previewAdminPageAccess(admin, page.id, principal), true);
  assert.equal(previewAdminPageAccess(admin, page.id, null), false);
  const renamed = renameAdminMemberType(admin, TYPE, 'Chanteurs');
  assert.equal(renamed.types[0].id, TYPE);
  assert.deepEqual(renamed.memberships, membership);
  assert.equal(previewAdminPageAccess(renamed, page.id, principal), true);
});

test('M007-C: M006 language selection never overrides M002 authorization or exposes editor drafts', () => {
  const {type, membership} = fixture();
  const publicPage = {
    id: 'neutral-accueil', group: 'page', name: 'Accueil',
    visibility: 'published', blocks: [], accessPolicy: {mode: ACCESS_MODES.PUBLIC}
  };
  const privatePage = {
    id: 'neutral-prive', group: 'page', name: 'Membres',
    visibility: 'published', blocks: [{kind: 'text', text: 'CANONICAL PRIVATE'}],
    accessPolicy: {mode: ACCESS_MODES.SELECTED_TYPES, typeIds: [TYPE]},
    translations: {en: {name: 'EDITOR DRAFT SECRET'}}
  };
  const snapshot = {
    ok: true, celebrationVisible: false,
    shared: {pages: [publicPage, privatePage]}
  };
  const registry = setLanguageActive(
    addLanguage(createLanguageRegistry(), {id: 'en', name: 'English', flag: '🇬🇧'}),
    'en', true
  );
  const publishedPageReleases = {
    'neutral-prive': {
      publication: 'published', pageId: 'neutral-prive',
      variants: {en: {name: 'Authorized members'}}
    }
  };
  const before = structuredClone(privatePage);
  const common = {
    snapshot, registry, requestedLanguageId: 'en',
    currentUrl: SITE + '/?lang=en',
    publishedPageReleases,
    hrefForPage: p => p.id === 'neutral-accueil' ? '/' : '/membres'
  };
  const anonymous = preparePublicLanguageNavigation(common);
  assert.ok(anonymous);
  assert.deepEqual(anonymous.menu.map(item => item.pageId), ['neutral-accueil']);
  assert.ok(!JSON.stringify(anonymous).includes('EDITOR DRAFT SECRET'));
  assert.ok(!JSON.stringify(anonymous).includes('CANONICAL PRIVATE'));

  const authorized = preparePublicLanguageNavigation({
    ...common, context: {
      principal: {id: PERSON, authenticated: true}, types: [type],
      memberships: membership
    }
  });
  assert.ok(authorized.menu.some(item => item.pageId === 'neutral-prive'));
  assert.deepEqual(privatePage, before, 'language navigation may not rewrite canonical ACL');
  assert.deepEqual(privatePage.accessPolicy, {
    mode: ACCESS_MODES.SELECTED_TYPES, typeIds: [TYPE]
  });
});
