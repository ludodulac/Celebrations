import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {M031_COMPACT_LAYOUT_CSS} from '../migration/cloudflare/app/styles/admin/m031-compact-layout.mjs';
import {M031_VISITOR_NAV_STYLE} from '../migration/cloudflare/editor-trial-site-page.mjs';
const admin=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../migration/cloudflare/editor-demo-preparation-page.mjs',import.meta.url),'utf8');
test('M031/4: real original editor and visitor inline scripts still parse without runtime eval',()=>{
 assert.doesNotThrow(()=>new Function(DEMO_CLIENT));
 assert.doesNotThrow(()=>new Function(TRIAL_SITE_CLIENT));
});
test('M031/4: real editor toolbar and navigation are MOVED, not cloned, and survive render()',()=>{
 assert.match(admin,/m031UpgradeAdmin\(\)/);
 assert.match(admin,/slot\.append\(toolbar\)/);
 assert.match(admin,/nav\.append\(siteLink\)/);
 assert.match(admin,/settingsBody\.append\(publication\)/);
 assert.match(admin,/settingsBody\.append\(pageSettings\)/);
 assert.match(admin,/m031SettingsOpen/);
 assert.match(admin,/rail\.append\(panel\)/);
 assert.match(admin,/layout\.prepend\(panel\)/);
 assert.match(admin,/m031ReflowRail/);
 assert.match(html,/m031-admin-home-link/);
 assert.ok(html.includes('href="/admin?celebration='),'Admin link must reload selected celebration');
 assert.match(html,/ADMIN_STAGE_LAYOUT\+M031_COMPACT_LAYOUT_CSS/);
 assert.ok(!admin.includes('cloneNode(true)'), 'Do not clone native controls or their event handlers');
});
test('M031/4: compact settings and full-width canvas are scoped to official admin',()=>{
 assert.match(M031_COMPACT_LAYOUT_CSS,/\.stage-editor\.m031-compact/);
 assert.match(M031_COMPACT_LAYOUT_CSS,/position:sticky/);
 assert.match(M031_COMPACT_LAYOUT_CSS,/\.m031-settings-fields/);
 assert.match(M031_COMPACT_LAYOUT_CSS,/\.m031-page-flyout:popover-open/);
 assert.match(M031_COMPACT_LAYOUT_CSS,/min-width:1051px/);
 assert.match(M031_COMPACT_LAYOUT_CSS,/max-width:700px/);
 assert.match(M031_COMPACT_LAYOUT_CSS,/\.m031-site-link/);
});
test('M031/4: visitor days remain one row on desktop; touch gets original behavior',()=>{
 assert.match(M031_VISITOR_NAV_STYLE,/@media\(min-width:1051px\)/);
 assert.match(M031_VISITOR_NAV_STYLE,/grid-auto-flow:column/);
 assert.match(M031_VISITOR_NAV_STYLE,/white-space:nowrap!important/);
 assert.match(TRIAL_SITE_CLIENT,/pointerenter/);
 assert.match(TRIAL_SITE_CLIENT,/pointerleave/);
 assert.match(TRIAL_SITE_CLIENT,/\(hover:hover\) and \(pointer:fine\)/);
 assert.match(TRIAL_SITE_CLIENT,/menuOpen=!menuOpen/,'Existing click behavior preserved');
});
test('M031/4: never change canonical calendar, D1 session, visibility or publication sources',()=>{
 assert.match(admin,/Célébrations prévues \(2026–2039\)/);
 assert.match(admin,/memberPanel\.commandContent\('create-celebration'/);
 assert.match(admin,/memberPanel\.commandContent\('celebration-visibility'/);
 assert.match(admin,/serverPublishedCelebrationVisibility/);
});
