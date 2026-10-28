-- MISSION C: additive historical snapshots. Keep the three editor_b_* tables unchanged.
-- No historical tables, R2 files, public routes or production resources may be modified.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS editor_c_imports(
 page_id TEXT PRIMARY KEY,
 source_key TEXT NOT NULL UNIQUE,
 original_route TEXT NOT NULL,
 source_sha256 TEXT NOT NULL,
 imported_version INTEGER NOT NULL,
 imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(page_id,imported_version) REFERENCES editor_b_revisions(page_id,version) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS editor_c_blocks(
 page_id TEXT NOT NULL,
 version INTEGER NOT NULL,
 block_id TEXT NOT NULL,
 position INTEGER NOT NULL CHECK(position>=0),
 legacy_kind TEXT NOT NULL,
 source_table TEXT NOT NULL,
 source_id TEXT NOT NULL,
 data_json TEXT NOT NULL CHECK(json_valid(data_json)),
 PRIMARY KEY(page_id,version,block_id),
 FOREIGN KEY(page_id,version) REFERENCES editor_b_revisions(page_id,version) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_editor_c_blocks_order ON editor_c_blocks(page_id,version,position);
CREATE INDEX IF NOT EXISTS idx_editor_c_blocks_source ON editor_c_blocks(source_table,source_id);
