// M030 M09 — Chromium staging proof, M016 only, NO data writes, NO official deploy.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const HOST='https://celebrations-m016-admin-preprod.rondes.workers.dev';
assert.equal(process.env.M030_M016_ONLY,'YES');
assert.ok((process.env.M017_ADMIN_PASSWORD||'').length>=16);
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1300,height:880}});
const mobileCtx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const folder='docs/m030-M016-screens';mkdirSync(folder,{recursive:true});
const page=await ctx.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 let r=await page.goto(HOST+'/admin',{waitUntil:'domcontentloaded'});
 assert.equal(r.status(),200);
 await page.locator('input[name="code"]').fill(process.env.M017_ADMIN_PASSWORD);
 await Promise.all([
  page.waitForURL(u=>u.pathname==='/admin.html',{timeout:30000}),
  page.locator('button[type="submit"]').click()
 ]);
 console.log('M030_M09_M016_AUTH_GATE_PASS');
 r=await page.goto(HOST+'/__editor/demo-preparation?celebration=90000002',{waitUntil:'domcontentloaded'});
 assert.equal(r.status(),200);
 await page.locator('[data-tab="celebrations"]').click();
 await page.locator('.m030-planned-cycles').waitFor();
 assert.equal(await page.locator('.m030-cycle-group').count(),14);
 assert.equal(await page.locator('.m030-cycle-group .m030-cycle-row').count(),56);
 assert.equal(await page.locator('.m030-planned-cycles summary').first().innerText(),'Célébrations prévues (2026–2039)');
 assert.equal(await page.getByText('Date du mercredi :').count(),0);
 assert.equal(await page.getByText('Dates de préparation').count(),0);
 assert.equal(await page.getByText('+ Nouvelle célébration').count(),0);
 assert.equal(await page.locator('.m030-cycle-row').first().getByText('Michaël 2026').count(),1);
 const history=await page.locator('.m030-cycle-group').first().locator('summary').textContent();
 assert.ok(history.includes('2026'));
 await page.screenshot({path:folder+'/01-admin-cycles-ordinateur.png',fullPage:true});
 await page.locator('.m030-planned-cycles>summary').click();
 await page.locator('.m030-cycle-group').first().locator('summary').click();
 await page.screenshot({path:folder+'/02-admin-cycle-2026.png',fullPage:true});
 console.log('M030_M09_M016_CANONICAL_EDITOR_PASS cycles=14 slots=56 no_wednesday_form=true');
 // Visitor listing must never show duplicate cards, and any private-only
 // labels must remain unclickable. Never generate or publish test content.
 await mobileCtx.addCookies(await ctx.cookies(HOST));
 const mobile=await mobileCtx.newPage(),mErrors=[];
 mobile.on('pageerror',e=>mErrors.push(e.message));
 const attempts=[];
 let route=null;
 for(const cid of ['101','102','103','104','105','106','90000001','90000002']){
  const response=await mobileCtx.request.get(HOST+'/__editor/voir-le-site?celebration='+cid+'&page=celebrations',
   {failOnStatusCode:false});
  attempts.push({cid,status:response.status()});
  if(response.status()===200){route=cid;break}
 }
 // An isolated M016 instance may contain only test or private-only IDs. The
 // absence of a public canonical year is a safe result, never auto-publish.
 if(route){
  r=await mobile.goto(HOST+'/__editor/voir-le-site?celebration='+route+'&page=celebrations',
   {waitUntil:'domcontentloaded'});
  assert.equal(r.status(),200);
  await mobile.locator('#stage-main').waitFor();
  await mobile.waitForTimeout(800);
  const titles=await mobile.locator('.celebration-choice strong').allTextContents();
  assert.equal(new Set(titles).size,titles.length,'One visitor card per cycle');
  assert.equal(await mobile.locator('.celebration-choice a').count(),0,
   'Public/private cards are never nested arbitrary anchors');
  const privateCards=mobile.locator('div.celebration-choice');
  for(let i=0;i<await privateCards.count();i++)
   assert.equal(await privateCards.nth(i).locator('a').count(),0);
  await mobile.screenshot({path:folder+'/03-visiteur-smartphone-celebrations.png',fullPage:true});
  console.log('M030_M09_M016_VISITOR_PASS '+JSON.stringify({publicRoute:route,uniqueTitles:titles.length,privateUnclickable:true}));
 }else{
  console.log('M030_M09_M016_NO_PUBLIC_CANONICAL_SLOT '+JSON.stringify({attempts}));
  // No private page should be made visible to solve a staging fixture mismatch.
 }
 assert.deepEqual(errors,[],'Desktop has no runtime browser errors');
 assert.deepEqual(mErrors,[],'Mobile has no runtime browser errors');
 console.log('M030_M09_M016_BROWSER_PASS no_mutation=true');
}finally{await ctx.close();await mobileCtx.close();await browser.close()}
