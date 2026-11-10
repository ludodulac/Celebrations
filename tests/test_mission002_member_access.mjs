import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 ACCESS_MODES, SPACE_VISIBILITIES, isMemberTypeId,
 createMemberType, renameMemberType, assignMemberTypes, enrollInSpace,
 canAccessPolicy, canAccessSpace, canAccessPage
} from '../migration/cloudflare/app/domain/member-access.mjs';

const TYPE_A='member-type:1a8f0';
const TYPE_B='member-type:2b9e1';
const TYPE_C='member-type:3c7a2';
const MEMBER='person-001';
const C='celebration-001';
const S='space-001';
const types=[createMemberType({id:TYPE_A,name:'Première catégorie'}),
 createMemberType({id:TYPE_B,name:'Deuxième catégorie'}),
 createMemberType({id:TYPE_C,name:'Troisième catégorie'})];
const memberships=assignMemberTypes(MEMBER,[TYPE_A,TYPE_B],types);
const principal={id:MEMBER,authenticated:true};
const enrolled=[enrollInSpace(MEMBER,S)];
const context={principal,types,memberships,enrollments:enrolled};
const policy=(mode,typeIds)=>typeIds===undefined?{mode}:{mode,typeIds};
const page=(accessPolicy,spaceId)=>({id:'page-001',celebrationId:C,
 ...(accessPolicy===undefined?{}:{accessPolicy}),
 ...(spaceId===undefined?{}:{spaceId})});
const space=(visibility,accessPolicy=policy(ACCESS_MODES.PUBLIC))=>({
 id:S,celebrationId:C,visibility,accessPolicy
});
const roundTrip=o=>JSON.parse(JSON.stringify(o));

test('M002: immutable type identity, mutable label and historic group separation',()=>{
 assert.deepEqual(createMemberType({id:TYPE_A,name:'  Nouveau nom  '}),
  {id:TYPE_A,name:'Nouveau nom'});
 const renamed=renameMemberType({...types[0],sort_order:4},'Nom changé');
 assert.equal(renamed.id,TYPE_A);assert.equal(renamed.name,'Nom changé');
 assert.equal(renamed.sort_order,4);
 assert.equal(types[0].name,'Première catégorie','original cannot mutate');
 for(const historicalId of ['all','angel','nonangel',null,'']) {
  assert.equal(isMemberTypeId(historicalId),false);
  assert.throws(()=>createMemberType({id:historicalId,name:'Nouveau nom'}),TypeError);
 }
 assert.throws(()=>createMemberType({id:TYPE_A,name:'   '}),TypeError);
 assert.throws(()=>createMemberType({id:TYPE_A,name:'x'.repeat(121)}),TypeError);
});

test('M002: multiple type assignments use stable IDs, not display names',()=>{
 assert.deepEqual(memberships,[{memberId:MEMBER,typeId:TYPE_A},
  {memberId:MEMBER,typeId:TYPE_B}]);
 assert.deepEqual(assignMemberTypes(MEMBER,[TYPE_A,TYPE_B,TYPE_A],types),memberships);
 const renamed=types.map(t=>t.id===TYPE_A?renameMemberType(t,'Renommé'):t);
 assert.deepEqual(assignMemberTypes(MEMBER,[TYPE_A,TYPE_B],renamed),memberships);
 assert.throws(()=>assignMemberTypes(MEMBER,['angel'],types),TypeError);
 assert.throws(()=>assignMemberTypes(MEMBER,['member-type:unknown'],types),TypeError);
});

test('M002: PUBLIC does not require a login, including the legacy page shape',()=>{
 const anonymous={};
 assert.equal(canAccessPolicy(policy(ACCESS_MODES.PUBLIC),anonymous),true);
 assert.equal(canAccessPage({id:'neutral-accueil-general',group:'page',
  visibility:'published',blocks:[]},anonymous),true);
 assert.equal(canAccessPage({id:'preparation-101',group:'celebration',
  blocks:[]},anonymous),true);
 assert.equal(canAccessPage(page(policy(ACCESS_MODES.PUBLIC)),anonymous),true);
});

test('M002: ALL_PRIVATE_TYPES needs verified login and at least one current type',()=>{
 const gate=policy(ACCESS_MODES.ALL_PRIVATE_TYPES);
 assert.equal(canAccessPolicy(gate,context),true);
 assert.equal(canAccessPolicy(gate,{}),false);
 assert.equal(canAccessPolicy(gate,{...context,principal:{id:MEMBER}}),false);
 assert.equal(canAccessPolicy(gate,{...context,memberships:[]}),false);
 assert.equal(canAccessPolicy(gate,{...context,types:[]}),false);
 assert.equal(canAccessPolicy(gate,{...context,types:[{...types[0],disabled:true}],
  memberships:[memberships[0]]}),false);
 assert.equal(canAccessPolicy(gate,{...context,memberships:[{memberId:'other',typeId:TYPE_A}]}),false);
});

test('M002: SELECTED_TYPES means any selected type, rejects others and malformed rules',()=>{
 const selected=policy(ACCESS_MODES.SELECTED_TYPES,[TYPE_B,TYPE_C]);
 assert.equal(canAccessPolicy(selected,context),true);
 assert.equal(canAccessPolicy(policy(ACCESS_MODES.SELECTED_TYPES,[TYPE_C]),context),false);
 assert.equal(canAccessPolicy(selected,{...context,memberships:[memberships[0]]}),false);
 assert.equal(canAccessPolicy(selected,{...context,principal:null}),false);
 for(const bad of [null,{}, {mode:'UNKNOWN'},policy(ACCESS_MODES.SELECTED_TYPES,[]),
  policy(ACCESS_MODES.SELECTED_TYPES,['angel']),
  policy(ACCESS_MODES.SELECTED_TYPES,TYPE_A)])
  assert.equal(canAccessPolicy(bad,context),false);
});

test('M002: private celebration space mandates individual enrollment in addition to any type',()=>{
 const privateSpace=space(SPACE_VISIBILITIES.PRIVATE,
  policy(ACCESS_MODES.SELECTED_TYPES,[TYPE_A]));
 assert.equal(canAccessSpace(privateSpace,{...context,enrollments:[]}),false);
 assert.equal(canAccessSpace(privateSpace,{...context,enrollments:[{memberId:'other',spaceId:S}]}),false);
 assert.equal(canAccessSpace(privateSpace,{...context,enrollments:[{memberId:MEMBER,spaceId:'other'}]}),false);
 assert.equal(canAccessSpace(privateSpace,context),true);
 assert.equal(canAccessSpace(privateSpace,{...context,principal:{id:MEMBER}}),false);
 assert.equal(canAccessSpace(privateSpace,{...context,memberships:[]}),false);
 const enrolledOnly=space(SPACE_VISIBILITIES.PRIVATE,policy(ACCESS_MODES.PUBLIC));
 assert.equal(canAccessSpace(enrolledOnly,{...context,memberships:[],types:[]}),true,
  'explicit invitation may admit a member without a type if space policy permits');
 assert.equal(canAccessSpace(enrolledOnly,{...context,principal:null}),false);
});

test('M002: page policy and space policy are cumulative, even for a PUBLIC page',()=>{
 const gated=space(SPACE_VISIBILITIES.PRIVATE,
  policy(ACCESS_MODES.SELECTED_TYPES,[TYPE_A]));
 const inside=page(policy(ACCESS_MODES.PUBLIC),S);
 assert.equal(canAccessPage(inside,{...context,space:gated}),true);
 assert.equal(canAccessPage(inside,{...context,space:gated,enrollments:[]}),false);
 assert.equal(canAccessPage(inside,{...context,space:gated,principal:null}),false);
 assert.equal(canAccessPage(page(policy(ACCESS_MODES.SELECTED_TYPES,[TYPE_C]),S),
  {...context,space:gated}),false);
 assert.equal(canAccessPage(page(policy(ACCESS_MODES.PUBLIC),S),context),false,
  'direct internal page URL cannot skip space metadata');
 assert.equal(canAccessPage(inside,{...context,space:{...gated,id:'other'}}),false);
 assert.equal(canAccessPage({...inside,celebrationId:'other'},
  {...context,space:gated}),false);
 assert.equal(canAccessPage({...inside,spaceId:null},{...context,space:gated}),false);
 assert.equal(canAccessPage(page(policy(ACCESS_MODES.PUBLIC)),{...context,space:gated}),false,
  'page without a canonical binding cannot borrow a space');
 assert.equal(canAccessPage({...inside,accessPolicy:null},{...context,space:gated}),false);
});

test('M002: public space does not weaken a restricted page',()=>{
 const publicSpace=space(SPACE_VISIBILITIES.PUBLIC);
 assert.equal(canAccessPage(page(policy(ACCESS_MODES.PUBLIC),S),
  {space:publicSpace}),true);
 assert.equal(canAccessPage(page(policy(ACCESS_MODES.ALL_PRIVATE_TYPES),S),
  {space:publicSpace}),false);
 assert.equal(canAccessPage(page(policy(ACCESS_MODES.ALL_PRIVATE_TYPES),S),
  {...context,space:publicSpace}),true);
 assert.equal(canAccessSpace(space(SPACE_VISIBILITIES.PUBLIC,
  policy(ACCESS_MODES.SELECTED_TYPES,[TYPE_A])),context),false,
  'contradictory public-space policy fails closed');
 assert.equal(canAccessSpace({...publicSpace,visibility:'UNRECOGNIZED'},context),false);
});

test('M002: changing the language never changes the authorization outcome',()=>{
 const inside=page(policy(ACCESS_MODES.SELECTED_TYPES,[TYPE_A]),S);
 const privateSpace=space(SPACE_VISIBILITIES.PRIVATE);
 const allowed=canAccessPage(inside,{...context,space:privateSpace});
 const blocked=canAccessPage(inside,{...context,space:privateSpace,enrollments:[]});
 for(const language of ['fr','en','it','es','de',null]) {
  const localized={...inside,language,translations:{[language??'default']:{title:'X'}}};
  assert.equal(canAccessPage(localized,{...context,space:privateSpace,language}),allowed);
  assert.equal(canAccessPage(localized,{...context,space:privateSpace,enrollments:[],language}),blocked);
 }
 assert.equal(allowed,true);assert.equal(blocked,false);
});

test('M002: D1/R2 export-import preserves every stable ID, label relation and decision',()=>{
 const fixture={types, memberships, enrollments:enrolled,
  pages:[page(policy(ACCESS_MODES.SELECTED_TYPES,[TYPE_A,TYPE_B]),S)],
  spaces:[space(SPACE_VISIBILITIES.PRIVATE,policy(ACCESS_MODES.ALL_PRIVATE_TYPES))]};
 const imported=roundTrip(fixture);
 assert.deepEqual(imported,fixture);
 assert.equal(imported.types[0].id,TYPE_A);
 assert.equal(imported.memberships[1].typeId,TYPE_B);
 assert.equal(imported.pages[0].id,'page-001');
 assert.equal(imported.pages[0].spaceId,S);
 assert.equal(canAccessPage(imported.pages[0],{
  principal,types:imported.types,memberships:imported.memberships,
  enrollments:imported.enrollments,space:imported.spaces[0]}),true);
 assert.equal(canAccessPage(imported.pages[0],{
  principal,types:imported.types,memberships:imported.memberships,
  enrollments:[],space:imported.spaces[0]}),false);
});

test('M002: pure module never depends on Cloudflare account, bindings or browser',()=>{
 const path=new URL('../migration/cloudflare/app/domain/member-access.mjs',import.meta.url);
 const source=readFileSync(path,'utf8');
 for(const unwanted of ['cloudflare','workers.dev','wrangler','account_id',
  'api.cloudflare.com','localStorage','document.','window.','fetch(', 'env.DB',
  'env.EDITOR_BUCKET','env.MEDIA_BUCKET', 'process.env', 'crypto.randomUUID(']) {
  // The introductory comment names Cloudflare as an absence condition;
  // inspect executable (non-comment) lines only.
  const code=source.split('\n').filter(line=>!line.trim().startsWith('//')).join('\n');
  assert.equal(code.toLowerCase().includes(unwanted.toLowerCase()),false,unwanted);
 }
 assert.equal(Object.isFrozen(ACCESS_MODES),true);
 assert.equal(Object.isFrozen(SPACE_VISIBILITIES),true);
});
