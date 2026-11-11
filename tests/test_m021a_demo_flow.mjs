import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {pbkdf2Sync} from 'node:crypto';
import {createContactDirectoryD1} from '../migration/cloudflare/app/persistence/contact-directory-d1.mjs';
import {m021DemoCreate,m021DemoList,m021DemoDelete}
 from '../migration/cloudflare/app/application/m021-demo-members.mjs';
import {handleAuth,authorize} from '../migration/cloudflare/auth-api.mjs';
import {resolveExplicitMemberIdentity}
 from '../migration/cloudflare/app/security/member-identity-links.mjs';

function d1(sqlite){
 return {
  prepare(sql){
   let bind=[];
   return {bind(...args){bind=args;return this;},
    async first(){return sqlite.prepare(sql).get(...bind)??null;},
    async all(){return {results:sqlite.prepare(sql).all(...bind)};},
    async run(){const r=sqlite.prepare(sql).run(...bind);
     return {meta:{changes:Number(r.changes)},success:true};}};
  },
  async batch(stmts){
   sqlite.exec('BEGIN IMMEDIATE');try{
    const out=[];for(const s of stmts)out.push(await s.run());
    sqlite.exec('COMMIT');return out;
   }catch(e){sqlite.exec('ROLLBACK');throw e;}
  }
 };
}
function testDb(){
 const sqlite=new DatabaseSync(':memory:');
 sqlite.exec('PRAGMA foreign_keys=ON');
 const root=new URL('../migration/cloudflare/',import.meta.url);
 for(const name of [
  'celebrations-schema.sql',
  'd1-migrations/20261110_007a_contact_directory.sql',
  'd1-migrations/20261110_008b_directory_integrity.sql',
  'd1-migrations/20261110_009b_explicit_identity_links.sql',
  'd1-migrations/20261111_010b_member_admin_revisions.sql',
  'd1-migrations/20261111_020b_category_abbreviation.sql',
  'd1-migrations/20261111_020d_member_brevo.sql',
  'd1-migrations/20261111_021a_demo_members.sql'
 ])sqlite.exec(readFileSync(new URL(name,root),'utf8'));
 for(const [id,name] of [[41,'Michaël'],[42,'Gabriel']])
  sqlite.prepare('INSERT INTO celebrations_celebrations(id,archangel) VALUES(?,?)').run(id,name);
 for(const [id,name] of [['member-type:anges','Porteurs d’ange'],
  ['member-type:coeur','Bon retournement du cœur']])
  sqlite.prepare('INSERT INTO celebrations_directory_member_types(id,name) VALUES(?,?)').run(id,name);
 const db=d1(sqlite);
 return {sqlite,db,env:{DB:db},
  directory:createContactDirectoryD1(db,{resolveCanonicalSpace:async()=>null})};
}
async function login(db,email,password,host='celebrations-m016-admin-preprod.rondes.workers.dev'){
 const url='https://'+host+'/api/auth';
 const post=body=>handleAuth(new Request(url,{method:'POST',
  headers:{'content-type':'application/json'},body:JSON.stringify(body)}),{DB:db});
 const begin=await post({action:'participant_begin',email});
 if(begin.status!==200)return begin;
 const {salt}=await begin.json();
 return post({action:'participant_login_derived',email,
  password_proof:pbkdf2Sync(password,salt,180000,32,'sha256').toString('hex')});
}

test('M021-A — create Marie and Paul, real hashed login, separated ACL grants, deletion and session revocation',async()=>{
 const {sqlite,db,env,directory}=testDb(),actor='operator@example.invalid';
 try{
  const marie=await m021DemoCreate(db,env,directory,actor,{
   givenName:'Marie',familyName:'Test',typeId:'member-type:anges',celebrationIds:['41']
  });
  const paul=await m021DemoCreate(db,env,directory,actor,{
   givenName:'Paul',familyName:'Test',typeId:'member-type:coeur',celebrationIds:['42']
  });
  assert.match(marie.email,/^m021-[0-9a-f]{32}@test[.]invalid$/);
  assert.notEqual(marie.email,paul.email);
  assert.equal((await m021DemoList(db)).length,2);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM celebrations_participants WHERE password_salt LIKE ?')
   .get('client180:%').n,2);
  const marieLogin=await login(db,marie.email,'poule');
  assert.equal(marieLogin.status,200,await marieLogin.clone().text());
  const bearer=(await marieLogin.json()).token;
  const claim=new Request('https://celebrations-m016-admin-preprod.rondes.workers.dev/',{
   headers:{authorization:'Bearer '+bearer}
  });
  assert.equal((await authorize(claim,env)),marie.email);
  assert.equal((await resolveExplicitMemberIdentity(claim,env)).id,marie.personId);
  assert.equal((await login(db,paul.email,'incorrect')).status,401);
  const marieCategories=sqlite.prepare('SELECT type_id AS category FROM celebrations_directory_person_types WHERE person_id=?')
   .all(marie.personId).map(r=>r.category);
  assert.deepEqual(marieCategories,['member-type:anges']);
  assert.deepEqual(sqlite.prepare('SELECT celebration_id AS id FROM celebrations_directory_person_celebrations WHERE person_id=?')
   .all(marie.personId).map(r=>r.id),[41]);
  assert.deepEqual(sqlite.prepare('SELECT celebration_id AS id FROM celebrations_directory_person_celebrations WHERE person_id=?')
   .all(paul.personId).map(r=>r.id),[42]);
  await assert.rejects(()=>m021DemoDelete(db,actor,'person:550e8400-e29b-41d4-a716-446655440000'),
   /inconnu/);
  assert.deepEqual(await m021DemoDelete(db,actor,marie.personId),{deleted:true});
  assert.equal(await authorize(claim,env),null,'deleted member session must be invalidated');
  assert.equal((await m021DemoList(db)).length,1);
  assert.equal((await login(db,marie.email,'poule')).status,404,'deleted account cannot re-login');
  assert.equal((await login(db,paul.email,'poule')).status,200,'other demo member is preserved');
  assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{sqlite.close();}
});

test('M021-A — multiple celebration grants remain assigned to only their explicit account',async()=>{
 const {sqlite,db,env,directory}=testDb();
 try{
  const member=await m021DemoCreate(db,env,directory,'operator@example.invalid',{
   givenName:'Ana',familyName:'Test',typeId:'member-type:anges',
   celebrationIds:['41','42']
  });
  assert.deepEqual((await m021DemoList(db))[0].celebrations.sort(),[41,42]);
  assert.equal((await login(db,member.email,'poule')).status,200);
  await m021DemoDelete(db,'operator@example.invalid',member.personId);
  assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
 }finally{sqlite.close();}
});
