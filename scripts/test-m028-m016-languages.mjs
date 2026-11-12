// M028: real Chromium verification on the isolated M016 Worker ONLY.
// The owner is beginning to use the official site: no production writes.
// The test never edits documents, publishes pages, or creates accounts.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const HOST='https://celebrations-m016-admin-preprod.rondes.workers.dev';
const FOLDER='docs/m028-mobile';
const PREFERENCE='celebrations-admin-show-language-tools-v1';
assert.equal(process.env.M028_M016_ONLY,'YES','Only explicitly approved isolated M016 testing');
assert.ok((process.env.M017_ADMIN_PASSWORD||'').length>=16,'M016 PIN must be supplied by staging secret');
mkdirSync(FOLDER,{recursive:true});

const browser=await chromium.launch({headless:true});
let context=null,page=null,originalMode=null,editorId='90000002',originalContent=null;
const pageErrors=[];

async function siteMode(){
 const resp=await page.request.get(HOST+'/api/site-identity',{failOnStatusCode:false});
 assert.equal(resp.status(),200,'M016 site identity GET');
 const json=await resp.json();
 assert.equal(json.ok,true);
 return json;
}
async function setMode(enabled){
 const mode=await siteMode();
 if(mode.memberAccessUiEnabled===enabled)return;
 const r=await page.request.post(HOST+'/api/site-identity',{
  headers:{origin:HOST,'content-type':'application/json'},
  data:{expectedRevision:mode.revision,memberAccessUiEnabled:enabled},
  failOnStatusCode:false
 });
 assert.equal(r.status(),200,'M016 display-only member mode update');
 assert.equal((await siteMode()).memberAccessUiEnabled,enabled);
}
async function login(p){
 const r=await p.goto(HOST+'/admin',{waitUntil:'domcontentloaded',timeout:45000});
 assert.equal(r.status(),200,'M016 auth screen');
 await p.locator('input[name="code"]').fill(process.env.M017_ADMIN_PASSWORD);
 await Promise.all([
  p.waitForURL(u=>u.pathname==='/admin.html',{timeout:30000}),
  p.locator('button[type="submit"]').click()
 ]);
}
async function chooseExistingCelebration(){
 for(const cid of ['101','102','103','104','90000002','90000001']){
  const response=await page.request.get(HOST+'/api/editor-open-draft?celebration='+cid,
   {failOnStatusCode:false});
  if(response.status()!==200)continue;
  const data=await response.json();
  if(data.record?.pages?.some(p=>p.group==='celebration'))return cid;
 }
 return '90000002';
}
async function openEditor(p=page,id=editorId){
 const r=await p.goto(HOST+'/__editor/demo-preparation?celebration='+id,
  {waitUntil:'domcontentloaded',timeout:40000});
 assert.equal(r.status(),200,'isolated M016 editor');
 await p.locator('[data-tab="settings"]').waitFor();
 await p.waitForTimeout(550); // wait for initial GET, avoid hydrator racing test clicks
}
async function content(){
 const r=await page.request.get(HOST+'/api/editor-open-draft?celebration='+editorId,
 {failOnStatusCode:false});
 assert.equal(r.status(),200);
 const d=await r.json();
 assert.equal(d.ok,true);
 const {record,shared,plans,localization,celebrationMetadata,mediaCatalogue}=d;
 return JSON.stringify({record,shared,plans,localization,celebrationMetadata,mediaCatalogue});
}
async function findPageSettings(p){
 await p.locator('[data-tab="pages"]').click();
 if(await p.locator('.m020-settings').count()===0){
  await p.locator('[data-tab="celebrations"]').click();
 }
 assert.ok(await p.locator('.m020-settings').count()>0,'A real page must have Settings on M016');
}

try{
 context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 page=await context.newPage();
 page.on('pageerror',e=>pageErrors.push(e.message));
 await login(page);
 originalMode=(await siteMode()).memberAccessUiEnabled;
 editorId=await chooseExistingCelebration();
 originalContent=await content();
 await setMode(false);
 await openEditor();
 assert.equal(await page.locator('[data-tab="languages-categories"]').isVisible(),false,
  'Simplified main navigation must not show Languages');
 assert.equal(await page.locator('[data-tab="members-spaces"]').isVisible(),false);
 await findPageSettings(page);
 assert.equal(await page.locator('.m020-settings select[aria-label="Langue"]').count(),0,
  'French page must have no language picker in simplified default mode');
 assert.ok(await page.locator('.m020-settings .m022-save').count()>0,'Save is still present');
 await page.screenshot({path:FOLDER+'/01-mobile-pages-simplifiees.png',fullPage:true});
 await page.locator('[data-tab="settings"]').click();
 const box=page.locator('details.m028-language-settings');
 assert.equal(await box.count(),1,'Single existing Settings panel');
 assert.equal(await box.getAttribute('open'),null,'Advanced panel starts collapsed');
 await box.locator('summary').click();
 const toggle=box.getByRole('checkbox',{name:'Afficher les outils de traduction'});
 assert.equal(await toggle.isChecked(),false);
 assert.equal(await box.locator('.m028-language-tools').isVisible(),false);
 await page.screenshot({path:FOLDER+'/02-mobile-parametres-langues-cachees.png',fullPage:true});

 await toggle.check();
 assert.equal(await box.locator('.m028-language-tools').isVisible(),true,
  'Existing language list is accessible only on demand');
 assert.ok(await box.locator('.m018-language-list .m018-language-entry').count()>=8,
  'Existing eight languages stay available');
 assert.equal(await page.evaluate(k=>localStorage.getItem(k),PREFERENCE),'1',
  'Preference is local to this browser');
 await page.screenshot({path:FOLDER+'/03-mobile-parametres-langues-ouvertes.png',fullPage:true});
 await findPageSettings(page);
 assert.equal(await page.locator('.m020-settings select[aria-label="Langue"]').count(),1,
  'Language picker reappears when explicitly requested');
 await page.screenshot({path:FOLDER+'/04-mobile-page-langue-active.png',fullPage:true});

 await page.locator('[data-tab="settings"]').click();
 const enabledBox=page.locator('details.m028-language-settings');
 assert.equal(await enabledBox.getAttribute('open'),'','Panel remains open while enabled');
 await enabledBox.getByRole('checkbox',{name:'Afficher les outils de traduction'}).uncheck();
 assert.equal(await enabledBox.locator('.m028-language-tools').isVisible(),false);
 assert.equal(await page.evaluate(k=>localStorage.getItem(k),PREFERENCE),'0');
 await findPageSettings(page);
 assert.equal(await page.locator('.m020-settings select[aria-label="Langue"]').count(),0);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForTimeout(550);
 await findPageSettings(page);
 assert.equal(await page.locator('.m020-settings select[aria-label="Langue"]').count(),0,
  'Hidden UI remains hidden after reload');
 assert.equal(await content(),originalContent,
  'Show/hide language setting must not alter saved pages or translations');
 console.log('M028_M016_MOBILE_SIMPLE_PASS languages_hidden_by_default=true checkbox_reversible=true browser_persisted=true draft_unchanged=true');

 // Full member mode retains categories, with the language manager only in Settings.
 await setMode(true);
 await openEditor();
 assert.equal(await page.locator('[data-tab="members-spaces"]').isVisible(),true);
 const categories=page.locator('[data-tab="languages-categories"]');
 assert.equal(await categories.isVisible(),true,'Categories remain accessible in full mode');
 assert.match((await categories.innerText()).trim(),/Catégories/);
 assert.doesNotMatch((await categories.innerText()).trim(),/Langues/);
 await categories.click();
 assert.equal(await categories.evaluate(el=>el.classList.contains('active')),true);
 await page.screenshot({path:FOLDER+'/05-mobile-mode-complet-categories.png',fullPage:true});
 assert.equal(await content(),originalContent,'Category navigation does not edit private data');
 console.log('M028_M016_MOBILE_FULL_PASS member_controls_visible=true categories_retained=true no_language_tab=true');

 // Desktop is an independent new browser. It starts in French even if the
 // original mobile test context previously enabled its own local preference.
 const desktopContext=await browser.newContext({viewport:{width:1280,height:800}});
 const desktop=await desktopContext.newPage();
 desktop.on('pageerror',e=>pageErrors.push(e.message));
 await login(desktop);
 await openEditor(desktop);
 await findPageSettings(desktop);
 assert.equal(await desktop.locator('.m020-settings select[aria-label="Langue"]').count(),0);
 await desktop.locator('[data-tab="settings"]').click();
 const desktopBox=desktop.locator('details.m028-language-settings');
 assert.equal(await desktopBox.count(),1);
 assert.equal(await desktopBox.getAttribute('open'),null);
 assert.equal(await desktopBox.getByRole('checkbox',{name:'Afficher les outils de traduction'}).isChecked(),false);
 await desktop.screenshot({path:FOLDER+'/06-desktop-parametres-langues.png',fullPage:true});
 await desktopContext.close();
 assert.equal(await content(),originalContent,'No desktop write to pages or translations');
 assert.deepEqual(pageErrors,[],'No uncaught JS exceptions');
 console.log('M028_REAL_M016_BROWSER_PASS mobile=true desktop=true mode_simple=true mode_complet=true data_unchanged=true');
}finally{
 if(page&&originalMode!==null){
  try{await setMode(originalMode);console.log('M028_M016_OWNER_MEMBER_MODE_RESTORED')}
  catch(e){console.error('M028_M016_OWNER_MEMBER_MODE_RESTORE_ERROR',e);throw e}
 }
 await context?.close();
 await browser.close();
}
