# CELEBRATIONS-SUPABASE-EXIT-001 — consolidation (staging only)

## Baseline independently inspected, 2026-10-13
- Main application: `ludodulac/Celebrations`; PR #33 remains draft and untouched by this exit branch. R2-027 run 38376347798 succeeded, existing 158 R2 media objects already migrated. No repeat copy performed.
- Supabase project `jwyayfkssyagvnablttg` remains active. 16 `celebrations_*` tables, including participant password hashes, sessions, committee letters, and content associations. Data types include bigint, text, date, timestamptz, uuid, boolean; the current public JS uses PostgREST, Supabase Edge Functions and direct Storage public URLs.
- Public UI `supabase-data.js` uses eight PostgREST reads and direct public Storage URLs. `public-profile-gate.js` invokes `celebrations-access` and `celebrations-audience`. `admin-supabase-core.js` invokes `celebrations-admin-safe-save` and `celebrations-admin-data`, and uses signed uploads / resumable TUS. `admin-committee-links.js` uploads to Supabase and invokes committee actions. Replacing the storage URL alone is NOT an exit.
- Security: current anonymous direct Supabase media access does not establish permission for R2 publication. Committee links need per-slug revocation and no-store. R2 bucket MUST remain private.

## Implemented on isolated branch `feat/celebrations-supabase-exit-001`
1. `migration/cloudflare/media-gateway.mjs`: non-deployed Worker-compatible **private R2** read gateway. Deny by default; public media requires explicit ACL approval; committee documents resolved by revocable slug only, not raw committee object keys; HTTP HEAD and single Range requests, partial 206 responses, private/no-store cache headers. No browser R2 credentials.
2. `migration/cloudflare/media-acl.sql`: **candidate only** SQLite-compatible ACL schema with explicit approval flags defaulting to false. This does not assert full PostgreSQL-to-D1 compatibility and must not be applied without separate authorization.
3. `migration/export_celebrations_readonly.py`: read-only, paginated JSON export of all 16 Celebrations tables to a newly created private directory, restrictive permissions, SHA-256 manifest, no automatic uploads or overwrite. Includes sensitive account and hash records: **never commit or publish generated output**. Not executed against live user data in this mission.
4. Node and Python tests plus GitHub Actions CI; no secrets or real media required.

## Remaining functional parity work (blocking production)
- Decide database target after a **real schema compatibility check** covering 16 tables, keys, foreign keys, unique constraints, defaults, sequences, triggers, indexes, date/time and transaction behavior. D1 is NOT approved as a full data target by this document.
- Replace eight public PostgREST queries with a server-side API that enforces access rules and avoids leaking restricted rows. Reimplement all admin safe-merge operations transactionally, content relationships, settings, click analytics, committee CRUD, and validation.
- Reimplement `celebrations-access` and `celebrations-audience` password verification, registration/recovery, sessions, permissions, rate limiting and secure migration of existing password hashes. **Never reset or migrate accounts without approved tested plan.**
- New admin media upload path needs server-side signed R2 uploads, bounded size/MIME, finalization, metadata and authorization, resumable behavior as needed. Revocation must deny reads immediately; storage deletion must report failures, with no cache of private committee PDFs.
- Range/HEAD gateway tests are mocked: real Cloudflare Worker R2 Range semantics, audio seeking, PDF rendering, and browser CORS need staging verification.
- Deploy a **nonproduction** preview and run authenticated public/admin end-to-end tests. Preserve Supabase as rollback source until explicit production approval and data reconciliation.
- Protect the staging gateway: no route or R2 binding has been deployed, and no production site files were switched.

## Other projects (read-only inspection)
- BRIF: preserve GitHub, Vercel, Stripe; do not migrate its Supabase test accounts or data. The IN-SECT Supabase project contains `drop_service_*` tables in addition to `insect_*` tables. The user has authorized abandoning current BRIF operation, but other projects may still depend on this Supabase project.
- IN-SECT Supabase project `nczdadkyysrxxcsnsrrn`: `insect_matches` (8 rows), `insect_matchmaking_queue` (1 row), plus 8 `drop_service_*` tables. Do not assume this project can be deleted until code/hosting dependency checks.
- BORALOG Supabase project `jwtawyeuyvqjikjvfhri`: active tables include organizations, projects, events, messages (9), tasks, people, memberships. Do not assume it can be shut down.
- All three projects are in the same Supabase organization according to the project listing. Canceling a paid organization plan may affect all three. Confirm plan downgrade behavior and billing in Supabase before cancellation.

## Cost and decision
No new paid service activated. Candidate Cloudflare Worker + private R2 + optional SQLite/D1 ACL may fit free quotas, but **actual cost is NOT CERTIFIED** without measured request/storage/CPU/write volumes, chosen DB target and Cloudflare billing plan. Existing R2 cost is separate. No price promise.

READY_FOR_PRODUCTION = NO
READY_TO_CANCEL_SUPABASE_PRO = NO
No migration copy, production deployment, storage deletion, DNS change or merge performed.
