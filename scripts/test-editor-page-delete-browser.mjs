import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin='https://celebrations-exit-staging.rondes.workers.dev';
const browser=await chromium.launch();
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width===390,hasTouch:width===390});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  let title='';
  page.on('dialog',async dialog=>dialog.accept(dialog.type()==='prompt'?title:undefined));
  const response=await page.goto(origin+'/__editor/demo-preparation?celebration=101',{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200);
  await page.locator('[data-tab="pages"]').click();
  title='Suppression test page '+width;
  await page.getByRole('button',{name:'＋ Page'}).click();
  const row=page.locator('.general-page-row').filter({hasText:title});
  await row.waitFor();
  assert.equal(await row.count(),1);
  // A protected historical home cannot be deleted via the menu.
  const historical=page.locator('.general-page-row').filter({hasText:'Accueil général'});
  if(await historical.count()){
   await historical.locator('summary').click();
   assert.equal(await historical.getByRole('button',{name:'Supprimer la page'}).count(),0);
   await historical.locator('summary').click();
  }
  await row.locator('summary').click();
  await row.getByRole('button',{name:'Supprimer la page'}).click();
  assert.equal(await row.count(),0,'Created general page disappears after confirmation');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="pages"]').click();
  assert.equal(await page.locator('.general-page-row').filter({hasText:title}).count(),0,'Deleted general page stays deleted after reload');

  await page.locator('[data-tab="celebrations"]').click();
  title='Suppression test étape '+width;
  await page.getByRole('button',{name:'＋ Page'}).click();
  const extra=page.locator('.general-page-row').filter({hasText:title});
  await extra.waitFor();
  assert.equal(await extra.getByLabel('Options de la page '+title).count(),1);
  await extra.locator('summary').click();
  await extra.getByRole('button',{name:'Supprimer la page'}).click();
  assert.equal(await extra.count(),0,'New celebration page removed');
  assert.equal(await page.locator('#workspace .list .item').filter({hasText:'Mercredi'}).count(),1,'Historic Wednesday remains');
  assert.deepEqual(errors,[]);
  console.log('SERVER_PAGE_DELETE_PASS mobile='+(width===390)+' general=true extra=true historic_protected=true');
  await context.close();
 }
}finally{await browser.close()}
