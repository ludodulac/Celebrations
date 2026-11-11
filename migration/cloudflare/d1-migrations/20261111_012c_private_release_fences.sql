-- M012-C PROPOSED ONLY. Never execute remotely in this mission.
-- D1 acknowledges an already committed R2 private publication epoch.
-- No membership, enrollment or historical content is created here.
CREATE TABLE celebrations_private_release_fences (
 celebration_id INTEGER PRIMARY KEY REFERENCES celebrations_celebrations(id) ON DELETE RESTRICT,
 revision INTEGER NOT NULL CHECK(revision>0),
 token TEXT NOT NULL CHECK(length(token)=36)
);
