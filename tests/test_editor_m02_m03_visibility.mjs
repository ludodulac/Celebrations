import test from 'node:test';
import assert from 'node:assert/strict';
import {CSS_02_BLOCK_CONTROLS} from '../migration/cloudflare/app/styles/admin/02-block-controls.mjs';
import {CSS_06_LIBRARY_DIALOGS} from '../migration/cloudflare/app/styles/admin/06-library-dialogs.mjs';
import {CSS_04_SECTION_COMPOSER} from '../migration/cloudflare/app/styles/admin/04-section-composer.mjs';
import {CSS_07_DRAG_RESOURCES} from '../migration/cloudflare/app/styles/admin/07-drag-resources.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';

test('M09: blue plus stays invisible until hover; empty pages always offer one',()=>{
 const css=CSS_04_SECTION_COMPOSER;
 assert.match(css,/\.stage-editor \.section-add-blue\{[^}]*opacity:0;pointer-events:none/s);
 assert.match(css,/\.canvas>\.section-insert:only-child>\.section-add-blue/);
 assert.match(css,/\.canvas>\.block>\.section-insert/,'Insertion button is a child of the block');
 assert.match(css,/@media\(hover:hover\) and \(pointer:fine\)\{/);
 assert.match(css,/\.canvas>\.block:hover>\.section-insert>\.section-add-blue/);
 assert.match(css,/\.canvas>\.content-section:hover>\.section-insert>\.section-add-blue/);
 assert.match(css,/\.canvas>\.block>\.section-insert/,'Mouse remains within the block over the blue +');
 assert.match(css,/\.section-insert:focus-within>\.section-add-blue/,'The open blue menu stays accessible');
 assert.match(css,/@media\(hover:none\),\(pointer:coarse\)\{/);
 assert.match(css,/\.canvas>\.block\.is-selected>\.section-insert>\.section-add-blue/,'Touch fallback still reveals insert');
 assert.doesNotMatch(css,/\.section-insert:has\(\+\.block\.is-selected\)>\.section-add-blue/,'No more button above selected block');
});

test('M09: green plus appears on element hover, with touch and empty-column fallbacks',()=>{
 const css=CSS_04_SECTION_COMPOSER;
 assert.match(css,/\.stage-editor \.section-add-green\{[^}]*opacity:0;pointer-events:none/s);
 assert.match(css,/\.section-column:has\(>\.block:hover\)>\.section-column-actions>\.section-add-green/);
 assert.match(css,/\.section-column-actions:hover>\.section-add-green/);
 assert.match(css,/\.section-column:not\(:has\(>\.block\)\)>\.section-column-actions>\.section-add-green/);
 assert.match(css,/\.section-column:has\(>\.block\.is-selected\)>\.section-column-actions>\.section-add-green/);
 assert.match(css,/\.canvas>\.block:hover>\.existing-block-add\{display:flex!important\}/);
 assert.match(css,/\.canvas>\.block\.is-selected>\.existing-block-add\{display:flex!important\}/);
 assert.match(css,/\.existing-block-add-button\[aria-expanded="true"\]/);
 assert.match(css,/\.section-column-actions:focus-within \.section-add-green/);
 const beginning=DEMO_CLIENT.indexOf('function existingBlockAddControls(');
 const end=DEMO_CLIENT.indexOf('\nfunction addSection(',beginning);
 const block=DEMO_CLIENT.slice(beginning,end);
 assert.ok(block.includes("event.stopPropagation()"));
 assert.ok(!block.includes('selectBlock(box)'),'Green + no longer opens the editing toolbar');
});

test('M09: image actions on hover, on tap when selected, without exposing the resize slider',()=>{
 const css=CSS_06_LIBRARY_DIALOGS;
 assert.match(css,/\.block\[data-kind="image"\]>\.block-edit-actions\.image-direct-actions\{\s*display:none!important/);
 assert.match(css,/@media\(hover:hover\) and \(pointer:fine\)\{/);
 assert.match(css,/\.block\[data-kind="image"\]:hover>\.block-edit-actions\.image-direct-actions\{\s*display:flex!important/);
 assert.match(css,/\.block\[data-kind="image"\]\.is-selected>\.block-edit-actions\.image-direct-actions/);
 assert.doesNotMatch(css,/\.block\[data-kind="image"\]:hover>\.image-size-control/);
 const actionStart=DEMO_CLIENT.indexOf("const actions=n('div','block-edit-actions image-direct-actions')");
 assert.ok(actionStart>0);
 const actionText=DEMO_CLIENT.slice(actionStart,actionStart+850);
 assert.match(actionText,/Télécharger une image/);
 assert.match(actionText,/Images du site/);
 assert.match(actionText,/Supprimer l’image/);
 assert.match(actionText,/e\.stopPropagation\(\);startImageUpload\(x\)/);
 assert.match(actionText,/e\.stopPropagation\(\);showImagePicker\(x\)/);
});

test('M09: eye icon uses real accessible SVG; section visibility hides all descendants for visitors',()=>{
 assert.ok(DEMO_CLIENT.includes("document.createElementNS(ns,'svg')"));
 assert.ok(DEMO_CLIENT.includes("visibilityEyeIcon(x.hideOnSite!==true)"));
 assert.ok(DEMO_CLIENT.includes("visibilityEyeIcon(!hidden)"));
 assert.ok(!DEMO_CLIENT.includes('👁̸'),'Ambiguous unicode overlay glyph removed');
 assert.ok(DEMO_CLIENT.includes("section.hideOnSite=section.hideOnSite!==true"));
 assert.ok(DEMO_CLIENT.includes("'Bloc entier invisible aux visiteurs'"));
 assert.ok(DEMO_CLIENT.includes("'Invisible aux visiteurs'"));
 assert.match(CSS_04_SECTION_COMPOSER,/\.section-settings-fields>\.section-visibility-toggle\{/);
 assert.match(CSS_07_DRAG_RESOURCES,/\.content-section\.hidden-on-public\{/);
 assert.match(CSS_07_DRAG_RESOURCES,/\.block\.hidden-on-public\{/);
 assert.ok(TRIAL_SITE_CLIENT.includes('if(!b||b.hideOnSite===true)return;'),
  'The existing visitor renderer must omit whole hidden sections and single elements');
});
