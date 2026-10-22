// Only live-visible footer behavior on the separate read-only Cloudflare preview.
// Unpublished legal draft must not be shown or fetched from Supabase.
import assert from "node:assert/strict";
import {chromium} from "playwright";
const origin="https://celebrations-exit-preview-ro.rondes.workers.dev";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const seen=[],errors=[],posts=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(e.name||"Error"));
 page.on("request",r=>{if(/jwyayfkssyagvnablttg\.(supabase\.co|storage\.supabase\.co)/.test(r.url()))seen.push("legacy");});
 await page.route("**/*",async route=>{
  const r=route.request();
  if(!["GET","HEAD"].includes(r.method())){
   posts.push(r.method());
   await route.fulfill({status:405,body:"read-only",contentType:"text/plain"});return;
  }
  await route.continue();
 });
 await page.goto(origin+"/",{waitUntil:"domcontentloaded",timeout:45000});
 await page.evaluate(()=>window.publicDataReady);
 await page.waitForFunction(()=>window.publicShellReady===true,null,{timeout:15000});
 await page.waitForFunction(()=>[...document.querySelectorAll("a[data-footer-slug]")].every(a=>a.hidden),
  null,{timeout:12000});
 const count=await page.locator("a[data-footer-slug]").count();
 assert.equal(count,3,"Three footer page links not configurable");
 const visible=await page.locator("a[data-footer-slug]:visible").count();
 assert.equal(visible,0,"Unpublished legal footer unexpectedly clickable in public site");
 let tested=0;
 for(const slug of ["mentions-legales","confidentialite","cookies"]){
  const response=await page.goto(origin+"/"+slug+".html",{
   waitUntil:"domcontentloaded",timeout:45000
  });
  assert.equal(response.status(),200);
  await page.locator("#legalContent").waitFor({state:"visible",timeout:12000});
  await page.waitForFunction(()=>document.querySelector("#legalContent")?.textContent?.trim().length>10,
   null,{timeout:16000});
  const content=await page.locator("#legalContent").innerText();
  assert.ok(content.includes("Page en préparation"),"Unpublished legal page content exposed or unavailable");
  assert.ok(!content.includes("momentanément indisponible"),"Cloudflare D1 legal read failed");
  assert.equal(await page.evaluate(()=>window.CELEBRATIONS_STAGING_BACKEND),origin);
  tested++;
 }
 assert.deepEqual(errors,[],"Legal page JavaScript errors");
 assert.deepEqual(seen,[],"Direct legal page still calls Supabase");
 console.log("MISSION10_PUBLIC_FOOTER_LEGAL_BROWSER_PASS "+JSON.stringify({
  public_footer_links_hidden:count,footer_links_currently_visible:visible,
  legal_pages_direct_http_200:tested,unpublished_content_stays_private:true,
  legal_backends_cloudflare_only:true,
  old_supabase_network_requests:seen.length,javascript_errors:errors.length,
  blocked_analytics_mutations:posts.length,source_writes:0,cloudflare_d1_writes:0
 }));
}finally{await browser.close()}
