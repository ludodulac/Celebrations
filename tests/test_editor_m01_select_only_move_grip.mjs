import test from 'node:test';
import assert from 'node:assert/strict';
import {CSS_07_DRAG_RESOURCES} from '../migration/cloudflare/app/styles/admin/07-drag-resources.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';

test('desktop: grip only on hover of non-edited block; no editing toolbar appears',()=>{
 const css=CSS_07_DRAG_RESOURCES;
 assert.match(css,/\.stage-editor \.canvas \.block>\.editor-move-handle\{[^}]*opacity:0;pointer-events:none/s);
 assert.match(css,/@media\(hover:hover\) and \(pointer:fine\)\{/);
 assert.match(css,/\.block:not\(\.is-selected\):hover>\.editor-move-handle\{[^}]*opacity:1!important;pointer-events:auto!important/s);
 assert.doesNotMatch(css,/\.block\.is-selected>\.editor-move-handle\{[^}]*opacity:1!important/s);
 assert.doesNotMatch(css,/\.editor-drop-before>\.editor-move-handle/);
 assert.doesNotMatch(css,/\.editor-drop-after>\.editor-move-handle/);
 assert.match(css,/\.block>\.editor-move-handle:focus-visible\{/);
 const coarse=css.match(/@media\(hover:none\),\(pointer:coarse\)\{[^}]*\}/)?.[0];
 assert.ok(coarse,'Touch grip retains accessible hit-area without being permanently shown');
 assert.doesNotMatch(coarse,/opacity:1!important|pointer-events:auto!important/);
});

test('touch: long press reuses existing pointer drag; short tap selects for editing',()=>{
 assert.match(DEMO_CLIENT,/box\.onclick=e=>\{/);
 assert.match(DEMO_CLIENT,/selectBlock\(box\)/);
 assert.match(DEMO_CLIENT,/if\(Date\.now\(\)<\(box\._suppressClickUntil\|\|0\)\)/);
 assert.match(DEMO_CLIENT,/onpointerdown=e=>startEditorPointerDrag\(e,box,x,p,handle\)/);
 assert.match(DEMO_CLIENT,/box\.append\(editorMoveHandle\(box,x,p\)\)/);
 assert.match(DEMO_CLIENT,/enableTouchLongPressDragging\(box,x,p\)/);
 assert.match(DEMO_CLIENT,/if\(state\.isTouch\)state\.timer=setTimeout\(/);
 assert.match(DEMO_CLIENT,/\},430\)/);
 assert.match(DEMO_CLIENT,/box\.classList\.contains\('is-selected'\)\)return/);
 assert.doesNotMatch(DEMO_CLIENT,/enableDirectBlockDragging/);
 assert.doesNotMatch(DEMO_CLIENT,/editorDragModel\.canDirectDrag/);
});
