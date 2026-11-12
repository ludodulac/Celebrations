// M021-C: real official domain smoke on Android viewport. Only the UI-mode
// preference may be written; NEVER create a test member, page, or celebration.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const ORIGIN='https://ronde-des-archanges-universelle.eu';
const baseline=JSON.parse(readFileSync('/tmp/m021c-official-baseline.json','utf8'));
const CID=String(baseline.counts.first_celebration_id);
assert.match(CID,/^[0-9]+$/);
assert.equal(process.env.M021C_PROD_APPROVED,'YES');
mkdirSync('docs/m021c-official-smartphone',{recursive:true});
const browser=await chromium.launch({headless:true});
let page,sessionAuthorized=false;
async function readMode(){
 const r=await page.request.get(ORIGIN+'/api/site-identity',{failOnStatusCode:false});
 assert.equal(r.status(),200,'Official admin cookie must unlock the settings read');
 const v=await r.json();assert.equal(v.ok,true);return v;
}
async function setMode(value){
 const v=await readMode();
 if(v.memberAccessUiEnabled===value)return;
 const r=await page.request.post(ORIGIN+'/api/site-identity',{
  headers:{origin:ORIGIN,'content-type':'application/json'},
  data:{expectedRevision:v.revision,memberAccessUiEnabled:value},
  failOnStatusCode:false
 });
 assert.equal(r.status(),200,'Official settings write must remain owner-only');
 assert.equal((await r.json()).memberAccessUiEnabled,value);
 assert.equal((await readMode()).memberAccessUiEnabled,value,'Mode persisted on official R2');
}
async function editor(){
 const r=await page.goto(ORIGIN+'/__editor/demo-preparation?celebration='+CID,
  {waitUntil:'domcontentloaded',timeout:35000});
 assert.equal(r?.status(),200,'Official editor, not M016, must render');
 await page.locator('[data-tab="settings"]').waitFor({state:'visible'});
 await page.waitForTimeout(550);
}
async function showMode(){
 await page.locator('[data-tab="settings"]').click();
 const box=page.getByRole('checkbox',{name:'Activer la gestion des membres et des accès privés'});
 await box.waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('.m021b-mode-choice input')?.disabled);
 return box;
}
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const original=await page.goto(ORIGIN+'/',{waitUntil:'domcontentloaded',timeout:35000});
 assert.equal(original?.status(),200,'Historical official public homepage still opens');
 assert.equal(await page.locator('#back-admin').count(),1,'Existing admin footer link retained');
 const unauthed=await page.request.get(ORIGIN+'/api/editor-open-draft?celebration='+CID,
  {failOnStatusCode:false});
 assert.equal(unauthed.status(),401,'Drafts remain private to administrator');
 const unauthMember=await page.request.get(ORIGIN+'/api/admin/member-directory?action=snapshot',
  {failOnStatusCode:false});
 assert.equal(unauthMember.status(),401,'Private member directory remains protected');
 const gate=await page.goto(ORIGIN+'/admin',{waitUntil:'domcontentloaded',timeout:35000});
 assert.equal(gate?.status(),200,'Existing official PIN login form');
 assert.equal(await page.locator('form[action="/api/editor-access"] input[name="code"]').count(),1);
 await page.locator('input[name="code"]').fill(process.env.M017_ADMIN_PASSWORD);
 await Promise.all([
  page.waitForURL(u=>u.pathname==='/admin.html',{timeout:30000}),
  page.locator('button[type="submit"]').click()
 ]);
 sessionAuthorized=true;
 await setMode(false); // User's requested production default.
 await editor();
 let toggle=await showMode();
 assert.equal(await toggle.isChecked(),false,'Official simplified mode set');
 assert.equal(await page.locator('[data-tab="members-spaces"]').isVisible(),false);
 assert.equal(await page.locator('[data-tab="languages-categories"]').innerText(),'◇ Langues');
 await page.screenshot({path:'docs/m021c-official-smartphone/01-officiel-simplifie.png',fullPage:true});
 await page.locator('[data-tab="languages-categories"]').click();
 assert.equal(await page.getByRole('heading',{name:'Langues',exact:true}).isVisible(),true);
 await page.locator('[data-tab="media"]').click();
 assert.equal(await page.locator('#workspace').isVisible(),true);
 await page.locator('[data-tab="pages"]').click();
 assert.equal(await page.locator('.m020-access').count(),0);
 assert.ok(await page.getByRole('button',{name:/Page/i}).count()>0,'Public page controls visible');
 assert.ok(await page.locator('.canvas').count()>0,'Existing page editor interactive');
 await page.locator('#preview-btn').click();
 assert.match(await page.locator('#preview-btn').innerText(),/Revenir à l’édition/);
 await page.locator('#preview-btn').click();
 await page.locator('[data-tab="celebrations"]').click();
 assert.equal(await page.locator('.m020-access').count(),0);
 assert.ok(await page.getByRole('button',{name:'Dupliquer'}).count()>0);
 assert.ok(await page.locator('details.new-celebration').count()>0);
 await page.goto(ORIGIN+'/?page=neutral-accueil-general',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(600);
 assert.equal(await page.locator('#member-connection').isVisible(),false);
 assert.equal(await page.locator('#back-admin').isVisible(),true);

 await setMode(true); // Verify the complete UI, never change rights.
 await editor();toggle=await showMode();
 assert.equal(await toggle.isChecked(),true,'Full admin mode persistent on official site');
 assert.equal(await page.locator('[data-tab="members-spaces"]').isVisible(),true);
 assert.match(await page.locator('[data-tab="languages-categories"]').innerText(),/catégories/i);
 await page.screenshot({path:'docs/m021c-official-smartphone/02-officiel-complet.png',fullPage:true});
 await page.locator('[data-tab="celebrations"]').click();
 assert.ok(await page.locator('.m020-access').count()>0,'Advanced ACL controls restored');
 assert.ok(await page.getByRole('button',{name:'Versions par catégorie'}).count()>0);
 await page.goto(ORIGIN+'/?page=neutral-accueil-general',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(600);
 assert.equal(await page.locator('#member-connection').isVisible(),true);

 await setMode(false); // Leave official site in owner's requested simplified mode.
 await editor();toggle=await showMode();
 assert.equal(await toggle.isChecked(),false);
 assert.equal(await page.locator('[data-tab="members-spaces"]').isVisible(),false);
 await page.reload({waitUntil:'domcontentloaded'});
 toggle=await showMode();assert.equal(await toggle.isChecked(),false,'Setting survives reload');
 assert.deepEqual(errors,[],'No uncaught official JS errors');
 console.log('M021C_REAL_OFFICIAL_SMARTPHONE_AND_PIN_PASS '+JSON.stringify({
  origin:ORIGIN,official:200,admin_pin:true,mode_simplified:true,
  mode_complete:true,returned_simplified:true,private_draft_denied:401,
  private_members_denied:401,page_editor:true,celebration_editor:true,
  media:true,languages:true,preview:true,real_data_mutations:false
 }));
}finally{
 if(sessionAuthorized&&page)try{
  await setMode(false);
  console.log('M021C_OFFICIAL_SIMPLIFIED_MODE_FINAL_OK');
 }catch(e){console.error('M021C_MODE_RESET_FAILED',e.message)}
 await browser.close();
}