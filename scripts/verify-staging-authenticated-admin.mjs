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
assert.ok(["mentions-legales","confidentialite","cookies"].every(slug=>footer.drafts.some(d=>d.slug===slug)),"Three editable legal draft pages missing");
assert.ok(footer.drafts.every(x=>Object.keys(x).every(k=>
 ["slug","draft_number","title","content","is_active","is_public","updated_at"].includes(k))));
const participants=await adminCall("/api/participants-admin","admin_list_participants");
assert.ok(Array.isArray(participants.participants));
assert.ok(participants.participants.every(p=>Object.keys(p).every(k=>["email","registered_at"].includes(k))),
 "Participant admin list must exclude password, recovery secrets and hashes");
const stats=await adminCall("/api/stats","summary");
assert.ok(stats.visits&&Number(stats.visits.visits)>=1,"Historical visitor statistics not available");
assert.ok(Array.isArray(stats.clicks),"Historical resource clicks not available");
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
 // Fail-closed: a read-only audit must NEVER allow a business mutation to
 // reach staging D1, even if a UI regression automatically calls saveState().
 const interceptedMutations=[];
 await page.route("**/api/**",async route=>{
  const req=route.request();
  if(req.method()==="GET"||req.method()==="HEAD"){await route.continue();return}
  let action="";try{action=JSON.parse(req.postData()||"{}").action||""}catch{}
  const path=new URL(req.url()).pathname;
  const reads={
   "/api/auth":new Set(["admin_session"]),
   "/api/admin":new Set(["list"]),
   "/api/footer-admin":new Set(["admin_footer_drafts"]),
   "/api/stats":new Set(["summary"]),
   "/api/participants-admin":new Set(["admin_list_participants","admin_list"])
  };
  if(reads[path]?.has(action)){await route.continue();return}
  interceptedMutations.push({path,action});
  await route.fulfill({status:409,contentType:"application/json",
    body:JSON.stringify({ok:false,error:"Read-only audit: mutation intentionally blocked"})});
 });
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
 await page.evaluate(()=>{
  window.__stagingAuditSaveStacks=[];
  const prior=window.saveState;
  window.saveState=function(...args){
   window.__stagingAuditSaveStacks.push(String(new Error("view-triggered saveState").stack||"").slice(0,950));
   return prior.apply(this,args);
  };
 });
 await page.locator(".admin-nav [data-admin=celebrations]").click();
 const rows=await page.locator("#panel .admin-row").count();
 const data=await page.evaluate(()=>({
  celebrations:state.celebrations.length,
  events:state.events.length,
  contents:state.contents.length
 }));
 // The current guided admin intentionally shows only the active celebration;
 // its D1-backed state must nevertheless include the full administrative corpus.
 assert.equal(rows,1,"Guided admin should display exactly one active celebration");
 assert.ok(data.celebrations>=4&&data.events>=62&&data.contents>=211,
  "Authenticated admin is missing D1 programme rows: "+JSON.stringify(data));
 // The actual admin browser snapshot must pass the exact D1 serializer
 // before edits can be enabled. This endpoint is strictly non-mutating.
 const snapshot=await page.evaluate(()=>JSON.parse(JSON.stringify({
  action:"safe_merge_preview",
  groups:state.groups,celebrations:state.celebrations,
  events:state.events,contents:state.contents
 })));
 const preflight=await fetch(origin+"/api/safe-save",{
  method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+bearer},
  body:JSON.stringify(snapshot),signal:AbortSignal.timeout(25000)
 });
 const preview=await preflight.json();
 assert.equal(preflight.status,200,"Real admin snapshot preflight failed: "+JSON.stringify(preview));
 assert.equal(preview.ok,true);
 assert.equal(preview.dry_run,true);
 assert.ok(preview.statements<=48,"Real staging snapshot exceeds free-tier SQL limit");
 assert.equal(preview.counts.contents,data.contents);
 assert.equal(preview.counts.events,data.events);
 await page.locator(".admin-nav [data-admin=media]").click();
 const library=await page.locator("#panel").innerText();
 assert.ok(library.length>40,"Admin media panel unexpectedly empty");
 await page.locator("[data-footer-page=mentions-legales]").first().click();
 await page.locator("#footerPageText").waitFor({state:"visible",timeout:15000});
 assert.ok((await page.locator("#footerPageText").inputValue()).length>120,"Legal editor has no saved draft");
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
 const stacks=await page.evaluate(()=>window.__stagingAuditSaveStacks||[]);
 assert.ok(browserWrites.every(x=>readActions[x.path]?.has(x.action))&&interceptedMutations.length===0,
 "Admin browsing attempted business writes (BLOCKED): "+JSON.stringify(interceptedMutations)+
 " | saveState call sites "+JSON.stringify(stacks.slice(0,6)));
 console.log("STAGING_AUTHENTICATED_ADMIN_SMOKE "+JSON.stringify({
  authenticated:true,celebration_rows_visible:rows,loaded_data:data,save_preflight_queries:preview.statements,media_panel:true,footer_editor:true,
  footer_drafts:footer.drafts.length,stats_page_views:stats.visits.visits,participant_count:participants.participants.length,
  audience_count:audiences.participants.length,
  browser_requests:browserWrites.length,legacy_supabase_requests:legacy.length,js_errors:errors
 }));
}finally{await browser.close()}
