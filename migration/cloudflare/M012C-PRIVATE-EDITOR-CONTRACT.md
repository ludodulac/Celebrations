# M012-C — Canonical space/page write contract (not activated)

Base 85b551c86b5a4d002099530354e53cbe677629b6. Same R2 object:
`EDITOR_BUCKET/editor-trials/server-drafts-v1.json`. No additional editor/store,
no Workers edited. The existing R2 adapter uses ETag conditional PUT plus
the global editor version. A draft save does not publish its text.

## A — Worker owner

Proposed path: `/api/admin/private-editor` (GET / POST). Invoke
`handlePrivateEditorCommand(request, env)` from
`app/application/private-editor-publication-service.mjs` only behind the
existing isolated-host opt-in gate. Do not enable in official hosts now.
Service independently calls `authorize(request,env,true)` (D1 bearer),
requires HTTPS and same-origin POST. Never accept client actor/roles.
GET requires `?celebration=41`. Use the existing D1/R2 bindings.
All responses are no-store. Do not enable private reads until reviewed
dedicated PRIVATE_MEMBER_BUCKET and the proposed D1 schema are ready.
For a trusted enrollment resolver use the canonical published loader
`createCanonicalPrivateLoaders(env).loadPublishedSpace(id)` per request;
it denies unacknowledged releases. The directory still owns individual grants.

## B — editor owner

POST JSON includes `action`, `celebration` (canonical **decimal text**),
`expectedRevision` (the GET response's global R2 editor revision).
Success returns `revision`, `publishedRevision`, `record` (draft),
`pageReleases`, `spaceReleases`, `celebrationVisibility`,
`privateReleaseReady`, `idMap` (temporary to canonical).
Replace local IDs with this map and reload the record. No local fallback.

- `save`: optional complete `spaces` array (omission leaves unchanged;
  explicit empty deletes all), optional `pages` list of root upserts/ACL
  patches (omission leaves unchanged, not a replacement). Space shape
  is M005: id, celebrationId, name, visibility PUBLIC/PRIVATE, accessPolicy,
  pages. Each page id, name/title, blocks, accessPolicy, optional translations;
  nested spaceId must match input parent. Existing root may be patched with
  just id/accessPolicy. New IDs must start `draft-space:` / `draft-page:`;
  backend allocates permanent UUIDs. Existing permanent IDs must belong to
  that canonical aggregate. Policy modes and selected active types are
  validated against D1. An existing space cannot switch PUBLIC/PRIVATE;
  create a new space. A managed root cannot switch to PUBLIC.
  Ordinary public root edits continue through the old editor.
- `publish`: `kind:"space"|"page"`, `id`; nested page also
  `spaceId`. Explicitly publish celebration, space, then each page.
  Space publication does not publish children. Draft edits do not refresh
  private publications; republish explicitly. Policy changes revoke prior
  releases immediately. Explicit `unpublish` or `delete` has the same
  target shape. Unpublishing a space revokes all child confirmations.
- `celebration-visibility`: `visibility:"published"|"draft"|"hidden"`.
  Hide/draft revokes all private confirmations; showing again does NOT restore
  them. The ordinary public editor must use this command for managed celebrations.
- `duplicate`: `targetCelebration`, an existing numeric D1 celebration
  with no canonical R2 record. M005 copies only draft content with new page/space
  IDs; no grants, release confirmations, published translations or media
  manifest. Response includes `duplicate.spaceIds/pageIds`. Creating the D1
  celebration is outside this mission, not inferred from a provisional plan.
- `reconcile`: only action, celebration, expectedRevision. Acknowledges
  exact stored canonical epoch, never browser-provided state. GET again first.

No caller sends published ledgers, members, storage keys, actor or grants.
A 409 means reload, keep unsaved local changes. A 503 with `saved:true`
means R2 already committed; reload, **do not replay** the mutation, then
reconcile. A 503 without saved may be a network ambiguity: reload before
retrying. A GET with privateReleaseReady false never means live publication.

## R2/D1 protocol

1. Validate D1 admin, celebration, active type catalogue and proposed fence
   schema. Check expected version. Validate M002 policy/M005 ownership.
2. Write draft or explicit release/revocation in one conditional R2 PUT.
   Published content and both M011-B manifests are part of the same snapshot.
   A changed published epoch stores `published.privateReleaseRevisions[cid]`
   = {revision, token}; token server UUID, revision equals current
   publishedRevision at the mutation. Unrelated public changes can advance the
   global publishedRevision without invalidating earlier celebration epochs.
3. Only after success, D1 batch inserts missing private-space registry IDs
   (never enrollment/participation) and acknowledges exact epoch. Conditional
   D1 upsert refuses rollback to a stale epoch and wrong space ownership.
4. M011-B canonical loader requires matching D1 epoch and registry for every
   released private space. No match, no private page, media, search or navigation.
   A partial failure denies until reconcile. The two services are **not atomic**.
   A failed R2 conditional PUT never runs D1 acknowledgement.
   D1 individual permissions are evaluated on every request. No cached grant.
   Registry rows can remain after revoke (permanent IDs, existing FK grants);
   re-release of the same space uses its existing explicit enrollments.
   Deletion never reuses an ID, no automatic transfer or creation of grants.

## Security and limits

- The legacy cookie-only server draft and publication handlers cannot mutate
  managed pages/spaces and preserve them on ordinary saves. Legacy initial
  publication excludes managed drafts and all nested spaces.
- Raw public projection and media routes continue through M009-A/C.
  All spaces are intentionally excluded from legacy anonymous projection:
  PUBLIC spaces can be durably saved and explicitly released, but their public
  display/navigation is a separate future integration, not enabled here.
- Private media and translation **drafts** stay separate. Page republish
  invalidates old private media/translation confirmations rather than copying
  them. This mission does not create a private media upload/release or private
  translation release command. Existing M011-B protection remains; new bytes
  require a separately verified dedicated private R2 workflow. Previously public
  URLs cannot be made confidential by changing only a page policy.
- Previously stored M011-B release ledgers without a D1 epoch now fail closed.
  The proposed additive migration must be reviewed before any activation;
  it was not applied to real D1. A controlled explicit re-publication is
  required for any legacy private confirmations.
- D1/R2 failures and CAS races are tested with local SQLite + simulated R2,
  not live services. Already-started responses cannot be recalled; every new
  private request revalidates the canonical epoch and member grants.
