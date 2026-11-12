// M024: authenticated READ-ONLY browser smoke of the current isolated M016
// editor. No test files, pages, PINs or media can reach the official domain.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const HOST='https://celebrations-m016-admin-preprod.rondes.workers.dev';
const CID='90000002';
assert.equal(process.env.M024_M016_ONLY,'YES');
assert.ok((process.env.M017_ADMIN_PASSWORD||'').length>=16);
const browser=await chromium.launch({headless:true});
try{
 for(const width of [390,1280]){
  const ctx=await browser.newContext({viewport:{width,height:850},isMobile:width===390,hasTouch:width===390});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let unsafeWrites=0;
  await page.route(/\/api\/(editor-media|editor-open-draft|editor-publication|site-identity)/,async route=>{
   if(route.request().method()!=='GET'){unsafeWrites++;await route.abort();return;}
   await route.continue();
  });
  await page.goto(HOST+'/admin',{waitUntil:'domcontentloaded'});
  await page.locator('input[name="code"]').fill(process.env.M017_ADMIN_PASSWORD);
  await Promise.all([
   page.waitForURL(url=>url.pathname==='/admin.html',{timeout:30000}),
   page.locator('button[type="submit"]').click()
  ]);
  await page.goto(HOST+'/__editor/demo-preparation?celebration='+CID,{waitUntil:'domcontentloaded'});
  const settings=page.locator('[data-tab="settings"]');
  await settings.click();
  await page.getByRole('checkbox',{name:'Activer la gestion des membres et des accès privés'}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Identité du site',exact:true}).count(),0,
    'Site identity editing was removed from Settings');
  assert.equal(await page.getByRole('button',{name:'Enregistrer l’identité'}).count(),0);
  await page.locator('[data-tab="media"]').click();
  await page.locator('[data-file-category="images"]').waitFor({timeout:20000});
  for(const category of ['images','audios','videos','autres']){
   await page.locator('[data-file-category="'+category+'"]').click();
   await page.waitForTimeout(350);
   const cards=page.locator('.global-media-card');
   for(let i=0;i<await cards.count();i++){
    const card=cards.nth(i),unused=await card.getAttribute('data-usage');
    const button=card.getByRole('button',{name:'Supprimer si inutilisé'});
    assert.equal(await button.count(),unused==='unused'?1:0,
     'Only confidently unused media may show DELETE: '+category);
   }
  }
  assert.equal(unsafeWrites,0,'Read-only smoke must never modify isolated M016 or official data');
  assert.deepEqual(errors,[],'No uncaught browser JavaScript errors');
  console.log('M024_M016_BROWSER_PASS '+JSON.stringify({width,identityRemoved:true,mediaCategories:4,
   protectedMediaDeleteButtonsHidden:true,noWrites:true}));
  await ctx.close();
 }
}finally{await browser.close()}
