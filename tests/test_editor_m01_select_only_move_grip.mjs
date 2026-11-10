import test from 'node:test';
import assert from 'node:assert/strict';
import {CSS_07_DRAG_RESOURCES} from '../migration/cloudflare/app/styles/admin/07-drag-resources.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';

test('Mission 01: the grip is hidden until its block is selected on mobile and desktop',()=>{
 const css=CSS_07_DRAG_RESOURCES;
 assert.match(css,/\.stage-editor \.canvas \.block>\.editor-move-handle\{[^}]*opacity:0;pointer-events:none/s);
 assert.match(css,/\.stage-editor \.canvas \.block\.is-selected>\.editor-move-handle\{[^}]*opacity:1!important;pointer-events:auto!important/s);
 assert.doesNotMatch(css,/\.block:hover>\.editor-move-handle/);
 assert.doesNotMatch(css,/\.block:focus-within>\.editor-move-handle/);
 assert.doesNotMatch(css,/\.block>\.editor-move-handle\{[^}]*opacity:\.94!important/s);
 const coarse=css.match(/@media\(hover:none\),\(pointer:coarse\)\{[^}]*\}/)?.[0];
 assert.ok(coarse,'Mobile touch-target sizing remains present');
 assert.doesNotMatch(coarse,/opacity:1!important|pointer-events:auto!important/);
});

test('Mission 01: selection and pointer dragging still use the same original code',()=>{
 assert.match(DEMO_CLIENT,/box\.onclick=\(\)=>selectBlock\(box\)/);
 assert.match(DEMO_CLIENT,/if\(selectedBlockId===String\(x\.id\)\)box\.classList\.add\('is-selected'\)/);
 assert.match(DEMO_CLIENT,/onpointerdown=e=>startEditorPointerDrag\(e,box,x,p,handle\)/);
 assert.match(DEMO_CLIENT,/box\.append\(editorMoveHandle\(box,x,p\)\)/);
 assert.match(DEMO_CLIENT,/width:44px;min-width:44px|touch-action:none/);
});
