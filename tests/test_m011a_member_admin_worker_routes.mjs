// M011-A: full Worker.fetch HTTP Request tests and actual local SQLite constraints
// behind the same D1 prepare/batch interface. No remote D1, real accounts or deploy.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import production from '../migration/cloudflare/production-worker.mjs';
import staging from '../migration/cloudflare/staging-worker.mjs';
import {
  MEMBER_DIRECTORY_ADMIN_PATH, MEMBER_IDENTITY_CLAIM_PATH
} from '../migration/cloudflare/app/security/member-admin-worker-routes.mjs';

const HOST='member-route.test',ORIGIN='https://'+HOST;
const ADMIN='a'.repeat(64),PARTICIPANT='p'.repeat(64),EXPIRED='e'.repeat(64);
const A='person:550e8400-e29b-41d4-a716-446655440000';
const TYPE='member-type:choir';
const hash=token=>createHash('sha256').update(token).digest('hex');
const schema=path=>readFileSync(new URL('../migration/cloudflare/'+path,import.meta.url),'utf8');

function d1Facade(sqlite) {
  return {
    prepare(sql) {
      let args=[];
      return {
        bind(...values){args=values;return this;},
        async first(){return sqlite.prepare(sql).get(...args)??null;},
        async all(){return {results:sqlite.prepare(sql).all(...args)};},
        async run(){
          const r=sqlite.prepare(sql).run(...args);
          return {success:true,meta:{changes:Number(r.changes)}};
        }
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results=[];
        for(const statement of statements)results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch(error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    }
  };
}
function fixture(worker=production) {
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
    .run('participant@example.org','unaltered-synthetic-hash','angel');
  const future=new Date(Date.now()+3600000).toISOString();
  const past=new Date(Date.now()-3600000).toISOString();
  sqlite.prepare('INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)')
    .run(hash(ADMIN),'operator@example.org',future);
  sqlite.prepare('INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)')
    .run(hash(EXPIRED),'former@example.org',past);
  sqlite.prepare('INSERT INTO celebrations_participant_sessions(token_hash,participant_email,expires_at) VALUES(?,?,?)')
    .run(hash(PARTICIPANT),'participant@example.org',future);
  const assetCalls=[];
  const env={
    DB:d1Facade(sqlite),
    MEMBER_DIRECTORY_API_ENABLED:'true',
    MEMBER_DIRECTORY_API_HOST:HOST,
    ASSETS:{fetch:async req=>{
      assetCalls.push(new URL(req.url).pathname);
      return new Response('UNCHANGED_PUBLIC_ASSET',{status:200});
    }}
  };
  async function http(path,{
    method='GET',token=null,body,origin=ORIGIN,host=HOST,headers={},envPatch={}
  }={}) {
    const url=new URL(path,'https://'+host);
    const opts={method,headers:{
      ...(token?{authorization:'Bearer '+token}:{}),
      ...(body!==undefined?{'content-type':'application/json'}:{}),
      ...(method==='POST' && origin!==null?{origin}:{}),
      ...headers
    }};
    if(body!==undefined)opts.body=JSON.stringify(body);
    return worker.fetch(new Request(url,opts),{...env,...envPatch});
  }
  const json=async(path,options)=>{
    const response=await http(path,options);
    return {response,status:response.status,...await response.json()};
  };
  const count=(table)=>sqlite.prepare('SELECT count(*) AS n FROM '+table).get().n;
  const revision=(id)=>sqlite.prepare(
    'SELECT revision FROM celebrations_directory_admin_revisions WHERE resource_key=?'
  ).get(id)?.revision??0;
  return {sqlite,env,worker,http,json,count,revision,assetCalls,
    close(){sqlite.close();}};
}
const post=(c,body,extra={})=>c.json(MEMBER_DIRECTORY_ADMIN_PATH,{
  method:'POST',token:ADMIN,body,...extra
});

test('M011-A both real Workers have a disabled-by-default route boundary',async()=>{
  for(const worker of [production,staging]) {
    const c=fixture(worker);
    try {
      for(const path of [MEMBER_DIRECTORY_ADMIN_PATH,MEMBER_IDENTITY_CLAIM_PATH]) {
        const r=await c.http(path,{token:ADMIN,envPatch:{
          MEMBER_DIRECTORY_API_ENABLED:undefined
        }});
        assert.equal(r.status,404);
        assert.equal(r.headers.get('cache-control')?.includes('no-store'),true);
        assert.equal(r.headers.get('access-control-allow-origin'),null);
        assert.equal(c.assetCalls.length,0,'no static-asset bypass for disabled API');
        assert.equal((await c.http(path,{token:ADMIN,envPatch:{
          MEMBER_DIRECTORY_API_HOST:undefined
        }})).status,404);
      }
      const asset=await c.http('/unchanged-public.css');
      assert.equal(asset.status,200);
      assert.equal(await asset.text(),'UNCHANGED_PUBLIC_ASSET');
      assert.deepEqual(c.assetCalls,['/unchanged-public.css']);
    } finally {c.close();}
  }
});

test('M011-A official, read-only, obsolete, wrong and HTTP hosts cannot opt in',async()=>{
  const c=fixture();
  try {
    for(const host of [
      'www.ronde-des-archanges-universelle.eu',
      'ronde-des-archanges-universelle.eu',
      'celebrations-exit-production.rondes.workers.dev',
      'celebrations-visual-candidate.rondes.workers.dev',
      'celebrations-exit-staging.rondes.workers.dev'
    ]) {
      assert.equal((await c.http(MEMBER_DIRECTORY_ADMIN_PATH,{
        token:ADMIN,host,envPatch:{MEMBER_DIRECTORY_API_HOST:host}
      })).status,404,host);
    }
    // A different host is denied unless it is deliberately selected as the
    // isolated opt-in host; it is never accepted by default.
    assert.equal((await c.http(MEMBER_DIRECTORY_ADMIN_PATH,{
      token:ADMIN,host:'other-host.test'
    })).status,404);
    const insecure=await c.worker.fetch(new Request(
      'http://'+HOST+MEMBER_DIRECTORY_ADMIN_PATH,{
        headers:{authorization:'Bearer '+ADMIN}
      }),c.env);
    assert.equal(insecure.status,404);
    assert.equal(c.count('celebrations_directory_admin_audit'),0);
  } finally {c.close();}
});

test('M011-A every HTTP admin read/write requires live ADMIN session and same origin',async()=>{
  for(const worker of [production,staging]) {
    const c=fixture(worker);
    try {
      for(const token of [null,PARTICIPANT,EXPIRED,'x'.repeat(64)]) {
        const get=await c.http(MEMBER_DIRECTORY_ADMIN_PATH,{token});
        assert.equal(get.status,401);
        const write=await c.http(MEMBER_DIRECTORY_ADMIN_PATH,{
          method:'POST',token,body:{action:'create_person',email:'fake@example.org'}
        });
        assert.equal(write.status,401);
      }
      // The separate editor cookie does not authorize this sensitive API.
      assert.equal((await c.http(MEMBER_DIRECTORY_ADMIN_PATH,{
        headers:{cookie:'celebrations_editor_access=signed-fake-value'}
      })).status,401);
      assert.equal((await c.http(MEMBER_DIRECTORY_ADMIN_PATH,{token:ADMIN,
        headers:{origin:'https://other-origin.test'}})).status,403);
      assert.equal((await c.http(MEMBER_DIRECTORY_ADMIN_PATH,{token:ADMIN,
        headers:{'sec-fetch-site':'cross-site'}})).status,403);
      assert.equal((await c.http(MEMBER_DIRECTORY_ADMIN_PATH,{
        method:'POST',token:ADMIN,body:{action:'create_person',email:'fake@example.org'},
        origin:null
      })).status,403);
      assert.equal((await c.http(MEMBER_DIRECTORY_ADMIN_PATH,{
        method:'POST',token:ADMIN,body:{action:'create_person',email:'fake@example.org'},
        origin:'https://other-origin.test'
      })).status,403);
      assert.equal((await c.http(MEMBER_DIRECTORY_ADMIN_PATH,{
        method:'DELETE',token:ADMIN
      })).status,405);
      assert.equal(c.count('celebrations_directory_people'),0);
      assert.equal(c.count('celebrations_directory_admin_audit'),0);
      const allowed=await c.json(MEMBER_DIRECTORY_ADMIN_PATH,{token:ADMIN});
      assert.equal(allowed.status,200);
      assert.deepEqual(allowed.data.members,[]);
      assert.equal(allowed.data.pagePolicyWritesEnabled,false);
      assert.equal(allowed.response.headers.get('access-control-allow-origin'),null);
    } finally {c.close();}
  }
});

test('M011-A participant-only claim stays pending; admin cannot claim',async()=>{
  const c=fixture();
  try {
    c.sqlite.prepare('INSERT INTO celebrations_directory_people(id,email_normalized) VALUES(?,?)')
      .run(A,'participant@example.org');
    for(const token of [null,ADMIN,EXPIRED]) {
      assert.equal((await c.http(MEMBER_IDENTITY_CLAIM_PATH,{
        method:'POST',token,body:{personId:A}
      })).status,401);
    }
    assert.equal((await c.http(MEMBER_IDENTITY_CLAIM_PATH,{
      method:'GET',token:PARTICIPANT
    })).status,405);
    assert.equal((await c.http(MEMBER_IDENTITY_CLAIM_PATH,{
      method:'POST',token:PARTICIPANT,origin:'https://evil.test',
      body:{personId:A}
    })).status,403);
    const r=await c.json(MEMBER_IDENTITY_CLAIM_PATH,{
      method:'POST',token:PARTICIPANT,
      body:{personId:A,role:'admin',status:'approved',approved:true}
    });
    assert.equal(r.response.status,200);
    assert.equal(r.ok,true);
    assert.equal(r.status,'pending','the claim status cannot be approved by its submitter');
    assert.match(r.claimId,/^claim:/);
    assert.equal(c.sqlite.prepare('SELECT status FROM celebrations_directory_identity_claims')
      .get().status,'pending');
    assert.equal(c.count('celebrations_directory_identity_links'),0);
    assert.equal(c.count('celebrations_directory_admin_audit'),0);
    assert.equal(c.sqlite.prepare('SELECT password_hash FROM celebrations_participants')
      .get().password_hash,'unaltered-synthetic-hash');
    assert.equal((await c.json(MEMBER_IDENTITY_CLAIM_PATH,{
      method:'POST',token:PARTICIPANT,body:{personId:'person:unknown'}
    })).status,403);
  } finally {c.close();}
});

test('M011-A HTTP admin pagination, search beyond 100 and permanent IDs',async()=>{
  const c=fixture();
  try {
    for(let i=0;i<127;i++) {
      c.sqlite.prepare('INSERT INTO celebrations_directory_people(id,email_normalized,given_name) VALUES(?,?,?)')
        .run('person:'+String(i).padStart(8,'0')+'-e29b-41d4-a716-446655440000',
          'person'+String(i).padStart(3,'0')+'@example.org',
          i===126?'Marc':'Personne');
    }
    const ids=new Set(),cursors=new Set();let cursor='';
    for(;;) {
      const query='?action=snapshot&limit=37&cursor='+encodeURIComponent(cursor);
      const response=await c.json(MEMBER_DIRECTORY_ADMIN_PATH+query,{token:ADMIN});
      assert.equal(response.status,200);
      for(const p of response.data.members)ids.add(p.id);
      if(!response.data.hasMorePeople)break;
      cursor=response.data.nextCursor;
      assert.ok(cursor&&!cursors.has(cursor),'nextCursor moves forward');
      cursors.add(cursor);
    }
    assert.equal(ids.size,127);
    const found=await c.json(MEMBER_DIRECTORY_ADMIN_PATH+
      '?action=snapshot&search=marc',{token:ADMIN});
    assert.equal(found.data.members.length,1);
    assert.equal(found.data.members[0].emailNormalized,'person126@example.org');
    assert.equal((await c.json(MEMBER_DIRECTORY_ADMIN_PATH+
      '?action=snapshot&limit=999',{token:ADMIN})).status,400);
    assert.equal((await c.json(MEMBER_DIRECTORY_ADMIN_PATH+
      '?action=person_detail&personId='+encodeURIComponent(
        'person:00000126-e29b-41d4-a716-446655440000'
      ),{token:ADMIN})).status,200);
  } finally {c.close();}
});

test('M011-A audited writes, optimistic revisions and missing canonical resolver reject',async()=>{
  const c=fixture();
  try {
    const created=await post(c,{action:'create_person',
      email:'Alice@example.org',givenName:'Alice'});
    assert.equal(created.status,200);
    const id=created.result.id;
    assert.match(id,/^person:/);
    assert.equal(c.count('celebrations_directory_admin_audit'),1);
    const t=await post(c,{action:'create_type',typeId:TYPE,name:'Chorale'});
    assert.equal(t.status,200);
    assert.equal(c.count('celebrations_directory_admin_audit'),2);
    const updated=await post(c,{action:'update_person',personId:id,
      expectedRevision:0,changes:{displayName:'Alice A.'}});
    assert.equal(updated.status,200);
    assert.equal(c.revision(id),1);
    assert.equal((await post(c,{action:'update_person',personId:id,
      expectedRevision:0,changes:{displayName:'Overwritten'}})).status,409);
    assert.equal(c.count('celebrations_directory_admin_audit'),3);
    assert.equal((await post(c,{action:'add_celebration',personId:id,
      expectedRevision:1,celebrationId:'41'})).status,200);
    const rev=c.revision(id);
    assert.equal((await post(c,{action:'enroll_space',personId:id,
      expectedRevision:rev,spaceId:'space:41:private',
      space:{id:'space:41:private',visibility:'PRIVATE',celebrationId:'41'}
    })).status,400);
    assert.equal(c.count('celebrations_directory_private_space_enrollments'),0);
    assert.equal(c.count('celebrations_directory_private_spaces'),0);
    assert.equal(c.revision(id),rev);
    assert.equal(c.count('celebrations_directory_admin_audit'),4);
    assert.equal(c.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
  } finally {c.close();}
});

test('M011-A D1 audit failure rolls back HTTP mutations and membership batch',async()=>{
  const c=fixture();
  try {
    c.sqlite.prepare('INSERT INTO celebrations_directory_people(id,email_normalized) VALUES(?,?)')
      .run(A,'alice@example.org');
    assert.equal((await post(c,{action:'create_type',typeId:TYPE,name:'Chorale'}))
      .status,200);
    c.sqlite.exec(`CREATE TRIGGER reject_new_admin_audit BEFORE INSERT
      ON celebrations_directory_admin_audit
      WHEN NEW.action IN ('create_person','set_person_types')
      BEGIN SELECT RAISE(ABORT,'audit unavailable'); END`);
    assert.equal((await post(c,{action:'create_person',email:'should-not-exist@example.org'}))
      .status,409);
    assert.equal(c.sqlite.prepare('SELECT count(*) AS n FROM celebrations_directory_people')
      .get().n,1);
    assert.equal((await post(c,{action:'set_person_types',personId:A,
      expectedRevision:0,typeIds:[TYPE]})).status,409);
    assert.equal(c.count('celebrations_directory_person_types'),0);
    assert.equal(c.revision(A),0);
    assert.equal(c.count('celebrations_directory_admin_audit'),1);
  } finally {c.close();}
});
