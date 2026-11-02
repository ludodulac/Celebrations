import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin='https://celebrations-exit-staging.rondes.workers.dev';
const names=['Accueil de la célébration','Préparation','Mercredi','Jeudi','Vendredi','Samedi','Dimanche','Après célébration'];
const browser=await chromium.launch();
try {
 for(const mobile of [false,true]) {
  const context=await browser.newContext({
   viewport:mobile?{width:390,height:844}:{width:1366,height:768},
   isMobile:mobile,hasTouch:mobile
  });
  const page=await context.newPage();
  page.setDefaultTimeout(12000);
  const errors=[];
  page.on('pageerror',err=>errors.push(String(err)));
  const res=await page.goto(origin+'/__editor/demo-preparation',{waitUntil:'domcontentloaded',timeout:30000});
  assert.equal(res.status(),200,'Seven-page stage editor must be available');
  const sidebar=page.locator('#workspace .list .item');
  await sidebar.first().waitFor();
  assert.equal(await sidebar.count(),8,'Only celebration pages appear under Célébrations');
  assert.equal(await page.locator('.celebration-select').count(),1);
  for (const name of names) {
    const button=page.locator('#workspace .list .item').filter({hasText:name});
    assert.equal(await button.count(),1,'Stage navigation '+name);
    await button.click();
    assert.ok((await page.locator('#workspace .list .item.active').innerText()).includes(name));
    assert.equal(await page.locator('.editor-head h2').count(),0,'No uneditable duplicate title above '+name);
  }
  await page.locator('[data-tab="pages"]').click();
  assert.equal(await page.locator('#workspace .list .item').count(),1,'Pages tab excludes celebration days');
  assert.ok((await page.locator('#workspace .list .item').first().innerText()).includes('Accueil général'));
  assert.equal(await page.locator('.celebration-select').count(),0);
  await page.locator('[data-tab="celebrations"]').click();
  await page.locator('#workspace .list .item').filter({hasText:'Mercredi'}).click();
  await page.locator('.block .ed').first().fill('Essai local mercredi');
  await page.locator('#save-btn').click();
  await page.reload();
  await page.locator('#workspace .list .item').filter({hasText:'Mercredi'}).click();
  await page.getByText('Essai local mercredi').waitFor();
  await page.getByRole('button',{name:'✧ Préparation',exact:true}).click();
  assert.ok(await page.locator('#workspace .canvas .block').count()>=1);
  assert.deepEqual(errors,[],'No browser JavaScript errors');
  console.log('CELEBRATION_PAGES_PASS mobile='+mobile+' celebration_pages=8 general_pages=1 public_only=true browser_local_edit=true');
  await context.close();
 }
} finally {await browser.close();}
