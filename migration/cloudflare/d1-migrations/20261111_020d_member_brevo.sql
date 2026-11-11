-- M020-D (proposition, NON APPLIQUÉE): ajout exclusivement.
-- Prérequis : schéma historique + annuaire 007a/008b + identités 009b.
PRAGMA foreign_keys=ON;
CREATE TABLE celebrations_member_invitation_bindings (
  person_id TEXT NOT NULL PRIMARY KEY,
  participant_email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('invited','active','revoked')),
  reviewed_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(person_id) REFERENCES celebrations_directory_people(id) ON DELETE RESTRICT,
  FOREIGN KEY(participant_email) REFERENCES celebrations_participants(email) ON DELETE RESTRICT
);
CREATE TABLE celebrations_member_email_tokens (
  token_hash TEXT NOT NULL PRIMARY KEY CHECK(length(token_hash)=64),
  participant_email TEXT NOT NULL,
  person_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('activate','reset')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY(person_id) REFERENCES celebrations_member_invitation_bindings(person_id) ON DELETE CASCADE,
  FOREIGN KEY(participant_email) REFERENCES celebrations_participants(email) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX idx_member_one_pending_token
  ON celebrations_member_email_tokens(participant_email,purpose) WHERE used_at IS NULL;
CREATE INDEX idx_member_token_expiry ON celebrations_member_email_tokens(expires_at);
CREATE TABLE celebrations_member_mail_events (
  id TEXT NOT NULL PRIMARY KEY,
  identity_hash TEXT NOT NULL CHECK(length(identity_hash)=64),
  purpose TEXT,
  outcome TEXT NOT NULL CHECK(outcome IN ('attempt','sent')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_member_mail_limits
  ON celebrations_member_mail_events(identity_hash,created_at);
CREATE INDEX idx_member_mail_daily
  ON celebrations_member_mail_events(outcome,created_at);
