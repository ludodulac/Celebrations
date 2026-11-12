// M021-B: live checks on the existing *isolated* M016 worker. No official writes.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const HOST='https://celebrations-m016-admin-preprod.rondes.workers.dev';
const FOLDER='docs/m021b-smartphone';
assert.equal(process.env.M021B_ISOLATED_ONLY,'YES');
assert.ok((process.env.M017_ADMIN_PASSWORD||'').length>=16);
await mkdir(FOLDER,{recursive:true});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

const browser=await chromium.launch({headless:true});
let page,baseline;
async function readMode(){
 const response=await page.request.get(HOST+'/api/site-identity',{failOnStatusCode:false});
 assert.equal(response.status(),200,'owner mode read should remain PIN protected');
 const info=await response.json();
 assert.equal(info.ok,true);
 assert.equal(typeof info.memberAccessUiEnabled,'boolean');
 return info;
}
async function apiMode(mode){
 const previous=await readMode();
 if(previous.memberAccessUiEnabled===mode)return previous;
 const response=await page.request.post(HOST+'/api/site-identity',{
  headers:{origin:HOST,'content-type':'application/json'},
  data:{expectedRevision:previous.revision,memberAccessUiEnabled:mode},
  failOnStatusCode:false
 });
 assert.equal(response.status(),200,'save admin mode in isolated editor R2 only');
 assert.equal((await response.json()).memberAccessUiEnabled,mode);
 return readMode();
}
async function waitMode(value){
 for(let i=0;i<35;i++){
  if((await readMode()).memberAccessUiEnabled===value)return;
  await sleep(300);
 }
 throw Error('Mode setting did not persist');
}
async function goEditor(){
 const response=await page.goto(HOST+'/__editor/demo-preparation?celebration=90000002',
  {waitUntil:'domcontentloaded'});
 assert.equal(response.status(),200,'editor must remain accessible via owner PIN');
 await page.locator('[data-tab="settings"]').waitFor();
}
async function modePanel(){
 await page.locator('[data-tab="settings"]').click();
 const label=page.getByRole('checkbox',{name:'Activer la gestion des membres et des accès privés'});
 await label.waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.querySelector('.m021b-mode-choice input')?.disabled);
 return label;
}
try{
 const context=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true
 });
 page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(String(e.message||e)));
 const blocked=await page.request.get(HOST+'/api/site-identity',{failOnStatusCode:false});
 assert.ok([401,403].includes(blocked.status()),'anonymous mode access must be denied');
 const pinPage=await page.goto(HOST+'/admin',{waitUntil:'domcontentloaded'});
 assert.equal(pinPage.status(),200,'existing PIN page remains accessible');
 await page.locator('input[name="code"]').fill(process.env.M017_ADMIN_PASSWORD);
 await Promise.all([
  page.waitForURL(u=>u.pathname==='/admin.html',{timeout:30000}),
  page.locator('button[type="submit"]').click()
 ]);
 baseline=await readMode();
 // A previously enabled mode is temporarily disabled and restored at the end.
 await apiMode(false);
 await goEditor();
 let check=await modePanel();
 assert.equal(await check.isChecked(),false);
 assert.equal(await page.locator('[data-tab="members-spaces"]').isVisible(),false);
 assert.match(await page.locator('[data-tab="languages-categories"]').innerText(),/Langues/);
 assert.doesNotMatch(await page.locator('[data-tab="languages-categories"]').innerText(),/catégories/i);
 await page.screenshot({path:FOLDER+'/01-mode-simplifie.png',fullPage:true});

 await page.locator('[data-tab="languages-categories"]').click();
 assert.equal(await page.getByRole('heading',{name:'Langues',exact:true}).isVisible(),true);
 assert.equal(await page.getByRole('button',{name:'Catégories',exact:true}).count(),0);
 await page.locator('[data-tab="media"]').click();
 assert.equal(await page.locator('#workspace').isVisible(),true);
 await page.locator('[data-tab="celebrations"]').click();
 assert.equal(await page.locator('.m020-access').count(),0);
 assert.ok(await page.getByRole('button',{name:/Dupliquer/i}).count()>0);
 const siteBefore=await page.request.get(HOST+'/?page=neutral-accueil-general');
 assert.equal(siteBefore.status(),200);
 await page.goto(HOST+'/?page=neutral-accueil-general',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(800);
 assert.equal(await page.locator('#member-connection').isVisible(),false,
  'login entry hidden in simplified display');

 await goEditor();
 check=await modePanel();
 await check.check();
 await waitMode(true);
 await page.reload({waitUntil:'domcontentloaded'});
 check=await modePanel();
 assert.equal(await check.isChecked(),true,'full mode survives refresh');
 assert.equal(await page.locator('[data-tab="members-spaces"]').isVisible(),true);
 assert.match(await page.locator('[data-tab="languages-categories"]').innerText(),/catégories/i);
 await page.screenshot({path:FOLDER+'/02-mode-complet.png',fullPage:true});
 await page.locator('[data-tab="celebrations"]').click();
 assert.ok(await page.locator('.m020-access').count()>0);
 assert.ok(await page.getByRole('button',{name:'Versions par catégorie'}).count()>0);
 await page.locator('[data-tab="members-spaces"]').click();
 await page.waitForTimeout(900);
 await page.screenshot({path:FOLDER+'/03-membres-mode-complet.png',fullPage:true});

 await page.goto(HOST+'/?page=neutral-accueil-general',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(800);
 assert.equal(await page.locator('#member-connection').isVisible(),true,
  'member login entry returns in full mode');
 // The member/session endpoints remain guarded in either UI mode.
 const protectedResponse=await page.request.get(HOST+'/api/admin/private-editor?celebration=90000002',
  {failOnStatusCode:false});
 assert.ok([400,401,403,405].includes(protectedResponse.status()),
  'browser preference must not create unguarded private editor access');

 await goEditor();
 check=await modePanel();
 await check.uncheck();
 await waitMode(false);
 await page.reload({waitUntil:'domcontentloaded'});
 check=await modePanel();
 assert.equal(await check.isChecked(),false,'simplified mode survives refresh');
 assert.equal(await page.locator('[data-tab="members-spaces"]').isVisible(),false);
 assert.deepEqual(errors,[],'mobile Chromium errors');
 console.log('M021B_SIMPLIFIED_FULL_M016_MOBILE_PASS');
}finally{
 if(page&&baseline){
  try{await apiMode(baseline.memberAccessUiEnabled);console.log('M021B_OWNER_MODE_RESTORED');}
  catch(e){console.error('M021B_RESTORE_FAILED',String(e))}
 }
 await browser.close();
}