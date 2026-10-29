// MISSION D4: end-to-end test in real Chromium, staging ONLY.
// QA invitation code is generated at CI runtime. Never print it or upload browser state.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const ORIGIN='https://celebrations-exit-staging.rondes.workers.dev';
const QA_CODE=process.env.D4_QA_CODE;
assert.ok(QA_CODE&&QA_CODE.length>=30,'Masked QA invitation unavailable');
const browser=await chromium.launch({headless:true});
try{
 for(const device of [{name:'desktop',viewport:{width:1366,height:768},isMobile:false},
  {name:'mobile',viewport:{width:390,height:844},isMobile:true}]){
  const ctx=await browser.newContext({viewport:device.viewport,isMobile:device.isMobile});
  const anonymous=await ctx.request.get(ORIGIN+'/__editor/preview?key=home');
  assert.equal(anonymous.status(),401,'Draft visible without administrator session');
  const wrong=await ctx.request.post(ORIGIN+'/__editor/access/session',{
   data:{code:'D4'+crypto.randomUUID().replaceAll('-','')}});
  assert.equal(wrong.status(),401,'Invalid D4 code accepted');
  const page=await ctx.newPage();
  const login=await page.goto(ORIGIN+'/__editor/access',{waitUntil:'domcontentloaded'});
  assert.equal(login.status(),200);
  assert.ok(await page.locator('input#code').isVisible(),'Access field not visible');
  assert.ok(await page.locator('button#connect').isVisible(),'Access submit button not visible');
  await page.locator('input#code').fill(QA_CODE);
  await page.locator('button#connect').click();
  await page.locator('#links:not([hidden])').waitFor({timeout:15000});
  const error=await page.locator('#status').innerText();
  assert.match(error,/Accès autorisé/,'QA invitation failed');
  assert.equal(await page.locator('a[href="/admin.html?staging=1"]').count(),1);
  assert.equal(await page.locator('a[href="/__editor/entry"]').count(),1);
  await page.locator('a[href="/admin.html?staging=1"]').click();
  await page.waitForURL(/\/admin\.html\?staging=1/,{timeout:20000});
  await page.locator('body:not(.admin-auth-locked)').waitFor({timeout:25000});
  assert.equal(await page.locator('#adminPasswordGate').count(),0,'Staging admin asked for official password');
  assert.ok(await page.locator('button[data-admin="home"]').count()>0,'Existing staging admin missing');
  await page.goto(ORIGIN+'/__editor/entry',{waitUntil:'domcontentloaded'});
  await page.waitForURL(/\/__editor\/preview\?key=home/,{timeout:20000});
  assert.ok(await page.locator('main h1').count()>0,'Preview home page not rendered');
  assert.ok(await page.locator('.d-welcome').count()>0,'Preview welcome missing');
  const nav=page.locator('nav a[href*="key=celebration%3A101"]').first();
  if(await nav.count()){
   await nav.click();
   await page.waitForURL(/key=celebration%3A101/,{timeout:12000});
   assert.ok(await page.locator('.d-celebration-title').count()>0,'Celebration page failed after normal login');
  }
  const current=await page.evaluate(()=>({
   width:document.documentElement.scrollWidth,viewport:innerWidth,hasCookie:document.cookie.includes('d2_preview')
  }));
  assert.ok(current.width<=current.viewport+3,'Mobile horizontal overflow in secure preview');
  assert.equal(current.hasCookie,false,'HttpOnly staging preview cookie accessible from JS');
  // Test logout revokes the normal admin session and the browser preview cookie.
  const token=await page.evaluate(()=>localStorage.getItem('celebrations-admin-token'));
  assert.ok(token&&token.length>=64);
  const logout=await ctx.request.post(ORIGIN+'/api/auth',{data:{action:'admin_logout',admin_token:token}});
  assert.equal(logout.status(),200);
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('body').innerText(), 'Preview requires authorized staging access');
  console.log('MISSION_D4_NORMAL_BROWSER_LOGIN_PASS device='+device.name+
   ' login=true original_admin=true preview_navigation=true logout_revokes=true anonymous_401=true');
  await ctx.close();
 }
}finally{await browser.close()}
