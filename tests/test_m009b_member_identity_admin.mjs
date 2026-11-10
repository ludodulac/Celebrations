// M009-B — isolated SQLite/D1-shaped tests; only invented people and credentials.
// node --test tests/test_m009b_member_identity_admin.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {handleMemberDirectoryAdmin,handleMemberIdentityClaim}
  from '../migration/cloudflare/app/application/member-directory-admin-service.mjs';
import {resolveExplicitMemberIdentity}
  from '../migration/cloudflare/app/security/member-identity-links.mjs';
import {createCelebrationSpace} from '../migration/cloudflare/app/domain/celebration-spaces.mjs';
import {canAccessSpace,ACCESS_MODES}
  from '../migration/cloudflare/app/domain/member-access.mjs';
import {createContactDirectoryD1}
  from '../migration/cloudflare/app/persistence/contact-directory-d1.mjs';

const A='person:550e8400-e29b-41d4-a716-446655440000';
const B='person:550e8400-e29b-41d4-a716-446655440001';
const C='person:550e8400-e29b-41d4-a716-446655440002';
const TA='member-type:choir', TB='member-type:visitors';
const participantToken='p'.repeat(64),adminToken='a'.repeat(64);
const hash=value=>createHash('sha256').update(value).digest('hex');
const sql=path=>readFileSync(new URL('../migration/cloudflare/'+path,import.meta.url),'utf8');
function d1(sqlite) {
  return {
    prepare(statement) {
      let params=[];
      return {
        bind(...values){params=values;return this;},
        async first(){return sqlite.prepare(statement).get(...params)??null;},
        async all(){return {results:sqlite.prepare(statement).all(...params)};},
        async run(){let r=sqlite.prepare(statement).run(...params);
          return {meta:{changes:Number(r.changes)},success:true};}
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const result=[];
        for(const item of statements) result.push(await item.run());
        sqlite.exec('COMMIT');
        return result;
      } catch(e) {sqlite.exec('ROLLBACK');throw e;}
    }
  };
}
function setup() {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for(const p of [
    'celebrations-schema.sql',
    'd1-migrations/20261110_007a_contact_directory.sql',
    'd1-migrations/20261110_008b_directory_integrity.sql',
    'd1-migrations/20261110_009b_explicit_identity_links.sql'
  ]) sqlite.exec(sql(p));
  sqlite.prepare('INSERT INTO celebrations_celebrations(id,archangel) VALUES(?,?)')
    .run(41,'Gabriel');
  sqlite.prepare('INSERT INTO celebrations_participants(email,password_hash,audience) VALUES(?,?,?)')
    .run('alice@example.org','existing-password-hash','angel');
  sqlite.prepare('INSERT INTO celebrations_participants(email,password_hash,audience) VALUES(?,?,?)')
    .run('bob@example.org','existing-bob-hash','nonangel');
  const expires=new Date(Date.now()+3600000).toISOString();
  sqlite.prepare('INSERT INTO celebrations_participant_sessions(token_hash,participant_email,expires_at) VALUES(?,?,?)')
    .run(hash(participantToken),'alice@example.org',expires);
  sqlite.prepare('INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)')
    .run(hash(adminToken),'admin@example.org',expires);
  const database=d1(sqlite);
  const directory=createContactDirectoryD1(database,{
    resolveCanonicalSpace:async id=>id==='space:41:chapel'?
      createCelebrationSpace({id,celebrationId:'41',visibility:'PRIVATE',
        accessPolicy:{mode:ACCESS_MODES.SELECTED_TYPES,typeIds:[TA]},pages:[]})
      :null
  });
  const env={DB:database};
  const handlers={resolveCanonicalSpace:async id=>id==='space:41:chapel'?
    createCelebrationSpace({id,celebrationId:'41',visibility:'PRIVATE',
      accessPolicy:{mode:ACCESS_MODES.SELECTED_TYPES,typeIds:[TA]},pages:[]}):null};
  const request=(token,method='GET',body=null,path='/private/admin/members')=>
    new Request('https://example.org'+path,{
      method,headers:{
        ...(token?{'authorization':'Bearer '+token}:{}),
        ...(body?{'content-type':'application/json'}:{})
      },
      ...(body?{body:JSON.stringify(body)}:{})
    });
  const admin=async(body)=> {
    const response=await handleMemberDirectoryAdmin(
      request(adminToken,'POST',body),env,handlers);
    return {status:response.status,data:await response.json()};
  };
  const participant=async(personId,token=participantToken)=>{
    const response=await handleMemberIdentityClaim(
      request(token,'POST',{personId},'/private/members/identity-claim'),env);
    return {status:response.status,data:await response.json()};
  };
  return {sqlite,database,directory,env,handlers,request,admin,participant};
}
async function seed(directory) {
  await directory.createPerson({id:A,email:'alice@example.org',givenName:'Alice'});
  await directory.createPerson({id:B,email:'unrelated@example.org',givenName:'Bea'});
  await directory.createPerson({id:C,email:'third@example.org',givenName:'Cora'});
}
async function adminGet(ctx,action='snapshot',personId='') {
  const suffix='?action='+action+(personId?'&personId='+encodeURIComponent(personId):'');
  const response=await handleMemberDirectoryAdmin(
    ctx.request(adminToken,'GET',null,'/private/admin/members'+suffix),ctx.env,ctx.handlers);
  return {status:response.status,data:await response.json()};
}

test('M009-B preserves historical accounts: email equality never creates a link',async()=>{
  const ctx=setup();
  await seed(ctx.directory);
  assert.equal(await resolveExplicitMemberIdentity(
    ctx.request(participantToken),ctx.env),null);
  assert.deepEqual(ctx.sqlite.prepare('SELECT email,password_hash,audience FROM celebrations_participants ORDER BY email').all(),[
    {email:'alice@example.org',password_hash:'existing-password-hash',audience:'angel'},
    {email:'bob@example.org',password_hash:'existing-bob-hash',audience:'nonangel'}
  ]);
  assert.equal(ctx.sqlite.prepare('SELECT COUNT(*) AS n FROM celebrations_directory_identity_links').get().n,0);
  ctx.sqlite.close();
});

test('M009-B admin handler checks actual ADMIN session, not participant token or forged role',async()=>{
  const ctx=setup();await seed(ctx.directory);
  for(const token of [null,participantToken,'x'.repeat(64)]) {
    const r=await handleMemberDirectoryAdmin(ctx.request(token,'GET'),ctx.env,ctx.handlers);
    assert.equal(r.status,401);
  }
  const malicious=ctx.request(participantToken,'POST',
    {action:'create_type',typeId:TA,name:'Pretend admin',role:'admin',isAdmin:true});
  assert.equal((await handleMemberDirectoryAdmin(malicious,ctx.env,ctx.handlers)).status,401);
  assert.deepEqual((await adminGet(ctx)).data.data.members.map(p=>p.id),[A,C,B].sort((x,y)=>{
    const map={[A]:'alice@example.org',[B]:'unrelated@example.org',[C]:'third@example.org'};
    return map[x].localeCompare(map[y]);
  }));
  assert.equal(ctx.sqlite.prepare('SELECT COUNT(*) AS n FROM celebrations_directory_member_types').get().n,0);
  ctx.sqlite.close();
});

test('M009-B participant claim is pending only; admin validates independently before link',async()=>{
  const ctx=setup();await seed(ctx.directory);
  const denied=await ctx.participant(A,'invalid-token');
  assert.equal(denied.status,403);
  const claim=await ctx.participant(B);
  assert.equal(claim.status,200);
  assert.equal(claim.data.status,'pending');
  assert.equal(await resolveExplicitMemberIdentity(ctx.request(participantToken),ctx.env),null);
  const pending=await adminGet(ctx,'pending_claims');
  assert.equal(pending.data.data[0].personId,B,'different emails are not auto-merged');
  const refused=await ctx.admin({action:'review_claim',claimId:claim.data.claimId,
    approve:true});
  assert.equal(refused.status,400,'method of independent verification is mandatory');
  assert.equal(await resolveExplicitMemberIdentity(ctx.request(participantToken),ctx.env),null);
  const approved=await ctx.admin({action:'review_claim',claimId:claim.data.claimId,
    approve:true,verificationMethod:'in_person'});
  assert.equal(approved.status,200);
  assert.deepEqual(await resolveExplicitMemberIdentity(
    ctx.request(participantToken),ctx.env),{authenticated:true,id:B});
  const duplicate=await ctx.admin({action:'review_claim',claimId:claim.data.claimId,
    approve:true,verificationMethod:'in_person'});
  assert.notEqual(duplicate.status,200);
  assert.equal(ctx.sqlite.prepare('SELECT COUNT(*) AS n FROM celebrations_directory_identity_links').get().n,1);
  assert.equal(ctx.sqlite.prepare('SELECT COUNT(*) AS n FROM celebrations_directory_admin_audit WHERE action=?').get('identity-approved').n,1);
  ctx.sqlite.close();
});

test('M009-B failed audit insert rolls back identity approval and link atomically',async()=>{
  const ctx=setup();await seed(ctx.directory);
  const claim=(await ctx.participant(A)).data.claimId;
  ctx.sqlite.exec("CREATE TRIGGER test_abort_audit BEFORE INSERT ON celebrations_directory_admin_audit " +
    "WHEN NEW.action='identity-approved' BEGIN SELECT RAISE(ABORT,'test audit failure'); END");
  const result=await ctx.admin({action:'review_claim',claimId:claim,
    approve:true,verificationMethod:'independent_records'});
  assert.notEqual(result.status,200);
  assert.equal(ctx.sqlite.prepare('SELECT status FROM celebrations_directory_identity_claims WHERE claim_id=?').get(claim).status,'pending');
  assert.equal(ctx.sqlite.prepare('SELECT COUNT(*) AS n FROM celebrations_directory_identity_links').get().n,0);
  ctx.sqlite.close();
});

test('M009-B D1 types, disabled, multi-memberships, celebration and private enrollment',async()=>{
  const ctx=setup();await seed(ctx.directory);
  assert.equal((await ctx.admin({action:'create_type',typeId:TA,name:'Chorale'})).status,200);
  assert.equal((await ctx.admin({action:'create_type',typeId:TB,name:'Visiteurs'})).status,200);
  assert.equal((await ctx.admin({action:'create_type',typeId:TA,name:'Doublon'})).status,409);
  assert.equal((await ctx.admin({action:'rename_type',typeId:TA,name:'Chanteurs'})).data.result.name,'Chanteurs');
  assert.equal((await ctx.admin({action:'set_person_types',personId:A,
    typeIds:[TA,TB,TA]})).status,200);
  assert.equal((await ctx.admin({action:'disable_type',typeId:TB,disabled:true})).status,200);
  assert.equal((await ctx.admin({action:'set_person_types',personId:B,
    typeIds:[TB]})).status,400);
  assert.equal((await ctx.admin({action:'set_person_types',personId:A,
    typeIds:[TA]})).status,200);
  const memberships=await ctx.directory.getPersonMemberTypes(A);
  assert.deepEqual(memberships.map(x=>x.typeId),[TA,TB],
    'historical disabled association is retained');
  assert.equal((await ctx.admin({action:'add_celebration',personId:A,
    celebrationId:'041'})).status,400);
  assert.equal((await ctx.admin({action:'enroll_space',personId:A,
    spaceId:'space:41:chapel'})).status,409,
    'no participation: space enrollment must fail as an atomic batch');
  assert.equal(ctx.sqlite.prepare('SELECT COUNT(*) AS n FROM celebrations_directory_private_spaces').get().n,0);
  assert.equal((await ctx.admin({action:'add_celebration',personId:A,
    celebrationId:'41'})).status,200);
  assert.equal((await ctx.admin({action:'enroll_space',personId:A,
    spaceId:'space:41:chapel'})).status,200);
  const detail=await adminGet(ctx,'person_detail',A);
  assert.deepEqual(detail.data.data.celebrations.map(x=>x.celebrationId),['41']);
  assert.deepEqual(detail.data.data.enrollments.map(x=>x.spaceId),['space:41:chapel']);
  const grants=await ctx.directory.readTrustedAssignments(A);
  const space=await ctx.handlers.resolveCanonicalSpace('space:41:chapel');
  assert.equal(canAccessSpace(space,{...grants,
    principal:{id:A,authenticated:true}}),true);
  assert.equal(canAccessSpace(space,{...grants,
    principal:{id:B,authenticated:true}}),false);
  assert.equal((await ctx.admin({action:'remove_celebration',personId:A,
    celebrationId:41})).status,409,'FK prevents orphaning a private enrollment');
  assert.equal((await ctx.admin({action:'remove_enrollment',personId:A,
    spaceId:'space:41:chapel'})).status,200);
  assert.equal((await ctx.admin({action:'remove_celebration',personId:A,
    celebrationId:41})).status,200);
  assert.equal(ctx.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
  ctx.sqlite.close();
});

test('M009-B rejects identity duplicates, enforces unique account and unique person',async()=>{
  const ctx=setup();await seed(ctx.directory);
  const a=(await ctx.participant(A)).data.claimId;
  assert.equal((await ctx.participant(A)).status,403,
    'duplicate claim is rejected');
  assert.equal((await ctx.admin({action:'review_claim',claimId:a,
    approve:true,verificationMethod:'video_verified'})).status,200);
  const b=(await ctx.participant(B)).data.claimId;
  assert.equal((await ctx.admin({action:'review_claim',claimId:b,
    approve:true,verificationMethod:'video_verified'})).status,409,
    'one historical account cannot be linked to two people');
  assert.equal(ctx.sqlite.prepare('SELECT status FROM celebrations_directory_identity_claims WHERE claim_id=?').get(b).status,'pending',
    'conflicting review rolls back');
  assert.equal((await ctx.admin({action:'unlink_identity',personId:A})).status,200);
  assert.equal(await resolveExplicitMemberIdentity(ctx.request(participantToken),ctx.env),null);
  assert.equal(ctx.sqlite.prepare('SELECT COUNT(*) AS n FROM celebrations_directory_admin_audit').get().n,2);
  ctx.sqlite.close();
});

test('M009-B administrator identity claims are never inferred from email or page browser metadata',async()=>{
  const ctx=setup();await seed(ctx.directory);
  const forged=await ctx.admin({action:'set_person_types',personId:A,
    typeIds:['angel'],principal:{id:A,authenticated:true,role:'admin'}});
  assert.equal(forged.status,400);
  assert.equal((await ctx.admin({action:'create_type',typeId:'all',name:'Legacy'})).status,400);
  const before=ctx.sqlite.prepare('SELECT password_hash FROM celebrations_participants WHERE email=?').get('alice@example.org').password_hash;
  await ctx.admin({action:'create_person',email:'new@example.org',givenName:'New'});
  assert.equal(ctx.sqlite.prepare('SELECT COUNT(*) AS n FROM celebrations_directory_people WHERE email_normalized=?').get('new@example.org').n,1);
  assert.equal((await ctx.admin({action:'create_person',email:'new@example.org'})).status,409);
  assert.equal(ctx.sqlite.prepare('SELECT password_hash FROM celebrations_participants WHERE email=?').get('alice@example.org').password_hash,before);
  ctx.sqlite.close();
});

test('M009-B modules are opt-in: production Worker unaffected; mobile layout available',()=>{
  const worker=sql('production-worker.mjs');
  const staging=sql('staging-worker.mjs');
  assert.doesNotMatch(worker,/member-directory-admin-service|member-identity-links|member-directory-admin-integration/);
  assert.doesNotMatch(staging,/member-directory-admin-service|member-identity-links|member-directory-admin-integration/);
  const ui=readFileSync(new URL('../migration/cloudflare/app/admin/member-directory-admin-integration.mjs',import.meta.url),'utf8');
  assert.match(ui,/mountMemberAccessAdmin/);
  assert.match(ui,/@media\(max-width:720px\)/);
  assert.match(ui,/min-height:44px/);
});
