-- M007-A rollback proposal, EMPTY-TABLES ONLY, not executed by this mission.
-- Never run on a nonempty directory: it would erase future member data.
-- All six newly introduced tables must be empty; guard fails BEFORE any DROP.
-- Requires operator confirmation, maintenance isolation and a verified backup.
PRAGMA foreign_keys=ON;
CREATE TEMP TABLE _m007a_empty_only_guard (n INTEGER NOT NULL CHECK(n=0));
INSERT INTO _m007a_empty_only_guard(n)
SELECT
 (SELECT count(*) FROM celebrations_directory_private_space_enrollments)
+(SELECT count(*) FROM celebrations_directory_private_spaces)
+(SELECT count(*) FROM celebrations_directory_person_celebrations)
+(SELECT count(*) FROM celebrations_directory_person_types)
+(SELECT count(*) FROM celebrations_directory_member_types)
+(SELECT count(*) FROM celebrations_directory_people);
DROP TABLE _m007a_empty_only_guard;
DROP TABLE celebrations_directory_private_space_enrollments;
DROP TABLE celebrations_directory_private_spaces;
DROP TABLE celebrations_directory_person_celebrations;
DROP TABLE celebrations_directory_person_types;
DROP TABLE celebrations_directory_member_types;
DROP TABLE celebrations_directory_people;
