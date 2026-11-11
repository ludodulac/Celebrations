// M021-A: smoke the already isolated M016 worker only, with the owner's PIN.
// No production domain or real member data, and no persistent demo users.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const HOST='https://celebrations-m016-admin-preprod.rondes.workers.dev';
assert.equal(process.env.M021A_ISOLATED_ONLY,'YES');
assert.ok((process.env.M017_ADMIN_PASSWORD||'').length>=16);
const anonymous=await fetch(HOST+'/',{redirect:'manual'});
assert.equal(anonymous.status,302,'anonymous visitors must get PIN redirect');
assert.equal(new URL(anonymous.headers.get('location')).pathname,'/admin');
const blocked=await fetch(HOST+'/api/site-identity');
assert.ok([401,403,404].includes(blocked.status),'site identity API must refuse anonymous requests');
const folder='docs/m021a-smartphone';
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(String(e.message||e)));
 let resp=await page.goto(HOST+'/admin',{waitUntil:'domcontentloaded'});
 assert.equal(resp.status(),200);
 await page.locator('input[name="code"]').fill(process.env.M017_ADMIN_PASSWORD);
 await Promise.all([
  page.waitForURL(u=>u.pathname==='/admin.html',{timeout:30000}),
  page.locator('button[type="submit"]').click()
 ]);
 await page.screenshot({path:folder+'/01-pin-admin.png',fullPage:true});
 resp=await page.goto(HOST+'/__editor/demo-preparation?celebration=90000002',
  {waitUntil:'domcontentloaded'});
 assert.equal(resp.status(),200,'existing editor accessible with PIN');
 await page.waitForTimeout(1700);
 const settings=page.locator('[data-tab="settings"]');
 await settings.click();
 await page.getByRole('heading',{name:'Identité du site'}).waitFor();
 const titre=page.getByPlaceholder('Ronde des Archanges Universelle');
 await titre.fill('M021 — Aperçu temporaire');
 await page.getByText('M021 — Aperçu temporaire',{exact:true}).waitFor();
 await page.screenshot({path:folder+'/02-identite-preview-mobile.png',fullPage:true});
 // Restore untouched: preview changes are unsaved.
 await page.locator('[data-tab="members-spaces"]').click();
 await page.waitForTimeout(2200);
 const memberText=await page.locator('body').innerText();
 console.log('M021A_MEMBER_DEBUG '+JSON.stringify({
  text:memberText.slice(0,3200),errors,visiblePanels:await page.locator('.m021-demo-members').count(),
  path:page.url()}));
 await page.screenshot({path:folder+'/03-comptes-fictifs-mobile.png',fullPage:true});
 await page.getByRole('heading',{name:/Comptes fictifs/}).waitFor({timeout:12000});
 const response=await page.request.get(HOST+'/api/site-identity');
 assert.equal(response.status(),200,'identity read protected by owner cookie');
 assert.equal((await response.json()).ok,true);
 resp=await page.goto(HOST+'/?celebration=90000002&page=member-area&lang=fr',
  {waitUntil:'domcontentloaded'});
 assert.equal(resp.status(),200);
 await page.screenshot({path:folder+'/04-connexion-mobile.png',fullPage:true});
 assert.deepEqual(errors,[],'browser must not raise JS exceptions');
 console.log('M021A_M016_PIN_RESPONSIVE_SMOKE_PASS');
}finally{await browser.close();}
