import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  createCelebrationSpace, addSpaceToCelebration, getCelebrationSpaces,
  canReadSpacePage, translateCelebrationSpace, resolveSpaceLanguage,
  duplicateCelebrationSpace, duplicateCelebration
} from '../migration/cloudflare/app/domain/celebration-spaces.mjs';
import {
  ACCESS_MODES, SPACE_VISIBILITIES, canAccessSpace, canAccessPage,
  createMemberType, assignMemberTypes, enrollInSpace
} from '../migration/cloudflare/app/domain/member-access.mjs';
import {createLanguageRegistry, addLanguage, setLanguageActive}
  from '../migration/cloudflare/app/domain/editor-localization.mjs';

const C = 'plan-michael-2027-01-20';
const C2 = 'plan-michael-2028-01-20';
const TYPE = 'member-type:alpha';
const OWNER = {id:C, archangel:'michael', date:'2027-01-20', year:'2027',
  steps:['preparation','mercredi','jeudi','vendredi','samedi','dimanche'],
  pages:[{id:'legacy-preparation',group:'celebration',name:'Préparation',
    blocks:[{kind:'audio',src:'/media/new/old-audio.mp3'}]}],
  oldConfiguration:{legacy:true}, visibility:'published'};
const page = (id, text = 'Bonjour') => ({id, group:'celebration',
  name:'Accueil', blocks:[
    {id:1,kind:'text',rich:text},
    {id:2,kind:'image',src:'/media/new/old-photo.jpg'},
    {id:3,kind:'pdf',href:'/letter/livret.pdf'},
    {id:4,kind:'audio',src:'/media/new/chant.mp3'},
    {id:5,kind:'video',src:'https://video.example/stream'},
    {id:6,kind:'button',text:'Suite',href:'/chemin-etape',targetPageId:'second-page'}
  ],documents:[{url:'/letter/livret.pdf'}],
  links:[{href:'https://example.org'}],
  media:[{key:'existing-r2-object',src:'/media/new/old-photo.jpg'}],
  presentation:{columns:2,mobile:'stack'}, visibility:'published'});
const privateSpace = (id = 'space-main') => createCelebrationSpace({
  id, celebrationId:C, name:'Espace préparatoire',
  visibility:SPACE_VISIBILITIES.PRIVATE,
  accessPolicy:{mode:ACCESS_MODES.SELECTED_TYPES,typeIds:[TYPE]},
  pages:[page('first-page'),page('second-page','Étape suivante')]
});
const publicSpace = id => createCelebrationSpace({id,celebrationId:C,
  visibility:SPACE_VISIBILITIES.PUBLIC,
  accessPolicy:{mode:ACCESS_MODES.PUBLIC}, pages:[page('page-'+id)]});
const auth = (spaceId='space-main') => {
  const types=[createMemberType({id:TYPE,name:'Catégorie personnalisable'})];
  return {principal:{id:'member-01',authenticated:true},types,
    memberships:assignMemberTypes('member-01',[TYPE],types),
    enrollments:[enrollInSpace('member-01',spaceId)]};
};
const roundTrip = data => JSON.parse(JSON.stringify(data));

test('M005/01: creating a space binds its pages to an existing celebration',()=>{
  const space=privateSpace();
  assert.equal(space.id,'space-main');
  assert.equal(space.celebrationId,C);
  assert.equal(space.pages[0].spaceId,space.id);
  assert.equal(space.pages[0].celebrationId,C);
  assert.equal(space.visibility,'PRIVATE');
  assert.deepEqual(space.accessPolicy.typeIds,[TYPE]);
  assert.equal(space.pages[0].blocks[1].src,'/media/new/old-photo.jpg');
  assert.equal(createCelebrationSpace({id:'invited',celebrationId:C}).visibility,'PRIVATE');
});

test('M005/02: several independent spaces may share one celebration ID',()=>{
  const original=addSpaceToCelebration(OWNER,privateSpace());
  const next=addSpaceToCelebration(original,publicSpace('space-public'));
  assert.equal(getCelebrationSpaces(next).length,2);
  assert.deepEqual(getCelebrationSpaces(next).map(s=>s.celebrationId),[C,C]);
  assert.equal(OWNER.spaces,undefined);
  assert.equal(original.spaces.length,1);
  const detached=getCelebrationSpaces(next);
  detached[0].pages[0].blocks[0].rich='BAD';
  assert.equal(next.spaces[0].pages[0].blocks[0].rich,'Bonjour');
});

test('M005/03: the parent stays a single original celebration with intact dates/stages',()=>{
  const result=addSpaceToCelebration(OWNER,privateSpace());
  assert.equal(result.id,C);
  assert.equal(result.date,OWNER.date);
  assert.deepEqual(result.steps,OWNER.steps);
  assert.deepEqual(result.pages,OWNER.pages);
  assert.equal(result.spaces[0].celebrationId,result.id);
  assert.equal(result.oldConfiguration.legacy,true);
  assert.equal(result.celebrations,undefined);
});

test('M005/04: complete duplication keeps nested blocks, texts, links and presentations',()=>{
  const original=privateSpace();
  const copy=duplicateCelebrationSpace(original,{
    id:'space-next',pageIds:{'first-page':'first-copy','second-page':'second-copy'}
  });
  assert.equal(copy.name,original.name);
  assert.deepEqual(copy.pages[0].documents,original.pages[0].documents);
  assert.deepEqual(copy.pages[0].links,original.pages[0].links);
  assert.deepEqual(copy.pages[0].presentation,original.pages[0].presentation);
  assert.deepEqual(copy.pages[0].blocks.slice(0,5),original.pages[0].blocks.slice(0,5));
  assert.equal(copy.pages[0].blocks[5].targetPageId,'second-copy');
  assert.equal(copy.pages[0].blocks[5].href,'/chemin-etape');
});

test('M005/05: all new space and page IDs are distinct and colliding IDs fail',()=>{
  const original=privateSpace();
  const copied=duplicateCelebrationSpace(original,{
    id:'space-next',pageIds:{'first-page':'first-copy','second-page':'second-copy'}
  });
  assert.notEqual(copied.id,original.id);
  assert.deepEqual(copied.pages.map(p=>p.id),['first-copy','second-copy']);
  assert.throws(()=>duplicateCelebrationSpace(original,{id:original.id,pageIds:{
    'first-page':'first-copy','second-page':'second-copy'}}),/Distinct/);
  assert.throws(()=>duplicateCelebrationSpace(original,{id:'new'}),/Missing/);
  assert.throws(()=>duplicateCelebrationSpace(original,{id:'new',pageIds:{
    'first-page':'same','second-page':'same'}}),/Distinct/);
  assert.throws(()=>duplicateCelebrationSpace(original,{id:'new',pageIds:{
    'first-page':'first-copy','second-page':'second-copy'},
    reservedPageIds:['first-copy']}),/Distinct/);
  assert.throws(()=>addSpaceToCelebration(addSpaceToCelebration(OWNER,original),original),/already exists/);
});

test('M005/06: R2 media references are reused, not copied or renamed',()=>{
  const result=duplicateCelebrationSpace(privateSpace(),{id:'space-clone',
    pageIds:{'first-page':'f2','second-page':'s2'}});
  const blocks=result.pages[0].blocks;
  assert.deepEqual(blocks.map(b=>b.src||b.href||b.rich),[
    'Bonjour','/media/new/old-photo.jpg','/letter/livret.pdf',
    '/media/new/chant.mp3','https://video.example/stream','/chemin-etape'
  ]);
  assert.equal(result.pages[0].media[0].key,'existing-r2-object');
});

test('M005/07: original and copy share no mutable nested objects',()=>{
  const original=privateSpace();
  const copied=duplicateCelebrationSpace(original,{id:'space-clone',
    pageIds:{'first-page':'f2','second-page':'s2'}});
  copied.pages[0].blocks[0].rich='VERSION 2';
  copied.pages[0].documents[0].url='/letter/changed.pdf';
  copied.accessPolicy.typeIds.push('member-type:new');
  copied.pages[0].presentation.columns=4;
  assert.equal(original.pages[0].blocks[0].rich,'Bonjour');
  assert.equal(original.pages[0].documents[0].url,'/letter/livret.pdf');
  assert.deepEqual(original.accessPolicy.typeIds,[TYPE]);
  assert.equal(original.pages[0].presentation.columns,2);
});

test('M005/08: never duplicate individual enrollments or member assignments',()=>{
  const original=privateSpace();
  original.enrollments=[{memberId:'member-01',spaceId:original.id}];
  original.memberTypeAssignments=[{memberId:'member-01',typeId:TYPE}];
  original.pages[0].memberships=[{memberId:'member-01',typeId:TYPE}];
  const copy=duplicateCelebrationSpace(original,{id:'space-clone',
    pageIds:{'first-page':'f2','second-page':'s2'}});
  assert.equal(copy.enrollments,undefined);
  assert.equal(copy.memberTypeAssignments,undefined);
  assert.equal(copy.pages[0].memberships,undefined);
  assert.equal(canAccessSpace(copy,auth()),false);
  assert.equal(canAccessSpace(copy,auth('space-clone')),true);
  const celebration={...OWNER, enrollments:[{memberId:'member-01',spaceId:'space-main'}],
    spaces:[original]};
  const cloned=duplicateCelebration(celebration,{
    id:C2,spaceIds:{'space-main':'space-moved'},
    pageIds:{'legacy-preparation':'legacy-new','first-page':'f3','second-page':'s3'}
  });
  assert.equal(cloned.enrollments,undefined);
  assert.equal(cloned.spaces[0].enrollments,undefined);
});

test('M005/09: a copy is draft and PRIVATE cannot accidentally become PUBLIC',()=>{
  const source=privateSpace();
  source.publicationStatus='published';
  source.published=true;
  source.publishedSnapshot={id:source.id};
  const duplicated=duplicateCelebrationSpace(source,{
    id:'space-clone',pageIds:{'first-page':'f2','second-page':'s2'}
  });
  assert.equal(duplicated.visibility,'PRIVATE');
  assert.equal(duplicated.publicationStatus,'draft');
  assert.equal(duplicated.published,false);
  assert.equal(duplicated.publishedSnapshot,undefined);
  assert.deepEqual(duplicated.pages.map(p=>p.visibility),['draft','draft']);
  const publicCopied=duplicateCelebrationSpace(publicSpace('public-a'),{
    id:'public-b',pageIds:{'page-public-a':'page-public-b'}
  });
  assert.equal(publicCopied.visibility,'PUBLIC');
  assert.equal(publicCopied.publicationStatus,'draft');
  assert.equal(publicCopied.pages[0].visibility,'draft');
});

test('M005/10: M003 language variants stay on the same space and never grant access',()=>{
  const reg=setLanguageActive(addLanguage(createLanguageRegistry(),
    {id:'en',name:'English'}),'en',true);
  const base=privateSpace();
  const localized=translateCelebrationSpace(base,reg,'en',{
    name:'Members area',blocks:[{kind:'text',rich:'Welcome'}],
    media:[{src:'/media/new/old-photo.jpg'}]});
  assert.equal(localized.id,base.id);
  assert.equal(localized.celebrationId,base.celebrationId);
  assert.deepEqual(localized.accessPolicy,base.accessPolicy);
  assert.equal(resolveSpaceLanguage(localized,reg,'en').content.name,'Members area');
  assert.equal(resolveSpaceLanguage(localized,reg,'fr').content.name,base.name);
  assert.throws(()=>translateCelebrationSpace(base,reg,'en',{
    name:'BAD',visibility:'PUBLIC',blocks:[]}),/éditoriaux/);
  const celebration=addSpaceToCelebration(OWNER,localized);
  for(const language of ['fr','en','es']){
    assert.equal(canReadSpacePage(celebration,'space-main','first-page',
      {...auth(),language}),true);
    assert.equal(canReadSpacePage(celebration,'space-main','first-page',
      {...auth(),enrollments:[],language}),false);
  }
  const doubled=duplicateCelebrationSpace(localized,{id:'space-copy',
    pageIds:{'first-page':'f2','second-page':'s2'}});
  assert.equal(doubled.translations.en.name,'Members area');
  doubled.translations.en.name='Modified translation';
  assert.equal(localized.translations.en.name,'Members area');
});

test('M005/11: legacy celebrations remain readable and are never rewritten',()=>{
  const before=JSON.stringify(OWNER);
  const next=addSpaceToCelebration(OWNER,privateSpace());
  assert.equal(JSON.stringify(OWNER),before);
  assert.deepEqual(next.pages,OWNER.pages);
  assert.equal(canAccessPage(OWNER.pages[0],{}),true);
  const oldClone=duplicateCelebration(OWNER,{id:C2,
    pageIds:{'legacy-preparation':'legacy-copy'}});
  assert.equal(oldClone.id,C2);
  assert.equal(oldClone.date,OWNER.date);
  assert.deepEqual(oldClone.steps,OWNER.steps);
  assert.deepEqual(oldClone.oldConfiguration,OWNER.oldConfiguration);
  assert.deepEqual(oldClone.spaces,[]);
  assert.equal(oldClone.pages[0].id,'legacy-copy');
  assert.equal(oldClone.pages[0].visibility,'draft');
  assert.equal(OWNER.visibility,'published');
});

test('M005/12: complete celebration copy is portable across Cloudflare accounts',()=>{
  const original=addSpaceToCelebration(OWNER,privateSpace());
  const result=duplicateCelebration(original,{
    id:C2,spaceIds:{'space-main':'new-space'},
    pageIds:{'legacy-preparation':'new-legacy','first-page':'new-first',
      'second-page':'new-second'}
  });
  const imported=roundTrip(result);
  assert.deepEqual(imported,result);
  assert.equal(imported.id,C2);
  assert.equal(imported.visibility,'draft');
  assert.equal(imported.spaces[0].celebrationId,C2);
  assert.equal(imported.spaces[0].pages[0].celebrationId,C2);
  assert.equal(imported.spaces[0].pages[0].spaceId,'new-space');
  assert.equal(imported.spaces[0].accessPolicy.typeIds[0],TYPE);
  assert.equal(canReadSpacePage(imported,'new-space','new-first',auth()),false);
  assert.equal(canReadSpacePage(imported,'new-space','new-first',auth('new-space')),true);
  const source=readFileSync(new URL('../migration/cloudflare/app/domain/celebration-spaces.mjs',
    import.meta.url),'utf8');
  for(const forbidden of ['fetch(', 'env.DB', 'env.R2', 'R2Bucket', 'D1Database',
    'localStorage', 'document.', 'window.', 'api.cloudflare.com',
    'wrangler', 'account_id', 'crypto.randomUUID(', 'serverPublish('])
    assert.equal(source.includes(forbidden),false,forbidden);
});

test('M005 security: invalid policies, detached pages and cross-celebration IDs fail closed',()=>{
  assert.throws(()=>createCelebrationSpace({id:'bad',celebrationId:C,
    visibility:'PUBLIC',accessPolicy:{mode:'SELECTED_TYPES',typeIds:[TYPE]}}),TypeError);
  assert.throws(()=>createCelebrationSpace({id:'bad',celebrationId:C,
    visibility:'PRIVATE',accessPolicy:{mode:'SELECTED_TYPES',typeIds:['angel']}}),TypeError);
  assert.throws(()=>createCelebrationSpace({id:'bad',celebrationId:C,
    pages:[{...page('orphan'),celebrationId:'other-celebration'}]}),TypeError);
  assert.throws(()=>addSpaceToCelebration(OWNER,createCelebrationSpace({
    id:'wrong',celebrationId:'other-celebration'})),TypeError);
  const original=addSpaceToCelebration(OWNER,privateSpace());
  assert.equal(canReadSpacePage(original,'space-main','first-page',
    {...auth(),enrollments:[]}),false);
  assert.equal(canReadSpacePage(original,'space-main','other',auth()),false);
  assert.equal(canReadSpacePage(original,'bogus','first-page',auth()),false);
  assert.equal(canReadSpacePage(original,'space-main','first-page',{
    ...auth(),principal:{id:'member-01',authenticated:false}}),false);
});

test('M005 security: cannot reuse page IDs across siblings or duplicate with missing maps',()=>{
  const a=addSpaceToCelebration(OWNER,privateSpace());
  assert.throws(()=>addSpaceToCelebration(a,createCelebrationSpace({id:'new',
    celebrationId:C,pages:[page('first-page')]})),/already exists/);
  assert.throws(()=>duplicateCelebration(a,{id:C2,spaceIds:{'space-main':'next'},
    pageIds:{'first-page':'first-copy','second-page':'second-copy'}}),/Missing/);
  assert.throws(()=>duplicateCelebration(a,{id:C2,spaceIds:{'space-main':'space-main'},
    pageIds:{'legacy-preparation':'legacy-copy','first-page':'first-copy',
      'second-page':'second-copy'}}),/Distinct/);
});
