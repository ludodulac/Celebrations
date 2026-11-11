-- M021-A: strictly test D1 on the isolated M016 preproduction. Never apply to production.
CREATE TABLE celebrations_m021_demo_members (
  person_id TEXT NOT NULL PRIMARY KEY,
  participant_email TEXT NOT NULL UNIQUE CHECK(participant_email LIKE 'm021-%@test.invalid'),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_m021_demo_email ON celebrations_m021_demo_members(participant_email);
