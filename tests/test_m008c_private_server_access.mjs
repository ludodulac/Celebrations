// M008-C — native Node 22 regression tests; no Cloudflare account / D1 writes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sha256} from '../migration/cloudflare/auth-api.mjs';
import {
  resolveVerifiedMember, handlePrivatePage, handlePrivateMedia,
  allowedPrivatePageIds
} from '../migration/cloudflare/app/security/member-private-access.mjs';

const TOKEN = 'a'.repeat(64);
const PERSON = 'person:550e8400-e29b-41d4-a716-446655440000';
const EMAIL = 'alice@example.org';
const TYPE = 'member-type:chorale';
const TYPE_OTHER = 'member-type:visiteur';
const SPACE = 'space:43:chapelle';
const policy = {mode: 'SELECTED_TYPES', typeIds: [TYPE]};
const root = {id: 'page:privee', celebrationId: '43', visibility: 'published',
  accessPolicy: policy, blocks: [{text: 'SECRET_CANONIQUE'}],
  translations: {en: {text: 'SECRET_TRADUIT'}}};
const space = {id: SPACE, celebrationId: '43', visibility: 'PRIVATE',
  accessPolicy: policy};
const inner = {id: 'page:chapelle', visibility: 'published',
  celebrationId: '43', spaceId: SPACE, accessPolicy: {mode: 'PUBLIC'},
  blocks: [{text: 'SECRET_ESPACE'}]};

const req = (token = TOKEN, path = '/private/page:privee', method = 'GET', headers = {}) =>
  new Request('https://www.ronde-des-archanges-universelle.eu' + path, {
    method, headers: {...(token ? {authorization: 'Bearer ' + token} : {}), ...headers}
  });

// fakeDb responds ONLY to the exact read surfaces used by the private guard,
// the M009-B explicitly approved identity link and participant session verifier.
// It models revocation between consecutive requests.
function scenario(overrides = {}) {
  const state = {
    sessionToken: TOKEN, email: EMAIL, sessionExpiry: '2099-01-01T00:00:00.000Z',
    personId: PERSON, registered: true, approvedLink: true,
    linkedEmail: EMAIL, claimApproved: true, claimReviewed: true,
    disabled: 0, types: [TYPE], celebrationEnrolled: true, enrolled: true,
    dbError: false, ...overrides
  };
  const queries = [];
  const db = {
    prepare(sql) {
      return {bind(...args) {
        queries.push({sql, args});
        return {
          async first() {
            if (state.dbError) throw Error('SQL PRIVATE INTERNAL ERROR');
            if (sql.includes('FROM celebrations_participant_sessions'))
              return args[0] === await sha256(state.sessionToken) ?
                {email: state.email, expires_at: state.sessionExpiry} : null;
            if (sql.includes('FROM celebrations_directory_identity_links'))
              return state.registered && state.approvedLink && state.claimApproved &&
                state.claimReviewed && state.linkedEmail === args[0] ?
                {id: state.personId} : null;
            if (sql.includes('FROM celebrations_directory_person_celebrations'))
              return state.celebrationEnrolled && args[0] === PERSON &&
                args[1] === 43 ? {enrolled: 1} : null;
            if (sql.includes('FROM celebrations_directory_private_space_enrollments'))
              return state.enrolled && args[0] === PERSON &&
                args[1] === SPACE && args[2] === 43 ? {enrolled: 1} : null;
            throw Error('Unexpected D1 first query');
          },
          async all() {
            if (state.dbError) throw Error('SQL PRIVATE INTERNAL ERROR');
            if (sql.includes('FROM celebrations_directory_person_types')) return {
              results: state.types.map(type_id => ({
                type_id, disabled: type_id === TYPE ? state.disabled : 0
              }))
            };
            throw Error('Unexpected D1 all query');
          }
        };
      }};
    }
  };
  return {state, queries, env: {DB: db}};
}
const loaders = (pages = [root, inner], spaces = [space]) => ({
  async loadPublishedPage(id) { return pages.find(p => p.id === id) || null; },
  async loadPublishedSpace(id) { return spaces.find(s => s.id === id) || null; }
});
const rendered = opts => {
  let n = 0;
  return {
    count: () => n,
    options: {...opts, render: ({page}) => {
      n++;
      return Response.json({id: page.id, text: page.blocks[0].text,
        translation: page.translations?.en?.text});
    }}
  };
};
const body = response => response.text();
function noLeak(response, text) {
  assert.notEqual(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.match(response.headers.get('vary'), /Authorization/);
  return body(response).then(s => {
    assert.equal(s.includes(text), false);
    assert.equal(s.includes('SQL PRIVATE'), false);
  });
}

test('M008-C: only an approved link maps participant session to permanent person', async () => {
  const {env, queries} = scenario();
  assert.deepEqual(await resolveVerifiedMember(req(), env),
    {id: PERSON, authenticated: true});
  assert.ok(queries.some(x => x.sql.includes('celebrations_participant_sessions')));
  assert.ok(queries.some(x => x.sql.includes('FROM celebrations_directory_identity_links')));
  assert.ok(queries.some(x => x.sql.includes('JOIN celebrations_directory_identity_claims')));
  assert.ok(queries.some(x => x.sql.includes("c.status='approved'")));
  assert.ok(queries.some(x => x.sql.includes('JOIN celebrations_participants')));
  assert.ok(!queries.some(x => x.sql.includes('d.email_normalized=?')));
  assert.ok(!queries.some(x => x.sql.includes('celebrations_admin_sessions')));
  assert.ok(!queries.some(x => x.sql.includes('celebrations_groups')));
});

test('M008-C: visitor, forged token, expired session, unmapped person and invalid person denied', async () => {
  const cases = [
    [scenario(), req(null)],
    [scenario(), req('fake'.repeat(16))],
    [scenario({sessionExpiry: '2000-01-01T00:00:00Z'}), req()],
    [scenario({registered: false}), req()],
    [scenario({approvedLink: false}), req()], // equal email alone never approves
    [scenario({claimApproved: false}), req()],
    [scenario({claimReviewed: false}), req()],
    [scenario({personId: 'test-person-not-uuid'}), req()],
    [scenario({email: 'old@example.org'}), req()]
  ];
  for (const [f, request] of cases) {
    const renderer = rendered({...loaders(), pageId: root.id});
    const response = await handlePrivatePage(request, f.env, renderer.options);
    assert.equal(response.status, 404);
    assert.equal(renderer.count(), 0, 'denied response must never render');
    await noLeak(response, 'SECRET');
  }
});

test('M008-C: SELECTED_TYPES refuses wrong type, no type, disabled type', async () => {
  for (const changes of [
    {types: []}, {types: [TYPE_OTHER]}, {disabled: 1}
  ]) {
    const f = scenario(changes);
    const renderer = rendered({...loaders(), pageId: root.id});
    const response = await handlePrivatePage(req(), f.env, renderer.options);
    assert.equal(response.status, 404);
    assert.equal(renderer.count(), 0);
    await noLeak(response, 'SECRET');
  }
});

test('M008-C: authorized type reveals only the canonical published page with non-cacheable headers', async () => {
  const f = scenario(), renderer = rendered({...loaders(), pageId: root.id});
  const response = await handlePrivatePage(req(), f.env, renderer.options);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).text, 'SECRET_CANONIQUE');
  assert.equal(renderer.count(), 1);
  assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.match(response.headers.get('vary'), /Authorization/);
  assert.equal(response.headers.get('etag'), null);
});

test('M008-C: explicit enrollment AND valid type required for private spaces', async () => {
  const options = rendered({...loaders(), pageId: inner.id});
  const f = scenario();
  assert.equal((await handlePrivatePage(req(), f.env, options.options)).status, 200);
  f.state.enrolled = false; // immediate revocation, not cached
  assert.equal((await handlePrivatePage(req(), f.env, options.options)).status, 404);
  f.state.enrolled = true; f.state.types = [];
  assert.equal((await handlePrivatePage(req(), f.env, options.options)).status, 404);
  f.state.types = [TYPE]; f.state.disabled = 1;
  assert.equal((await handlePrivatePage(req(), f.env, options.options)).status, 404);
});

test('M008-C: PRIVATE space with PUBLIC policy still requires individual enrollment', async () => {
  const publicRuleSpace = {...space, accessPolicy: {mode: 'PUBLIC'}};
  const opts = rendered({...loaders([inner], [publicRuleSpace]), pageId: inner.id});
  const f = scenario({types: []});
  assert.equal((await handlePrivatePage(req(), f.env, opts.options)).status, 200);
  f.state.enrolled = false;
  assert.equal((await handlePrivatePage(req(), f.env, opts.options)).status, 404);
});

test('M008-C: direct URLs cannot skip missing/incorrect canonical space or ACL', async () => {
  const invalidPages = [
    {...inner, spaceId: 'space:43:autre'},
    {...inner, celebrationId: '999'},
    {...inner, accessPolicy: null},
    {...inner, visibility: 'draft'},
    {...inner, publicationStatus: 'draft'},
    {...inner, publicationStatus: 'unpublished'},
    {...inner, published: false},
    {...inner, published: 0},
    {...inner, isPublished: false},
    {...inner, id: 'fake-page'},
    {...root, accessPolicy: {mode: 'PUBLIC'}},
    {...root, accessPolicy: undefined}
  ];
  for (const page of invalidPages) {
    const render = rendered({...loaders([page]), pageId: page.id === 'fake-page' ? inner.id : page.id});
    const response = await handlePrivatePage(req(), scenario().env, render.options);
    assert.equal(response.status, 404, JSON.stringify(page));
    assert.equal(render.count(), 0);
  }
  const missing = rendered({...loaders([]), pageId: inner.id});
  assert.equal((await handlePrivatePage(req(), scenario().env, missing.options)).status, 404);
  assert.equal(missing.count(), 0);
});

test('M008-C: browser-controlled body, email, membership, language, admin proof ignored', async () => {
  const f = scenario({types: []});
  const renderer = rendered({...loaders(), pageId: root.id});
  const injected = new Request('https://www.ronde-des-archanges-universelle.eu/private/page:privee?lang=en&role=admin&accessPolicy=PUBLIC&memberId=' + PERSON,
    {method: 'GET', headers: {authorization: 'Bearer ' + TOKEN, 'x-admin-auth': 'true', 'x-member-type': TYPE}});
  const response = await handlePrivatePage(injected, f.env, renderer.options);
  assert.equal(response.status, 404);
  assert.equal(renderer.count(), 0);
  await noLeak(response, 'SECRET_TRADUIT');
});

test('M008-C: request errors are generic, fail closed, no stacktrace or SQL leakage', async () => {
  const f = scenario({dbError: true});
  const response = await handlePrivatePage(req(), f.env, rendered({...loaders(), pageId: root.id}).options);
  assert.equal(response.status, 503);
  await noLeak(response, 'SQL PRIVATE');
  const wrong = await handlePrivatePage(req(), scenario().env, {
    ...loaders(), pageId: root.id, render: () => {throw Error('SECRET_TRADUIT')}
  });
  assert.equal(wrong.status, 503);
  assert.ok(!(await wrong.text()).includes('SECRET_TRADUIT'));
  assert.equal((await handlePrivatePage(req(), scenario().env, {
    ...loaders(), pageId: root.id, render: () => new Response('x')
  })).headers.get('cache-control'), 'private, no-store, max-age=0');
});

test('M008-C: HEAD and unsupported methods never emit private content', async () => {
  const f = scenario();
  const opts = rendered({...loaders(), pageId: root.id});
  const head = await handlePrivatePage(req(TOKEN, '/', 'HEAD'), f.env, opts.options);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const put = await handlePrivatePage(req(TOKEN, '/', 'PUT'), f.env, opts.options);
  assert.equal(put.status, 405);
  await noLeak(put, 'SECRET');
});

test('M008-C: media denies unknown, unowned, public-key and unauthenticated requests BEFORE R2 get', async () => {
  const f = scenario();
  let gets = 0;
  f.env.PRIVATE_MEMBER_BUCKET = {async get() {gets++; return null}};
  const base = {...loaders(), pageId: inner.id, mediaId: 'media:private',
    loadPrivateMedia: async () => ({id: 'media:private', pageId: inner.id,
      visibility: 'private', storageKey: 'private-members/43/private.pdf',
      mimeType: 'application/pdf'})};
  const options = [
    [req(null), base],
    [req(), {...base, loadPrivateMedia: async () => ({id:'media:private',
      pageId:'other', visibility:'private', storageKey:'private-members/a'})}],
    [req(), {...base, loadPrivateMedia: async () => ({id:'media:private',
      pageId:inner.id, visibility:'private', storageKey:'editor-trials/uploads/p.pdf'})}],
    [req(), {...base, loadPrivateMedia: async () => ({id:'media:private',
      pageId:inner.id, visibility:'private', storageKey:'private-members/../secret.pdf'})}]
  ];
  for (const [request, opts] of options)
    assert.equal((await handlePrivateMedia(request, f.env, opts)).status, 404);
  assert.equal(gets, 0);
});

test('M018-A: no celebration registration denies root and private space before rendering', async () => {
  const f = scenario({celebrationEnrolled: false});
  for (const pageId of [root.id, inner.id]) {
    const renderer = rendered({...loaders(), pageId});
    const response = await handlePrivatePage(req(), f.env, renderer.options);
    assert.equal(response.status, 404);
    assert.equal(renderer.count(), 0);
    await noLeak(response, 'SECRET');
  }
  f.state.celebrationEnrolled = true;
  assert.equal((await handlePrivatePage(req(), f.env,
    rendered({...loaders(), pageId: root.id}).options)).status, 200);
  assert.ok(f.queries.some(q =>
    q.sql.includes('FROM celebrations_directory_person_celebrations')));
});

test('M018-A: malformed or mismatched celebration ownership fails closed with 404', async () => {
  for (const page of [
    {...root, celebrationId: undefined},
    {...root, celebrationId: '00043'},
    {...root, celebrationId: 'invalid'},
    {...root, celebrationId: '9007199254740993'},
    {...inner, celebrationId: '999'}
  ]) {
    const renderer = rendered({...loaders([page]), pageId: page.id});
    const response = await handlePrivatePage(req(), scenario().env, renderer.options);
    assert.equal(response.status, 404, JSON.stringify(page));
    assert.equal(renderer.count(), 0);
  }
});

test('M008-C: private PDF bytes are only read after permission, not public bucket', async () => {
  const f = scenario();
  let key = null;
  f.env.MEDIA_BUCKET = {get(){ throw Error('public bucket touched')}};
  f.env.PRIVATE_MEMBER_BUCKET = {async get(k) {
    key = k;
    return {body: 'PRIVATE PDF BYTES', size: 17,
      writeHttpMetadata(headers) {headers.set('etag', 'PRIVATE_ETAG')}};
  }};
  const opts = {...loaders(), pageId: inner.id, mediaId: 'media:private',
    loadPrivateMedia: async () => ({id: 'media:private', pageId: inner.id,
      visibility: 'private', storageKey: 'private-members/43/report.pdf',
      mimeType: 'application/pdf'})};
  const good = await handlePrivateMedia(req(), f.env, opts);
  assert.equal(good.status, 200);
  assert.equal(key, 'private-members/43/report.pdf');
  assert.equal(good.headers.get('content-disposition'), 'attachment');
  assert.equal(good.headers.get('cache-control'), 'private, no-store, max-age=0');
  assert.equal(good.headers.get('etag'), null);
  assert.equal(await good.text(), 'PRIVATE PDF BYTES');
  f.state.enrolled = false;
  assert.equal((await handlePrivateMedia(req(), f.env, opts)).status, 404);
});

test('M008-C: filtered search IDs have no private snippets; revoke is immediate', async () => {
  const f = scenario();
  const ids = await allowedPrivatePageIds(req(), f.env,
    [root.id, 'nonexistent', inner.id, root.id], loaders());
  assert.deepEqual(ids, [root.id, inner.id]);
  f.state.types = [];
  assert.deepEqual(await allowedPrivatePageIds(req(), f.env,
    [root.id, inner.id], loaders()), []);
  assert.deepEqual(await allowedPrivatePageIds(req(null), f.env,
    [root.id, inner.id], loaders()), []);
});

test('M008-C: no private routes added to live worker or existing public renderer', () => {
  const production = readFileSync(new URL('../migration/cloudflare/production-worker.mjs', import.meta.url), 'utf8');
  const staging = readFileSync(new URL('../migration/cloudflare/staging-worker.mjs', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../migration/cloudflare/app/security/member-private-access.mjs', import.meta.url), 'utf8');
  for (const original of [production, staging])
    assert.equal(original.includes('member-private-access.mjs'), false);
  assert.equal(source.includes("canAccessPage(page, context)"), true);
  assert.equal(source.includes('resolveExplicitMemberIdentity(request, env)'), true);
  assert.equal(source.includes('d.email_normalized=?'), false);
});
