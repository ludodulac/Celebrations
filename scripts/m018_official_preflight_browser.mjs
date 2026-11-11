// M018 browser preflight on official site before release: read-only.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin='https://ronde-des-archanges-universelle.eu';
const b=await chromium.launch({headless:true});
try{
 const page=await b.newPage();
 const response=await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:35000});
 assert.equal(response?.status(),200);
 const admin=page.locator('a[href$="/admin"],a[href$="/admin.html"],a[href*="/admin?"]').first();
 const found=await admin.count();
 assert.ok(found,'Existing homepage must have an Administration link');
 await admin.click();
 await page.waitForURL(u=>['/admin','/admin.html'].includes(u.pathname),{timeout:15000});
 assert.equal(new URL(page.url()).origin,origin);
 assert.equal(await page.locator('input[name="code"]').count(),1,
  'Owner usual PIN form must remain');
 console.log('M018_OFFICIAL_PREP_SMOKE_OK visitor=200 admin_link=true pin_form=true');
}finally{await b.close()}
