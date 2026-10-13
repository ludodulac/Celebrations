# CELEBRATIONS-SUPABASE-EXIT-004 — assembly evidence (staging branch only)

## Actual changes
- Existing public/admin pages now have explicit staging routing, not a redesign. The staging Worker routes public D1 reads, participant/admin auth, audience checks, admin CRUD, transactional safe_merge, R2 media reads and admin writes; Worker serves an isolated static assets binding and redirects root/admin entrypoints to staging mode.
- Existing admin saveState() safe_merge now reaches a D1 batch that atomically merges contents, celebrations, steps, events, and their relations. A unique step identity constraint was added. **Atomic batch is NOT conflict detection**: simultaneous browser edits can overwrite each other. Link merge, safe deletion and cross-object revisions remain incomplete.
- Participant registration and answer-based password recovery now use legacy PBKDF2 and exact French normalization; password reset revokes existing participant sessions. D1 persistent login throttling was added.
- Existing committee UI now has a staging R2 upload/finalize path with atomic D1 document + ACL publication, link access and ACL revocation. Public committee route rejects revoked links. No physical deletion is implied by revocation.
- Existing library upload/delete controls route to staging R2. R2 deletion is rejected while referenced in D1. R2 public gateway enforces an explicit public allowlist; restricted media requests require bearer-authenticated audience match.
- Static staging assets are built from site files by scripts/build_staging_assets.py; excludes .github, migration backend, scripts, tests, docs, and data files (PDF/JSON/TXT).
- Production still uses Supabase; no production branch/route/data/bucket was changed.

## Known limitations (do not certify PASS)
1. No Cloudflare Workers/D1/R2 account connector available. No D1 staging database created, no R2 staging bucket bound, no Worker deployed, no staging URL or real browser validation.
2. Staging bindings DB, MEDIA_ACL, MEDIA_BUCKET and ASSETS must point to isolated resources; admin password hash/salt must be configured as secrets. The example wrangler file deliberately has placeholders.
3. Restricted audio/PDF URLs in existing HTML elements do not attach bearer headers. Media ACL code can authorize bearer fetches, but browser media players still need a verified token-safe delivery path.
4. Public frontend still has Supabase-specific calls beyond the D1 data loader. Admin settings, link edits, media lifecycle and committee UX need browser validation and completion.
5. Safe_merge does not implement optimistic concurrency version checking; it merges relations non-destructively and does not fully reconcile deleted relations/links.
6. Committee media delete is ACL revocation, not physical deletion; old Supabase committee URLs remain active while production stays on Supabase.
7. No real participants or committee PDFs have been imported to staging; no personal information used.
8. Unit tests, mocked Worker route tests, relational schema importer tests, and static build CI are not equivalent to end-to-end browser tests.
9. Admin credentials must be configured independently in staging; the old Supabase production admin password is not migrated.
10. Existing site's default mode remains Supabase, intentionally for rollback. No authorized production cutover.

READY_FOR_PRODUCTION=NO
READY_TO_CANCEL_SUPABASE_PRO=NO
