# CELEBRATIONS-R2-022 — evidence-based decision

Source: GitHub Actions run 38311230330, artifact r2-021-access-evidence (ID 11774961639). Evidence downloaded and inspected. The artifact itself contains object keys and is not copied into Git.

## Confirmed inventory
- 158 source objects, 126 with a reference in audited `celebrations_contents`, 32 without a reference.
- 142 `media/` objects: 126 referenced and 16 unreferenced.
- 9 `committee/` objects: **all 9 unreferenced in audited content tables**.
- 7 `tests/` objects: all 7 unreferenced.
- All 158 responded HTTP 206 to unauthenticated byte-range requests at their existing Supabase Storage public URLs. This proves technical exposure, not publication authorization.
- Referenced object evidence contains only audience `all` in this audit (134 reference records, including repeated references to one object). Audience `all` is insufficient evidence for independent R2 publication.

## Conservative classification from available evidence
PUBLIC_CONFIRMED = 0; RESTRICTED_CONFIRMED = 0; UNCERTAIN = 126; UNREFERENCED = 32.
The 9 committee objects are UNREFERENCED and high-priority confidentiality review; **not** certified private or public. The 16 unreferenced media objects and 7 tests objects also require ownership and permission review.

## Limitations
The R2-021 evidence collected content tables and associations but did not capture PostgreSQL RLS policies, Edge Function authorization source, committee-specific metadata tables, actual participant entitlements or explicit publication approvals. No per-object affirmative publication permission exists in the evidence. No R2 public access authorized.

## Recommended public delivery
Keep Supabase as current origin. If permission proofs are later obtained, use an isolated public-only R2 bucket containing only approved objects; never expose the mixed original bucket. For restricted content use server-side authorization and short-lived controlled delivery, not a client-side audience selector. Before enabling any domain, resolve the 9 committee files and verify all references and direct-link risks.

## Safe sync
`scripts/r2_022_safe_sync_plan.py` is an **offline dry-run-only planner**, not a network sync implementation. It accepts precomputed SHA-256 maps and emits only action counts: SKIP_IDENTICAL, WOULD_COPY_AFTER_AUTHORIZATION, CONFLICT_STOP, ORPHAN_REVIEW_NO_DELETE. No writes, no deletions, no secret or path logging. Production-grade synchronization requires a separate explicitly authorized implementation and validation of safe versioned uploads, tombstones and revocation for administrative deletes.

## Evidence handling
The original 7-day GitHub artifact remains the source of detailed per-object evidence. No filenames or sensitive document content are printed in CI logs by the new tests. Run classification locally on the evidence JSON if authorized; the classifier returns a per-object JSON report, which should remain access-restricted.
