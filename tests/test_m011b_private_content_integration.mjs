// M011-B: native Node 22 SQLite (D1 semantics) + simulated, disjoint R2.
// Never connects to Cloudflare, mutates a real bucket, or enables a Worker.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sha256} from '../migration/cloudflare/auth-api.mjs';
import {EDITOR_SNAPSHOT_KEY}
  from '../migration/cloudflare/app/ports/editor-snapshot-contract.mjs';
import {createCanonicalPrivateLoaders}
  from '../migration/cloudflare/app/persistence/private-canonical-content.mjs';
import {handleCanonicalPrivatePage,handleCanonicalPrivateMedia,
  handleCanonicalPrivateList,listAuthorizedPrivatePages}
  from '../migration/cloudflare/app/application/private-content-read-service.mjs';
import {duplicateCelebration}
  from '../migration/cloudflare/app/domain/celebration-spaces.mjs';
import {handleMedia} from '../migration/cloudflare/media-gateway.mjs';
import {releasedPublicSpaces} from '../migration/cloudflare/editor-publication-api.mjs';

const P='person:550e8400-e29b-41d4-a716-446655440000';
const CLAIM='claim:550e8400-e29b-41d4-a716-446655440000';
const EMAIL='alice@example.org', TOKEN='x'.repeat(64),ADMIN='a'.repeat(64);
const TYPE='member-type:chant',OTHER='member-type:visitor';
const ROOT='page:41:private-root',INNER='page:41:chapelle';
const SPACE='space:41:chapelle',MEDIA='private-asset:pdf-41';
const SITE_URL='https://www.ronde-des-archanges-universelle.eu';
const policy={mode:'SELECTED_TYPES',typeIds:[TYPE]};
const page=(id,more={})=>({id,celebrationId:'41',
  name:id===ROOT?'Cantique autorisé':'Chapelle interdite',
  group:'celebration',visibility:'published',publicationStatus:'published',
  accessPolicy:structuredClone(policy),blocks:[
    {id:1,kind:'text',text:id===ROOT?'AUTHORIZED_CANONICAL':'HIDDEN_SPACE_SECRET',
      xPrivateEmail:'do-not-show@example.org'},
    ...(id===ROOT?[{id:2,kind:'button',mediaId:MEDIA,text:'PDF personnel',
      remoteKey:'private-members/41/NEVER_EXPOSE.pdf'}]:[])
  ],...more});
const space=()=>({id:SPACE,celebrationId:'41',visibility:'PRIVATE',
  publicationStatus:'published',accessPolicy:structuredClone(policy),
  pages:[page(INNER,{spaceId:SPACE,accessPolicy:{mode:'PUBLIC'}})]});
const langRegistry=()=>({version:1,defaultLanguageId:'fr',languages:[
  {id:'fr',name:'Français',flag:'🇫🇷',active:true},
  {id:'en',name:'English',flag:'🇬🇧',active:true}
]});
function initialState(){
 const root=page(ROOT), chapel=space();
 return {version:11,drafts:{'41':{pages:[{...root,visibility:'draft'}],
   spaces:[{...chapel,publicationStatus:'draft'}]}},
   shared:{pages:[],homeId:''},plans:[],mediaCatalogue:[{
    id:'sneaky',src:'/media/private-members/41/report.pdf',general:true
   }],
   publishedRevision:2,publishedAt:'2026-11-11T00:00:00.000Z',
   localization:{pages:{[ROOT]:{en:{
     name:'UNRELEASED_EDITOR_TRANSLATION',blocks:[{kind:'text',text:'UNRELEASED'}]
   }}}},
   published:{privateReleaseRevisions:{'41':{revision:2,token:'550e8400-e29b-41d4-a716-446655440000'}},drafts:{'41':{pages:[root],spaces:[chapel]}},
    shared:{pages:[]},plans:[],celebrationVisibility:{'41':'published'},
    languageRegistry:langRegistry(),
    privatePageReleases:{
      [ROOT]:{pageId:ROOT,celebrationId:'41',publication:'published'},
      [INNER]:{pageId:INNER,celebrationId:'41',spaceId:SPACE,publication:'published'}
    },
    privateSpaceReleases:{[SPACE]:{spaceId:SPACE,celebrationId:'41',publication:'published'}},
    privateTranslationReleases:{[ROOT]:{pageId:ROOT,publication:'published',
      variants:{en:{name:'Allowed English title',blocks:[
        {id:1,kind:'text',text:'AUTHORIZED_ENGLISH'},
        {id:2,kind:'button',mediaId:MEDIA,text:'Private file'}
      ]}}}},
    privateMedia:[{id:MEDIA,pageId:ROOT,celebrationId:'41',
      visibility:'private',publicationStatus:'published',
      storageKey:'private-members/41/report.pdf',mimeType:'application/pdf'}]
   }};
}
function makeD1(db,queries){
 return {prepare(sql){return {bind(...params){
   queries.push({sql,params});
   const statement=db.prepare(sql);
   return {first:async()=>statement.get(...params)??null,
     all:async()=>({results:statement.all(...params)}),
     run:async()=>({meta:{changes:Number(statement.run(...params).changes)}})};
 }}}};
}
function req(token=TOKEN,path='/private/read',method='GET',headers={}){
 return new Request(SITE_URL+path,{method,headers:{
  ...(token?{authorization:'Bearer '+token}:{}),...headers
 }});
}
async function setup(){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON');
 for(const file of ['celebrations-schema.sql',
  'd1-migrations/20261110_007a_contact_directory.sql',
  'd1-migrations/20261110_008b_directory_integrity.sql',
  'd1-migrations/20261110_009b_explicit_identity_links.sql',
  'd1-migrations/20261111_012c_private_release_fences.sql']){
  db.exec(readFileSync(new URL('../migration/cloudflare/'+file,import.meta.url),'utf8'));
 }
 for(const id of [41,42])db.prepare(
   'INSERT INTO celebrations_celebrations(id,archangel) VALUES(?,?)').run(id,'Gabriel');
 db.prepare('INSERT INTO celebrations_private_release_fences(celebration_id,revision,token) VALUES(?,?,?)')
  .run(41,2,'550e8400-e29b-41d4-a716-446655440000');
 db.prepare('INSERT INTO celebrations_participants(email,password_hash,audience) VALUES(?,?,?)')
  .run(EMAIL,'synthetic-password-hash','angel');
 db.prepare('INSERT INTO celebrations_participant_sessions(token_hash,participant_email,expires_at) VALUES(?,?,?)')
  .run(await sha256(TOKEN),EMAIL,new Date(Date.now()+3600000).toISOString());
 db.prepare('INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)')
  .run(await sha256(ADMIN),'admin@example.org',new Date(Date.now()+3600000).toISOString());
 db.prepare('INSERT INTO celebrations_directory_people(id,email_normalized) VALUES(?,?)').run(P,EMAIL);
 for(const type of [TYPE,OTHER])db.prepare(
   'INSERT INTO celebrations_directory_member_types(id,name) VALUES(?,?)').run(type,type);
 db.prepare('INSERT INTO celebrations_directory_person_types(person_id,type_id) VALUES(?,?)')
  .run(P,TYPE);
 db.prepare('INSERT INTO celebrations_directory_person_celebrations(person_id,celebration_id) VALUES(?,?)')
  .run(P,41);
 db.prepare('INSERT INTO celebrations_directory_private_spaces(space_id,celebration_id) VALUES(?,?)')
  .run(SPACE,41);
 db.prepare('INSERT INTO celebrations_directory_private_space_enrollments(person_id,celebration_id,space_id) VALUES(?,?,?)')
  .run(P,41,SPACE);
 const state=initialState(),queries=[],reads={editor:0,private:0,public:0};
 const EDITOR_BUCKET={async get(key){
   reads.editor++;
   assert.equal(key,EDITOR_SNAPSHOT_KEY,'only the existing published editor snapshot');
   return {etag:'etag-1',body:true,text:async()=>JSON.stringify(state)};
 }};
 const PRIVATE_MEMBER_BUCKET={async get(key){
   reads.private++;
   assert.equal(key,'private-members/41/report.pdf');
   return {body:'ONLY_PRIVATE_PDF_BYTES',size:22,
     writeHttpMetadata(h){h.set('content-type','application/pdf');h.set('etag','not-public')}}
 }};
 const MEDIA_BUCKET={async get(){reads.public++;throw Error('Public R2 must not read private media')}};
 const MEDIA_ACL={prepare(){throw Error('No public ACL lookup should happen for private URL')}};
 const env={DB:makeD1(db,queries),EDITOR_BUCKET,PRIVATE_MEMBER_BUCKET,MEDIA_BUCKET,MEDIA_ACL};
 const approve=()=>{
   db.prepare('INSERT INTO celebrations_directory_identity_claims '+
     '(claim_id,participant_email,person_id,status,reviewed_at,reviewed_by,verification_method) '+
     'VALUES(?,?,?,\'approved\',?,?,?)')
    .run(CLAIM,EMAIL,P,'2026-11-11T00:00:00.000Z','admin@example.org','video_verified');
   db.prepare('INSERT INTO celebrations_directory_identity_links '+
     '(participant_email,person_id,approved_claim_id) VALUES(?,?,?)')
    .run(EMAIL,P,CLAIM);
 };
 return {db,state,env,reads,queries,approve,close:()=>db.close()};
}
const readPage=(f,id=ROOT,request=req(),lang='fr')=>
  handleCanonicalPrivatePage(request,f.env,{pageId:id,languageId:lang});
const readMedia=(f,id=MEDIA,pageId=ROOT,request=req())=>
  handleCanonicalPrivateMedia(request,f.env,{mediaId:id,pageId});
const list=(f,options={},request=req())=>
  listAuthorizedPrivatePages(request,f.env,{celebrationId:'41',...options});
async function noLeak(r){
 assert.match(r.headers.get('cache-control')||'',/no-store/);
 assert.match(r.headers.get('vary')||'',/Authorization/);
 const body=await r.text();
 assert.doesNotMatch(body,/HIDDEN_SPACE_SECRET|UNRELEASED|private-members|person:|SQL_SECRET/);
}
test('M011-B: no approval, admin-only token or browser-provided grants can authorize a page',async()=>{
 const f=await setup();
 try{
  for(const request of [req(),req(null),req(ADMIN),
    req(TOKEN,'/private?accessPolicy=PUBLIC&types='+TYPE,'GET',{
      'x-member-type':TYPE,'x-member-id':P,'x-verified':'true'})]){
   const r=await readPage(f,ROOT,request);
   assert.equal(r.status,404);
   await noLeak(r);
  }
  assert.equal(f.reads.private,0);
  assert.deepEqual(await list(f),[]);
 }finally{f.close()}
});
test('M011-B: live D1 permissions + approved identity reveal only safe canonical fields',async()=>{
 const f=await setup();
 try{
  f.approve();
  const r=await readPage(f);
  assert.equal(r.status,200,await r.clone().text());
  assert.equal(r.headers.get('etag'),null);
  const body=await r.json();
  assert.equal(body.id,ROOT);assert.equal(body.celebrationId,'41');
  assert.equal(body.blocks[0].text,'AUTHORIZED_CANONICAL');
  assert.equal(body.blocks[1].mediaId,MEDIA);
  const serialized=JSON.stringify(body);
  for(const secret of ['private-members','accessPolicy','UNRELEASED',
    'person:','remoteKey','xPrivateEmail','privateMedia','storageKey'])
   assert.equal(serialized.includes(secret),false,secret);
  assert.equal(f.reads.editor,1,'single canonical R2 read per HTTP request');
  assert.equal(f.reads.private,0,'page read never fetches media bytes');
 }finally{f.close()}
});
test('M011-B: published English changes content, never identity/ACL; draft translations cannot leak',async()=>{
 const f=await setup();
 try{
  f.approve();
  let r=await readPage(f,ROOT,req(TOKEN,'/private?lang=en&accessPolicy=PUBLIC'),'en');
  assert.equal(r.status,200);
  let body=await r.json();
  assert.equal(body.name,'Allowed English title');
  assert.equal(body.blocks[0].text,'AUTHORIZED_ENGLISH');
  assert.equal(body.id,ROOT);
  f.state.published.privateTranslationReleases[ROOT].variants.en={
    id:'forged-id',accessPolicy:{mode:'PUBLIC'},name:'Bad',
    blocks:[{kind:'text',text:'LEAK_FROM_UNRELEASED'}]
  };
  r=await readPage(f,ROOT,req(),'en');
  body=await r.json();
  assert.equal(body.name,'Cantique autorisé');
  assert.doesNotMatch(JSON.stringify(body),/LEAK_FROM_UNRELEASED|UNRELEASED_EDITOR/);
  f.db.prepare('UPDATE celebrations_directory_member_types SET disabled=1 WHERE id=?').run(TYPE);
  assert.equal((await readPage(f,ROOT,req(),'en')).status,404,
    'language never overrides disabled type');
 }finally{f.close()}
});
test('M011-B: space membership AND matching celebration AND active member type on every request',async()=>{
 const f=await setup();
 try{
  f.approve();
  assert.equal((await readPage(f,INNER)).status,200);
  f.db.prepare('DELETE FROM celebrations_directory_private_space_enrollments WHERE person_id=?').run(P);
  const denied=await readPage(f,INNER);
  assert.equal(denied.status,404);await noLeak(denied);
  assert.equal((await readPage(f,ROOT)).status,200,'root type still valid');
  f.db.prepare('INSERT INTO celebrations_directory_private_space_enrollments(person_id,celebration_id,space_id) VALUES(?,?,?)')
   .run(P,41,SPACE);
  assert.equal((await readPage(f,INNER)).status,200);
  f.db.prepare('DELETE FROM celebrations_directory_person_types WHERE person_id=?').run(P);
  assert.equal((await readPage(f,ROOT)).status,404);
  assert.equal((await readPage(f,INNER)).status,404);
 }finally{f.close()}
});
test('M011-B: private media uses ONLY linked published canonical manifest and disjoint R2',async()=>{
 const f=await setup();
 try{
  f.approve();
  let r=await readMedia(f);
  assert.equal(r.status,200,await r.clone().text());
  assert.equal(await r.text(),'ONLY_PRIVATE_PDF_BYTES');
  assert.equal(r.headers.get('content-type'),'application/pdf');
  assert.equal(r.headers.get('content-disposition'),'attachment');
  assert.equal(r.headers.get('etag'),null);
  assert.equal(f.reads.private,1);assert.equal(f.reads.public,0);
  r=await readMedia(f,MEDIA,ROOT,req(TOKEN,'/private','HEAD'));
  assert.equal(r.status,200);assert.equal(await r.text(),'');
  f.state.published.privateMedia[0].storageKey='private-members/42/foreign.pdf';
  assert.equal((await readMedia(f)).status,404);
  f.state.published.privateMedia[0].storageKey='private-members/41/report.pdf';
  f.state.published.drafts['41'].pages[0].blocks.pop();
  assert.equal((await readMedia(f)).status,404,'orphaned media not published');
  f.state.published.drafts['41'].pages[0]=page(ROOT);
  f.env.PRIVATE_MEMBER_BUCKET=f.env.MEDIA_BUCKET;
  assert.equal((await readMedia(f)).status,503,'never alias to public R2');
  assert.equal(f.reads.public,0);
 }finally{f.close()}
});
test('M011-B: revocation of a person link, type, individual enrollment or session is immediate',async()=>{
 const f=await setup();
 try{
  f.approve();
  assert.equal((await readMedia(f)).status,200);
  f.db.prepare('DELETE FROM celebrations_directory_identity_links WHERE participant_email=?').run(EMAIL);
  assert.equal((await readPage(f)).status,404);
  assert.equal((await readMedia(f)).status,404);
  assert.equal((await readPage(f,INNER)).status,404);
  assert.deepEqual(await list(f),[]);
  assert.equal(f.reads.private,1,'no second private R2 read after revocation');
 }finally{f.close()}
});
test('M011-B: pages require an explicit release, published celebration, valid ownership',async()=>{
 const f=await setup();
 try{
  f.approve();
  const original=f.state.published.drafts['41'].pages[0];
  for(const patch of [
   {visibility:'draft'}, {visibility:'hidden'},
   {publicationStatus:'draft'}, {publicationStatus:undefined},
   {celebrationId:'42'}, {spaceId:'space:41:forged'},
   {accessPolicy:{mode:'PUBLIC'}}, {accessPolicy:null},
   {blocks:'not-a-list'}, {published:false}
  ]){
    f.state.published.drafts['41'].pages[0]={...original,...patch};
    assert.equal((await readPage(f)).status,404,JSON.stringify(patch));
  }
  f.state.published.drafts['41'].pages[0]=original;
  delete f.state.published.privatePageReleases[ROOT];
  assert.equal((await readPage(f)).status,404,'no explicit release ledger means no page');
  f.state.published.privatePageReleases[ROOT]={
    pageId:ROOT,celebrationId:'41',publication:'published'};
  f.state.published.celebrationVisibility['41']='draft';
  assert.equal((await readPage(f)).status,404);
  f.state.published.celebrationVisibility['41']='published';
  f.state.publishedRevision=0;
  assert.equal((await readPage(f)).status,404);
  f.state.publishedRevision=2;
  f.state.published.drafts['41'].pages.push(structuredClone(original));
  assert.equal((await readPage(f)).status,404,'duplicate page ID invalidates both');
  f.state.published.drafts['41'].pages.pop();
  f.state.published.drafts['41'].spaces.push(structuredClone(space()));
  assert.equal((await readPage(f,INNER)).status,404,'duplicate space ID invalidates');
 }finally{f.close()}
});
test('M011-B: search, navigation and lists reveal no unauthorized title, count or snippet',async()=>{
 const f=await setup();
 try{
  f.approve();
  let rows=await list(f);
  assert.deepEqual(rows.map(x=>x.id),[ROOT,INNER]);
  f.db.prepare('DELETE FROM celebrations_directory_private_space_enrollments WHERE person_id=?').run(P);
  rows=await list(f);
  assert.deepEqual(rows.map(x=>x.id),[ROOT]);
  assert.doesNotMatch(JSON.stringify(rows),/Chapelle|HIDDEN_SPACE/);
  assert.deepEqual(await list(f,{search:'Chapelle'}),[]);
  assert.deepEqual(await list(f,{search:'HIDDEN_SPACE_SECRET'}),[]);
  rows=await list(f,{languageId:'en',search:'Allowed English'});
  assert.deepEqual(rows.map(x=>x.id),[ROOT]);
  const response=await handleCanonicalPrivateList(req(),f.env,{
   celebrationId:'41',search:'Chapelle'});
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{pages:[]});
  const head=await handleCanonicalPrivateList(req(TOKEN,'/private/list','HEAD'),
   f.env,{celebrationId:'41'});
  assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.match(head.headers.get('cache-control'),/no-store/);
 }finally{f.close()}
});
test('M011-B: cloned celebration pages/spaces and copied media never inherit access',async()=>{
 const f=await setup();
 try{
  f.approve();
  const aggregate={id:'41',pages:[page(ROOT)],spaces:[space()]};
  const clone=duplicateCelebration(aggregate,{
   id:'42',pageIds:{[ROOT]:'page:42:private-root',[INNER]:'page:42:chapelle'},
   spaceIds:{[SPACE]:'space:42:chapelle'}
  });
  assert.equal(clone.pages[0].visibility,'draft');
  assert.equal(clone.spaces[0].pages[0].publicationStatus,'draft');
  assert.equal(JSON.stringify(clone).includes('enrollments'),false);
  // An unrelated publication of another page cannot release cloned drafts.
  f.state.published.drafts['42']={pages:clone.pages,spaces:clone.spaces};
  f.state.published.celebrationVisibility['42']='published';
  assert.equal((await readPage(f,'page:42:private-root')).status,404);
  assert.equal((await readPage(f,'page:42:chapelle')).status,404);
  // Even when an operator deliberately releases the clone, M008-C must
  // consult the new celebration's distinct D1 enrollment registry.
  const cp=f.state.published.drafts['42'];
  cp.spaces[0].publicationStatus='published';
  cp.spaces[0].pages[0].visibility='published';
  cp.spaces[0].pages[0].publicationStatus='published';
  f.state.published.privateSpaceReleases['space:42:chapelle']={
    spaceId:'space:42:chapelle',celebrationId:'42',publication:'published'};
  f.state.published.privatePageReleases['page:42:chapelle']={
    pageId:'page:42:chapelle',spaceId:'space:42:chapelle',
    celebrationId:'42',publication:'published'};
  f.db.prepare('INSERT INTO celebrations_directory_private_spaces(space_id,celebration_id) VALUES(?,?)')
    .run('space:42:chapelle',42);
  f.db.prepare('INSERT INTO celebrations_directory_person_celebrations(person_id,celebration_id) VALUES(?,?)')
    .run(P,42);
  assert.equal((await readPage(f,'page:42:chapelle')).status,404,
    'no cloned individual space enrollment');
 }finally{f.close()}
});
test('M011-B: public legacy gateway never reads private member keys',async()=>{
 const f=await setup();
 try{
  for(const path of ['/media/private-members/41/report.pdf',
    '/media/private-members%252F41%252Freport.pdf']){
   const result=await handleMedia(req(null,path),f.env);
   assert.equal(result.status,404);
   assert.equal(f.reads.public,0);assert.equal(f.reads.private,0);
  }
  for(const worker of ['production-worker.mjs','staging-worker.mjs']){
   const source=readFileSync(new URL('../migration/cloudflare/'+worker,import.meta.url),'utf8');
   assert.doesNotMatch(source,/private-content-read-service\.mjs|private-canonical-content\.mjs/,
     'Worker owner M011-A must not be modified by M011-B');
  }
 }finally{f.close()}
});
test('M011-B: storage errors produce generic no-cache failure without private metadata',async()=>{
 const f=await setup();
 try{
  f.approve();
  f.env.EDITOR_BUCKET={get:async()=>{throw Error('SQL_SECRET_STORAGE')}};
  let r=await readPage(f);
  assert.equal(r.status,503);await noLeak(r);
  f.env.EDITOR_BUCKET=null;
  r=await readPage(f);
  assert.equal(r.status,503);await noLeak(r);
  r=await readPage(f,ROOT,req(TOKEN,'/private','POST'));
  assert.equal(r.status,405);
  assert.equal(f.reads.private,0);
 }finally{f.close()}
});

test('M014: navigation exposes a space label only through an authorized published page, including after revocation',async()=>{
 const f=await setup();
 try{
  f.approve();
  f.state.published.drafts['41'].spaces[0].name='Espace réservé test';
  let rows=await list(f);
  assert.equal(rows.find(row=>row.id===INNER)?.spaceName,'Espace réservé test');
  assert.equal(Object.hasOwn(rows.find(row=>row.id===ROOT),'spaceName'),false);
  f.db.prepare('DELETE FROM celebrations_directory_private_space_enrollments WHERE person_id=?').run(P);
  rows=await list(f);
  assert.deepEqual(rows.map(row=>row.id),[ROOT]);
  assert.doesNotMatch(JSON.stringify(rows),/Espace réservé test|space:41:chapelle/);
  assert.equal((await readPage(f,INNER)).status,404);
  assert.deepEqual(await list(f,{},req(ADMIN)),[]);
 }finally{f.close()}
});
test('M014: authorized private content does not serialize editorial links naming forbidden managed pages or spaces',async()=>{
 const f=await setup();
 try{
  f.approve();
  f.db.prepare('DELETE FROM celebrations_directory_private_space_enrollments WHERE person_id=?').run(P);
  const root=f.state.published.drafts['41'].pages[0];
  root.blocks.push(
   {id:10,kind:'button',href:'/programme?page='+encodeURIComponent(INNER),text:'Lien page interdite'},
   {id:11,kind:'section',columns:[[{id:12,kind:'button',href:'/programme?space='+encodeURIComponent(SPACE),text:'Lien espace interdit'}]]},
   {id:13,kind:'button',href:'/programme',text:'Programme public'});
  const r=await readPage(f);
  assert.equal(r.status,200);
  const body=await r.json();
  const serialized=JSON.stringify(body);
  assert.doesNotMatch(serialized,/page:41:chapelle|space:41:chapelle|page%3A41%3Achapelle|space%3A41%3Achapelle|Lien page interdite|Lien espace interdit/);
  assert.equal(body.blocks.find(b=>b.id===13)?.href,'/programme');
 }finally{f.close()}
});

test('M014: public spaces require public page AND space policy, explicit publication and the D1 fence',async()=>{
 const f=await setup();
 try{
  const sid='space:550e8400-e29b-41d4-a716-446655440010',pid='page:550e8400-e29b-41d4-a716-446655440011';
  const denied='page:550e8400-e29b-41d4-a716-446655440012';
  const base=page(pid,{name:'Public text',spaceId:sid,accessPolicy:{mode:'PUBLIC'},blocks:[
   {kind:'text',text:'SAFE_TEXT'},{kind:'button',text:'UNVERIFIED_FILE',href:'/media/new/not-released.pdf'}
  ]});
  f.state.published.drafts['41'].spaces.push({id:sid,name:'Public space',celebrationId:'41',visibility:'PUBLIC',publicationStatus:'published',accessPolicy:{mode:'PUBLIC'},
   pages:[base,{...base,id:denied,name:'RESTRICTED_TITLE',accessPolicy:policy}]});
  f.state.published.privateSpaceReleases[sid]={spaceId:sid,celebrationId:'41',publication:'published'};
  for(const id of [pid,denied])f.state.published.privatePageReleases[id]={pageId:id,spaceId:sid,celebrationId:'41',publication:'published'};
  let spaces=await releasedPublicSpaces(f.state,'41',f.env.DB);
  assert.deepEqual(spaces.map(s=>s.id),[sid]);
  assert.deepEqual(spaces[0].pages.map(p=>p.id),[pid]);
  assert.match(JSON.stringify(spaces),/SAFE_TEXT/);
  assert.doesNotMatch(JSON.stringify(spaces),/RESTRICTED_TITLE|UNVERIFIED_FILE|not-released|Chapelle|private-members/);
  delete f.state.published.privatePageReleases[pid];
  assert.deepEqual(await releasedPublicSpaces(f.state,'41',f.env.DB),[]);
  f.state.published.privatePageReleases[pid]={pageId:pid,spaceId:sid,celebrationId:'41',publication:'published'};
  f.db.prepare('DELETE FROM celebrations_private_release_fences WHERE celebration_id=?').run(41);
  assert.deepEqual(await releasedPublicSpaces(f.state,'41',f.env.DB),[]);
 }finally{f.close()}
});

test('M015: authorized public-style text with empty href/src survives sanitized private read',async()=>{
  const f=await setup();
  try{
    f.approve();
    f.state.published.drafts['41'].pages[0].blocks=[
      {id:'sec',kind:'section',layout:'single',columns:[[
        {id:'txt',kind:'text',text:'Texte sûr conservé',href:'',src:'',align:'left'},
        {id:'unsafe',kind:'button',text:'Lien privé interdit',href:'/private/hidden'}
      ],[]]}
    ];
    const r=await readPage(f);
    assert.equal(r.status,200);
    const body=await r.json();
    assert.equal(body.blocks[0].columns[0].length,1);
    assert.equal(body.blocks[0].columns[0][0].text,'Texte sûr conservé');
    assert.equal(body.blocks[0].columns[0][0].href,undefined);
    assert.equal(body.blocks[0].columns[0][0].src,undefined);
    assert.doesNotMatch(JSON.stringify(body),/Lien privé interdit|\/private\/hidden/);
  }finally{f.close()}
});
