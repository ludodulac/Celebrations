import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin='https://celebrations-exit-staging.rondes.workers.dev';
const names=['Accueil de la célébration','Préparation','Mercredi','Jeudi','Vendredi','Samedi','Dimanche','Après préparation','Accueil général'];
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
  const res=await page.goto(origin+'/__editor/demo-preparation');
  assert.equal(res.status(),200,'Seven-page stage editor must be available');
  const sidebar=page.locator('#workspace .list .item');
  await sidebar.first().waitFor();
  assert.equal(await sidebar.count(),9,'Eight celebration pages and neutral home');
  for (const name of names) {
    const button=sidebar.getByRole('button',{name:(name==='Accueil général'?'▤ ':'✧ ')+name,exact:true});
    assert.equal(await button.count(),1,'Stage navigation '+name);
    await button.click();
    assert.equal((await page.locator('.editor-head h2').innerText()).trim(),name);
    assert.ok(await page.locator('#workspace .canvas .block').count()>=1,'Stage content blocks '+name);
  }
  await sidebar.filter({hasText:'Mercredi'}).click();
  await page.locator('.block .ed').first().fill('Essai local mercredi');
  await page.locator('#save-btn').click();
  await page.reload();
  await page.locator('#workspace .list .item').filter({hasText:'Mercredi'}).click();
  await page.getByText('Essai local mercredi').waitFor();
  await page.locator('#workspace .list .item').filter({hasText:'Préparation'}).click();
  assert.ok(await page.locator('#workspace .canvas .block').count()>=1);
  assert.deepEqual(errors,[],'No browser JavaScript errors');
  console.log('CELEBRATION_PAGES_PASS mobile='+mobile+' pages=9 public_only=true browser_local_edit=true');
  await context.close();
 }
} finally {await browser.close();}
,'i')});
    assert.equal(await button.count(),1,'Stage navigation '+name);
    await button.click();
    assert.equal((await page.locator('.editor-head h2').innerText()).trim(),name);
    assert.ok(await page.locator('#workspace .canvas .block').count()>=1,'Stage content blocks '+name);
  }
  await sidebar.filter({hasText:'Mercredi'}).click();
  await page.locator('.block .ed').first().fill('Essai local mercredi');
  await page.locator('#save-btn').click();
  await page.reload();
  await page.locator('#workspace .list .item').filter({hasText:'Mercredi'}).click();
  await page.getByText('Essai local mercredi').waitFor();
  await page.locator('#workspace .list .item').filter({hasText:'Préparation'}).click();
  assert.ok(await page.locator('#workspace .canvas .block').count()>=1);
  assert.deepEqual(errors,[],'No browser JavaScript errors');
  console.log('CELEBRATION_PAGES_PASS mobile='+mobile+' pages=9 public_only=true browser_local_edit=true');
  await context.close();
 }
} finally {await browser.close();}
