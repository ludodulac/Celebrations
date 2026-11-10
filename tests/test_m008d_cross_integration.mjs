// M008-D — real M008-A/B/C cross-integration against *local* in-memory SQLite.
// No production bindings, credentials, routes or external services.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sha256} from '../migration/cloudflare/auth-api.mjs';
import {createContactDirectoryD1, toD1CelebrationId, toDomainCelebrationId}
  from '../migration/cloudflare/app/persistence/contact-directory-d1.mjs';
import {createCelebrationSpace}
  from '../migration/cloudflare/app/domain/celebration-spaces.mjs';
import {canAccessPage}
  from '../migration/cloudflare/app/domain/member-access.mjs';
import {resolveVerifiedMember, handlePrivatePage, allowedPrivatePageIds}
  from '../migration/cloudflare/app/security/member-private-access.mjs';
import {publicSnapshot} from '../migration/cloudflare/editor-publication-api.mjs';
import {projectPublishedLanguage}
  from '../migration/cloudflare/app/application/public-language-release.mjs';

const PERSON='person:550e8400-e29b-41d4-a716-446655440000';
const TYPE='member-type:chorale';
const TOKEN='c'.repeat(64);
const SPACE='space:41:chapelle';
const PAGE='page:41:chapelle';
const domainSpace=()=>createCelebrationSpace({
  id:SPACE,celebrationId:'41',visibility:'PRIVATE',
  accessPolicy:{mode:'SELECTED_TYPES',typeIds:[TYPE]},pages:[]
});
const page=()=>({id:PAGE,celebrationId:'41',spaceId:SPACE,visibility:'published',
  accessPolicy:{mode:'PUBLIC'},blocks:[{text:'PRIVATE_CONTENT_008D'}]});

function dbFacade(sqlite){
  const prepare=(query)=>({
    bind(...args){this.args=args;return this;},
    async first(){return sqlite.prepare(query).get(...(this.args||[]))??null;},
    async all(){return {results:sqlite.prepare(query).all(...(this.args||[]))};},
    async run(){const r=sqlite.prepare(query).run(...(this.args||[]));return {meta:{changes:Number(r.changes)}};}
  });
  return {prepare,async batch(statements){
    sqlite.exec('BEGIN IMMEDIATE');
    try{const out=[];for(const x of statements)out.push(await x.run());sqlite.exec('COMMIT');return out;}
    catch(e){sqlite.exec('ROLLBACK');throw e;}
  }};
}
function localSetup(){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for(const relative of ['celebrations-schema.sql','d1-migrations/20261110_007a_contact_directory.sql',
    'd1-migrations/20261110_008b_directory_integrity.sql'])
    sqlite.exec(readFileSync(new URL('../migration/cloudflare/'+relative,import.meta.url),'utf8'));
  sqlite.prepare('INSERT INTO celebrations_celebrations(id,archangel) VALUES(?,?)').run(41,'Gabriel');
  const db=dbFacade(sqlite);
  const space=domainSpace(), directory=createContactDirectoryD1(db,{
    resolveCanonicalSpace:async id=>id===SPACE?space:null
  });
  const req=(token=TOKEN)=>new Request(
    'https://www.ronde-des-archanges-universelle.eu/private/'+PAGE+'?lang=en',
    {headers:token?{authorization:'Bearer '+token}:{}}
  );
  const env={DB:db};
  const options={pageId:PAGE,loadPublishedPage:async id=>id===PAGE?page():null,
    loadPublishedSpace:async id=>id===SPACE?space:null,
    render:({page:canonical})=>Response.json({text:canonical.blocks[0].text})};
  return {sqlite,db,space,directory,req,env,options};
}
test('M008-D: D1 adapter writes are read by M008-C real server guard, with revocation',async()=>{
  const s=localSetup();
  try{
    assert.equal(toD1CelebrationId('41'),41);
    assert.equal(toDomainCelebrationId(41),'41');
    assert.throws(()=>toD1CelebrationId('041'),TypeError);
    await s.directory.createPerson({id:PERSON,email:'alice@example.org'});
    await s.directory.createMemberType({id:TYPE,name:'Chorale'});
    await s.directory.addPersonCelebration(PERSON,41);
    s.sqlite.prepare('INSERT INTO celebrations_participants(email,audience,password_hash) VALUES(?,?,?)')
      .run('alice@example.org','all','synthetic-nonlogin-hash');
    s.sqlite.prepare('INSERT INTO celebrations_participant_sessions(token_hash,participant_email,expires_at) VALUES(?,?,?)')
      .run(await sha256(TOKEN),'alice@example.org','2099-01-01T00:00:00.000Z');
    assert.deepEqual(await resolveVerifiedMember(s.req(),s.env),
      {id:PERSON,authenticated:true});
    assert.equal((await handlePrivatePage(s.req(),s.env,s.options)).status,404);
    await s.directory.replacePersonMemberTypes(PERSON,[TYPE]);
    assert.equal((await handlePrivatePage(s.req(),s.env,s.options)).status,404,
      'type alone must never bypass individual enrollment');
    await s.directory.enrollPersonInPrivateSpace(PERSON,SPACE);
    const grants=await s.directory.readTrustedAssignments(PERSON);
    assert.equal(canAccessPage(page(),{...grants,
      principal:{id:PERSON,authenticated:true},space:s.space}),true);
    const approved=await handlePrivatePage(s.req(),s.env,s.options);
    assert.equal(approved.status,200);
    assert.match(await approved.text(),/PRIVATE_CONTENT_008D/);
    assert.match(approved.headers.get('cache-control'),/no-store/);
    assert.deepEqual(await allowedPrivatePageIds(s.req(),s.env,[PAGE],s.options),[PAGE]);
    await s.directory.setMemberTypeDisabled(TYPE,true);
    const disabled=await handlePrivatePage(s.req(),s.env,s.options);
    assert.equal(disabled.status,404);
    assert.doesNotMatch(await disabled.text(),/PRIVATE_CONTENT_008D/);
    await s.directory.setMemberTypeDisabled(TYPE,false);
    await s.directory.removePrivateEnrollment(PERSON,SPACE);
    assert.equal((await handlePrivatePage(s.req(),s.env,s.options)).status,404);
    assert.equal((await handlePrivatePage(s.req(null),s.env,s.options)).status,404);
    assert.equal(s.sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
  }finally{s.sqlite.close();}
});
test('M008-D: public French projection does not publish private page or draft translations',()=>{
  const publicPage={id:'neutral-accueil-general',name:'Accueil',visibility:'published',
    blocks:[{text:'Bonjour'}]};
  const restricted={id:'neutral-restricted',name:'DO_NOT_LEAK',visibility:'published',
    accessPolicy:{mode:'SELECTED_TYPES',typeIds:[TYPE]},
    blocks:[{text:'SECRET_MEMBRE'}]};
  const draft={id:'mercredi-41',name:'SECRET_BROUILLON',visibility:'draft',
    blocks:[{text:'SECRET_TRADUCTION'}]};
  const state={version:1,shared:{homeId:publicPage.id,pages:[publicPage,restricted]},
    drafts:{'41':{pages:[draft]}},plans:[],
    published:{shared:{homeId:publicPage.id,pages:[publicPage,restricted]},
      drafts:{'41':{pages:[draft]}},plans:[],celebrationVisibility:{}},
    localization:{pages:{[publicPage.id]:{en:{name:'UNPUBLISHED_TRANSLATION'}}}}};
  const raw=publicSnapshot(state,'41');
  const projected=projectPublishedLanguage(raw,state.published,
    'https://www.ronde-des-archanges-universelle.eu/?lang=en');
  const output=JSON.stringify(projected);
  assert.equal(projected.shared.pages[0].name,'Accueil');
  for(const marker of ['DO_NOT_LEAK','SECRET_MEMBRE','SECRET_BROUILLON',
    'SECRET_TRADUCTION','UNPUBLISHED_TRANSLATION'])
    assert.equal(output.includes(marker),false,marker);
  assert.equal(projected.publicLanguage.selectedLanguageId,'fr');
});
test('M008-D: new private service is not imported by existing worker routes',()=>{
  for(const path of ['production-worker.mjs','staging-worker.mjs']){
    const source=readFileSync(new URL('../migration/cloudflare/'+path,import.meta.url),'utf8');
    assert.equal(source.includes('member-private-access.mjs'),false,path);
  }
  const api=readFileSync(new URL('../migration/cloudflare/public-data-api.mjs',import.meta.url),'utf8');
  assert.equal(api.includes('celebrations_directory_people'),false);
  assert.equal(api.includes('celebrations_directory_person_types'),false);
});
