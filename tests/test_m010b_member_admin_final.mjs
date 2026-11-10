// M010-B: real SQLite transaction tests (D1-shaped API), synthetic records only.
// Run: node --test tests/test_m010b_member_admin_final.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {handleMemberDirectoryAdmin}
  from '../migration/cloudflare/app/application/member-directory-admin-service.mjs';
import {createContactDirectoryD1}
  from '../migration/cloudflare/app/persistence/contact-directory-d1.mjs';
import {createCelebrationSpace}
  from '../migration/cloudflare/app/domain/celebration-spaces.mjs';
import {ACCESS_MODES}
  from '../migration/cloudflare/app/domain/member-access.mjs';

const A='person:550e8400-e29b-41d4-a716-446655440000';
const B='person:550e8400-e29b-41d4-a716-446655440001';
const T1='member-type:choir',T2='member-type:visitors';
const token='a'.repeat(64);
const sql=p=>readFileSync(new URL('../migration/cloudflare/'+p,import.meta.url),'utf8');
function facade(sqlite) {
  return {
    prepare(source) {
      let args=[];
      return {
        bind(...params){args=params;return this;},
        async all(){return {results:sqlite.prepare(source).all(...args)};},
        async first(){return sqlite.prepare(source).get(...args)??null;},
        async run(){const result=sqlite.prepare(source).run(...args);
          return {success:true,meta:{changes:Number(result.changes)}};}
      };
    },
    async batch(items) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results=[];
        for(const item of items)results.push(await item.run());
        sqlite.exec('COMMIT');
        return results;
      } catch(error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    }
  };
}
function setup() {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for(const name of [
    'celebrations-schema.sql',
    'd1-migrations/20261110_007a_contact_directory.sql',
    'd1-migrations/20261110_008b_directory_integrity.sql',
    'd1-migrations/20261110_009b_explicit_identity_links.sql',
    'd1-migrations/20261111_010b_member_admin_revisions.sql'
  ])sqlite.exec(sql(name));
  sqlite.prepare('INSERT INTO celebrations_celebrations(id,archangel) VALUES(?,?)')
    .run(41,'Gabriel');
  sqlite.prepare('INSERT INTO celebrations_celebrations(id,archangel) VALUES(?,?)')
    .run(42,'Raphaël');
  sqlite.prepare('INSERT INTO celebrations_participants(email,password_hash,audience) VALUES(?,?,?)')
    .run('legacy@example.org','unchanged-hash','angel');
  sqlite.prepare('INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)')
    .run(createHash('sha256').update(token).digest('hex'),'admin@example.org',
      new Date(Date.now()+3600000).toISOString());
  const db=facade(sqlite);
  const resolveCanonicalSpace=async id=>{
    if(id==='space:41:private')return createCelebrationSpace({
      id,celebrationId:'41',visibility:'PRIVATE',
      accessPolicy:{mode:ACCESS_MODES.ALL_PRIVATE_TYPES},pages:[]});
    if(id==='space:41:public')return createCelebrationSpace({
      id,celebrationId:'41',visibility:'PUBLIC',
      accessPolicy:{mode:ACCESS_MODES.PUBLIC},pages:[]});
    return null;
  };
  const directory=createContactDirectoryD1(db,{resolveCanonicalSpace});
  async function api(method,params={},actor=token,headers={}) {
    const {action,...fields}=params;
    const url=new URL('https://example.org/private/admin/members');
    if(method==='GET')for(const [key,value] of Object.entries(params))
      if(value!=null)url.searchParams.set(key,String(value));
    const res=await handleMemberDirectoryAdmin(new Request(url,{
      method,headers:{...(actor?{authorization:'Bearer '+actor}:{}),
        ...(method==='POST'?{'content-type':'application/json'}:{}),...headers},
      ...(method==='POST'?{body:JSON.stringify({action,...fields})}:{})
    }),{DB:db},{resolveCanonicalSpace});
    return {status:res.status,...await res.json()};
  }
  const post=body=>api('POST',body);
  const get=params=>api('GET',params);
  const rev=id=>sqlite.prepare(`SELECT revision FROM celebrations_directory_admin_revisions
    WHERE resource_key=?`).get(id)?.revision??0;
  const auditCount=()=>sqlite.prepare('SELECT count(*) AS n FROM celebrations_directory_admin_audit').get().n;
  const person=async(email,id='person:'+randomUUID())=>
    directory.createPerson({id,email});
  return {sqlite,db,directory,api,post,get,rev,auditCount,person};
}

test('010-B keyset pagination reaches 137 contacts, name/email search after 100',async()=>{
  const c=setup();
  for(let i=0;i<137;i++)
    await c.directory.createPerson({id:'person:'+randomUUID(),
      email:'demo'+String(i).padStart(3,'0')+'@example.org',
      givenName:i===136?'Dernière':'Personne',familyName:'Test'});
  const found=[], cursors=new Set();let cursor='';
  do {
    const result=await c.get({action:'snapshot',limit:50,cursor});
    assert.equal(result.status,200);
    found.push(...result.data.members.map(p=>p.emailNormalized));
    if(!result.data.hasMorePeople)break;
    cursor=result.data.nextCursor;
    assert.ok(cursor&&!cursors.has(cursor),'pagination advances');
    cursors.add(cursor);
  }while(true);
  assert.equal(found.length,137);
  assert.equal(new Set(found).size,137);
  const search=await c.get({action:'snapshot',search:'DERNIÈRE'});
  assert.equal(search.status,200);
  assert.deepEqual(search.data.members.map(p=>p.emailNormalized),
    ['demo136@example.org']);
  const email=await c.get({action:'snapshot',search:'demo125@'});
  assert.deepEqual(email.data.members.map(p=>p.emailNormalized),
    ['demo125@example.org']);
  assert.equal((await c.get({action:'snapshot',limit:500})).status,400);
  c.sqlite.close();
});

test('010-B all directory writes require ADMIN session, browser roles are irrelevant',async()=>{
  const c=setup();await c.person('alice@example.org',A);
  const command={action:'create_type',typeId:T1,name:'Chorale',role:'admin'};
  assert.equal((await c.api('POST',command,null)).status,401);
  assert.equal((await c.api('POST',command,'x'.repeat(64))).status,401);
  assert.equal((await c.api('POST',command)).status,400);
  assert.equal((await c.api('POST',{action:'create_type',typeId:T1,name:'Chorale'},
    token,{origin:'https://evil.example'})).status,403);
  assert.equal(c.auditCount(),0);
  assert.equal(c.sqlite.prepare('SELECT password_hash FROM celebrations_participants WHERE email=?')
    .get('legacy@example.org').password_hash,'unchanged-hash');
  c.sqlite.close();
});

test('010-B audit failure rolls back create, edit and multi-row memberships',async()=>{
  const c=setup();await c.person('alice@example.org',A);
  assert.equal((await c.post({action:'create_type',typeId:T1,name:'Choir'})).status,200);
  assert.equal((await c.post({action:'create_type',typeId:T2,name:'Visitor'})).status,200);
  const count=c.auditCount();
  c.sqlite.exec(`CREATE TRIGGER reject_admin_audit BEFORE INSERT
    ON celebrations_directory_admin_audit
    WHEN NEW.action IN ('create_person','update_person','set_person_types')
    BEGIN SELECT RAISE(ABORT,'audit down'); END`);
  assert.equal((await c.post({action:'create_person',email:'new@example.org'})).status,409);
  assert.equal((await c.directory.getPersonByEmail('new@example.org')),null);
  assert.equal((await c.post({action:'update_person',personId:A,
    expectedRevision:0,changes:{displayName:'Edited'}})).status,409);
  assert.equal((await c.directory.getPerson(A)).displayName,null);
  assert.equal((await c.post({action:'set_person_types',personId:A,
    expectedRevision:0,typeIds:[T1,T2]})).status,409);
  assert.deepEqual(await c.directory.getPersonMemberTypes(A),[]);
  assert.equal(c.rev(A),0,'failed batch cannot advance version');
  assert.equal(c.auditCount(),count,'no audit entry without a mutation');
  c.sqlite.close();
});

test('010-B stale concurrent editor cannot overwrite a later revision or add audit',async()=>{
  const c=setup();await c.person('alice@example.org',A);
  const initial=(await c.get({action:'person_detail',personId:A})).data.person.revision;
  const change1=await c.post({action:'update_person',personId:A,
    expectedRevision:initial,changes:{displayName:'First'}});
  assert.equal(change1.status,200);
  assert.equal(change1.revision,1);
  const auditCount=c.auditCount();
  const stale=await c.post({action:'update_person',personId:A,
    expectedRevision:initial,changes:{displayName:'Second'}});
  assert.equal(stale.status,409);
  assert.equal(c.auditCount(),auditCount);
  assert.equal((await c.directory.getPerson(A)).displayName,'First');
  const fresh=await c.post({action:'update_person',personId:A,
    expectedRevision:c.rev(A),changes:{displayName:'Third'}});
  assert.equal(fresh.status,200);
  assert.equal(c.rev(A),2);
  assert.equal(c.auditCount(),auditCount+1);
  c.sqlite.close();
});

test('010-B type lifecycle, multi-membership and historic disabled links',async()=>{
  const c=setup();await c.person('alice@example.org',A);await c.person('bea@example.org',B);
  for(const [id,name] of [[T1,'Chorale'],[T2,'Visiteurs']])
    assert.equal((await c.post({action:'create_type',typeId:id,name})).status,200);
  assert.equal((await c.post({action:'set_person_types',personId:A,
    expectedRevision:0,typeIds:[T1,T2,T2]})).status,200);
  assert.equal((await c.post({action:'disable_type',typeId:T2,
    expectedRevision:0,disabled:true})).status,200);
  assert.equal((await c.post({action:'set_person_types',personId:B,
    expectedRevision:0,typeIds:[T2]})).status,400);
  assert.equal((await c.post({action:'set_person_types',personId:A,
    expectedRevision:c.rev(A),typeIds:[T1]})).status,200);
  assert.deepEqual((await c.directory.getPersonMemberTypes(A)).map(x=>x.typeId),[T1,T2]);
  assert.equal((await c.post({action:'rename_type',typeId:T1,name:'Chanteurs',
    expectedRevision:0})).status,200);
  assert.equal((await c.post({action:'rename_type',typeId:T1,name:'Stale',
    expectedRevision:0})).status,409);
  assert.equal((await c.directory.getMemberTypes()).find(x=>x.id===T1).name,'Chanteurs');
  assert.equal((await c.post({action:'disable_type',typeId:T2,
    expectedRevision:c.rev(T2),disabled:false})).status,200);
  c.sqlite.close();
});

test('010-B private enrollment requires canonical server space and linked celebration',async()=>{
  const c=setup();await c.person('alice@example.org',A);
  assert.equal((await c.post({action:'enroll_space',personId:A,
    expectedRevision:0,spaceId:'space:41:private',
    space:{visibility:'PRIVATE',celebrationId:'42'}})).status,409);
  assert.equal(c.rev(A),0);
  assert.equal((await c.post({action:'add_celebration',personId:A,
    expectedRevision:0,celebrationId:'41'})).status,200);
  assert.equal((await c.post({action:'enroll_space',personId:A,
    expectedRevision:c.rev(A),spaceId:'space:41:public'})).status,400);
  assert.equal((await c.post({action:'enroll_space',personId:A,
    expectedRevision:c.rev(A),spaceId:'space:42:unknown'})).status,400);
  const grant=await c.post({action:'enroll_space',personId:A,
    expectedRevision:c.rev(A),spaceId:'space:41:private'});
  assert.equal(grant.status,200);
  assert.deepEqual((await c.directory.getPrivateEnrollments(A)).map(x=>x.spaceId),
    ['space:41:private']);
  const count=c.auditCount();
  assert.equal((await c.post({action:'enroll_space',personId:A,
    expectedRevision:c.rev(A),spaceId:'space:41:private'})).status,409);
  assert.equal(c.auditCount(),count);
  assert.equal((await c.post({action:'remove_celebration',personId:A,
    expectedRevision:c.rev(A),celebrationId:'41'})).status,409);
  assert.equal((await c.post({action:'remove_enrollment',personId:A,
    expectedRevision:c.rev(A),spaceId:'space:41:private'})).status,200);
  assert.equal((await c.post({action:'remove_celebration',personId:A,
    expectedRevision:c.rev(A),celebrationId:'41'})).status,200);
  assert.equal(c.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
  c.sqlite.close();
});

test('010-B no Worker routes activated or cross-team files touched',()=>{
  for(const file of ['production-worker.mjs','staging-worker.mjs']) {
    const code=sql(file);
    assert.doesNotMatch(code,/member-directory-admin-service|member-directory-admin-transaction/);
  }
});
