// M020-E: isolated M016 online smoke, 390px screenshots, no real members or email.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const origin='https://celebrations-m016-admin-preprod.rondes.workers.dev';
assert.equal(process.env.M020E_ISOLATED_ONLY,'YES');
assert.ok((process.env.M017_ADMIN_PASSWORD||'').length>=16);
const folder='docs/m020e-smartphone';
await mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true});
const checks=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e.message||e)));
 const go=async(relative)=>{
  const response=await page.goto(origin+relative,{waitUntil:'domcontentloaded',timeout:35000});
  assert.equal(response.status(),200,relative+' HTTP 200');
  await page.waitForTimeout(500);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+4);
  assert.equal(overflow,false,relative+' responsive 390px');
 };
 await go('/admin');
 assert.equal(await page.locator('input[name="code"]').count(),1,'existing admin PIN retained');
 await page.locator('input[name="code"]').fill(process.env.M017_ADMIN_PASSWORD);
 await Promise.all([page.waitForURL(u=>u.pathname==='/admin.html',{timeout:30000}),page.locator('button[type="submit"]').click()]);
 await page.waitForLoadState('domcontentloaded');
 assert.match(await page.locator('body').innerText(),/Membres|Célébrations/i);
 await page.screenshot({path:folder+'/01-administration.png',fullPage:true});
 checks.push('admin-login-PIN');
 await go('/?celebration=90000002&lang=fr');
 await page.screenshot({path:folder+'/02-visiteur-fr.png',fullPage:true});
 checks.push('visitor-390px');
 await go('/?celebration=90000002&page=member-area&lang=en');
 await page.screenshot({path:folder+'/03-connexion-membre.png',fullPage:true});
 checks.push('member-interface');
 await go('/?celebration=90000002&page=mediatheque&lang=fr');
 await page.screenshot({path:folder+'/04-mediatheque.png',fullPage:true});
 checks.push('media-interface');
 const unauthorized=await context.request.get(origin+'/api/participant/space-pages?celebration=90000002&lang=fr',{headers:{cookie:''}});
 assert.ok([401,403,404].includes(unauthorized.status()),'Private list must deny unauthenticated readers');
 checks.push('private-denied-'+unauthorized.status());
 assert.deepEqual(errors,[],'No browser JavaScript error');
 console.log('M020E_M016_PUBLIC_AND_ADMIN_SMOKE_PASS '+checks.join(','));
}finally{await browser.close()}
