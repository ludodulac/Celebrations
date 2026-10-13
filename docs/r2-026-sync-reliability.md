# CELEBRATIONS-R2-026 — controlled sync reliability

The operational entrypoint remains `scripts/r2_023_sync.py`. Source metadata and SHA-256 are checked after download, before R2 conditional PUT, and after PUT. Existing R2 bytes are SHA-256 verified on every rerun. A conditional PUT race is accepted only when the newly appearing object is independently downloaded and its bytes match; a mismatch stops the run.

Result categories distinguish `CONTENT_VERIFIED` (R2 matches downloaded source bytes) from `SOURCE_STABLE_DURING_CHECKS` (no detected change) and `ATOMIC_SNAPSHOT=false` (no immutable source snapshot guarantee). Source changes detected during checks fail closed. A later source change is not ruled out.

The GitHub test workflow now has a fixed `concurrency` group and `cancel-in-progress: false`. **This only serializes workflow runs using the same group**. Any future copy workflow must reuse the exact group. GitHub concurrency is not a universal distributed lock. The entrypoint refuses real copy when `GITHUB_ACTIONS != true`; externally initiated live copies are excluded. `DRY_RUN` defaults true; `CONFIRM_COPY=COPY` is mandatory for live copy.

**Important deployment limitation:** No production-copy GitHub Actions workflow is authorized or enabled by this mission. GitHub Actions concurrency is not a substitute for coordinating manual workflows that omit the group. GitHub concurrency groups allow at most one running and one pending, and ordering is not guaranteed. Avoid parallel scopes in any future workflow.

A run interrupted after conditional PUT will be re-inventoried and independently verified on the next run. No delete calls are present. No real copies were performed. Tests are mocked and do not prove real API conditional GET support; no such support is claimed.
