import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base='https://celebrations-exit-staging.rondes.workers.dev';
const browser=await chromium.launch();
try{
 for(const mobile of [false,true]){
  const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1366,height:768},hasTouch:mobile,isMobile:mobile});
  const page=await ctx.newPage();page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/__editor/demo-preparation',{waitUntil:'domcontentloaded',timeout:30000});
  const initial=await page.locator('#workspace .list .item').count();assert.ok(initial>=8);
  page.once('dialog',d=>d.accept('Un moment particulier'));
  await page.getByRole('button',{name:'＋ Page',exact:true}).click();
  await page.locator('#workspace .list .item.active').getByText('Un moment particulier').waitFor();
  assert.equal(await page.locator('#workspace .list .item').count(),initial+1);
  await page.locator('[data-tab="pages"]').click();
  assert.equal(await page.locator('#workspace .list .item').count(),1);
  page.once('dialog',d=>d.accept('Informations pratiques'));
  await page.getByRole('button',{name:'＋ Page',exact:true}).click();
  await page.locator('#workspace .list .item.active').getByText('Informations pratiques').waitFor();
  assert.equal(await page.locator('#workspace .list .item').count(),2);
  const [preview]=await Promise.all([page.waitForEvent('popup'),page.locator('#view-site-btn').click()]);
  assert.ok((await preview.locator('body').evaluate(el=>el.classList.contains('is-neutral-preview'))));
  await preview.locator('#menu-toggle').click();
  assert.equal(await preview.locator('.general-tab').count(),3);
  await preview.getByRole('button',{name:'Un moment particulier'}).count().then(count=>assert.equal(count,0,'The extra celebration page is not a general page'));
  await preview.close();
  await page.locator('[data-tab="celebrations"]').click();
  assert.equal(await page.locator('#workspace .list .item').count(),initial+1);
  assert.equal(await page.locator('.celebration-select').count(),1);
  assert.equal(await page.locator('.file-category-tabs').count(),0);
  await page.locator('[data-tab="media"]').click();
  assert.equal(await page.locator('.celebration-select').count(),0,'Files are global, not assigned to one celebration selector');
  assert.equal(await page.locator('.file-category-tabs [data-file-category]').count(),4);
  assert.equal(await page.locator('[data-tab="audio"]').count(),0);
  assert.deepEqual(errors,[]);
  console.log('EXTRA_NEUTRAL_PAGES_PASS mobile='+mobile+' separate_tabs=true extra_celebration=true global_pages=true');
  await ctx.close();
 }
}finally{await browser.close()}
