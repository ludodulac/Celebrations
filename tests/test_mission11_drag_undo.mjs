import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {readFileSync} from 'node:fs';
import {createEditorDragModel} from '../migration/cloudflare/app/domain/editor-drag-model.mjs';
import {createEditorUndoPolicy} from '../migration/cloudflare/app/application/editor-undo-policy.mjs';
import {createBlockModel} from '../migration/cloudflare/app/domain/editor-block-model.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {SERVER_EDITOR_SYNC} from '../migration/cloudflare/editor-server-sync-client.mjs';

const drag=createEditorDragModel({createSection:createBlockModel().createSection});
const history=createEditorUndoPolicy({steps:36,bytes:6000000});
const copy=o=>JSON.parse(JSON.stringify(o));
const pageFixture=()=>{
 const title={id:'heading',kind:'heading',rich:'<strong>Le titre</strong>',text:'Titre',hideOnSite:true};
 const image={id:'picture',kind:'image',src:'/media/photo.jpg',widthPct:53,
  extra:{future:'préservé'}};
 const video={id:'clip',kind:'video',href:'https://youtu.be/dQw4w9WgXcQ',
  cover:'/media/couv.png',text:'La vidéo'};
 const file={id:'doc',kind:'button',href:'/media/priere.pdf',displayAsButton:true};
 const section={id:'zone',kind:'section',layout:'columns',
  columns:[[image],[video]],style:{border:'round',color:'#aabbcc',metadata:'historical'}};
 return {id:'mercredi-101',group:'celebration',visibility:'published',
  blocks:[title,section,file],custom:{page:'garder'}};
};
test('M11: composed editor has real ESM drag and undo modules and unchanged public surface',()=>{
 new Script(DEMO_CLIENT);
 for(const fn of ['createEditorDragModel','createEditorUndoPolicy'])
  assert.equal(DEMO_CLIENT.split('function '+fn+'(').length-1,1,fn);
 for(const hook of ['editorDragModel.locate(','editorDragModel.move(',
  'editorDragModel.intoBlock(','editorDragModel.pointerIntent(',
  'editorDragModel.canDirectDrag(','editorUndoPolicy.record(',
  'editorUndoPolicy.restorePages(','undoLastEditorAction()'])
  assert.ok(DEMO_CLIENT.includes(hook),hook);
 assert.ok(DEMO_CLIENT.includes("box.append(editorMoveHandle(box,x,p))"));
 assert.ok(DEMO_CLIENT.includes("state.timer=setTimeout("));
 assert.ok(SERVER_EDITOR_SYNC.includes("resetUndoHistory()"));
});
test('M11: moving real original objects across both columns and page root retains all fields',()=>{
 const p=pageFixture(),before=copy(p);
 const title=p.blocks[0],zone=p.blocks[1],file=p.blocks[2];
 const image=zone.columns[0][0],video=zone.columns[1][0];
 assert.equal(drag.move(p,'picture','zone',1,'clip',false),true);
 assert.deepEqual(zone.columns[1].map(x=>x.id),['picture','clip']);
 assert.strictEqual(zone.columns[1][0],image);
 assert.equal(drag.move(p,'clip','',0,'doc',false),true);
 assert.deepEqual(p.blocks.map(x=>x.id),['heading','zone','clip','doc']);
 assert.strictEqual(p.blocks[2],video);
 assert.equal(drag.move(p,'heading','zone',0),true);
 assert.strictEqual(zone.columns[0][0],title);
 assert.equal(drag.move(p,'doc','zone',0,'heading',false),true);
 assert.strictEqual(zone.columns[0][0],file);
 assert.equal(image.src,before.blocks[1].columns[0][0].src);
 assert.equal(image.widthPct,53);
 assert.equal(video.cover,'/media/couv.png');
 assert.deepEqual(image.extra,{future:'préservé'});
 assert.equal(p.custom.page,'garder');
 assert.equal(p.visibility,'published');
 assert.deepEqual(p.blocks.flatMap(x=>x.kind==='section'?x.columns.flat():[x])
  .map(x=>x.id).sort(),['heading','picture','clip','doc'].sort());
});
test('M11: no-op and invalid drops leave serialized page and undo origin intact',()=>{
 const p=pageFixture(),original=JSON.stringify(p);
 assert.equal(drag.move(p,'heading','',0,'heading',false),false);
 assert.equal(drag.move(p,'heading','',0,'zone',false),false);
 assert.equal(drag.move(p,'heading','missing',0),false);
 assert.equal(drag.move(p,'picture','zone',9),false);
 assert.equal(drag.move(p,'picture','zone',1,'does-not-exist',false),false);
 assert.equal(drag.move(p,'missing','zone',0),false);
 assert.equal(drag.intoBlock(p,'heading','heading',true,()=>123),false);
 assert.equal(drag.intoBlock(p,'heading','clip',true,()=>123),false,
  'nested target cannot accidentally wrap a page root');
 assert.equal(JSON.stringify(p),original);
});
test('M11: into-block groups without cloning or removing texts, images, videos or references',()=>{
 const p=pageFixture(),title=p.blocks[0],image=p.blocks[1].columns[0][0],file=p.blocks[2];
 const serialized=JSON.stringify({title,image,file});
 let generated=0;
 assert.equal(drag.intoBlock(p,'picture','doc',false,()=>{generated++;return 'new-group'}),true);
 assert.equal(generated,1);
 assert.equal(p.blocks.length,3);
 const section=p.blocks[2];
 assert.equal(section.id,'new-group');assert.equal(section.kind,'section');
 assert.equal(section.layout,'single');
 assert.strictEqual(section.columns[0][0],image);
 assert.strictEqual(section.columns[0][1],file);
 assert.strictEqual(p.blocks[0],title);
 assert.equal(JSON.stringify({title,image,file}),serialized);
 assert.deepEqual(p.blocks[1].columns,[[],[p.blocks[1].columns[1][0]]]);
});
test('M11: selection is mandatory for direct block dragging; handle remains explicit',()=>{
 assert.equal(drag.canDirectDrag(null,'picture'),false);
 assert.equal(drag.canDirectDrag('doc','picture'),false);
 assert.equal(drag.canDirectDrag('picture','picture'),true);
 assert.equal(drag.canDirectDrag(42,'42'),true);
 assert.equal(drag.pointerAllowed({pointerType:'mouse',button:0},false),true);
 assert.equal(drag.pointerAllowed({pointerType:'mouse',button:2},false),false);
 assert.equal(drag.pointerAllowed({pointerType:'touch',button:0},true),false);
 assert.ok(DEMO_CLIENT.includes("if(!editorDragModel.canDirectDrag(selectedBlockId,x.id))return;"));
});
test('M11: mouse threshold and touch long-press intent prevent accidental drags',()=>{
 const mouse={startX:10,startY:10,isTouch:false};
 assert.equal(drag.pointerIntent(mouse,{clientX:12,clientY:13}),'wait');
 assert.equal(drag.pointerIntent(mouse,{clientX:16,clientY:10}),'activate');
 const touch={startX:10,startY:10,isTouch:true};
 assert.equal(drag.pointerIntent(touch,{clientX:12,clientY:12}),'wait');
 assert.equal(drag.pointerIntent(touch,{clientX:50,clientY:10}),'cancel');
 assert.ok(DEMO_CLIENT.includes("state.timer=setTimeout("));
 assert.ok(DEMO_CLIENT.includes("},430);"));
 assert.ok(DEMO_CLIENT.includes("if(intent==='cancel'){editorDragFinish(state,false);return}"));
 assert.ok(DEMO_CLIENT.includes("if(!shouldMove||!state.active||!destination||preview)return false;"));
});
test('M11: undo restores a move with one action, while preserving current public visibility',()=>{
 const original=pageFixture(),db={pages:[original],siteHomeId:'neutral-accueil-general',
  celebrationDates:{wednesday:'2026-11-11'},celebrationTimes:{mercredi:'14:15'}};
 const before=history.snapshot(db),stack=[],snap=copy(db.pages);
 assert.equal(drag.move(original,'picture','zone',1),true);
 const after=history.snapshot(db);
 const current=history.record(stack,before,after,'',Date.now(),'abc',0);
 assert.equal(stack.length,1);
 assert.equal(current.anchor,after);
 original.visibility='hidden'; // this is a remote publication, never undo it
 const prior=JSON.parse(stack.pop());
 const restored=history.restorePages(prior.pages,db.pages);
 assert.deepEqual(restored[0].blocks,snap[0].blocks);
 assert.equal(restored[0].visibility,'hidden');
 assert.equal(prior.celebrationDates.wednesday,'2026-11-11');
 assert.equal(prior.celebrationTimes.mercredi,'14:15');
 assert.equal(prior.siteHomeId,'neutral-accueil-general');
});
test('M11: unknown old visibility remains implicit-public and removed pages return as draft',()=>{
 const old={id:'legacy',kind:'page',blocks:[{kind:'text',text:'Archive'}]};
 const gone={id:'removed',visibility:'published',blocks:[{kind:'image',src:'/media/photo.jpg'}]};
 const previous=[old,gone],present=[{...old,blocks:[]},{id:'new',visibility:'hidden'}];
 const restored=history.restorePages(previous,present);
 assert.equal(Object.hasOwn(restored[0],'visibility'),false);
 assert.equal(restored[1].visibility,'draft','Undo cannot republish a page deleted on the server');
 assert.equal(restored[1].blocks[0].src,'/media/photo.jpg');
});
test('M11: consecutive typing in the same field is one undo step, distinct actions are separate',()=>{
 const policy=createEditorUndoPolicy({steps:36,bytes:6000000});
 const stack=[];let anchor='state-0',lastTyping='',lastTypedAt=0;
 for(const [current,field,now] of [
  ['state-1','page:heading:texte',1000],
  ['state-2','page:heading:texte',1100],
  ['state-3','page:heading:texte',1200],
  ['state-4','page:button:texte',1400],
  ['state-5','page:button:texte',2600],
  ['state-6','',2700]
 ]){
  const r=policy.record(stack,anchor,current,field,now,lastTyping,lastTypedAt);
  anchor=r.anchor;lastTyping=r.lastTyping;lastTypedAt=r.lastTypedAt;
 }
 assert.deepEqual(stack,['state-0','state-3','state-4','state-5']);
});
test('M11: undo bounded by 36 snapshots and byte limit; no phantom history on no-change',()=>{
 const policy=createEditorUndoPolicy({steps:3,bytes:90}),stack=[];
 let anchor='x000000',lastTyping='',lastAt=0;
 for(let i=1;i<=8;i++){
  const now=i*1200,current='x'+String(i).padStart(6,'0');
  const before=stack.length;
  const r=policy.record(stack,anchor,current,'',now,lastTyping,lastAt);
  assert.equal(stack.length>=Math.min(before,2),true);
  anchor=r.anchor;lastTyping=r.lastTyping;lastAt=r.lastTypedAt;
 }
 assert.equal(stack.length,3);
 const count=stack.length;
 const noChange=policy.record(stack,anchor,anchor,'',9000,lastTyping,lastAt);
 assert.equal(noChange.anchor,anchor);assert.equal(stack.length,count);
 const heavy=createEditorUndoPolicy({steps:100,bytes:15}),b=[];
 heavy.record(b,'very-long-old-snapshot','new','',Date.now(),'',0);
 assert.equal(b.length,0,'A single snapshot above the limit is not kept');
});
test('M11: undo policy and drag model are entirely local, no network nor publication side effects',()=>{
 for(const file of ['migration/cloudflare/app/domain/editor-drag-model.mjs',
  'migration/cloudflare/app/application/editor-undo-policy.mjs']){
  const src=readFileSync(file,'utf8');
  for(const risky of ['fetch(', 'serverSave(', 'serverPublish(', 'localStorage',
   'indexedDB', 'window.', 'document.', '.put('])
   assert.ok(!src.includes(risky),file+' contains '+risky);
 }
 const section=DEMO_CLIENT.slice(DEMO_CLIENT.indexOf('function editorElementLocation('),
  DEMO_CLIENT.indexOf('function block(x,p,'));
 assert.doesNotMatch(section,/serverPublish\(/);
 assert.doesNotMatch(section,/serverSave\(/);
 assert.equal(SERVER_EDITOR_SYNC.includes('resetUndoHistory()'),true);
});
