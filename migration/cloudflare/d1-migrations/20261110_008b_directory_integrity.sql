-- M008-B additive guard for the M007-A directory (NOT EXECUTED on any live D1).
-- Apply only after 20261110_007a_contact_directory.sql, with review and backup.
-- No historical table is modified. D1/SQLite FK enforcement is mandatory.
CREATE TRIGGER celebrations_directory_reject_disabled_type_insert
BEFORE INSERT ON celebrations_directory_person_types
WHEN (SELECT disabled FROM celebrations_directory_member_types WHERE id=NEW.type_id)=1
BEGIN SELECT RAISE(ABORT,'cannot newly grant disabled member type'); END;

CREATE TRIGGER celebrations_directory_reject_disabled_type_update
BEFORE UPDATE OF type_id ON celebrations_directory_person_types
WHEN (SELECT disabled FROM celebrations_directory_member_types WHERE id=NEW.type_id)=1
BEGIN SELECT RAISE(ABORT,'cannot switch to disabled member type'); END;

-- A M005 private-space registry identity cannot quietly change celebration.
CREATE TRIGGER celebrations_directory_private_space_stable_celebration
BEFORE UPDATE OF celebration_id ON celebrations_directory_private_spaces
BEGIN SELECT RAISE(ABORT,'registered private space celebration is permanent'); END;
