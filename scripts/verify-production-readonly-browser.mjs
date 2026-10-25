// True-browser/mobile read-only production-data candidate smoke.
// Block every browser POST to avoid analytics/admin writes and reject any
// legacy Supabase fetch, JS failure, or unlocked administration screen.
import assert from "node:assert/strict";
import {chromium} from "playwright";
const approved=new Set([
 "https://celebrations-exit-preview-ro.rondes.workers.dev",
 "https://celebrations-exit-production.rondes.workers.dev"
]);
const origin=process.env.CELEBRATIONS_READONLY_BROWSER_ORIGIN||
 "https://celebrations-exit-preview-ro.rondes.workers.dev";
assert.ok(approved.has(origin),"Refuse unknown audit origin: no production domain changes");
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const result={};
try{
 const context=await browser.newContext({
  viewport:{width:390,height:844},
  serviceWorkers:"block"
 });
 const page=await context.newPage();
 const legacy=[],errors=[],mutationAttempts=[],serverFailures=[];
 page.on("pageerror",e=>errors.push(String(e.name||"Error")));
 page.on("request",r=>{
  if(/jwyayfkssyagvnablttg\.(supabase\.co|storage\.supabase\.co)/i.test(r.url()))
    legacy.push(r.method());
 });
 // Browser probe must not add any visit/click row, even if preview regresses.
 await page.route("**/*",async route=>{
  const req=route.request();
  if(req.method()!=="GET"&&req.method()!=="HEAD"){
   mutationAttempts.push(new URL(req.url()).pathname);
   await route.fulfill({status:405,contentType:"application/json",
                        body:JSON.stringify({ok:false,error:"read-only-browser-audit"})});
   return;
  }
  await route.continue();
 });
 const response=await page.goto(origin+"/",{waitUntil:"domcontentloaded",timeout:45000});
 assert.equal(response.status(),200);
 assert.match(response.headers()["x-robots-tag"]||"",/noindex/,"Isolated preview must not be indexed");
 await page.locator("img.welcome-autumn").waitFor({state:"visible",timeout:18000});
 const welcome=await page.locator("img.welcome-autumn").evaluate(img=>({
  src:new URL(img.currentSrc).pathname,
  complete:img.complete,
  width:img.naturalWidth,
  height:img.naturalHeight
 }));
 assert.equal(welcome.src,"/media/media/1791723108110/file-1791723109615-1000040461.jpg");
 assert.ok(welcome.complete&&welcome.width>0&&welcome.height>0,
   "The original homepage image must actually render in Chromium");
 result.homepage_image_loaded=true;
 await page.locator("#welcome-open-program").waitFor({state:"visible",timeout:20000});
 await page.evaluate(()=>window.publicDataReady);
 result.data=await page.evaluate(()=>({
   backend:window.CELEBRATIONS_STAGING_BACKEND,
   celebrations:window.state?.celebrations?.length,
   events:window.state?.events?.length,
   contents:window.state?.contents?.length
 }));
 assert.equal(result.data.backend,origin);
 assert.equal(result.data.celebrations,4);
 assert.equal(result.data.events,62);
 assert.equal(result.data.contents,211);
 await page.locator("#welcome-open-program").click();
 await page.locator(".celebration-inner-nav").first().waitFor({state:"visible",timeout:15000});
 await page.locator('.celebration-inner-nav button[data-tab="program"]').first().click();
 assert.ok(await page.locator("#program").evaluate(e=>!e.classList.contains("hidden")));
 await page.locator('.celebration-inner-nav button[data-tab="library"]').first().click();
 assert.ok(await page.locator("#library").evaluate(e=>!e.classList.contains("hidden")));
 const dayRoutes=["programme","mercredi","jeudi","vendredi","samedi",
                  "dimanche","apres-celebration"];
 for(const slug of dayRoutes){
  const day=await page.goto(origin+"/"+slug+"/",{waitUntil:"domcontentloaded",timeout:45000});
  assert.equal(day.status(),200,"Standalone day route unavailable");
  await page.evaluate(()=>window.publicDataReady);
  const state=await page.evaluate(()=>({
    backend:window.CELEBRATIONS_STAGING_BACKEND,
    celebrations:window.state?.celebrations?.length,
    events:window.state?.events?.length,
    contents:window.state?.contents?.length
  }));
  assert.equal(state.backend,origin,"Standalone day still uses source backend");
  assert.equal(state.celebrations,4);
  assert.equal(state.events,62);
  assert.equal(state.contents,211);
 }
 result.standalone_day_browser_pages=dayRoutes.length;
 const adminResp=await page.goto(origin+"/admin.html",{waitUntil:"domcontentloaded",timeout:45000});
 assert.equal(adminResp.status(),200);
 await page.locator("#adminPasswordGate").waitFor({state:"visible",timeout:15000});
 assert.ok(await page.locator("body.admin-auth-locked").count()>0);
 result.admin_gate_locked=true;
 result.blocked_client_posts=mutationAttempts.length;
 result.supabase_network_requests=legacy.length;
 result.javascript_errors=errors.length;
 assert.equal(legacy.length,0,"Preview browser must not contact legacy Supabase");
 assert.equal(errors.length,0,"Uncaught browser error in read-only preview");
 console.log("PRODUCTION_READONLY_PREVIEW_BROWSER_PASS "+JSON.stringify(result));
}finally{await browser.close()}
