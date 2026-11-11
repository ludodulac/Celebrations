// M010-D: the real M010-B admin handler must grant/revoke through the M010-A
// private gate, and must not revive M009-D's unsafe equal-email fallback.
// Only synthetic local SQLite, fake sessions and canonical in-memory pages.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {handleMemberDirectoryAdmin,handleMemberIdentityClaim}
  from '../migration/cloudflare/app/application/member-directory-admin-service.mjs';
import {resolveVerifiedMember,handlePrivatePage}
  from '../migration/cloudflare/app/security/member-private-access.mjs';
import {createCelebrationSpace}
  from '../migration/cloudflare/app/domain/celebration-spaces.mjs';

const PARTICIPANT='p'.repeat(64), ADMIN='a'.repeat(64);
const HASH=x=>createHash('sha256').update(x).digest('hex');
const TYPE='member-type:choir',SPACE='space:41:chapel';
const space=createCelebrationSpace({id:SPACE,celebrationId:'41',
  visibility:'PRIVATE',accessPolicy:{mode:'SELECTED_TYPES',typeIds:[TYPE]},pages:[]});
const page={id:'page:member',visibility:'published',
  accessPolicy:{mode:'SELECTED_TYPES',typeIds:[TYPE]},blocks:[]};
const inside={id:'page:chapel',spaceId:SPACE,celebrationId:'41',
  visibility:'published',accessPolicy:{mode:'PUBLIC'},blocks:[]};
const schema=path=>readFileSync(
  new URL('../migration/cloudflare/'+path,import.meta.url),'utf8');
function d1(sqlite) {
  return {
    prepare(sql) {
      let params=[];
      return {
        bind(...args){params=args;return this;},
        async first(){return sqlite.prepare(sql).get(...params)??null;},
        async all(){return {results:sqlite.prepare(sql).all(...params)};},
        async run(){const r=sqlite.prepare(sql).run(...params);
          return {meta:{changes:Number(r.changes)},success:true};}
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results=[];
        for(const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (e) {sqlite.exec('ROLLBACK');throw e;}
    }
  };
}
function fixture() {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for(const path of [
    'celebrations-schema.sql',
    'd1-migrations/20261110_007a_contact_directory.sql',
    'd1-migrations/20261110_008b_directory_integrity.sql',
    'd1-migrations/20261110_009b_explicit_identity_links.sql',
    'd1-migrations/20261111_010b_member_admin_revisions.sql'
  ])sqlite.exec(schema(path));
  sqlite.prepare('INSERT INTO celebrations_celebrations(id,archangel) VALUES(?,?)')
    .run(41,'Gabriel');
  sqlite.prepare('INSERT INTO celebrations_participants(email,password_hash,audience) VALUES(?,?,?)')
    .run('alice@example.org','synthetic-legacy-hash','angel');
  const expiration=new Date(Date.now()+3600000).toISOString();
  sqlite.prepare('INSERT INTO celebrations_participant_sessions(token_hash,participant_email,expires_at) VALUES(?,?,?)')
    .run(HASH(PARTICIPANT),'alice@example.org',expiration);
  sqlite.prepare('INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)')
    .run(HASH(ADMIN),'admin@example.org',expiration);
  const env={DB:d1(sqlite)},options={
    resolveCanonicalSpace:async id=>id===SPACE?space:null
  };
  const request=(token,method='GET',data,pathname='/private/admin/members')=>
    new Request('https://example.org'+pathname,{
      method,headers:{
        ...(token?{'authorization':'Bearer '+token}:{}),
        ...(data?{'content-type':'application/json'}:{})},
      ...(data?{body:JSON.stringify(data)}:{})
    });
  async function admin(data,token=ADMIN) {
    const r=await handleMemberDirectoryAdmin(
      request(token,'POST',data),env,options);
    return {status:r.status,body:await r.json()};
  }
  const revision=id=>sqlite.prepare(
    'SELECT revision FROM celebrations_directory_admin_revisions WHERE resource_key=?')
    .get(id)?.revision??0;
  const access=async (target=page,token=PARTICIPANT)=>{
    const req=request(token);
    return handlePrivatePage(req,env,{
      pageId:target.id,
      loadPublishedPage:async id=>id===target.id?target:null,
      loadPublishedSpace:async id=>id===SPACE?space:null,
      render:async()=>new Response('PRIVATE_FAKE_SECRET',{status:200})
    });
  };
  const auditCount=()=>sqlite.prepare(
    'SELECT count(*) AS n FROM celebrations_directory_admin_audit').get().n;
  return {sqlite,env,options,request,admin,revision,access,auditCount};
}
test('M010-D real admin edits + explicit identity + live grants and revocations',async()=>{
  const c=fixture();
  try {
    const created=await c.admin({action:'create_person',email:'alice@example.org',
      givenName:'Alice'});
    assert.equal(created.status,200);
    const personId=created.body.result.id;
    assert.match(personId,/^person:/);
    assert.equal((await c.admin({action:'create_type',typeId:TYPE,
      name:'Chorale'})).status,200);
    assert.equal((await c.admin({action:'set_person_types',personId,
      expectedRevision:0,typeIds:[TYPE]})).status,200);
    assert.equal((await c.admin({action:'add_celebration',personId,
      expectedRevision:c.revision(personId),celebrationId:'41'})).status,200);
    assert.equal((await c.admin({action:'enroll_space',personId,
      expectedRevision:c.revision(personId),spaceId:SPACE})).status,200);
    // The matching legacy email and all admin-assigned grants still confer NO identity.
    assert.equal(await resolveVerifiedMember(c.request(PARTICIPANT),c.env),null);
    assert.equal((await c.access(page)).status,404);
    assert.equal((await c.access(inside)).status,404);
    const request=await handleMemberIdentityClaim(
      c.request(PARTICIPANT,'POST',{personId},'/private/members/claim'),
      c.env);
    assert.equal(request.status,200);
    const claim=(await request.json()).claimId;
    assert.match(claim,/^claim:/);
    assert.equal((await c.access(page)).status,404,'pending claim has no rights');
    assert.equal((await c.admin({action:'review_claim',claimId:claim,
      approve:true,verificationMethod:'in_person'})).status,200);
    assert.deepEqual(await resolveVerifiedMember(c.request(PARTICIPANT),c.env),
      {id:personId,authenticated:true});
    assert.equal((await c.access(page)).status,200);
    assert.equal((await c.access(inside)).status,200);
    // M010-B revocation is read live by M010-A, without cached privileges.
    const before=c.auditCount();
    assert.equal((await c.admin({action:'remove_enrollment',personId,
      expectedRevision:c.revision(personId),spaceId:SPACE})).status,200);
    assert.equal((await c.access(inside)).status,404);
    assert.equal((await c.access(page)).status,200);
    const stale=await c.admin({action:'update_person',personId,
      expectedRevision:0,changes:{displayName:'Stale'}});
    assert.equal(stale.status,409);
    assert.equal(c.auditCount(),before+1,'failed stale write adds no success audit');
    assert.equal((await c.admin({action:'set_person_types',personId,
      expectedRevision:c.revision(personId),typeIds:[]})).status,200);
    assert.equal((await c.access(page)).status,404);
    assert.equal((await c.admin({action:'unlink_identity',personId})).status,200);
    assert.equal(await resolveVerifiedMember(c.request(PARTICIPANT),c.env),null);
    assert.equal((await c.access(page)).status,404);
    assert.equal(c.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
    assert.equal(c.sqlite.prepare(
      'SELECT password_hash FROM celebrations_participants WHERE email=?')
      .get('alice@example.org').password_hash,'synthetic-legacy-hash');
  } finally {c.sqlite.close();}
});
test('M010-D participant token cannot become administrator or create an approved link',async()=>{
  const c=fixture();
  try {
    const denied=await c.admin({action:'create_person',email:'other@example.org'},
      PARTICIPANT);
    assert.equal(denied.status,401);
    assert.equal(c.sqlite.prepare(
      'SELECT count(*) AS n FROM celebrations_directory_people').get().n,0);
    assert.equal(c.auditCount(),0);
    assert.equal((await c.access(page)).status,404);
  }finally {c.sqlite.close();}
});
