// M023: non-mutating Chromium proof that REAL stage navigation on isolated
// M016 remains clickable and all historical pages have useful ⋯ menus.
// No D1/R2 writes, no fake database rows, no production PIN.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const HOST='https://celebrations-m016-admin-preprod.rondes.workers.dev',CID='90000002';
assert.equal(process.env.M022_M016_ONLY,'YES');
assert.ok((process.env.M017_ADMIN_PASSWORD||'').length>=16);
const browser=await chromium.launch({headless:true});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let forbiddenWrites=0;
  await page.route(/\/api\/(editor-open-draft|editor-publication|admin\/private-editor)/,async route=>{
   if(route.request().method()!=='GET'){forbiddenWrites++;await route.abort();return;}
   await route.continue();
  });
  await page.goto(HOST+'/admin',{waitUntil:'domcontentloaded'});
  await page.locator('input[name="code"]').fill(process.env.M017_ADMIN_PASSWORD);
  await Promise.all([
   page.waitForURL(url=>url.pathname==='/admin.html',{timeout:30000}),
   page.locator('button[type="submit"]').click()
  ]);
  await page.goto(HOST+'/__editor/demo-preparation?celebration='+CID,{waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="celebrations"]').click();
  const prep=page.locator('button.item[data-page-id="preparation-'+CID+'"]');
  const mercredi=page.locator('button.item[data-page-id="mercredi-'+CID+'"]');
  await prep.waitFor({timeout:16000});await mercredi.waitFor({timeout:16000});
  const count=await page.locator('.general-page-row').count();
  assert.ok(count>=2,'Existing historical pages must be present');
  assert.equal(await page.locator('.general-page-row .page-options>summary').count(),count,
   'Every historical page must retain an actionable ellipsis');
  const prepRow=prep.locator('xpath=..');
  assert.equal(await prep.isEnabled(),true);
  assert.match((await prep.evaluate(x=>getComputedStyle(x).cursor)),/pointer/);
  await prepRow.locator('summary').click();
  await prepRow.getByRole('button',{name:'Modifier cette page'}).waitFor();
  await prepRow.getByRole('combobox',{name:'Visibilité de la page'}).waitFor();
  assert.equal(await prepRow.getByRole('button',{name:'Supprimer la page'}).count(),0,
   'Fixed historic stages are protected against irreversible deletion');
  assert.match(await prepRow.locator('.page-options-protected').innerText(),/Masqué/);
  await prepRow.getByRole('button',{name:'Modifier cette page'}).click();
  assert.ok((await page.locator('button.item.active').first().innerText()).includes('Préparation'));
  await mercredi.click();
  assert.ok((await page.locator('button.item.active').first().innerText()).includes('Mercredi'),
   'Clicking a different historical day must navigate and edit the selected page');
  const mercrediRow=mercredi.locator('xpath=..');
  await mercrediRow.locator('summary').click();
  await mercrediRow.getByRole('button',{name:'Modifier cette page'}).waitFor();
  assert.equal(forbiddenWrites,0,'Tests must not change M016 or official content');
  assert.deepEqual(errors,[],'Historical menu click must not throw uncaught errors');
  console.log('M023_HISTORICAL_PAGE_MENU_AND_NAVIGATION_PASS width='+width+
   ' rows='+count+' real_M016_preview=true no_writes=true');
  await context.close();
 }
}finally{await browser.close();}
