import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {createPageModel} from '../migration/cloudflare/app/domain/editor-pages.mjs';
import {createLanguageRegistry,addLanguage,setPageTranslation} from '../migration/cloudflare/app/domain/editor-localization.mjs';

function extract(from,to) {
 const find=name=>new RegExp('(?:async )?function '+name+'\\(').exec(DEMO_CLIENT);
 const start=find(from),end=find(to);
 assert.ok(start&&end&&end.index>start.index);
 return DEMO_CLIENT.slice(start.index,end.index);
}
function baseContext(page){
 const ctx={
  IS_STAGE:true,privateEdit:null,preview:false,dirty:false,STAGE_SEED:{celebrationId:'101'},
  db:{pages:[page]},editorPageModel:createPageModel(),
  editorLocalization:{registry:createLanguageRegistry(),pages:{}},
  clone:structuredClone,crypto:{randomUUID:()=> '7ed9ec75-7e77-44d2-9f17-911100007001'},
  save(){},mark(){},render(){},serverSave(){return true},
  clearLocaleView(){},selectedBlockId:null,id:page.id,tab:'pages',editingLanguageId:'fr',
  status:{textContent:''},alert(){throw Error('unexpected alert')},confirm(){return true},
  canonicalPage(){return this.db.pages[0]}
 };
 return ctx;
}
test('M018-C retains the editor shell and adds compact admin navigation',()=>{
 new vm.Script(DEMO_CLIENT);
 const html=readFileSync(new URL('../migration/cloudflare/editor-demo-preparation-page.mjs',import.meta.url),'utf8');
 assert.match(html,/data-tab="pages"/);
 assert.match(html,/data-tab="celebrations"/);
 assert.match(html,/data-tab="members-spaces"/);
 assert.doesNotMatch(html,/data-tab="participants"/);
 assert.match(html,/data-tab="languages-categories"/);
 assert.ok(DEMO_CLIENT.includes('function m018LanguagesCategories('));
 assert.ok(DEMO_CLIENT.includes('renameLanguage(editorLocalization.registry'));
 assert.ok(DEMO_CLIENT.includes('setLanguageActive(editorLocalization.registry'));
});
test('M018-C duplicate page keeps blocks and language content, not private rights',()=>{
 const original={id:'neutral-original',group:'page',name:'Accueil',
  visibility:'published',accessPolicy:{mode:'SELECTED_TYPES',typeIds:['member-type:a']},
  enrollments:['person-1'],participantIds:['person-1'],blocks:[{id:1,kind:'text',text:'Bonjour'}]};
 const ctx=baseContext(original);
 ctx.editorLocalization.pages[original.id]={en:{name:'Welcome',blocks:[{id:4,kind:'text',text:'Hello'}]}};
 vm.runInNewContext(extract('m018DuplicatePage','m018CopyContentVersion')+';this.copyPage=m018DuplicatePage;',ctx);
 ctx.copyPage(original);
 assert.equal(ctx.db.pages.length,2);
 const copy=ctx.db.pages[1];
 assert.equal(copy.visibility,'draft');
 assert.equal(copy.group,'page');
 assert.deepEqual(JSON.parse(JSON.stringify(copy.blocks)),original.blocks);
 assert.equal(Object.hasOwn(copy,'accessPolicy'),false);
 assert.equal(Object.hasOwn(copy,'enrollments'),false);
 assert.equal(Object.hasOwn(copy,'participantIds'),false);
 assert.ok(ctx.editorLocalization.pages[copy.id].en);
 assert.ok(ctx.editorLocalization.pages[original.id].en);
});
test('M018-C language variant duplication only carries authored content',()=>{
 const original={id:'neutral-original',group:'page',name:'Accueil',
  blocks:[{id:1,kind:'text',text:'Bonjour'}],
  accessPolicy:{mode:'SELECTED_TYPES',typeIds:['member-type:admin']}};
 const ctx=baseContext(original);
 ctx.editorLocalization.registry=addLanguage(ctx.editorLocalization.registry,
  {id:'en',name:'English'});
 ctx.canonicalPage=()=>original;
 ctx.setPageTranslation=setPageTranslation;
 vm.runInNewContext(extract('m018CopyContentVersion','pages')+';this.copyVersion=m018CopyContentVersion;',ctx);
 ctx.copyVersion('en');
 const content=ctx.editorLocalization.pages[original.id].en;
 assert.equal(content.name,'Accueil');
 assert.deepEqual(JSON.parse(JSON.stringify(content.blocks)),original.blocks);
 assert.equal(Object.hasOwn(content,'accessPolicy'),false);
 assert.equal(Object.hasOwn(content,'participantIds'),false);
 assert.equal(ctx.db.pages.length,1,'no second celebration or page');
});
test('M018-C private access is delegated to existing guarded member editor',()=>{
 assert.ok(DEMO_CLIENT.includes("editAccess('page',p)"));
 assert.ok(DEMO_CLIENT.includes('M012B.mount(memberPanelRoot'));
 assert.ok(!DEMO_CLIENT.includes("localStorage.setItem('celebrations-members-grants'"));
});

test('M019 empty canonical page list has no active page slug and keeps admin navigation usable',()=>{
 assert.equal(createPageModel().pageSlug(undefined,'90000002'),'');
 new vm.Script(DEMO_CLIENT);
});
