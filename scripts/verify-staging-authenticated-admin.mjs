// Browser and API check with a short-lived synthetic staging admin session.
// No production access and no business-data writes. Never print the bearer.
import assert from "node:assert/strict";
import {chromium} from "playwright";
const origin="https://celebrations-exit-staging.rondes.workers.dev";
const bearer=process.env.STAGING_TEMP_ADMIN_BEARER;
assert.ok(bearer&&/^[0-9a-f]{64}$/.test(bearer),"Ephemeral staging bearer missing");
async function adminCall(path,action){
 const r=await fetch(origin+path,{
  method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+bearer},
  body:JSON.stringify({action}),signal:AbortSignal.timeout(20000)
 });
 const data=await r.json();
 assert.equal(r.status,200,action+" failed, status "+r.status);
 assert.equal(data.ok,true,"Authenticated "+action+" was rejected");
 return data;
}
const footer=await adminCall("/api/footer-admin","admin_footer_drafts");
assert.ok(Array.isArray(footer.drafts),"Footer drafts must be an array");
assert.ok(footer.drafts.every(x=>Object.keys(x).every(k=>
 ["slug","draft_number","title","content","is_active","is_public","updated_at"].includes(k))));
const participants=await adminCall("/api/participants-admin","admin_list_participants");
assert.ok(Array.isArray(participants.participants));
assert.ok(participants.participants.every(p=>Object.keys(p).every(k=>["email","registered_at"].includes(k))),
 "Participant admin list must exclude password, recovery secrets and hashes");
const audiences=await adminCall("/api/participants-admin","admin_list");
assert.ok(Array.isArray(audiences.participants));
assert.ok(audiences.participants.every(p=>Object.keys(p).every(k=>["email","audience"].includes(k))));
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const errors=[],legacy=[],browserWrites=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
 await context.addInitScript(token=>{
   if(location.hostname==="celebrations-exit-staging.rondes.workers.dev")
    localStorage.setItem("celebrations-admin-token",token);
 },bearer);
 const page=await context.newPage();
 page.on("pageerror",e=>errors.push(String(e.stack||e.message).slice(0,700)));
 page.on("request",r=>{
  if(r.url().includes("jwyayfkssyagvnablttg.supabase.co"))legacy.push(r.method());
  if(r.method()!=="GET"&&r.method()!=="HEAD"&&r.url().includes("/api/")){
   let action="";try{action=JSON.parse(r.postData()||"{}").action||""}catch{}
   browserWrites.push({path:new URL(r.url()).pathname,action});
  }
 });
 await page.goto(origin+"/admin.html?staging=1",{waitUntil:"domcontentloaded",timeout:45000});
 await page.waitForFunction(()=>!document.body.classList.contains("admin-auth-locked"),{timeout:25000});
 await page.waitForFunction(()=>window.celebrationsCoreSyncStatus==="saved",{timeout:30000});
 await page.locator(".admin-nav [data-admin=celebrations]").click();
 const rows=await page.locator("#panel .admin-row").count();
 assert.ok(rows>=4,"Admin did not render at least four D1 celebrations: "+rows);
 await page.locator(".admin-nav [data-admin=media]").click();
 const library=await page.locator("#panel").innerText();
 assert.ok(library.length>40,"Admin media panel unexpectedly empty");
 await page.locator("[data-footer-page=mentions-legales]").first().click();
 await page.locator("#footerPageText").waitFor({state:"visible",timeout:15000});
 const editor=await page.locator("#footerPageText").count();
 assert.equal(editor,1,"Legal page editor did not open");
 assert.deepEqual(legacy,[],"Admin browser contacted production Supabase");
 assert.deepEqual(errors,[],"Admin browser runtime exceptions");
 // Session validation and metadata reads are permitted. No program writes.
 const readActions={
  "/api/auth":new Set(["admin_session"]),
  "/api/admin":new Set(["list"]),
  "/api/footer-admin":new Set(["admin_footer_drafts"])
 };
 assert.ok(browserWrites.every(x=>readActions[x.path]?.has(x.action)),
 "Unexpected authenticated admin mutation: "+JSON.stringify(browserWrites));
 console.log("STAGING_AUTHENTICATED_ADMIN_SMOKE "+JSON.stringify({
  authenticated:true,celebration_rows:rows,media_panel:true,footer_editor:true,
  footer_drafts:footer.drafts.length,participant_count:participants.participants.length,
  audience_count:audiences.participants.length,
  browser_requests:browserWrites.length,legacy_supabase_requests:legacy.length,js_errors:errors
 }));
}finally{await browser.close()}
