-- M007-A / 2026-11-10 / version 20261110_007a
-- ADDITIVE proposed Cloudflare D1 migration; not applied by this mission.
-- Requires existing celebrations_celebrations from celebrations-schema.sql.
-- No historic profiles, participants, sessions, groups or pages are altered.
PRAGMA foreign_keys=ON;

CREATE TABLE celebrations_directory_people (
  id TEXT NOT NULL PRIMARY KEY
    CHECK(length(id)=43 AND substr(id,1,7)='person:'),
  email_normalized TEXT NOT NULL COLLATE NOCASE UNIQUE
    CHECK(length(email_normalized) BETWEEN 5 AND 254
      AND email_normalized=lower(trim(email_normalized))
      AND email_normalized NOT GLOB '*[^!-~]*'
      AND email_normalized LIKE '%_@_%._%'
      AND length(email_normalized)-length(replace(email_normalized,'@',''))=1),
  given_name TEXT CHECK(given_name IS NULL OR length(trim(given_name)) BETWEEN 1 AND 120),
  family_name TEXT CHECK(family_name IS NULL OR length(trim(family_name)) BETWEEN 1 AND 120),
  display_name TEXT CHECK(display_name IS NULL OR length(trim(display_name)) BETWEEN 1 AND 120),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TRIGGER celebrations_directory_people_stable_id
BEFORE UPDATE OF id ON celebrations_directory_people
BEGIN SELECT RAISE(ABORT,'directory person ID is permanent'); END;

-- NOT celebrations_groups (historic audiences) and NOT auth identities.
CREATE TABLE celebrations_directory_member_types (
  id TEXT NOT NULL PRIMARY KEY
    CHECK(substr(id,1,12)='member-type:' AND length(id) BETWEEN 13 AND 132),
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
  disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TRIGGER celebrations_directory_member_types_stable_id
BEFORE UPDATE OF id ON celebrations_directory_member_types
BEGIN SELECT RAISE(ABORT,'directory type ID is permanent'); END;

CREATE TABLE celebrations_directory_person_types (
  person_id TEXT NOT NULL,
  type_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(person_id,type_id),
  FOREIGN KEY(person_id) REFERENCES celebrations_directory_people(id) ON DELETE RESTRICT,
  FOREIGN KEY(type_id) REFERENCES celebrations_directory_member_types(id) ON DELETE RESTRICT
);
CREATE INDEX idx_celebrations_directory_person_types_type
  ON celebrations_directory_person_types(type_id,person_id);

CREATE TABLE celebrations_directory_person_celebrations (
  person_id TEXT NOT NULL,
  celebration_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(person_id,celebration_id),
  FOREIGN KEY(person_id) REFERENCES celebrations_directory_people(id) ON DELETE RESTRICT,
  FOREIGN KEY(celebration_id) REFERENCES celebrations_celebrations(id) ON DELETE RESTRICT
);
CREATE INDEX idx_celebrations_directory_person_celebrations_celebration
  ON celebrations_directory_person_celebrations(celebration_id,person_id);

-- Registry of ONLY PRIVATE spaces until the canonical M005 space store is wired.
-- Space metadata and ACLs remain in the authoritative M005 model, never here.
CREATE TABLE celebrations_directory_private_spaces (
  space_id TEXT NOT NULL PRIMARY KEY
    CHECK(length(trim(space_id)) BETWEEN 1 AND 254 AND space_id=trim(space_id)),
  celebration_id INTEGER NOT NULL,
  UNIQUE(space_id,celebration_id),
  FOREIGN KEY(celebration_id) REFERENCES celebrations_celebrations(id) ON DELETE RESTRICT
);
CREATE INDEX idx_celebrations_directory_private_spaces_celebration
  ON celebrations_directory_private_spaces(celebration_id,space_id);
CREATE TRIGGER celebrations_directory_private_spaces_stable_id
BEFORE UPDATE OF space_id ON celebrations_directory_private_spaces
BEGIN SELECT RAISE(ABORT,'private space ID is permanent'); END;

-- celebration_id is repeated only to enforce both composite parent FKs:
-- a person cannot join a space outside their linked celebration.
CREATE TABLE celebrations_directory_private_space_enrollments (
  person_id TEXT NOT NULL,
  celebration_id INTEGER NOT NULL,
  space_id TEXT NOT NULL,
  enrolled_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(person_id,space_id),
  FOREIGN KEY(person_id,celebration_id)
    REFERENCES celebrations_directory_person_celebrations(person_id,celebration_id)
    ON DELETE RESTRICT,
  FOREIGN KEY(space_id,celebration_id)
    REFERENCES celebrations_directory_private_spaces(space_id,celebration_id)
    ON DELETE RESTRICT
);
CREATE INDEX idx_celebrations_directory_enrollments_space
  ON celebrations_directory_private_space_enrollments(space_id,celebration_id,person_id);
