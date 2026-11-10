import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {DEMO_CSS} from '../migration/cloudflare/editor-demo-style.mjs';

function touchGestureFixture(){
 const start=DEMO_CLIENT.indexOf('function enableTouchLongPressDragging(');
 const end=DEMO_CLIENT.indexOf('\nfunction block(',start);
 assert.ok(start>=0&&end>start,'Long-press adapter exists inside the existing editor');
 const env={calls:[],editorDragState:null};
 const js=`let preview=false;
 let editorDragState=null;
 function startEditorPointerDrag(e,box,x,p,handle){
  this.calls.push({e,box,x,p,handle});
 }
 ${DEMO_CLIENT.slice(start,end)}
 this.install=enableTouchLongPressDragging;
 this.setPreview=v=>{preview=v};
 this.setDrag=v=>{editorDragState=v};`;
 vm.runInNewContext(js,env);
 const listeners={};
 const block={classList:{selected:false,contains(v){return v==='is-selected'&&this.selected}},
  addEventListener:(name,fn)=>{listeners[name]=fn}};
 const item={id:'example',kind:'text',text:'Essai'};
 env.install(block,item,{blocks:[item]});
 const send=(pointerType,targetSelector=null)=>{
  const e={pointerType,button:0,target:{closest:()=>targetSelector},stopPropagation:()=>{}};
  listeners.pointerdown(e);
  return e;
 };
 return {env,block,listeners,send};
}

test('M08 desktop grip: hover without selection, never after click to edit',()=>{
 assert.match(DEMO_CSS,/@media\(hover:hover\) and \(pointer:fine\)/);
 assert.match(DEMO_CSS,/\.block:not\(\.is-selected\):hover>\.editor-move-handle/);
 assert.doesNotMatch(DEMO_CSS,/\.block\.is-selected>\.editor-move-handle\{\s*opacity:1/);
 assert.match(DEMO_CSS,/\.block>\.tools,\.block>\.formatbar,\.block>\.link-line,\.block>\.block-edit-actions\{display:none !important\}/);
 assert.match(DEMO_CSS,/\.block\.is-selected>\.tools/);
 assert.ok(!DEMO_CLIENT.includes('enableDirectBlockDragging'));
});

test('M08 touch: simple tap is not blocked; long press starts drag on unselected content',()=>{
 const {env,block,send}=touchGestureFixture();
 send('mouse');assert.equal(env.calls.length,0,'Mouse never starts a drag from the whole block');
 send('touch');assert.equal(env.calls.length,1);
 assert.strictEqual(env.calls[0].handle,block,'Touch uses original drag implementation, not a new tool');
 send('pen');assert.equal(env.calls.length,2,'Pen can long-press');
 block.classList.selected=true;
 send('touch');assert.equal(env.calls.length,2,'Editing mode is not a drag gesture');
 block.classList.selected=false;
 send('touch',{tagName:'INPUT'});assert.equal(env.calls.length,2,'Interactive controls are excluded');
 env.setPreview(true);send('touch');assert.equal(env.calls.length,2,'Visitor preview is inert');
});

test('M08: touch long press suppresses synthetic editing click without affecting taps',()=>{
 assert.match(DEMO_CLIENT,/if\(state\.isTouch\)\{/);
 assert.match(DEMO_CLIENT,/original\._suppressClickUntil=Date\.now\(\)\+850/);
 assert.match(DEMO_CLIENT,/if\(Date\.now\(\)<\(box\._suppressClickUntil\|\|0\)\)/);
 assert.match(DEMO_CLIENT,/if\(state\.isTouch\)state\.timer=setTimeout\(/);
 assert.match(DEMO_CLIENT,/\},430\)/);
 assert.match(DEMO_CLIENT,/if\(editorDragState\?\.box===box&&editorDragState\.isTouch\)e\.preventDefault\(\)/);
 assert.match(DEMO_CLIENT,/if\(intent==='cancel'\)\{editorDragFinish\(state,false\);return\}/);
 assert.match(DEMO_CLIENT,/editorDragFinish\(state,true\)/);
});
