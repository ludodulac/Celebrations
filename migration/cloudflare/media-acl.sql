-- Isolated candidate ACL schema for a PRIVATE R2 media gateway.
-- This is NOT the full Celebrations database migration.
-- Apply only to a new staging D1 database after explicit approval.
CREATE TABLE IF NOT EXISTS public_media (
 storage_path TEXT PRIMARY KEY,
 approved INTEGER NOT NULL DEFAULT 0 CHECK (approved IN (0,1)),
 revoked_at TEXT,
 approved_at TEXT
);
CREATE TABLE IF NOT EXISTS committee_media (
 slug TEXT PRIMARY KEY,
 storage_path TEXT NOT NULL UNIQUE,
 published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
 revoked_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS committee_media_active ON committee_media(published,revoked_at);
