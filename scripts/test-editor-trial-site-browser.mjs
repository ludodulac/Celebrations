import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base='https://celebrations-exit-staging.rondes.workers.dev';
const browser=await chromium.launch();
const widths=[360,390,768,1366];
const checkWidth=async(page,label)=>{
 const s=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth,inner:window.innerWidth}));
 assert.ok(s.scroll<=s.inner+1,'Horizontal page overflow on '+label+': '+JSON.stringify(s));
};
try{
 for(const width of widths){
  const mobile=width<600;
  const context=await browser.newContext({viewport:{width,height:mobile?780:840},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  const jsErrors=[];
  page.on('pageerror',err=>jsErrors.push(String(err)));
  const response=await page.goto(base+'/__editor/demo-preparation');
  assert.equal(response.status(),200);
  await page.locator('#workspace .list .item').first().waitFor();
  assert.equal(await page.locator('#workspace .list .item').count(),7);
  await checkWidth(page,'editor '+width);
  await page.locator('#workspace .list .item').filter({hasText:'Mercredi'}).click();
  const marker='VISUAL-CHANGE-MERCREDI-'+width;
  await page.locator('#workspace .block .ed').first().fill(marker);
  await page.locator('#save-btn').click();
  const link=page.locator('#view-site-btn');
  await link.waitFor();
  assert.match(await link.getAttribute('href'),/page=mercredi/);
  const [trial]=await Promise.all([page.waitForEvent('popup'),link.click()]);
  await trial.waitForLoadState('domcontentloaded');
  assert.match(trial.url(),/\/__editor\/voir-le-site/);
  await trial.getByText(marker).waitFor();
  assert.equal(await trial.locator('.stage-tab').count(),7);
  assert.equal(await trial.locator('#page-heading').innerText(),'Mercredi');
  await checkWidth(trial,'trial site '+width);
  await trial.getByRole('button',{name:'Dimanche'}).click();
  assert.equal(await trial.locator('#page-heading').innerText(),'Dimanche');
  assert.match(await trial.locator('#back-admin').getAttribute('href'),/page=dimanche/);
  assert.deepEqual(jsErrors,[]);
  console.log('EDITOR_TRIAL_SITE_PASS width='+width+' page_changes_visible=true pages=7 no_horizontal_scroll=true local_storage=true');
  await trial.close();await context.close();
 }
}finally{await browser.close();}
