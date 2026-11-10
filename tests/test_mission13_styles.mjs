import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEMO_CSS} from '../migration/cloudflare/editor-demo-style.mjs';
import {ADMIN_STAGE_LAYOUT} from '../migration/cloudflare/app/styles/admin/stage-layout.mjs';
import {ADMIN_STYLE} from '../migration/cloudflare/app/styles/admin/style.mjs';
import {PUBLIC_STYLE} from '../migration/cloudflare/app/styles/public/style.mjs';
import {TRIAL_SITE_STYLE,TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {handlePreparationDemo,STAGES} from '../migration/cloudflare/editor-demo-preparation-page.mjs';
import {handleTrialSite} from '../migration/cloudflare/editor-trial-site-page.mjs';

const HOST='https://celebrations-exit-staging.rondes.workers.dev';
const count=(s,v)=>s.split(v).length-1;
function fnv64(s){
 let value=0xcbf29ce484222325n;
 for(let i=0;i<s.length;i++){
  value^=BigInt(s.charCodeAt(i));
  value=BigInt.asUintN(64,value*0x100000001b3n);
 }
 return value.toString(16).padStart(16,'0');
}
const adminNames=[
 '01-foundations','02-block-controls','03-themes-pages-media',
 '04-section-composer','05-guide-publication','06-library-dialogs',
 '07-drag-resources','08-column-overrides'];
const publicNames=[
 '01-foundations','02-navigation-library','03-text-and-gallery',
 '04-columns-and-dividers','05-media-and-documents',
 '06-celebration-responsive'];
async function layers(group,names){
 return Promise.all(names.map(async name=>{
  const mod=await import('../migration/cloudflare/app/styles/'+group+'/'+name+'.mjs');
  const values=Object.values(mod);
  assert.equal(values.length,1,name);
  return values[0];
 }));
}
const fakeSteps=STAGES.map((p,i)=>({id:i+100,celebration_id:101,
 step_key:p.slug+'-101',label:p.label,body_text:'Test '+p.label}));
const env={DB:{prepare(sql){
 assert.ok(sql.trim().startsWith('SELECT '),'Read-only D1 fixture');
 return {bind(){return {async all(){
  if(sql.includes('FROM celebrations_celebrations'))
   return {results:[{id:101,archangel:'Michaël',year:'2026',status:'active'}]};
  if(sql.includes('FROM celebrations_steps'))return {results:fakeSteps};
  if(sql.includes('FROM celebrations_events WHERE'))return {results:[]};
  if(sql.includes('FROM celebrations_event_contents'))return {results:[]};
  if(sql.includes('FROM celebrations_step_contents'))return {results:[]};
  if(sql.includes('FROM celebrations_links'))return {results:[]};
  if(sql.includes("FROM celebrations_contents WHERE audience='all'"))return {results:[]};
  throw Error('Unexpected SQL query '+sql);
 }}}};
}}};

test('M13: all eight admin layers rejoin exactly into the approved M02/M03 CSS bytes',async()=>{
 const chunks=await layers('admin',adminNames);
 assert.deepEqual(chunks.map(x=>x.length),[7690,5092,15255,22591,11635,11868,8274,12868]);
 assert.equal(chunks.join(''),ADMIN_STYLE);
 assert.equal(DEMO_CSS,ADMIN_STYLE);
 assert.equal(DEMO_CSS.length,95273);
 assert.equal(fnv64(DEMO_CSS),'ce5de1f7695efdef');
});
test('M13: all six public layers rejoin exactly into M12 CSS bytes',async()=>{
 const chunks=await layers('public',publicNames);
 assert.deepEqual(chunks.map(x=>x.length),[2933,7615,4205,4204,7037,1412]);
 assert.equal(chunks.join(''),PUBLIC_STYLE);
 assert.equal(TRIAL_SITE_STYLE,PUBLIC_STYLE);
 assert.equal(TRIAL_SITE_STYLE.length,27406);
 assert.equal(fnv64(TRIAL_SITE_STYLE),'072384896a5db2c8');
});
test('M13: stage-only layout preserves its original order, content and nonce style tag',()=>{
 assert.equal(ADMIN_STAGE_LAYOUT.length,390);
 assert.equal(fnv64(ADMIN_STAGE_LAYOUT),'fe3d99292c8b8b54');
 assert.ok(ADMIN_STAGE_LAYOUT.startsWith('.stage-editor .list{display:grid;'));
 assert.ok(ADMIN_STAGE_LAYOUT.includes('@media(max-width:850px){'));
 const source=readFileSync('migration/cloudflare/editor-demo-preparation-page.mjs','utf8');
 assert.ok(source.includes("'<style nonce=\"'+nonce+'\">'+ADMIN_STAGE_LAYOUT+'</style>'"));
 assert.ok(source.indexOf("'<style nonce=\"'+nonce+'\">'+ADMIN_STAGE_LAYOUT")>
  source.indexOf("'<style nonce=\"'+nonce+'\">'+DEMO_CSS"));
});
test('M13: planned breakpoint inventory and cascade overrides remain safe after M02/M03',()=>{
 assert.equal(count(DEMO_CSS,'@media'),46);
 assert.equal(count(TRIAL_SITE_STYLE,'@media'),16);
 assert.equal(count(DEMO_CSS,'!important'),319);
 assert.equal(count(TRIAL_SITE_STYLE,'!important'),28);
 for(const marker of ['.editor-drag-ghost','.image-picker-dialog[open]',
  'dialog.file-picker-dialog[open]','.editor-undo-button','.block-validate-actions',
  'grid-auto-rows:190px!important'])
  assert.ok(DEMO_CSS.includes(marker),'Admin selector retained: '+marker);
 for(const marker of ['.trial-video-title','.trial-custom-divider',
  '.trial-content-section[data-layout="columns"]','.celebration-choice',
  '.general-navigation','.media-image-grid'])
  assert.ok(TRIAL_SITE_STYLE.includes(marker),'Public selector retained: '+marker);
 assert.equal(count(DEMO_CSS,'@media(max-width:650px)'),10);
});
test('M13: CSS is independently imported and never fetched at runtime',()=>{
 for(const entry of [
  'migration/cloudflare/app/styles/admin/style.mjs',
  'migration/cloudflare/app/styles/public/style.mjs']){
  const source=readFileSync(entry,'utf8');
  assert.ok(source.includes(".join('')"));
  assert.ok(!source.includes('fetch('));
  assert.ok(!source.includes('document.'));
  assert.ok(!source.includes('localStorage'));
 }
 const admin=readFileSync('migration/cloudflare/editor-demo-style.mjs','utf8');
 const pub=readFileSync('migration/cloudflare/editor-trial-site-client.mjs','utf8');
 assert.ok(admin.includes("import {ADMIN_STYLE} from './app/styles/admin/style.mjs'"));
 assert.ok(pub.includes("import {PUBLIC_STYLE} from './app/styles/public/style.mjs'"));
 assert.ok(pub.includes('export const TRIAL_SITE_STYLE = PUBLIC_STYLE;'));
 assert.ok(TRIAL_SITE_CLIENT.length>20000,'visitor JS was not rewritten for CSS');
});
test('M13: real admin and public pages emit the same nonce-protected CSS bytes',async()=>{
 const admin=await handlePreparationDemo(new Request(HOST+
  '/__editor/demo-preparation?celebration=101'),env);
 assert.equal(admin.status,200);
 const adminHtml=await admin.text();
 const first=[...adminHtml.matchAll(/<style nonce="([0-9a-f]{32})">([\s\S]*?)<\/style>/g)];
 assert.equal(first.length,2,'stage has base style plus ordered stage-specific style');
 assert.equal(first[0][2],DEMO_CSS);
 assert.equal(first[1][2],ADMIN_STAGE_LAYOUT);
 assert.equal(first[0][1],first[1][1]);
 assert.ok(admin.headers.get('content-security-policy').includes("style-src 'nonce-"+first[0][1]+"'"));
 const publicSite=await handleTrialSite(new Request(HOST+
  '/__editor/voir-le-site?celebration=101&page=mercredi'),env);
 assert.equal(publicSite.status,200);
 const html=await publicSite.text();
 const styles=[...html.matchAll(/<style nonce="([0-9a-f]{32})">([\s\S]*?)<\/style>/g)];
 assert.equal(styles.length,1);
 assert.equal(styles[0][2],TRIAL_SITE_STYLE);
 assert.ok(publicSite.headers.get('content-security-policy').includes("style-src 'nonce-"+styles[0][1]+"'"));
 assert.ok(html.includes('window.__PUBLIC_SITE_SNAPSHOT__'));
});
