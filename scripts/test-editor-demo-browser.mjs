import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base='https://celebrations-exit-staging.rondes.workers.dev';
const browser=await chromium.launch();
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1366,height:768},isMobile:mobile,hasTouch:mobile});
  const page=await context.newPage();
  const response=await page.goto(base+'/__editor/demo');
  assert.equal(response.status(),200);
  await page.locator('.ed').first().fill('Essai visuel');
  await page.locator('#save-btn').click();
  await page.reload();
  await page.getByText('Essai visuel').waitFor();
  await page.locator('[data-tab="celebrations"]').click();
  await page.getByText('Programme de démonstration').waitFor();
  console.log('VISUAL_DEMO_PASS mobile='+mobile);
  await context.close();
 }
}finally{await browser.close();}
