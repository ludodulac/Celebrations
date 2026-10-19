// Real Chromium smoke test of Cloudflare staging without credentials or mutations.
// Never interacts with production, performs public clicks and verifies admin gate.
import assert from "node:assert/strict";
import {chromium} from "playwright";
const origin="https://celebrations-exit-staging.rondes.workers.dev";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const errors=[],legacy=[],results={origin};
try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(String(e.stack||e.message).slice(0,900)));
 page.on("request",r=>{if(/jwyayfkssyagvnablttg\.(supabase\.co|storage\.supabase\.co)/.test(r.url()))legacy.push({method:r.method(),url:r.url().slice(0,150)});});
 await page.goto(origin+"/?staging=1",{waitUntil:"domcontentloaded",timeout:45000});
 await page.locator("#welcome-open-program").waitFor({state:"visible",timeout:20000});
 await page.evaluate(()=>window.publicDataReady);
 const before=await page.evaluate(()=>({staging:window.CELEBRATIONS_STAGING_BACKEND,celebrations:window.state?.celebrations?.length,events:window.state?.events?.length,contents:window.state?.contents?.length}));
 assert.equal(before.staging,origin,"Browser did not activate staging bridge");
 assert.ok(before.celebrations>=4&&before.events>=60&&before.contents>=100,
  "Browser did not load D1 programme state");
 Object.assign(results,{browser_data:before});
 await page.locator("#welcome-open-program").click();
 await page.locator(".celebration-inner-nav").first().waitFor({state:"visible",timeout:15000});
 results.programme_heading=await page.locator(".celebration-title-copy h1").first().innerText();
 assert.ok(/Archange/.test(results.programme_heading),"Actual celebration not rendered");
 await page.locator('.celebration-inner-nav button[data-tab="program"]').first().click();
 results.programme_visible=await page.locator("#program").evaluate(e=>!e.classList.contains("hidden"));
 assert.ok(results.programme_visible,"Clicking programme did not show event list");
 await page.locator('.celebration-inner-nav button[data-tab="library"]').first().click();
 results.library_visible=await page.locator("#library").evaluate(e=>!e.classList.contains("hidden"));
 assert.ok(results.library_visible,"Clicking mediathèque did not show the library");
 await page.goto(origin+"/admin.html?staging=1",{waitUntil:"domcontentloaded",timeout:45000});
 await page.locator("#adminPasswordGate").waitFor({state:"visible",timeout:15000});
 assert.ok(await page.locator("body.admin-auth-locked").count(),"Admin HTML must be locked before authentication");
 results.admin_gate=true;
 results.legacy_supabase_requests=legacy;
 results.page_errors=errors.slice(0,12);
 if(process.env.REQUIRE_CLOUDFLARE_ONLY==="1"){
   assert.equal(legacy.length,0,"Isolated Cloudflare site still requests "+legacy.length+" legacy Supabase resources: "+JSON.stringify(legacy.slice(0,4)));
   assert.equal(errors.length,0,"JavaScript errors in staging UI: "+JSON.stringify(errors.slice(0,4)));
 }
 console.log("STAGING_BROWSER_SMOKE "+JSON.stringify(results));
 // Known legacy welcome illustration needs migration; do not silently declare parity.
 if(errors.length)console.warn("STAGING_BROWSER_PAGE_ERRORS "+JSON.stringify(errors.slice(0,12)));
}finally{await browser.close()}
