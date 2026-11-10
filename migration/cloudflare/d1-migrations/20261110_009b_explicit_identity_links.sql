-- M009-B: additive, explicit two-party identity reconciliation and private audit.
-- PROPOSED ONLY. Never apply to staging or production as part of this PR.
-- Prerequisites: 20261110_007a_contact_directory.sql, 20261110_008b_directory_integrity.sql.
-- No legacy participant passwords, sessions, profiles or contact rows are changed.
PRAGMA foreign_keys=ON;

CREATE TABLE celebrations_directory_identity_claims (
  claim_id TEXT PRIMARY KEY,
  participant_email TEXT NOT NULL,
  person_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reviewed_at TEXT,
  reviewed_by TEXT,
  verification_method TEXT CHECK(verification_method IS NULL OR
    verification_method IN ('in_person','independent_records','video_verified')),
  UNIQUE(participant_email,person_id),
  FOREIGN KEY(participant_email) REFERENCES celebrations_participants(email) ON DELETE RESTRICT,
  FOREIGN KEY(person_id) REFERENCES celebrations_directory_people(id) ON DELETE RESTRICT
);
CREATE INDEX idx_celebrations_directory_claim_status
  ON celebrations_directory_identity_claims(status,created_at);

CREATE TABLE celebrations_directory_identity_links (
  participant_email TEXT NOT NULL PRIMARY KEY,
  person_id TEXT NOT NULL UNIQUE,
  approved_claim_id TEXT NOT NULL UNIQUE,
  approved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(participant_email) REFERENCES celebrations_participants(email) ON DELETE RESTRICT,
  FOREIGN KEY(person_id) REFERENCES celebrations_directory_people(id) ON DELETE RESTRICT,
  FOREIGN KEY(approved_claim_id) REFERENCES celebrations_directory_identity_claims(claim_id) ON DELETE RESTRICT
);
CREATE TRIGGER celebrations_directory_identity_link_immutable
BEFORE UPDATE ON celebrations_directory_identity_links
BEGIN SELECT RAISE(ABORT,'explicit identity links cannot be silently reassigned'); END;

CREATE TABLE celebrations_directory_admin_audit (
  id TEXT NOT NULL PRIMARY KEY,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_celebrations_directory_admin_audit_created
  ON celebrations_directory_admin_audit(created_at);
