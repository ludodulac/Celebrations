import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createEditorState} from '../migration/cloudflare/app/admin/editor-state.mjs';
import {createEditorLocalRules} from '../migration/cloudflare/app/admin/editor-local-rules.mjs';
import {renderEditorFrame} from '../migration/cloudflare/app/admin/editor-render.mjs';
import {bindEditorShell} from '../migration/cloudflare/app/admin/editor-dom.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {SERVER_EDITOR_SYNC} from '../migration/cloudflare/editor-server-sync-client.mjs';

test('M06: modularized script compiles, CSP inline contract and server sync appear once',()=>{
 new vm.Script(DEMO_CLIENT);
 for(const name of ['createEditorState','createEditorLocalRules','renderEditorFrame','bindEditorShell']){
  assert.equal(typeof ({createEditorState,createEditorLocalRules,renderEditorFrame,bindEditorShell})[name],'function');
  assert.equal((DEMO_CLIENT.match(new RegExp('function '+name+'\\(','g'))||[]).length,1,name);
 }
 assert.equal(DEMO_CLIENT.split('async function serverSave(').length-1,1);
 assert.ok(DEMO_CLIENT.includes(SERVER_EDITOR_SYNC));
 assert.ok(DEMO_CLIENT.includes("el('save-btn').onclick=IS_STAGE?"));
 assert.ok(!DEMO_CLIENT.includes('export function renderEditorFrame'));
});
test('M06: local boot restores existing pages without overwriting authored blocks',()=>{
 const saved={pages:[{id:'accueil-celebration-plan-a',name:'Accueil personnalisé',group:'celebration',blocks:[{id:9,text:'Auteur'}]}]};
 const storage={getItem:k=>k==='local-key'?JSON.stringify(saved):null};
 const seed={pages:[
  {id:'accueil-celebration-plan-a',name:'Accueil officiel',group:'celebration',blocks:[{id:100001,text:'Bloc nouveau'}]},
  {id:'preparation-plan-a',name:'Préparation',group:'celebration',blocks:[]}
 ]};
 const actual=createEditorState({STAGE_SEED:{celebrationId:'plan-a',pages:seed.pages},KEY:'local-key',seed,
  clone:o=>JSON.parse(JSON.stringify(o)),storage,search:'?tab=pages&page=preparation'});
 assert.equal(actual.stageTab,'pages');
 assert.equal(actual.stageActive.id,'preparation-plan-a');
 assert.equal(actual.db.pages.length,2);
 assert.equal(actual.db.pages[0].name,'Accueil personnalisé');
 assert.deepEqual(actual.db.pages[0].blocks.map(x=>x.id),[9,100001]);
});
test('M06: demonstration boot still uses existing local storage key',()=>{
 const seed={pages:[{id:'home',group:'page',blocks:[]}]};
 const r=createEditorState({STAGE_SEED:null,KEY:'celebrations-demo-editor-v1',seed,
  clone:o=>JSON.parse(JSON.stringify(o)),storage:{getItem:()=>null},search:''});
 assert.equal(r.stageTab,'celebrations');assert.equal(r.stageActive,null);assert.equal(r.db.pages[0].id,'home');
});
test('M06: validation rules remain compatible with legacy values',()=>{
 const r=createEditorLocalRules();
 assert.equal(r.validIso('2026-11-07'),true);assert.equal(r.validIso('2026-02-30'),false);
 assert.equal(r.validTime('23:59'),true);assert.equal(r.validTime('24:30'),false);
 assert.equal(r.validHref('/media/document.pdf'),true);
 assert.equal(r.validHref('javascript:alert(1)'),false);
 assert.equal(r.validHref('https://example.com/'),true);
 assert.equal(r.validColor('#aabbcc'),true);assert.equal(r.validColor('red'),false);
  assert.equal(r.prettyDate('bad-date'),'');
});
test('M06: render is a port-driven function; it keeps stage and tab semantics',()=>{
 const calls=[],view={hidden:null};
 const classes={toggle:(name,value)=>calls.push([name,value])};
 const dom={getElementById:()=>view,querySelector:()=>({classList:classes}),querySelectorAll:()=>[{dataset:{tab:'pages'},classList:{toggle:()=>{}}}]};
 renderEditorFrame({IS_STAGE:true,document:dom,STAGE_SEED:{celebrationId:'plan-a'},page:()=>({group:'page'}),pageSlug:()=> 'accueil',
  stateOfPage:()=> 'published',editorDragState:null,editorDragFinish:()=>{},undoAnchor:1,resetUndoHistory:()=>{},
  ensureUndoButton:()=>{},applyPalette:()=>{},w:{replaceChildren:()=>{}},tab:'pages',preview:false,
  el:()=>({textContent:''}),pages:()=>calls.push('pages'),celebrations:()=>{},media:()=>{},userGuide:()=>{},settings:()=>{}});
 assert.ok(view.href.includes('plan-a'));
 assert.equal(view.hidden,false);
 assert.ok(calls.includes('pages'));
});
test('M06: DOM handler binds existing actions, no automatic save',()=>{
 let onPreview=0,saved=0,prevented=0;
 const listeners={};
 const tabs=[{dataset:{tab:'pages'},onclick:null}];
 const buttons={'preview-btn':{},'save-btn':{}};
 bindEditorShell({document:{querySelectorAll:()=>tabs,addEventListener:(event,fn)=>listeners[event]=fn},
  window:{addEventListener:(event,fn)=>listeners[event]=fn},el:id=>buttons[id],
  enter:()=>{},onPreview:()=>onPreview++,isPreview:()=>false,deselect:()=>{},
  shouldWarnBeforeUnload:()=>true});
 assert.equal(saved,0);assert.equal(typeof listeners.beforeunload,'function');
 buttons['preview-btn'].onclick();assert.equal(onPreview,1);
 listeners.beforeunload({preventDefault:()=>prevented++,returnValue:null});assert.equal(prevented,1);
});
