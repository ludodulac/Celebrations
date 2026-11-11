// Targeted final owner rules — pure M002/M003/M005 engines, no second system.
// Synthetic Gabriel: 1 celebration × 2 categories × 3 manually written languages.
import test from 'node:test';
import assert from 'node:assert/strict';
import {canAccessPage,ACCESS_MODES,SPACE_VISIBILITIES} from '../migration/cloudflare/app/domain/member-access.mjs';
import {createCelebrationSpace,addSpaceToCelebration} from '../migration/cloudflare/app/domain/celebration-spaces.mjs';
import {createLanguageRegistry,addLanguage,setLanguageActive,setPageTranslation,
 resolvePageTranslation} from '../migration/cloudflare/app/domain/editor-localization.mjs';
import {readFileSync} from 'node:fs';

const types=[{id:'member-type:cat1',name:'Catégorie 1',disabled:false},
 {id:'member-type:cat2',name:'Catégorie 2',disabled:false}];
const member=id=>({id,authenticated:true});
const context=(id,type,registered=true)=>({
 principal:member(id),types,memberships:type?[{memberId:id,typeId:type}]:[],
 celebrationEnrolled:registered,enrollments:[]
});
let languages=addLanguage(createLanguageRegistry(),{id:'en',name:'English',active:false});
languages=addLanguage(languages,{id:'es',name:'Español',active:false});
languages=setLanguageActive(setLanguageActive(languages,'en',true),'es',true);
const variants=(id,type)=>['fr','en','es'].reduce((p,lang)=>{
 const text={fr:'Texte français',en:'Written English',es:'Texto español'}[lang];
 return lang==='fr'?p:setPageTranslation(p,languages,lang,{
  name:lang+' '+type,blocks:[{kind:'text',text:text+' '+type}]
 });
},{id:'page:'+id,celebrationId:'41',spaceId:'space:'+type,group:'celebration',
 name:'Français '+type,visibility:'published',publicationStatus:'published',
 accessPolicy:{mode:ACCESS_MODES.PUBLIC},blocks:[{kind:'text',text:'Texte français '+type}]});
test('M018: Gabriel remains ONE celebration with six manually edited category/language variants',()=>{
 let gabriel={id:'41',archangel:'Gabriel',spaces:[],pages:[]};
 for(const cat of types){
  const type=cat.id.slice('member-type:'.length);
  const space=createCelebrationSpace({id:'space:'+type,celebrationId:'41',
   name:cat.name,visibility:SPACE_VISIBILITIES.PRIVATE,accessScope:'CELEBRATION',
   accessPolicy:{mode:ACCESS_MODES.SELECTED_TYPES,typeIds:[cat.id]},
   pages:[variants(type,type)]});
  gabriel=addSpaceToCelebration(gabriel,space);
 }
 assert.equal(gabriel.id,'41');
 assert.equal(gabriel.spaces.length,2);
 assert.equal(gabriel.spaces.reduce((n,s)=>n+s.pages.length,0),2);
 const all=[];
 for(const space of gabriel.spaces)for(const lang of ['fr','en','es']){
  const page=space.pages[0],resolved=resolvePageTranslation(page,languages,lang);
  assert.equal(resolved.languageId,lang);
  assert.ok(resolved.content.blocks[0].text);
  all.push([space.id,lang,resolved.content.blocks[0].text]);
 }
 assert.equal(all.length,6);
 assert.equal(new Set(all.map(x=>x[2])).size,6);
});
test('M018: only explicit celebration enrollment AND matching category can read private variants',()=>{
 const one={id:'page:cat1',celebrationId:'41',spaceId:'space:cat1',
  accessPolicy:{mode:ACCESS_MODES.PUBLIC}};
 const space={id:'space:cat1',celebrationId:'41',visibility:'PRIVATE',accessScope:'CELEBRATION',
  accessPolicy:{mode:ACCESS_MODES.SELECTED_TYPES,typeIds:['member-type:cat1']}};
 assert.equal(canAccessPage(one,{...context('person:1','member-type:cat1'),space}),true);
 assert.equal(canAccessPage(one,{...context('person:2','member-type:cat2'),space}),false);
 assert.equal(canAccessPage(one,{...context('person:1','member-type:cat1',false),space}),false);
 assert.equal(canAccessPage(one,{...context('person:anon',null),space}),false);
 assert.equal(canAccessPage({...one,accessPolicy:{mode:ACCESS_MODES.SELECTED_TYPES,typeIds:['member-type:cat2']}},
  {...context('person:1','member-type:cat1'),space}),false);
});
test('M018: historical invited spaces keep their individual enrollment guard',()=>{
 const s={id:'space:historic',celebrationId:'41',visibility:'PRIVATE',
  accessPolicy:{mode:ACCESS_MODES.PUBLIC}};
 const p={id:'page:old',celebrationId:'41',spaceId:s.id,accessPolicy:{mode:ACCESS_MODES.PUBLIC}};
 assert.equal(canAccessPage(p,{...context('person:1','member-type:cat1'),space:s}),false);
 assert.equal(canAccessPage(p,{...context('person:1','member-type:cat1'),
  enrollments:[{memberId:'person:1',spaceId:s.id}],space:s}),true);
});
test('M018: public Michaël pages need no member login or category',()=>{
 const michael={id:'mercredi-101',celebrationId:'101',accessPolicy:{mode:ACCESS_MODES.PUBLIC}};
 assert.equal(canAccessPage(michael,{}),true);
});
test('M018: administration asks language NAME only and existing visitor has login on every page',()=>{
 const editor=readFileSync(new URL('../migration/cloudflare/editor-demo-client.mjs',import.meta.url),'utf8');
 const page=readFileSync(new URL('../migration/cloudflare/editor-trial-site-page.mjs',import.meta.url),'utf8');
 const client=readFileSync(new URL('../migration/cloudflare/editor-trial-site-client.mjs',import.meta.url),'utf8');
 assert.match(editor,/Nom de la nouvelle langue/);
 assert.doesNotMatch(editor,/Code de la nouvelle langue/);
 assert.match(editor,/A new language begins with no French blocks/);
 assert.match(page,/id="member-connection"/);
 assert.match(client,/space-pages\?celebration=all/);
 assert.match(client,/participant_login_derived/);
 assert.doesNotMatch(page,/paiement|demande d.accès/i);
});
