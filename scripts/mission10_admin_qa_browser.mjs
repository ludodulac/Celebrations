// Mission 10: actually click admin tabs over migrated prod D1 on QA hostname.
// Synthetic short-lived admin session created and revoked by Python parent.
// No PII, secret, PDF slug, personally identifying values logged.
import assert from "node:assert/strict";
import {chromium} from "playwright";
const origin="https://celebrations-exit-editable-qa.rondes.workers.dev";
const bearer=process.env.MISSION10_ADMIN_BEARER||"";
assert.match(bearer,/^[0-9a-f]{64}$/);
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const errors=[],legacy=[],blocked=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
 await context.addInitScript(token=>{
  if(location.hostname==="celebrations-exit-editable-qa.rondes.workers.dev")
   localStorage.setItem("celebrations-admin-token",token);
 },bearer);
 const page=await context.newPage();
 await page.route("**/*",async route=>{
  const req=route.request();
  if(["GET","HEAD"].includes(req.method())){await route.continue();return}
  const path=new URL(req.url()).pathname;
  let action="";try{action=JSON.parse(req.postData()||"{}").action||""}catch{}
  const allowed={
   "/api/auth":new Set(["admin_session"]),
   "/api/admin":new Set(["list"]),
   "/api/footer-admin":new Set(["admin_footer_drafts"]),
   "/api/stats":new Set(["summary"]),
   "/api/participants-admin":new Set(["admin_list_participants","admin_list"])
  };
  if(allowed[path]?.has(action)){await route.continue();return}
  blocked.push({path,action});
  await route.fulfill({status:405,contentType:"application/json",body:'{"ok":false}'});
 });
 page.on("pageerror",e=>errors.push(e.name||"Error"));
 page.on("request",r=>{
  if(/jwyayfkssyagvnablttg\.(supabase\.co|storage\.supabase\.co)/i.test(r.url()))legacy.push("legacy");
 });
 const response=await page.goto(origin+"/admin.html",{waitUntil:"domcontentloaded",timeout:45000});
 assert.equal(response.status(),200);
 await page.waitForFunction(()=>!document.body.classList.contains("admin-auth-locked"),
  null,{timeout:25000});
 await page.waitForFunction(()=>window.celebrationsCoreSyncStatus==="saved",null,{timeout:25000});
 // Committee is a real admin toolbar button; verify all nine imported links.
 await page.locator('.admin-nav [data-admin="committee-links"]').click();
 await page.locator("#committeeLinksList .admin-row").first().waitFor({state:"visible",timeout:18000});
 assert.equal(await page.locator("#committeeLinksList .admin-row").count(),9);
 assert.equal(await page.locator("#committeeLinksList [data-copy-committee-link]").count(),9);
 // Stats is a real admin menu. Load once (15-minute protected D1 summary cache).
 await page.locator('.admin-nav [data-admin="stats"]').click();
 await page.locator("#clickStatsBox .grid3 .card").first().waitFor({state:"visible",timeout:26000});
 assert.equal(await page.locator("#clickStatsBox .grid3 .card").count(),3);
 const overview=await page.locator("#clickStatsBox .grid3 .card").allInnerTexts();
 assert.ok(overview.some(x=>/pages vues/i.test(x)),"Historic page views not rendered");
 assert.ok(!(await page.locator("#clickStatsBox").innerText()).includes("Impossible de charger"));
 // The setting for other celebrations was intentionally hidden on current admin.
 assert.equal(await page.locator("#celebrationVisibilityAdmin").count(),0);
 // These three editor buttons ARE in the admin footer, even if public draft 0.
 let templates=0;
 for(const slug of ["mentions-legales","confidentialite","cookies"]){
  await page.locator('[data-footer-page="'+slug+'"]').click();
  await page.locator("#footerPageText").waitFor({state:"visible",timeout:12000});
  const text=await page.locator("#footerPageText").inputValue();
  assert.ok(text.length>350,"Legal editor must have a private editable template");
  assert.equal(await page.locator("#footerPagePublic").isChecked(),false,
   "Unapproved template must not appear on website");
  assert.match(text,/\[[^\]]{3,300}\]/,"Legal draft needs missing-facts warning");
  templates++;
 }
 assert.deepEqual(errors,[],"QA admin browser JavaScript errors");
 assert.deepEqual(legacy,[],"QA admin browser calls old Supabase");
 assert.deepEqual(blocked,[],"Admin triggered unapproved mutation on navigation");
 console.log("MISSION10_ADMIN_UI_REAL_BROWSER_PASS "+JSON.stringify({
  source:"migrated Cloudflare production D1 via separate QA Worker",
  historical_committee_links_displayed:9,copy_buttons:9,
  statistics_summary_visible:true,statistics_cards:3,
  legal_editors_with_private_templates:templates,
  legal_pages_unpublished:true,hidden_other_celebrations_setting_unchanged:true,
  uncontrolled_browser_mutation_requests:blocked.length,
  old_supabase_requests:legacy.length,javascript_errors:errors.length,
  actual_site_unchanged:true,source_writes:0,customer_data_writes:0
 }));
}finally{await browser.close()}
