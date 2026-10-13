# CELEBRATIONS-R2-023 — committee access and safe synchronization

## Committee: 9 individual evidence records (without revealing keys)
Evidence: R2-021 artifact 11774961639, cross-checked against GitHub code. All nine objects have **zero** references in the audited generic `celebrations_contents` tables, and all nine answer HTTP 206 without authentication at Supabase Storage public URLs. The exact names are deliberately omitted from this document; original restricted artifact contains them.

| Audit item | Size (bytes) | Generic content references | Anonymous HTTP | Intended usage |
|---|---:|---:|---:|---|
| C01 | 115495 | 0 | 206 | Committee PDF link mechanism (individual mapping unverified) |
| C02 | 305406 | 0 | 206 | Same |
| C03 | 1559252 | 0 | 206 | Same |
| C04 | 60831 | 0 | 206 | Same |
| C05 | 157560 | 0 | 206 | Same |
| C06 | 169489 | 0 | 206 | Same |
| C07 | 26315 | 0 | 206 | Same |
| C08 | 482030 | 0 | 206 | Same |
| C09 | 76301 | 0 | 206 | Same |

### Access flow found in source
- `admin-committee-links.js`: `committee_list` is called through `celebrations-admin-data` using an admin token. `committee_create_upload` generates a signed upload; `committee_finish_upload` registers the PDF; `committee_delete` is the administrative removal action. Administrator interface explicitly describes a shareable **public** link.
- `index.html`: `?lettre=<slug>` redirects to the Supabase Edge Function `celebrations-committee-public?slug=...`. This is a public-by-link workflow, but the Edge Function's actual validation, mapping, revocation and authorization were **not inspected**.
- `committee-links-data.js` is only an empty example array; it cannot prove which of the nine objects is active or intended for publication.
- Storage's anonymous HTTP 206 indicates existing direct technical exposure; it does not certify authorization or prove that administrative deletion revokes the direct link.

### Outstanding proof for each C01–C09
Read-only inspection of the committee-specific SQL table, matching object key to record id/slug, status, owner and publication flag; inspect `celebrations-committee-public` Edge Function and `committee_delete` implementation; validate revocation behavior and consent to public-by-link access. Until then each is **UNCERTAIN**, not PUBLIC_CONFIRMED. Do not expose original mixed R2 bucket.

## Sync implementation
`scripts/r2_023_sync.py` is a real-network-capable synchronizer but **has not been run against live storage**. Lists Supabase and R2; downloads source; hashes SHA-256; compares existing destination bytes and hashes; uses S3 `IfNoneMatch="*"` for new objects; re-downloads to verify bytes and SHA-256; stops on first error; writes counts-only JSON. Default DRY_RUN; real copy requires BOTH `DRY_RUN=false` and `CONFIRM_COPY=COPY`. No delete API calls. Single-object conditional PUT limited to 5 GiB. Existing matching files are verified, not overwritten.

### Administrative uploads and deletion safety
Current `admin-supabase-core.js` and `admin-committee-links.js` upload only to Supabase. Future server-side job (GitHub Actions scheduled or secure server worker) can run sync using secrets, never in browser. Maintain a versioned publication allowlist and tombstone/revocation table; before any R2 public delivery, make the serving layer deny tombstoned keys immediately. A public R2 bucket with permanent URLs cannot guarantee immediate revocation while retaining the file: keep mixed bucket private, or use a private R2 origin with an authenticated authorization gateway. No deletion is performed here.

### Constraints and remaining risks
Dry-run still downloads content for SHA-256 verification; it does not write R2. Destination inventory includes validation objects but never deletes them. Error reporting excludes keys and secrets. Race conditions involving source changes during a sync require additional version pinning and monitoring before live execution. No public code changed.
