-- M012-A: proposed additive replay-protection ledger. LOCAL ONLY until separately authorized.
-- No modification of existing credentials, sessions, or participants.
CREATE TABLE celebrations_editor_admin_challenges (
 challenge_hash TEXT PRIMARY KEY NOT NULL CHECK(length(challenge_hash)=64),
 expires_at TEXT NOT NULL
);
CREATE INDEX idx_celebrations_editor_admin_challenges_expiry
 ON celebrations_editor_admin_challenges(expires_at);
