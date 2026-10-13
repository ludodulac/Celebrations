# CELEBRATIONS-SUPABASE-EXIT-003 — implementation and staging status

Branch: feat/celebrations-supabase-exit-001. Production unchanged.

Implemented:
- D1 participant login with legacy Supabase PBKDF2-HMAC-SHA256 180,000 iterations, UTF-8 salt string, hex output; existing password hashes can be imported unchanged. Token is 32 random bytes, only SHA-256 stored. Session expiry checked server-side. Logout deletes hash.
- D1 admin login using independent ADMIN_PASSWORD_HASH and ADMIN_PASSWORD_SALT Worker secrets (never commit secrets); admin sessions checked on every mutation; logout.
- Participant audience lookup uses D1 session; public read API limits contents/events to 'all' or server-verified participant audience. Raw session, password and participant tables cannot be read publicly.
- Admin D1 CRUD allowlist for contents, events, participants' email/audience, settings, groups, celebrations, steps, links, and relations. Committee document row is readable/createable but deletion requires revocation endpoint. No general transaction across multiple CRUD calls; not parity with Supabase safe_merge.
- Private R2 media admin endpoints for bounded uploads, conditional put attempt, verified deletion of revoked/non-public media, and committee ACL revocation. Conditional-write semantics and atomicity must be verified on actual R2 staging before use.
- Isolated Worker staging entrypoint routes auth, audience, public D1 reads, admin CRUD, private R2 reads and media administration.
- Existing index.html has opt-in ?staging=1 and branch-only preview-client bridge. Default path remains Supabase. This is NOT a full frontend integration; admin save and registration/recovery still use legacy APIs.
- Offline relational 16-table schema and importer from EXIT-002 preserved.

**Security and completeness limitations:**
1. No Cloudflare deployment: no Cloudflare Worker/R2/D1 account access tool available in this execution; no staging URL and no real browser end-to-end test.
2. No staging D1 with imported test fixture. Only mocked handler and local SQLite schema tests.
3. Participant registration, password recovery, failed-login throttling, admin safe_merge transactional persistence, media upload finalize, access revocation propagation, restricted R2 media authorizations, committee upload UI, and legacy browser compatibility are NOT complete.
4. Current public R2 gateway uses a public_media allowlist and does NOT yet implement participant-only media access. Do not approve restricted media for public access.
5. Browser ?staging=1 requires hosting frontend and API on the same origin, with an isolated static-assets serving setup. Current staging Worker returns 404 for static assets.
6. Existing committee PDF access requires matching committee_media ACL rows; none migrated to D1.
7. Full rollback still consists of retaining production Supabase untouched; a tested feature flag for production cutover is not yet implemented.
8. No real personal data exported or imported in this mission.
9. CI tests are unit/mock tests, not a production-readiness certification.

READY_FOR_PRODUCTION=NO
READY_TO_CANCEL_SUPABASE_PRO=NO
