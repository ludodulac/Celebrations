import test from 'node:test';
import assert from 'node:assert/strict';
import {CSS_04_SECTION_COMPOSER} from '../migration/cloudflare/app/styles/admin/04-section-composer.mjs';
import {CSS_07_DRAG_RESOURCES} from '../migration/cloudflare/app/styles/admin/07-drag-resources.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';

test('M02: only selected blocks expose their adjacent blue insertion controls',()=>{
 const css=CSS_04_SECTION_COMPOSER;
 assert.match(css,/\.stage-editor \.section-add-blue\{[^}]*opacity:0;pointer-events:none/s);
 assert.match(css,/\.canvas>\.section-insert:only-child>\.section-add-blue/,'Empty page keeps one visible blue plus');
 assert.match(css,/\.block\.is-selected\+\.section-insert>\.section-add-blue/,'Blue plus after selected block');
 assert.match(css,/\.section-insert:has\(\+\.block\.is-selected\)>\.section-add-blue/,'Blue plus before selected block');
 assert.match(css,/\.content-section:has\(\.block\.is-selected\)\+\.section-insert>\.section-add-blue/);
 assert.match(css,/\.section-insert:has\(\+\.content-section \.block\.is-selected\)>\.section-add-blue/);
 assert.doesNotMatch(css,/\.section-insert:hover \.section-add-blue/,'No on-hover-only insertion button');
 assert.doesNotMatch(css,/@media\(hover:none\)\{\.stage-editor \.section-add-blue/,'Touch does not force every insertion plus visible');
 assert.doesNotMatch(css,/\.section-insert>\.section-add-blue\{[^}]*opacity:1/s,'Phone button retains default hidden state');
 assert.match(css,/\.stage-editor \.section-insert:focus-within>\.section-add-blue/,'Open insertion menu remains operable');
});
test('M02: selected or empty columns keep green insertion control available',()=>{
 const css=CSS_04_SECTION_COMPOSER;
 assert.match(css,/\.stage-editor \.section-add-green\{[^}]*opacity:0;pointer-events:none/s);
 assert.match(css,/\.section-column:has\(>\.block\.is-selected\)>\.section-column-actions>\.section-add-green/);
 assert.match(css,/\.section-column:not\(:has\(>\.block\)\)>\.section-column-actions>\.section-add-green/,'An empty column must not be a dead end');
 assert.match(css,/\.section-column-actions:focus-within \.section-add-green/,'Open green menu remains operable');
 assert.match(css,/\.canvas>\.block\.is-selected>\.existing-block-add\{display:flex!important\}/,'Single legacy block plus already appears only on selection');
 assert.doesNotMatch(css,/\.content-section:hover \.section-add-green/);
});
test('M03: hidden visitor headings are plainly labeled and greyed, not deleted',()=>{
 assert.match(DEMO_CLIENT,/hidden-on-public/);
 assert.match(DEMO_CLIENT,/👁̸ Invisible aux visiteurs/);
 assert.match(DEMO_CLIENT,/x\.hideOnSite\?'👁':'👁̸'/);
 assert.match(DEMO_CLIENT,/x\.hideOnSite=!x\.hideOnSite;mark\(\);render\(\)/);
 assert.match(CSS_07_DRAG_RESOURCES,/\.block\.hidden-on-public\{\s*opacity:\.7;background:#f0f1f2;filter:grayscale\(1\);/);
 assert.match(CSS_07_DRAG_RESOURCES,/\.block\.hidden-on-public>\.hidden-public-note\{/);
});
