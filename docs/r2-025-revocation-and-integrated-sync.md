# R2-025 — proposed committee revocation patch (NOT DEPLOYED)

Deployed `celebrations-admin-data` currently ignores `storage.remove()` error and deletes the committee DB row regardless. Proposed server-side change, for a later separately authorized deployment:

1. On `committee_delete`, resolve the row under administrator authorization and mark it `revoking` in a transaction or durable revocation registry **before** removing the object. The public function must reject revoked/revoking rows.
2. Execute Storage `remove([path])` and **check both `error` and returned deletion results**. If deletion fails, return an error and retain a durable revocation tombstone. Never report successful physical deletion.
3. Verify absence of the object through privileged Storage read or metadata query; avoid returning the object path in error messages. Handle retries idempotently.
4. Remove or deactivate the DB record only after verification, keeping the tombstone for any R2 gateway. Direct Supabase Storage URLs remain a risk until deletion is verified.
5. Replace `Cache-Control: public, max-age=3600` for revocable PDFs with `Cache-Control: no-store`; invalidate existing CDN caches where supported. Cached copies held by clients cannot be recalled retroactively.
6. Never expose a mixed public R2 bucket. Serve committee objects only through a gateway that checks current revocation state on each request.

This is a proposal only; no Edge Function deployed or production DB changed.

## Sync hardening reality
The actual `scripts/r2_023_sync.py` now calls source pre/post metadata and full SHA-256 rereads around download, before PUT, and after PUT; conditional `IfNoneMatch='*'` and destination SHA-256 verification remain. A copied object returns `COPIED_UNCERTIFIED_ATOMICITY`, and the report includes `fully_certified=false`: a mutable Supabase object may change between the final check and PUT, and post-checks cannot provide a global atomic snapshot.

No distributed cross-run lock has been implemented. GitHub Actions `concurrency` groups can serialize runs of a specific workflow, but not independent processes or workflows on other machines. Controlled live copy is blocked pending a shared lease/lock and immutable source versions or equivalent server-side snapshot guarantee.

On interruption, a rerun inventories R2 again and verifies existing objects' bytes before accepting them as identical. This does not certify that the previous interrupted attempt completed; the current run must finish its own checks.
