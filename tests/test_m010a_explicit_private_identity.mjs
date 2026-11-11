// M010-A — in-memory SQLite/D1 integration of private gate and explicit identity.
// No live Worker route, network, Cloudflare binding or real D1 mutation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {sha256} from '../migration/cloudflare/auth-api.mjs';
import {resolveExplicitMemberIdentity} from '../migration/cloudflare/app/security/member-identity-links.mjs';
import {resolveVerifiedMember, handlePrivatePage, handlePrivateMedia, allowedPrivatePageIds}
  from '../migration/cloudflare/app/security/member-private-access.mjs';

const P = 'person:550e8400-e29b-41d4-a716-446655440000';
const Q = 'person:550e8400-e29b-41d4-a716-446655440001';
const C = 'claim:550e8400-e29b-41d4-a716-446655440000';
const EMAIL = 'alice@example.org';
const TOKEN = 'm'.repeat(64);
const ADMIN_TOKEN = 'z'.repeat(64);
const T = 'member-type:chorale';
const OTHER = 'member-type:visiteur';
const SPACE = 'space:41:chapelle';
const PAGE = 'page:privee';
const PAGE_SPACE = 'page:chapelle';
const secret = 'SECRET_PRIVATE_010A';
const root = {id: PAGE, celebrationId: '41', visibility: 'published',
  accessPolicy: {mode:'SELECTED_TYPES',typeIds:[T]},
  blocks:[{text:secret}], translations:{en:{text:'SECRET_TRANSLATION_010A'}}};
const interior = {id:PAGE_SPACE, spaceId:SPACE, celebrationId:'41',
  visibility:'published',accessPolicy:{mode:'PUBLIC'},blocks:[{text:secret}]};
const space = {id:SPACE,celebrationId:'41',visibility:'PRIVATE',
  accessPolicy:{mode:'SELECTED_TYPES',typeIds:[T]}};

function d1(sqlite, queries) {
  return {prepare(statement) {
    return {bind(...args) {
      queries.push({statement,args});
      return {
        async first() {return sqlite.prepare(statement).get(...args)??null;},
        async all() {return {results:sqlite.prepare(statement).all(...args)};},
        async run() {
          return {meta:{changes:Number(sqlite.prepare(statement).run(...args).changes)}};
        }
      };
    }};
  }};
}
async function setup() {
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for(const path of ['celebrations-schema.sql',
    'd1-migrations/20261110_007a_contact_directory.sql',
    'd1-migrations/20261110_008b_directory_integrity.sql',
    'd1-migrations/20261110_009b_explicit_identity_links.sql']) {
    sqlite.exec(readFileSync(new URL('../migration/cloudflare/'+path,import.meta.url),'utf8'));
  }
  sqlite.prepare('INSERT INTO celebrations_celebrations(id,archangel) VALUES(?,?)').run(41,'Gabriel');
  sqlite.prepare('INSERT INTO celebrations_participants(email,password_hash,audience) VALUES(?,?,?)')
    .run(EMAIL,'synthetic-registered-hash','angel');
  sqlite.prepare('INSERT INTO celebrations_participants(email,password_hash,audience) VALUES(?,?,?)')
    .run('bob@example.org','synthetic-bob-hash','nonangel');
  sqlite.prepare('INSERT INTO celebrations_participant_sessions(token_hash,participant_email,expires_at) VALUES(?,?,?)')
    .run(await sha256(TOKEN),EMAIL,new Date(Date.now()+3600000).toISOString());
  sqlite.prepare('INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)')
    .run(await sha256(ADMIN_TOKEN),'admin@example.org',new Date(Date.now()+3600000).toISOString());
  sqlite.prepare('INSERT INTO celebrations_directory_people(id,email_normalized) VALUES(?,?)')
    .run(P,EMAIL);
  sqlite.prepare('INSERT INTO celebrations_directory_people(id,email_normalized) VALUES(?,?)')
    .run(Q,'unrelated@example.org');
  for(const [id,name] of [[T,'Chorale'],[OTHER,'Visiteur']])
    sqlite.prepare('INSERT INTO celebrations_directory_member_types(id,name) VALUES(?,?)').run(id,name);
  sqlite.prepare('INSERT INTO celebrations_directory_person_types(person_id,type_id) VALUES(?,?)').run(P,T);
  sqlite.prepare('INSERT INTO celebrations_directory_person_celebrations(person_id,celebration_id) VALUES(?,?)').run(P,41);
  sqlite.prepare('INSERT INTO celebrations_directory_private_spaces(space_id,celebration_id) VALUES(?,?)').run(SPACE,41);
  sqlite.prepare('INSERT INTO celebrations_directory_private_space_enrollments(person_id,celebration_id,space_id) VALUES(?,?,?)')
    .run(P,41,SPACE);
  const queries=[],env={DB:d1(sqlite,queries)};
  const req=(token=TOKEN)=>new Request('https://example.org/private/member/page?lang=en',{
    headers:token?{authorization:'Bearer '+token}:{}
  });
  const pageOptions=(page=root,counter={calls:0})=>({
    pageId:page.id,
    loadPublishedPage:async id=>id===page.id?page:null,
    loadPublishedSpace:async id=>id===SPACE?space:null,
    render:()=>{counter.calls++;return Response.json({secret,translation:'SECRET_TRANSLATION_010A'});}
  });
  const addClaim=({personId=P,email=EMAIL,status='approved',method='video_verified',
    reviewer='admin@example.org',reviewedAt='2026-11-11T00:00:00.000Z'}={})=>{
    sqlite.prepare('INSERT INTO celebrations_directory_identity_claims '+
      '(claim_id,participant_email,person_id,status,reviewed_by,reviewed_at,verification_method) '+
      'VALUES(?,?,?,?,?,?,?)').run(C,email,personId,status,reviewer,reviewedAt,method);
  };
  const addLink=({personId=P,email=EMAIL}={})=>{
    sqlite.prepare('INSERT INTO celebrations_directory_identity_links '+
      '(participant_email,person_id,approved_claim_id) VALUES(?,?,?)')
      .run(email,personId,C);
  };
  const approve=()=>{addClaim();addLink();};
  const close=()=>sqlite.close();
  return {sqlite,queries,env,req,pageOptions,addClaim,addLink,approve,close};
}

test('M010-A equal emails and registered account without explicit approval deny all rights',async()=>{
  const f=await setup();
  try {
    assert.equal(await resolveExplicitMemberIdentity(f.req(),f.env),null);
    assert.equal(await resolveVerifiedMember(f.req(),f.env),null);
    const calls={calls:0};
    const r=await handlePrivatePage(f.req(),f.env,f.pageOptions(root,calls));
    assert.equal(r.status,404);
    assert.equal(calls.calls,0);
    assert.doesNotMatch(await r.text(),/SECRET_/);
    assert.deepEqual(await allowedPrivatePageIds(f.req(),f.env,[PAGE],f.pageOptions()),[]);
    assert.ok(f.queries.some(q=>q.statement.includes('celebrations_directory_identity_claims')));
    assert.ok(f.queries.every(q=>!q.statement.includes('d.email_normalized=?')));
  } finally {f.close();}
});
test('M010-A pending claim or unreviewed link is never accepted as approval',async()=>{
  for(const variant of [{status:'pending'}, {status:'approved',reviewer:null},
    {status:'approved',reviewedAt:null}, {status:'approved',method:null}]) {
    const f=await setup();
    try {
      f.addClaim(variant);f.addLink();
      assert.equal(await resolveVerifiedMember(f.req(),f.env),null,JSON.stringify(variant));
      assert.equal((await handlePrivatePage(f.req(),f.env,f.pageOptions())).status,404);
    } finally {f.close();}
  }
});
test('M010-A verified participant session and admin-reviewed link recognize permanent identity',async()=>{
  const f=await setup();
  try {
    f.approve();
    assert.deepEqual(await resolveVerifiedMember(f.req(),f.env),{id:P,authenticated:true});
    const r=await handlePrivatePage(f.req(),f.env,f.pageOptions());
    assert.equal(r.status,200);
    assert.match(await r.text(),/SECRET_PRIVATE_010A/);
    assert.equal(r.headers.get('cache-control'),'private, no-store, max-age=0');
    assert.match(r.headers.get('vary'),/Authorization/);
  } finally {f.close();}
});
test('M010-A revoked identity link denies on next request despite unchanged types and enrollment',async()=>{
  const f=await setup();
  try {
    f.approve();
    assert.equal((await handlePrivatePage(f.req(),f.env,f.pageOptions(interior))).status,200);
    f.sqlite.prepare('DELETE FROM celebrations_directory_identity_links WHERE participant_email=?').run(EMAIL);
    assert.equal(await resolveVerifiedMember(f.req(),f.env),null);
    assert.equal((await handlePrivatePage(f.req(),f.env,f.pageOptions(interior))).status,404);
    assert.deepEqual(await allowedPrivatePageIds(f.req(),f.env,[PAGE,PAGE_SPACE],
      {...f.pageOptions(),loadPublishedPage:async id=>id===PAGE?root:id===PAGE_SPACE?interior:null}),[]);
  }finally{f.close();}
});
test('M010-A expired, missing, forged or administrator-only session is not a member session',async()=>{
  const f=await setup();
  try {
    f.approve();
    for(const token of [null,'x'.repeat(64),ADMIN_TOKEN]){
      assert.equal(await resolveVerifiedMember(f.req(token),f.env),null);
      assert.equal((await handlePrivatePage(f.req(token),f.env,f.pageOptions())).status,404);
    }
    f.sqlite.prepare('UPDATE celebrations_participant_sessions SET expires_at=? WHERE participant_email=?')
      .run('2000-01-01T00:00:00.000Z',EMAIL);
    assert.equal((await handlePrivatePage(f.req(),f.env,f.pageOptions())).status,404);
  }finally{f.close();}
});
test('M010-A mismatched account/person/claim IDs never receive another persons grants',async()=>{
  for(const variant of [
    {claim:{personId:P},link:{personId:Q}},
    {claim:{personId:P,email:'bob@example.org'},link:{personId:P,email:EMAIL}}
  ]){
    const f=await setup();
    try {
      f.addClaim(variant.claim);f.addLink(variant.link);
      assert.equal(await resolveVerifiedMember(f.req(),f.env),null);
      assert.equal((await handlePrivatePage(f.req(),f.env,f.pageOptions())).status,404);
    }finally{f.close();}
  }
});
test('M010-A different member type, disabled membership and removed grants deny immediately',async()=>{
  const f=await setup();
  try {
    f.approve();
    assert.equal((await handlePrivatePage(f.req(),f.env,f.pageOptions())).status,200);
    f.sqlite.prepare('DELETE FROM celebrations_directory_person_types WHERE person_id=?').run(P);
    f.sqlite.prepare('INSERT INTO celebrations_directory_person_types(person_id,type_id) VALUES(?,?)').run(P,OTHER);
    assert.equal((await handlePrivatePage(f.req(),f.env,f.pageOptions())).status,404);
    f.sqlite.prepare('DELETE FROM celebrations_directory_person_types WHERE person_id=?').run(P);
    f.sqlite.prepare('INSERT INTO celebrations_directory_person_types(person_id,type_id) VALUES(?,?)').run(P,T);
    f.sqlite.prepare('UPDATE celebrations_directory_member_types SET disabled=1 WHERE id=?').run(T);
    assert.equal((await handlePrivatePage(f.req(),f.env,f.pageOptions())).status,404);
  }finally{f.close();}
});
test('M010-A private space requires live individual enrollment and same celebration',async()=>{
  const f=await setup();
  try {
    f.approve();
    assert.equal((await handlePrivatePage(f.req(),f.env,f.pageOptions(interior))).status,200);
    f.sqlite.prepare('DELETE FROM celebrations_directory_private_space_enrollments WHERE person_id=?').run(P);
    assert.equal((await handlePrivatePage(f.req(),f.env,f.pageOptions(interior))).status,404);
    f.sqlite.prepare('INSERT INTO celebrations_directory_private_space_enrollments(person_id,celebration_id,space_id) VALUES(?,?,?)')
      .run(P,41,SPACE);
    assert.equal((await handlePrivatePage(f.req(),f.env,f.pageOptions({...interior,celebrationId:'999'}))).status,404);
  }finally{f.close();}
});
test('M018-A: revoking celebration enrollment blocks private root and space immediately',async()=>{
  const f=await setup();
  try {
    f.approve();
    assert.equal((await handlePrivatePage(f.req(),f.env,f.pageOptions(root))).status,200);
    assert.equal((await handlePrivatePage(f.req(),f.env,f.pageOptions(interior))).status,200);
    // The D1 foreign key requires withdrawing space grants before enrollment.
    f.sqlite.prepare('DELETE FROM celebrations_directory_private_space_enrollments WHERE person_id=?')
      .run(P);
    f.sqlite.prepare('DELETE FROM celebrations_directory_person_celebrations WHERE person_id=?')
      .run(P);
    assert.equal((await handlePrivatePage(f.req(),f.env,f.pageOptions(root))).status,404);
    assert.equal((await handlePrivatePage(f.req(),f.env,f.pageOptions(interior))).status,404);
  }finally{f.close();}
});
test('M010-A permissions and identity are reloaded from D1 for every request',async()=>{
  const f=await setup();
  try {
    f.approve();
    for(let n=0;n<2;n++)
      assert.equal((await handlePrivatePage(f.req(),f.env,f.pageOptions(interior))).status,200);
    for(const part of ['FROM celebrations_participant_sessions',
      'FROM celebrations_directory_identity_links',
      'FROM celebrations_directory_person_types',
      'FROM celebrations_directory_private_space_enrollments'])
      assert.ok(f.queries.filter(q=>q.statement.includes(part)).length>=2,part);
  }finally{f.close();}
});
test('M010-A D1 errors fail closed without leaking private data or rendering',async()=>{
  const f=await setup();
  try {
    f.approve();
    const original=f.env.DB;
    f.env.DB={prepare(sql){
      if(sql.includes('celebrations_directory_person_types'))throw Error('SQL PRIVATE SECRET');
      return original.prepare(sql);
    }};
    const counter={calls:0};
    const response=await handlePrivatePage(f.req(),f.env,f.pageOptions(root,counter));
    assert.equal(response.status,503);
    assert.equal(counter.calls,0);
    assert.doesNotMatch(await response.text(),/SQL|SECRET/);
    f.env.DB={prepare(){throw Error('SQL PRIVATE SECRET');}};
    const other=await handlePrivatePage(f.req(),f.env,f.pageOptions());
    assert.equal(other.status,503);
    assert.doesNotMatch(await other.text(),/SQL|SECRET/);
  }finally{f.close();}
});
test('M010-A media, translations, and search are blocked before R2 or rendering when link revoked',async()=>{
  const f=await setup();
  try {
    f.approve();
    let gets=0;
    f.env.PRIVATE_MEMBER_BUCKET={async get(){
      gets++;return {body:'PRIVATE_PDF_010A',size:16};
    }};
    const loadPublishedPage=async id=>id===PAGE?root:null;
    const opts={pageId:PAGE,mediaId:'media:private',loadPublishedPage,
      loadPublishedSpace:async()=>null,loadPrivateMedia:async()=>({
        id:'media:private',pageId:PAGE,visibility:'private',
        storageKey:'private-members/41/secret.pdf',mimeType:'application/pdf'
      })};
    const first=await handlePrivateMedia(f.req(),f.env,opts);
    assert.equal(first.status,200);
    assert.equal(gets,1);
    f.sqlite.prepare('DELETE FROM celebrations_directory_identity_links WHERE participant_email=?').run(EMAIL);
    const denied=await handlePrivateMedia(f.req(),f.env,opts);
    assert.equal(denied.status,404);
    assert.equal(gets,1,'revoked member must not read R2');
    const calls={calls:0};
    assert.equal((await handlePrivatePage(f.req(),f.env,f.pageOptions(root,calls))).status,404);
    assert.equal(calls.calls,0,'private translation must never render');
    assert.deepEqual(await allowedPrivatePageIds(f.req(),f.env,[PAGE],{
      loadPublishedPage,loadPublishedSpace:async()=>null}),[]);
  }finally{f.close();}
});
test('M010-A private identity service is still opt-in and not routed through live workers',()=>{
  for(const path of ['production-worker.mjs','staging-worker.mjs']){
    const source=readFileSync(new URL('../migration/cloudflare/'+path,import.meta.url),'utf8');
    assert.doesNotMatch(source,/member-private-access\.mjs|member-identity-links\.mjs/);
  }
});
