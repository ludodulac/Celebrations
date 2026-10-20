# R2-024 — findings and hardening status

## Committee authorization — inspected deployed Edge Functions
Supabase project `jwyayfkssyagvnablttg`, read-only inspection of deployed `celebrations-committee-public` v2 and `celebrations-admin-data` v5.

- Administrator must pass `isAdmin(admin_token)` before `committee_create_upload`, `committee_finish_upload`, `committee_list`, `committee_delete`.
- Upload path is `committee/<UUID>/<safe filename>`; a signed upload URL is generated; `committee_finish_upload` inserts into `celebrations_committee_letters` with ID, title, file name, storage path, MIME. No explicit per-row publication flag appears in this insertion.
- Public Edge Function has `verify_jwt=false`. It accepts an ID or slug, queries `celebrations_committee_letters`, then downloads the corresponding file with the **service-role client**, and returns the PDF to any caller. It does not check participant authorization, expiration, or a publication flag. Link knowledge is the only effective gate.
- `committee_delete` attempts Storage `remove([path])`, **does not check its error**, then deletes the database row. The public Edge Function link then returns 404 when the row is gone, but a direct Storage URL could still work if Storage removal failed. No deletion/revocation test was run.
- Public response sets `Cache-Control: public, max-age=3600`: clients or intermediaries may cache a PDF for up to one hour after revocation.
- R2 bucket remains private. Copying files into a private bucket does not automatically authorize their public distribution. A mixed public bucket is unsafe.
- The 9 specific committee keys remain unpaired with actual committee-letter table rows in this mission. A separate read-only database query is required for per-document certification.

## Concurrency hardening — status
`scripts/r2_024_consistency.py` introduces **standalone** fail-closed guards for source ETag/version, source before/after snapshots, byte-level SHA-256 comparison, interruption, and R2 conflicts. Tests exercise these rules. **These guards are not yet integrated into `scripts/r2_023_sync.py`.** Consequently the operational synchronizer is **NOT READY FOR CONTROLLED COPY**. Even with pre/post checks, an unversioned mutable source cannot prove atomic consistency with R2 write; source writes or deletions can race between checks. For strict correctness require immutable/versioned source keys or server-side snapshot/lock, plus one shared cross-run lock, destination conditional PUT and re-verification, and fail-closed tombstone handling.

No live copy, delete, public bucket activation, DNS change, production change or PR merge.
