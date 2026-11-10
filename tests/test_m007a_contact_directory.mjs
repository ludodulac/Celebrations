import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {
  isDirectoryPersonId, normalizeDirectoryEmail, createDirectoryPerson,
  planDirectoryMemberTypes, planDirectoryCelebration,
  planDirectoryPrivateEnrollment, previewDirectoryCsv
} from '../migration/cloudflare/app/domain/contact-directory.mjs';
import {
  createMemberType, canAccessSpace, ACCESS_MODES, SPACE_VISIBILITIES
} from '../migration/cloudflare/app/domain/member-access.mjs';

const ROOT = new URL('../migration/cloudflare/', import.meta.url);
const baseline = readFileSync(new URL('celebrations-schema.sql', ROOT), 'utf8');
const migration = readFileSync(new URL('d1-migrations/20261110_007a_contact_directory.sql', ROOT), 'utf8');
const rollback = readFileSync(new URL('d1-rollbacks/20261110_007a_contact_directory.empty-only.sql', ROOT), 'utf8');
const A = 'person:550e8400-e29b-41d4-a716-446655440000';
const B = 'person:550e8400-e29b-41d4-a716-446655440001';
const T1 = 'member-type:volontaire';
const T2 = 'member-type:organisateur';
const q = (db, sql, ...values) => db.prepare(sql).get(...values);
function dbFactory() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON;');
  db.exec(baseline); // exact existing D1 proposal, no fake production database
  db.exec(migration);
  assert.equal(q(db, 'PRAGMA foreign_keys').foreign_keys, 1);
  return db;
}
function addPerson(db, id, email) {
  db.prepare('INSERT INTO celebrations_directory_people(id,email_normalized) VALUES (?,?)')
    .run(id, normalizeDirectoryEmail(email));
}
function addCelebration(db, id) {
  db.prepare('INSERT INTO celebrations_celebrations(id,archangel) VALUES (?,?)')
    .run(id, 'Gabriel');
}
function tables(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all().map(row => row.name);
}

test('M007-A schema is an additive migration over existing D1 tables', () => {
  const original = new DatabaseSync(':memory:');
  original.exec(baseline);
  const historic = tables(original);
  const db = dbFactory();
  for (const name of historic) assert.ok(tables(db).includes(name), name);
  const own = tables(db).filter(name => name.startsWith('celebrations_directory_'));
  assert.deepEqual(own.sort(), [
    'celebrations_directory_member_types',
    'celebrations_directory_people',
    'celebrations_directory_person_celebrations',
    'celebrations_directory_person_types',
    'celebrations_directory_private_space_enrollments',
    'celebrations_directory_private_spaces'
  ]);
  assert.throws(() => db.exec(migration), /already exists/i,
    'versioned migration must not silently mask accidental reapplication');
  assert.equal(q(db,'SELECT count(*) AS n FROM celebrations_participants').n,0);
  db.close(); original.close();
});

test('M007-A permanent person ID and case-insensitive normalized email uniqueness', () => {
  const db = dbFactory();
  addPerson(db,A,'  ALICE+info@Example.ORG  ');
  assert.equal(q(db,'SELECT email_normalized AS email FROM celebrations_directory_people WHERE id=?',A).email,
    'alice+info@example.org');
  assert.throws(() => addPerson(db,B,'alice+info@EXAMPLE.org'), /UNIQUE/i);
  assert.throws(() => db.prepare('INSERT INTO celebrations_directory_people(id,email_normalized) VALUES(?,?)')
    .run(B,' ALICE@example.org '), /CHECK/i);
  assert.throws(() => db.prepare('UPDATE celebrations_directory_people SET id=? WHERE id=?')
    .run(B,A), /permanent/i);
  // Changing an email does not change the person's identity.
  db.prepare('UPDATE celebrations_directory_people SET email_normalized=? WHERE id=?')
    .run('alice@example.org',A);
  assert.equal(q(db,'SELECT id FROM celebrations_directory_people WHERE email_normalized=?','alice@example.org').id,A);
  db.close();
});

test('M007-A multiple member types; stable type IDs, name changes, FK and duplicate guards', () => {
  const db = dbFactory();
  addPerson(db,A,'alice@example.org');
  db.prepare('INSERT INTO celebrations_directory_member_types(id,name) VALUES(?,?)').run(T1,'Volontaire');
  db.prepare('INSERT INTO celebrations_directory_member_types(id,name) VALUES(?,?)').run(T2,'Organisation');
  db.prepare('INSERT INTO celebrations_directory_person_types(person_id,type_id) VALUES(?,?)').run(A,T1);
  db.prepare('INSERT INTO celebrations_directory_person_types(person_id,type_id) VALUES(?,?)').run(A,T2);
  assert.equal(q(db,'SELECT count(*) AS n FROM celebrations_directory_person_types WHERE person_id=?',A).n,2);
  assert.throws(() => db.prepare('INSERT INTO celebrations_directory_person_types(person_id,type_id) VALUES(?,?)')
    .run(A,T1), /UNIQUE/i);
  assert.throws(() => db.prepare('INSERT INTO celebrations_directory_person_types(person_id,type_id) VALUES(?,?)')
    .run(B,T1), /FOREIGN KEY/i);
  assert.throws(() => db.prepare('INSERT INTO celebrations_directory_person_types(person_id,type_id) VALUES(?,?)')
    .run(A,'member-type:missing'), /FOREIGN KEY/i);
  db.prepare('UPDATE celebrations_directory_member_types SET name=? WHERE id=?')
    .run('Nouvelle équipe',T1);
  assert.equal(q(db,'SELECT type_id FROM celebrations_directory_person_types WHERE type_id=?',T1).type_id,T1);
  assert.throws(() => db.prepare('UPDATE celebrations_directory_member_types SET id=? WHERE id=?')
    .run('member-type:changed',T1), /permanent/i);
  assert.throws(() => db.prepare('DELETE FROM celebrations_directory_people WHERE id=?').run(A), /FOREIGN KEY/i);
  db.close();
});

test('M007-A distinct celebration participation and isolated private enrollment with composite FKs', () => {
  const db = dbFactory();
  addPerson(db,A,'alice@example.org');
  addPerson(db,B,'bob@example.org');
  addCelebration(db,41);addCelebration(db,42);
  const participate = db.prepare('INSERT INTO celebrations_directory_person_celebrations(person_id,celebration_id) VALUES(?,?)');
  participate.run(A,41); participate.run(A,42); participate.run(B,42);
  assert.equal(q(db,'SELECT count(*) AS n FROM celebrations_directory_person_celebrations WHERE person_id=?',A).n,2);
  assert.throws(() => participate.run(A,41), /UNIQUE/i);
  assert.throws(() => participate.run(B,99), /FOREIGN KEY/i);
  const addSpace = db.prepare('INSERT INTO celebrations_directory_private_spaces(space_id,celebration_id) VALUES(?,?)');
  addSpace.run('space:alpha',41);addSpace.run('space:beta',42);
  const enroll = db.prepare('INSERT INTO celebrations_directory_private_space_enrollments(person_id,celebration_id,space_id) VALUES(?,?,?)');
  enroll.run(A,41,'space:alpha'); enroll.run(A,42,'space:beta');
  assert.equal(q(db,'SELECT count(*) AS n FROM celebrations_directory_private_space_enrollments WHERE person_id=?',A).n,2);
  assert.throws(() => enroll.run(A,41,'space:alpha'), /UNIQUE/i);
  assert.throws(() => enroll.run(B,41,'space:alpha'), /FOREIGN KEY/i,
    'person must participate in the same celebration');
  assert.throws(() => enroll.run(B,42,'space:alpha'), /FOREIGN KEY/i,
    'cannot attach space to the wrong celebration');
  assert.throws(() => enroll.run(A,41,'space:missing'), /FOREIGN KEY/i);
  assert.throws(() => db.prepare('DELETE FROM celebrations_directory_person_celebrations WHERE person_id=? AND celebration_id=?')
    .run(A,41), /FOREIGN KEY/i);
  assert.throws(() => db.prepare('UPDATE celebrations_directory_private_spaces SET space_id=? WHERE space_id=?')
    .run('new', 'space:alpha'), /permanent/i);
  assert.equal(q(db,'SELECT count(*) AS n FROM celebrations_directory_private_space_enrollments WHERE space_id=?','space:alpha').n,1);
  db.close();
});

test('M007-A portable domain maps exactly to M002 member-access grants, not automatic public access', () => {
  const types=[createMemberType({id:T1,name:'Volontaire'}),
    createMemberType({id:T2,name:'Organisation'})];
  const memberships=planDirectoryMemberTypes(A,[T1,T2,T1],types);
  assert.deepEqual(memberships,[{memberId:A,typeId:T1},{memberId:A,typeId:T2}]);
  assert.deepEqual(planDirectoryCelebration(A,41),{personId:A,celebrationId:41});
  const link=planDirectoryPrivateEnrollment(A,{id:'space:alpha',celebrationId:41,
    visibility:SPACE_VISIBILITIES.PRIVATE});
  assert.deepEqual(link,{personId:A,celebrationId:41,spaceId:'space:alpha'});
  const privateSpace={id:'space:alpha',celebrationId:'41',
    visibility:SPACE_VISIBILITIES.PRIVATE,
    accessPolicy:{mode:ACCESS_MODES.SELECTED_TYPES,typeIds:[T1]}};
  const ctx={principal:{id:A,authenticated:true},types,memberships,
    enrollments:[{memberId:link.personId,spaceId:link.spaceId}]};
  assert.equal(canAccessSpace(privateSpace,ctx),true);
  assert.equal(canAccessSpace(privateSpace,{...ctx,enrollments:[]}),false);
  assert.equal(canAccessSpace(privateSpace,{...ctx,principal:null}),false);
  assert.equal(canAccessSpace(privateSpace,{...ctx,memberships:[]}),false);
  assert.throws(() => planDirectoryPrivateEnrollment(A,{...privateSpace,
    celebrationId:41,visibility:SPACE_VISIBILITIES.PUBLIC}),TypeError);
  assert.throws(() => planDirectoryMemberTypes(A,['angel'],types), TypeError);
});

test('M007-A CSV preview recognizes BOM, semicolons, quotes and detects duplicate rows', () => {
  const csv='\uFEFFEmail;Prénom;Nom;member_type\r\n' +
    '" Eve+1@Example.org ";"Ève";"Le;Grand";"member-type:admin"\r\n' +
    '"eve+1@EXAMPLE.org";"Autre";"Nom";""\r\n' +
    '" EXISTING@example.org ";"Oui";"Déjà";""\r\n' +
    '"bad-email";"Non";"Valide";""\r\n';
  const preview=previewDirectoryCsv(csv,{existingEmails:['existing@example.org']});
  assert.equal(preview.candidates.length,1);
  assert.deepEqual(preview.candidates[0],{line:2,
    emailNormalized:'eve+1@example.org',givenName:'Ève',familyName:'Le;Grand',displayName:null});
  assert.equal(preview.duplicates.length,2);
  assert.deepEqual(preview.duplicates.map(r=>r.reason),['in-file','existing']);
  assert.deepEqual(preview.rejected,[{line:5,reason:'invalid-contact'}]);
  assert.equal(Object.hasOwn(preview.candidates[0],'member_type'),false,
    'CSV cannot grant permissions');
  assert.equal(Object.hasOwn(preview.candidates[0],'id'),false,
    'future trusted server must allocate person IDs');
});

test('M007-A malicious or malformed inputs do not silently merge or grant access', () => {
  assert.equal(isDirectoryPersonId(A),true);
  assert.equal(isDirectoryPersonId('alice@example.org'),false);
  for (const bad of ['','a@b','a@@b.io','first last@x.io','x..y@z.io','UP@X.IO\n','é@site.fr'])
    assert.throws(()=>normalizeDirectoryEmail(bad),TypeError,bad);
  assert.equal(normalizeDirectoryEmail('first.last@gmail.com'),'first.last@gmail.com');
  assert.equal(normalizeDirectoryEmail('firstlast@gmail.com'),'firstlast@gmail.com');
  assert.equal(normalizeDirectoryEmail('firstlast+tag@gmail.com'),'firstlast+tag@gmail.com');
  assert.throws(() => createDirectoryPerson({id:'alice@example.org',email:'alice@example.org'}),TypeError);
  assert.throws(() => previewDirectoryCsv('Email,mail\na@b.fr,a@b.fr'),TypeError);
  assert.throws(() => previewDirectoryCsv('Email,Nom\n"a@b.fr,"Bad"'),TypeError);
  assert.throws(() => planDirectoryCelebration(A,'41'),TypeError);
});

test('M007-A empty-only rollback cannot erase contacts, and restores original schema when empty', () => {
  const db=dbFactory();
  addPerson(db,A,'alice@example.org');
  assert.throws(() => db.exec(rollback), /CHECK constraint/i);
  assert.equal(q(db,'SELECT count(*) AS n FROM celebrations_directory_people').n,1,
    'guard must fail before DROP');
  db.close();
  const empty=dbFactory();
  empty.exec(rollback);
  assert.equal(tables(empty).some(name=>name.startsWith('celebrations_directory_')),false);
  assert.equal(tables(empty).includes('celebrations_participants'),true);
  empty.close();
});
