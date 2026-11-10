-- M010-B, proposal only. Requires the additive M007-A/M008-B/M009-B migrations.
-- NEVER auto-apply to production or staging. Existing historical accounts untouched.
-- Per-entity optimistic revision and unique mutation nonce; mutations and audit
-- records are committed in ONE Cloudflare D1 batch transaction.
CREATE TABLE celebrations_directory_admin_revisions (
  resource_key TEXT PRIMARY KEY NOT NULL CHECK(length(resource_key) BETWEEN 1 AND 254),
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  mutation_id TEXT NOT NULL DEFAULT '' CHECK(length(mutation_id) <= 80)
);
