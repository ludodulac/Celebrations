import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base='https://celebrations-exit-staging.rondes.workers.dev';
const browser=await chromium.launch();
try {
 for(const mobile of [false,true]){
  const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1366,height:768},hasTouch:mobile,isMobile:mobile});
  const page=await ctx.newPage();
  page.setDefaultTimeout(14000);
  await page.goto(base+'/__editor/demo-preparation');
  await page.locator('#workspace .list .item').first().waitFor();
  assert.equal(await page.locator('#workspace .list .item').count(),9);
  page.once('dialog',d=>d.accept('Un moment particulier'));
  await page.getByRole('button',{name:'Page dans la célébration'}).click();
  await page.locator('.editor-head').getByText('Un moment particulier').waitFor();
  assert.equal(await page.locator('#workspace .list .item').count(),10);
  const extraId=await page.evaluate(()=>JSON.parse(localStorage.getItem('celebrations-demo-preparation-'+window.__PREPARATION_SEED__.celebrationId)).pages.find(p=>p.name==='Un moment particulier').id);
  assert.ok(extraId.startsWith('extra-'));
  page.once('dialog',d=>d.accept('Informations pratiques'));
  await page.getByRole('button',{name:'Page hors célébration'}).click();
  await page.locator('.editor-head').getByText('Informations pratiques').waitFor();
  assert.equal(await page.locator('#workspace .list .item').count(),11);
  assert.equal(await page.locator('#theme-toggle').isVisible(),false);
  const trialURL=await page.locator('#view-site-btn').getAttribute('href');
  assert.ok(trialURL.includes('neutral-'));
  const [trial]=await Promise.all([page.waitForEvent('popup'),page.locator('#view-site-btn').click()]);
  await trial.locator('#page-heading').getByText('Informations pratiques').waitFor();
  assert.equal(await trial.locator('#stage-navigation').isVisible(),false);
  assert.ok(await trial.locator('body').evaluate(e=>e.classList.contains('is-neutral-preview')));
  await trial.locator('#menu-toggle').click();
  assert.equal(await trial.locator('.general-tab').count(),2);
  await trial.locator('#return-celebration').click();
  assert.equal(await trial.locator('.stage-tab').count(),9);
  await trial.getByRole('button',{name:'Un moment particulier'}).click();
  assert.equal(await trial.locator('#page-heading').innerText(),'Un moment particulier');
  const width=await trial.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:window.innerWidth}));
  assert.ok(width.scroll<=width.inner+1,'no horizontal overflow '+JSON.stringify(width));
  console.log('EXTRA_NEUTRAL_PAGES_PASS mobile='+mobile+' celebration_extra=true neutral_hamburger=true colored_border=true');
  await trial.close();await ctx.close();
 }
}finally{await browser.close()}
