import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base='https://celebrations-exit-staging.rondes.workers.dev';
const browser=await chromium.launch();
try{
 for(const width of [390,1280]){
  const ctx=await browser.newContext({viewport:{width,height:850},isMobile:width===390,hasTouch:width===390});
  const page=await ctx.newPage();page.setDefaultTimeout(18000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/__editor/demo');
  assert.ok(page.url().endsWith('/__editor/demo-preparation'),'The old design must redirect to the new editor');
  await page.goto(base+'/__editor/demo-preparation?celebration=101');
  await page.locator('#workspace .list .item').first().waitFor();
  const publicAudio=await page.evaluate(()=>window.__PREPARATION_SEED__?.media?.map(x=>x.name)||[]);
  console.log('SITE_HISTORICAL_AUDIO_CATALOGUE count='+publicAudio.length+' examples='+publicAudio.slice(0,4).join(', '));
  assert.equal(await page.locator('#workspace .list .item').count(),9);
  assert.equal(await page.locator('.editor-head h2').innerText(),'Accueil de la célébration');
  await page.locator('[data-tab="celebrations"]').click();
  await page.getByText('Préparer la prochaine célébration : Gabriel').waitFor();
  await page.getByLabel('Date du mercredi').fill('2026-11-04');
  await page.getByRole('button',{name:'Créer le brouillon Gabriel'}).click();
  await page.waitForURL('**/demo-preparation?celebration=plan-gabriel-2026-11-04');
  assert.equal(await page.locator('.editor-head h2').innerText(),'Accueil de la célébration');
  assert.equal(await page.locator('#workspace .list .item').count(),9);
  await page.locator('#workspace .list .item').filter({hasText:'Dimanche'}).click();
  assert.ok((await page.locator('.canvas').innerText()).includes('2026-11-08'));
  const [preview]=await Promise.all([page.waitForEvent('popup'),page.locator('#view-site-btn').click()]);
  await preview.locator('#page-heading').getByText('Dimanche').waitFor();
  await preview.locator('#menu-toggle').click();
  await preview.getByRole('button',{name:'✧ Célébrations'}).click();
  await preview.locator('#page-heading').getByText('Choisir une célébration').waitFor();
  assert.ok(await preview.locator('.celebration-choice').count()>=2);
  await preview.locator('#menu-toggle').click();
  await preview.getByRole('button',{name:'⌂ Accueil'}).click();
  await preview.locator('#page-heading').getByText('Accueil général').waitFor();
  assert.ok(await preview.locator('body').evaluate(e=>e.classList.contains('is-neutral-preview')));
  const back=await preview.locator('#back-admin').getAttribute('href');
  assert.ok(back.includes('page=neutral-accueil-general'));
  await preview.locator('#back-admin').click();
  await page.locator('[data-tab="audio"]').click();
  await page.locator('[data-action="back-to-editor"]').click();
  await page.locator('.editor-head h2').waitFor();
  assert.deepEqual(errors,[]);
  console.log('SITE_CYCLE_PASS mobile='+(width===390)+' next_gabriel=true planned_date=true menu_home=true menu_celebrations=true admin_return=true');
  await ctx.close();
 }
}finally{await browser.close()}
