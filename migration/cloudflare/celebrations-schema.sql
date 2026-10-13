-- D1 relational schema derived from live PostgreSQL metadata (read-only inspection).
-- Timestamps stored as ISO8601 TEXT; booleans as 0/1. No auth.users FK: external Supabase Auth table is outside these 16 tables.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS "celebrations_celebrations" (
  "id" INTEGER PRIMARY KEY,
  "archangel" TEXT NOT NULL,
  "year" TEXT,
  "status" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS "celebrations_steps" (
  "id" INTEGER PRIMARY KEY,
  "celebration_id" INTEGER NOT NULL,
  "step_key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "start_date" TEXT,
  "end_date" TEXT,
  "body_text" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY ("celebration_id") REFERENCES "celebrations_celebrations" ("id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "idx_celebrations_steps_celebration_id" ON "celebrations_steps" ("celebration_id");
CREATE TABLE IF NOT EXISTS "celebrations_events" (
  "id" TEXT NOT NULL,
  "celebration_id" INTEGER NOT NULL,
  "step_key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "event_time" TEXT,
  "description" TEXT,
  "audience" TEXT NOT NULL DEFAULT 'all',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY ("id"),
  FOREIGN KEY ("celebration_id") REFERENCES "celebrations_celebrations" ("id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "idx_celebrations_events_celebration_id" ON "celebrations_events" ("celebration_id");
CREATE TABLE IF NOT EXISTS "celebrations_contents" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "source_type" TEXT,
  "audience" TEXT NOT NULL DEFAULT 'all',
  "storage_path" TEXT,
  "external_url" TEXT,
  "file_name" TEXT,
  "mime_type" TEXT,
  "has_cover" INTEGER NOT NULL CHECK ("has_cover" IN (0,1)) DEFAULT 0,
  "cover_storage_path" TEXT,
  "audio_kind" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "description" TEXT,
  "inline_text" TEXT,
  "category" TEXT,
  "cover_file_name" TEXT,
  PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "celebrations_event_contents" (
  "event_id" TEXT NOT NULL,
  "content_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("event_id","content_id"),
  FOREIGN KEY ("content_id") REFERENCES "celebrations_contents" ("id") ON DELETE RESTRICT,
  FOREIGN KEY ("event_id") REFERENCES "celebrations_events" ("id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "idx_celebrations_event_contents_content_id" ON "celebrations_event_contents" ("content_id");
CREATE INDEX IF NOT EXISTS "idx_celebrations_event_contents_event_id" ON "celebrations_event_contents" ("event_id");
CREATE TABLE IF NOT EXISTS "celebrations_step_contents" (
  "celebration_id" INTEGER NOT NULL,
  "step_key" TEXT NOT NULL,
  "content_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("celebration_id","step_key","content_id"),
  FOREIGN KEY ("celebration_id") REFERENCES "celebrations_celebrations" ("id") ON DELETE RESTRICT,
  FOREIGN KEY ("content_id") REFERENCES "celebrations_contents" ("id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "idx_celebrations_step_contents_celebration_id" ON "celebrations_step_contents" ("celebration_id");
CREATE INDEX IF NOT EXISTS "idx_celebrations_step_contents_content_id" ON "celebrations_step_contents" ("content_id");
CREATE TABLE IF NOT EXISTS "celebrations_links" (
  "id" INTEGER PRIMARY KEY,
  "celebration_id" INTEGER,
  "step_key" TEXT,
  "event_id" TEXT,
  "label" TEXT,
  "url" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "link_type" TEXT NOT NULL DEFAULT 'link',
  FOREIGN KEY ("event_id") REFERENCES "celebrations_events" ("id") ON DELETE RESTRICT,
  FOREIGN KEY ("celebration_id") REFERENCES "celebrations_celebrations" ("id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "idx_celebrations_links_event_id" ON "celebrations_links" ("event_id");
CREATE INDEX IF NOT EXISTS "idx_celebrations_links_celebration_id" ON "celebrations_links" ("celebration_id");
CREATE TABLE IF NOT EXISTS "celebrations_footer_drafts" (
  "id" INTEGER PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "draft_number" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL DEFAULT '',
  "is_active" INTEGER NOT NULL CHECK ("is_active" IN (0,1)) DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "is_public" INTEGER NOT NULL CHECK ("is_public" IN (0,1)) DEFAULT 0
);
CREATE TABLE IF NOT EXISTS "celebrations_user_profiles" (
  "user_id" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "display_name" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY ("user_id")
);
CREATE TABLE IF NOT EXISTS "celebrations_participants" (
  "email" TEXT NOT NULL,
  "password_salt" TEXT,
  "password_hash" TEXT,
  "question_1" TEXT,
  "answer_1_salt" TEXT,
  "answer_1_hash" TEXT,
  "question_2" TEXT,
  "answer_2_salt" TEXT,
  "answer_2_hash" TEXT,
  "recovery_failed_count" INTEGER NOT NULL DEFAULT 0,
  "recovery_locked_until" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "registered_at" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "audience" TEXT,
  PRIMARY KEY ("email")
);
CREATE TABLE IF NOT EXISTS "celebrations_participant_sessions" (
  "token_hash" TEXT NOT NULL,
  "participant_email" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "expires_at" TEXT NOT NULL,
  PRIMARY KEY ("token_hash"),
  FOREIGN KEY ("participant_email") REFERENCES "celebrations_participants" ("email") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "idx_celebrations_participant_sessions_participant_email" ON "celebrations_participant_sessions" ("participant_email");
CREATE TABLE IF NOT EXISTS "celebrations_admin_sessions" (
  "token_hash" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "expires_at" TEXT NOT NULL,
  "admin_email" TEXT,
  PRIMARY KEY ("token_hash")
);
CREATE TABLE IF NOT EXISTS "celebrations_public_settings" (
  "id" INTEGER PRIMARY KEY DEFAULT 1,
  "show_other_celebrations" INTEGER NOT NULL CHECK ("show_other_celebrations" IN (0,1)) DEFAULT 0,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS "celebrations_groups" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_system" INTEGER NOT NULL CHECK ("is_system" IN (0,1)) DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "celebrations_committee_letters" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "storage_path" TEXT NOT NULL UNIQUE,
  "mime_type" TEXT NOT NULL DEFAULT 'application/pdf',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "slug" TEXT,
  PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "celebrations_clicks" (
  "id" INTEGER PRIMARY KEY,
  "clicked_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  "celebration_id" INTEGER,
  "content_id" TEXT,
  "target_kind" TEXT NOT NULL DEFAULT 'link',
  "target_label" TEXT,
  "target_url" TEXT,
  "page_path" TEXT,
  "step_key" TEXT,
  "event_id" TEXT,
  "visitor_id" TEXT
);
-- Auth identity mapping must be implemented independently before use of celebrations_user_profiles.
