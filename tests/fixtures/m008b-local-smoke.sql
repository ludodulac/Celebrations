PRAGMA foreign_keys = ON;
INSERT INTO celebrations_celebrations(id,archangel) VALUES(41,'Gabriel');
INSERT INTO celebrations_directory_people(id,email_normalized)
  VALUES('person:550e8400-e29b-41d4-a716-446655440000','fixture@example.org');
INSERT INTO celebrations_directory_member_types(id,name) VALUES('member-type:test','Test');
INSERT INTO celebrations_directory_person_types(person_id,type_id)
  VALUES('person:550e8400-e29b-41d4-a716-446655440000','member-type:test');
INSERT INTO celebrations_directory_person_celebrations(person_id,celebration_id)
  VALUES('person:550e8400-e29b-41d4-a716-446655440000',41);
INSERT INTO celebrations_directory_private_spaces(space_id,celebration_id)
  VALUES('space:test',41);
INSERT INTO celebrations_directory_private_space_enrollments(person_id,celebration_id,space_id)
  VALUES('person:550e8400-e29b-41d4-a716-446655440000',41,'space:test');
CREATE TABLE m008b_smoke_check (n INTEGER NOT NULL CHECK(n=1));
INSERT INTO m008b_smoke_check
  SELECT (SELECT COUNT(*) FROM celebrations_directory_private_space_enrollments)
    * (SELECT COUNT(*) FROM celebrations_directory_person_types);
