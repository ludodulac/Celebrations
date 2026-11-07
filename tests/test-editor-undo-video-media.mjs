import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {createMediaCatalogue} from '../migration/cloudflare/app/domain/editor-media-catalogue.mjs';
import {createEditorMediaCommands} from '../migration/cloudflare/app/application/editor-media-commands.mjs';
import {SERVER_EDITOR_SYNC} from '../migration/cloudflare/editor-server-sync-client.mjs';

const extract=(a,b)=>{
 const i=DEMO_CLIENT.indexOf(a),j=DEMO_CLIENT.indexOf(b,i+a.length);
 assert.ok(i>=0&&j>i,'Editor snippet exists: '+a);
 return DEMO_CLIENT.slice(i,j);
};
const fakeNode=(tag,cls='',text='')=>({
 tag,className:cls,textContent:text,dataset:{},children:[],attrs:{},value:'',open:false,
 append(...nodes){this.children.push(...nodes)},
 prepend(...nodes){this.children.unshift(...nodes)},
 replaceChildren(...nodes){this.children=nodes},
 setAttribute(key,value){this.attrs[key]=String(value)},
 close(){this.open=false;this.onclose?.()},
 showModal(){this.open=true},remove(){this.removed=true}
});
const flat=node=>[node,...(node.children||[]).flatMap(flat)];
const b=(label,fn,cls='')=>Object.assign(fakeNode('button',cls,label),{onclick:fn});
const categories=[['images','Images'],['pdf','PDF'],['audios','Audios'],['videos','Vidéos'],['autres','Autres']];

test('a video block chooses only videos from the same non-navigating library popup',()=>{
 const created=[],document={body:{append:x=>created.push(x)}};
 const source=extract('function chooseFile(x){','\nfunction attachFile(r){');
 const changes={marked:0,rendered:0};
 const video={kind:'video',href:'',text:''};
 const env={
  n:fakeNode,b,FILE_CATEGORIES:categories,
  globalFiles:[{name:'Ancien PDF.pdf',src:'/media/old.pdf',category:'pdf'}],
  publicFiles:()=>[],globalMedia:[
   {name:'Présentation Michaël.mp4',src:'/media/my-video.mp4',type:'video'},
   {name:'Prière.pdf',src:'/media/priere.pdf',type:'pdf'}],
  mediaCategoryOf:r=>r.type==='video'?'videos':r.type==='pdf'?'pdf':'autres',
  mediaCatalogue:createMediaCatalogue({validHref:src=>src.startsWith('/')||src.startsWith('https://')}),
  editorMediaCommands:createEditorMediaCommands(),
  validHref:x=>x.startsWith('/'),
  document,IS_STAGE:true,globalMediaLoaded:true,
  mark:()=>changes.marked++,render:()=>changes.rendered++
 };
 const choose=new Function(...Object.keys(env),source+';return chooseFile;')(...Object.values(env));
 choose(video);
 const dialog=created[0];assert.ok(dialog.open);
 const buttons=flat(dialog).filter(x=>x.tag==='button');
 assert.ok(buttons.some(x=>x.attrs['aria-label']==='Choisir Présentation Michaël.mp4'));
 assert.ok(!buttons.some(x=>x.attrs['aria-label']==='Choisir Prière.pdf'),
  'Non-video files must not appear in the video-only selector');
 const item=buttons.find(x=>x.attrs['aria-label']==='Choisir Présentation Michaël.mp4');
 item.onclick();
 assert.equal(video.kind,'video','The selected media must remain a video block');
 assert.equal(video.href,'/media/my-video.mp4');
 assert.equal(video.text,'Présentation Michaël','The caption defaults to the media filename');
 assert.equal(dialog.open,false);
 assert.deepEqual(changes,{marked:1,rendered:1});
 assert.match(DEMO_CLIENT,/Choisir une vidéo du site/);
});
function undoEnvironment(){
 const page={
  id:'preparation-101',group:'celebration',visibility:'published',
  blocks:[
   {id:'a',kind:'heading',text:'Titre'},
   {id:'b',kind:'text',text:'Description'},
   {id:'c',kind:'button',text:'Document',href:'/media/document.pdf'}
  ]
 };
 const db={pages:[page,
  {id:'mercredi-101',group:'celebration',name:'Mercredi',blocks:[{id:40,kind:'text',text:'Historique'}]}],
  siteHomeId:'neutral-accueil-general'};
 const listeners=new Map(),elements=new Map();
 const actions={prepend:node=>elements.set(node.id,node)};
 const document={
  activeElement:{tagName:'BODY',matches:()=>false,isContentEditable:false},
  getElementById:id=>elements.get(id)||null,
  querySelector:q=>q==='.stage-editor .topbar .actions'?actions:null,
  addEventListener:(key,fn)=>listeners.set(key,fn)
 };
 const status={textContent:''},ctrl={marked:0,rendered:0};
 const start=DEMO_CLIENT.indexOf('const UNDO_STEPS=');
 const end=DEMO_CLIENT.indexOf('function mark(){',start);
 assert.ok(start>0&&end>start);
 const script=DEMO_CLIENT.slice(start,end)+
  '\nfunction mark(){ctrl.marked++;rememberUndoChange()};'+
  '\nfunction render(){ctrl.rendered++};'+
  '\nreturn {resetUndoHistory,rememberUndoChange,undoLastEditorAction,ensureUndoButton,updateUndoButton,undoStack,db,document,listeners,status,ctrl};';
 const ctx=new Function('db','document','status','n','id','selectedBlockId','preview','editorDragState','editorDragFinish','ctrl','listeners',script)(
  db,document,status,fakeNode,'preparation-101',null,false,null,()=>{},ctrl,listeners
 );
 return ctx;
}

test('undo restores the exact previous order of moved blocks, with no remote publication',()=>{
 const u=undoEnvironment();
 u.resetUndoHistory();u.ensureUndoButton();
 assert.equal(u.document.getElementById('undo-btn').disabled,true);
 const original=JSON.stringify(u.db.pages[0].blocks);
 const [first]=u.db.pages[0].blocks.splice(0,1);
 u.db.pages[0].blocks.push(first);
 u.rememberUndoChange();
 assert.equal(u.document.getElementById('undo-btn').disabled,false);
 assert.ok(u.undoLastEditorAction());
 assert.equal(JSON.stringify(u.db.pages[0].blocks),original);
 assert.equal(u.document.getElementById('undo-btn').disabled,true);
 assert.ok(u.status.textContent.includes('Action annulée'));
 assert.equal(u.ctrl.marked,1);
 assert.equal(u.ctrl.rendered,1);
 assert.equal(u.db.pages[1].visibility,undefined,
  'Undo must not turn implicitly published historical pages into drafts');
 assert.equal(u.db.pages[0].visibility,'published',
  'Undo must preserve the explicit public status of the current page');
 assert.equal(SERVER_EDITOR_SYNC.includes('resetUndoHistory()'),true,
  'An explicit server publication clears older local undo actions');
});

test('Ctrl+Z undoes page movement and mobile arrow undoes deletion',()=>{
 const u=undoEnvironment();u.resetUndoHistory();u.ensureUndoButton();
 const block=u.db.pages[0].blocks.pop();u.rememberUndoChange();
 const hotkey={ctrlKey:true,metaKey:false,altKey:false,shiftKey:false,key:'z',
  prevented:false,preventDefault(){this.prevented=true}};
 u.listeners.get('keydown')(hotkey);
 assert.ok(hotkey.prevented,'Ctrl+Z should replace browser undo for non-text actions');
 assert.equal(u.db.pages[0].blocks.at(-1).id,block.id);
 u.db.pages[0].blocks.splice(1,1);u.rememberUndoChange();
 u.document.getElementById('undo-btn').onclick();
 assert.equal(u.db.pages[0].blocks.length,3,
  'The same Undo button must work without a physical keyboard');
});
