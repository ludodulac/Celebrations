-- Mission B: isolated visual-admin foundation. Additive tables ONLY.
-- Never ALTER, UPDATE or DELETE any historical celebrations_* table.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS editor_b_pages (
  id TEXT PRIMARY KEY,
  route_path TEXT NOT NULL UNIQUE,
  celebration_id INTEGER,
  step_key TEXT,
  head_version INTEGER NOT NULL DEFAULT 1 CHECK(head_version>=1),
  draft_version INTEGER NOT NULL DEFAULT 1,
  published_version INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(published_version IS NULL OR published_version<=head_version),
  FOREIGN KEY(celebration_id) REFERENCES celebrations_celebrations(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS editor_b_revisions (
  page_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version>=1),
  title TEXT NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('create','edit','block','publish','restore')),
  source_version INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(page_id,version),
  FOREIGN KEY(page_id) REFERENCES editor_b_pages(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS editor_b_blocks (
  page_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  block_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position>=0),
  kind TEXT NOT NULL CHECK(kind IN ('title','text','banner','button')),
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  PRIMARY KEY(page_id,version,block_id),
  FOREIGN KEY(page_id,version) REFERENCES editor_b_revisions(page_id,version) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_editor_b_blocks_order
 ON editor_b_blocks(page_id,version,position);
CREATE INDEX IF NOT EXISTS idx_editor_b_pages_celebration
 ON editor_b_pages(celebration_id);
-- Files, external URLs and trash are intentionally deferred to later missions:
-- Mission B does not introduce new file paths, R2 objects or destructive operations.
