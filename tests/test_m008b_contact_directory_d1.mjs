// M008-B: in-memory SQLite with D1 API semantics; no remote database or contacts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {
  createContactDirectoryD1,toD1CelebrationId,toDomainCelebrationId,
  memberIdForPersonId,personIdForMemberId
} from '../migration/cloudflare/app/persistence/contact-directory-d1.mjs';
import {createCelebrationSpace}
  from '../migration/cloudflare/app/domain/celebration-spaces.mjs';
import {canAccessSpace,ACCESS_MODES,SPACE_VISIBILITIES}
  from '../migration/cloudflare/app/domain/member-access.mjs';

const sql = name => readFileSync(new URL(`../migration/cloudflare/${name}`,import.meta.url),'utf8');
const A='person:550e8400-e29b-41d4-a716-446655440000';
const B='person:550e8400-e29b-41d4-a716-446655440001';
const T1='member-type:chorale';
const T2='member-type:volontaires';
const T3='member-type:bloque';

// Use SQLite's real constraints and transactions behind a D1-shaped API.
// Each test has an isolated database and fake entries.
function d1Facade(sqlite) {
  return {
    prepare(query) {
      let args=[];
      return {
        bind(...values) {args=values;return this;},
        async first() {return sqlite.prepare(query).get(...args)??null;},
        async all() {return {results:sqlite.prepare(query).all(...args)};},
        async run() {
          const r=sqlite.prepare(query).run(...args);
          return {success:true,meta:{changes:Number(r.changes)}};
        }
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results=[];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch(e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    }
  };
}
function setup() {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  sqlite.exec(sql('celebrations-schema.sql'));
  sqlite.exec(sql('d1-migrations/20261110_007a_contact_directory.sql'));
  sqlite.exec(sql('d1-migrations/20261110_008b_directory_integrity.sql'));
  sqlite.prepare('INSERT INTO celebrations_celebrations(id,archangel) VALUES(?,?)')
    .run(41,'Gabriel');
  sqlite.prepare('INSERT INTO celebrations_celebrations(id,archangel) VALUES(?,?)')
    .run(42,'Raphaël');
  const spaces=new Map();
  const directory=createContactDirectoryD1(d1Facade(sqlite),{
    resolveCanonicalSpace:async spaceId=>spaces.get(spaceId)??null
  });
  return {sqlite,directory,spaces};
}
const person=(id,email)=>({id,email,givenName:'Alice'});
const space=(id,celebrationId,visibility=SPACE_VISIBILITIES.PRIVATE)=>
  createCelebrationSpace({id,celebrationId,visibility,
    accessPolicy:visibility===SPACE_VISIBILITIES.PUBLIC?
      {mode:ACCESS_MODES.PUBLIC}:
      {mode:ACCESS_MODES.SELECTED_TYPES,typeIds:[T1]},pages:[]});

test('M008-B contact CRUD keeps permanent personId and historical logins independent',async()=>{
  const {sqlite,directory}=setup();
  sqlite.prepare('INSERT INTO celebrations_participants(email,audience) VALUES(?,?)')
    .run('ALICE@example.org','angel');
  assert.equal(await directory.hasHistoricalParticipantEmail(' alice@example.org '),true);
  assert.equal(await directory.getPersonByEmail('alice@example.org'),null);
  const a=await directory.createPerson(person(A,' ALICE@example.org '));
  assert.equal(a.id,A);
  assert.equal(a.emailNormalized,'alice@example.org');
  assert.equal((await directory.getPersonByEmail('Alice@EXAMPLE.ORG')).id,A);
  const changed=await directory.updatePerson(A,{givenName:'Alicia',displayName:'A. Exemple'});
  assert.equal(changed.id,A);
  assert.equal(changed.givenName,'Alicia');
  await assert.rejects(directory.updatePerson(A,{id:B}),/editable contact/i);
  await assert.rejects(directory.createPerson(person(B,'alice@example.org')),/UNIQUE/i);
  await directory.createPerson(person(B,'bob@example.org'));
  await assert.rejects(directory.updatePerson(B,{email:'ALICE@example.org'}),/UNIQUE/i);
  assert.equal((await directory.getPerson(B)).emailNormalized,'bob@example.org');
  assert.equal(sqlite.prepare('SELECT email FROM celebrations_participants').get().email,
    'ALICE@example.org','historical account remains untouched');
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM celebrations_participant_sessions').get().n,0);
  sqlite.close();
});

test('M008-B memberId is personId; multiple types, rename and suspended links',async()=>{
  const {sqlite,directory}=setup();
  assert.equal(memberIdForPersonId(A),A);
  assert.equal(personIdForMemberId(A),A);
  assert.throws(()=>memberIdForPersonId('alice@example.org'),TypeError);
  await directory.createPerson(person(A,'alice@example.org'));
  await directory.createMemberType({id:T1,name:'Chorale'});
  await directory.createMemberType({id:T2,name:'Volontaires'});
  assert.deepEqual(await directory.replacePersonMemberTypes(A,[T1,T2,T1]),[
    {memberId:A,typeId:T1},{memberId:A,typeId:T2}
  ]);
  assert.deepEqual(await directory.renameMemberType(T1,'Chanteurs'),
    {id:T1,name:'Chanteurs',disabled:false});
  await directory.setMemberTypeDisabled(T1,true);
  await directory.replacePersonMemberTypes(A,[]);
  assert.deepEqual(await directory.getPersonMemberTypes(A),[{memberId:A,typeId:T1}],
    'disabled historic association retained');
  await assert.rejects(directory.replacePersonMemberTypes(A,[T1,'angel']),/Unknown member type/i);
  assert.deepEqual(await directory.getPersonMemberTypes(A),[{memberId:A,typeId:T1}]);
  await directory.createPerson(person(B,'bob@example.org'));
  await assert.rejects(directory.replacePersonMemberTypes(B,[T1]),/disabled/i);
  await assert.rejects(directory.createMemberType({id:'angel',name:'Legacy'}),TypeError);
  assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
  sqlite.close();
});

test('M008-B failed second mutation rolls back the whole D1 batch',async()=>{
  const {sqlite,directory}=setup();
  await directory.createPerson(person(A,'alice@example.org'));
  for(const id of [T1,T2,T3]) await directory.createMemberType({id,name:id});
  await directory.replacePersonMemberTypes(A,[T1]);
  sqlite.exec(`CREATE TRIGGER test_abort_last
    BEFORE INSERT ON celebrations_directory_person_types
    WHEN NEW.type_id='${T3}'
    BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;`);
  await assert.rejects(directory.replacePersonMemberTypes(A,[T2,T3]),/synthetic failure/i);
  assert.deepEqual(await directory.getPersonMemberTypes(A),[{memberId:A,typeId:T1}]);
  sqlite.close();
});

test('M008-B canonical text celebration ID maps to existing integer D1 FK',async()=>{
  assert.equal(toD1CelebrationId(41),41);
  assert.equal(toD1CelebrationId('41'),41);
  assert.equal(toDomainCelebrationId(41),'41');
  for (const id of ['041','4.1','4e1',0,42.1,'missing',Number.MAX_SAFE_INTEGER+1])
    assert.throws(()=>toD1CelebrationId(id),TypeError,String(id));
  const {sqlite,directory}=setup();
  await directory.createPerson(person(A,'alice@example.org'));
  await directory.addPersonCelebration(A,41);
  await directory.addPersonCelebration(A,'42');
  assert.deepEqual(await directory.getPersonCelebrations(A),[
    {personId:A,celebrationId:41},{personId:A,celebrationId:42}
  ]);
  await assert.rejects(directory.addPersonCelebration(A,99),/FOREIGN KEY/i);
  await assert.rejects(directory.addPersonCelebration(A,'041'),TypeError);
  assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
  sqlite.close();
});

test('M008-B private enrollment requires canonical PRIVATE space, proper participation',async()=>{
  const {sqlite,directory,spaces}=setup();
  await directory.createPerson(person(A,'alice@example.org'));
  await directory.createPerson(person(B,'bob@example.org'));
  await directory.createMemberType({id:T1,name:'Chorale'});
  await directory.replacePersonMemberTypes(A,[T1]);
  spaces.set('space:41:prive',space('space:41:prive',41));
  spaces.set('space:42:prive',space('space:42:prive',42));
  spaces.set('space:41:public',space('space:41:public',41,SPACE_VISIBILITIES.PUBLIC));
  await assert.rejects(directory.enrollPersonInPrivateSpace(A,'space:41:prive'),/FOREIGN KEY/i);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM celebrations_directory_private_spaces').get().n,0,
    'failed batch must roll back registry');
  await directory.addPersonCelebration(A,'41');
  await directory.addPersonCelebration(B,'42');
  await directory.enrollPersonInPrivateSpace(A,'space:41:prive');
  await assert.rejects(directory.enrollPersonInPrivateSpace(B,'space:41:prive'),/FOREIGN KEY/i);
  await assert.rejects(directory.enrollPersonInPrivateSpace(A,'space:41:public'),/PRIVATE/i);
  await assert.rejects(directory.enrollPersonInPrivateSpace(A,'space:unknown'),/Unknown/i);
  assert.deepEqual(await directory.getPrivateEnrollments(A),[
    {memberId:A,spaceId:'space:41:prive',celebrationId:41}
  ]);
  const assignments=await directory.readTrustedAssignments(A);
  assert.equal(canAccessSpace(spaces.get('space:41:prive'),{
    ...assignments,principal:{authenticated:true,id:A}
  }),true);
  assert.equal(canAccessSpace(spaces.get('space:41:prive'),{
    ...assignments,principal:{authenticated:true,id:B}
  }),false);
  assert.equal(canAccessSpace(spaces.get('space:41:prive'),assignments),false);
  await assert.rejects(directory.removePersonCelebration(A,41),/FOREIGN KEY/i);
  await directory.removePrivateEnrollment(A,'space:41:prive');
  await directory.removePersonCelebration(A,41);
  assert.deepEqual(await directory.getPersonCelebrations(A),[]);
  assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
  sqlite.close();
});

test('M008-B moving a registered space across celebrations aborts',async()=>{
  const {sqlite,directory,spaces}=setup();
  await directory.createPerson(person(A,'alice@example.org'));
  await directory.addPersonCelebration(A,41);
  await directory.addPersonCelebration(A,42);
  spaces.set('space:move',space('space:move',41));
  await directory.enrollPersonInPrivateSpace(A,'space:move');
  spaces.set('space:move',space('space:move',42));
  await assert.rejects(directory.enrollPersonInPrivateSpace(A,'space:move'),/FOREIGN KEY|UNIQUE/i);
  assert.deepEqual(await directory.getPrivateEnrollments(A),[
    {memberId:A,spaceId:'space:move',celebrationId:41}
  ]);
  assert.throws(()=>sqlite.prepare(
    'UPDATE celebrations_directory_private_spaces SET celebration_id=42 WHERE space_id=?'
  ).run('space:move'),/permanent/i);
  sqlite.close();
});

test('M008-B lack of trusted resolver fails closed; no identity authentication',async()=>{
  const {sqlite}=setup();
  const writer=createContactDirectoryD1(d1Facade(sqlite));
  await writer.createPerson(person(A,'alice@example.org'));
  await writer.addPersonCelebration(A,41);
  await assert.rejects(writer.enrollPersonInPrivateSpace(A,'space:41:prive'),/resolver/i);
  assert.deepEqual(await writer.readTrustedAssignments(A),{
    types:[],memberships:[],enrollments:[]
  });
  assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
  sqlite.close();
});
