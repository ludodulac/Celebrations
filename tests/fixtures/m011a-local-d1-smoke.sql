-- M011-A isolated Wrangler D1 LOCAL ONLY check, no remote writes/deploy.
PRAGMA foreign_keys=ON;
INSERT INTO celebrations_celebrations(id,archangel) VALUES(41,'Gabriel');
INSERT INTO celebrations_participants(email,audience,password_hash)
 VALUES('synthetic-participant@example.org','angel','synthetic-password-hash');
INSERT INTO celebrations_directory_people(id,email_normalized)
 VALUES('person:550e8400-e29b-41d4-a716-446655440000','synthetic-participant@example.org');
INSERT INTO celebrations_directory_member_types(id,name)
 VALUES('member-type:choir','Chorale');
INSERT INTO celebrations_directory_person_types(person_id,type_id)
 VALUES('person:550e8400-e29b-41d4-a716-446655440000','member-type:choir');
INSERT INTO celebrations_directory_person_celebrations(person_id,celebration_id)
 VALUES('person:550e8400-e29b-41d4-a716-446655440000',41);
INSERT INTO celebrations_directory_identity_claims
 (claim_id,participant_email,person_id)
 VALUES('claim:550e8400-e29b-41d4-a716-446655440001',
        'synthetic-participant@example.org',
        'person:550e8400-e29b-41d4-a716-446655440000');
INSERT INTO celebrations_directory_admin_revisions(resource_key,revision,mutation_id)
 VALUES('person:550e8400-e29b-41d4-a716-446655440000',0,'');
INSERT INTO celebrations_directory_admin_audit(id,actor_email,action,target_id)
 VALUES('audit:550e8400-e29b-41d4-a716-446655440002','operator@example.org',
        'create_person','person:550e8400-e29b-41d4-a716-446655440000');
CREATE TABLE m011a_assert(ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO m011a_assert
 SELECT (SELECT count(*) FROM celebrations_directory_people)=1
    AND (SELECT count(*) FROM celebrations_directory_identity_claims WHERE status='pending')=1
    AND (SELECT count(*) FROM celebrations_directory_identity_links)=0
    AND (SELECT count(*) FROM celebrations_directory_admin_revisions WHERE revision=0)=1
    AND (SELECT count(*) FROM celebrations_directory_admin_audit)=1
    AND (SELECT count(*) FROM celebrations_directory_person_types)=1;
