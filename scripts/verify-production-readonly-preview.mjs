// Read-only isolated production-data preview acceptance, no POST/mutations.
import assert from "node:assert/strict";
import process from "node:process";
const site="https://celebrations-exit-preview-ro.rondes.workers.dev";
const token=process.env.CLOUDFLARE_API_TOKEN||"";
const account=process.env.CLOUDFLARE_ACCOUNT_ID||"";
const db=process.env.PROD_D1_ID||"";
if(!token||!account||!/^[a-f0-9-]{36}$/.test(db))throw Error("Missing protected D1 read scope");
const api="https://api.cloudflare.com/client/v4/accounts/"+account+"/d1/database/"+db+"/query";
const auth={Authorization:"Bearer "+token,"Content-Type":"application/json"};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function call(path,method="GET",headers={}){
 const r=await fetch(site+path,{method,headers,redirect:"manual",signal:AbortSignal.timeout(30000)});
 return r;
}
async function select(sql){
 const res=await fetch(api,{method:"POST",headers:auth,body:JSON.stringify({sql}),signal:AbortSignal.timeout(30000)});
 assert.equal(res.status,200,"Private D1 query unavailable");
 const data=await res.json();
 assert.equal(data.success,true,"Private D1 query failed");
 assert.equal(data.result?.length,1);
 assert.equal(data.result[0].success,true);
 assert.equal(Number(data.result[0].meta.rows_written),0);
 return data.result[0].results;
}
// Brand-new workers.dev Worker deployments can take a short period to
// propagate to edge DNS/routes; never infer application failure from the
// first few 404 responses immediately after Wrangler exits.
let home,admin,bridge,robots;
let edgeReady=false;
for(let attempt=1;attempt<=12;attempt++){
 [home,admin,bridge,robots]=await Promise.all([
  call("/"),call("/admin.html"),call("/migration/cloudflare/preview-client.js"),call("/robots.txt")
 ]);
 if([home,admin,bridge,robots].every(r=>r.status===200)){
  edgeReady=true;break;
 }
 console.log("PRODUCTION_READONLY_PREVIEW_EDGE_RETRY "+JSON.stringify({
  attempt,statuses:[home.status,admin.status,bridge.status,robots.status]
 }));
 await sleep(2500);
}
if(!edgeReady)throw Error("Worker edge static routes still unavailable after bounded retry");
for(const [label,r] of [["home",home],["admin",admin],["bridge",bridge],["robots",robots]]){
 assert.equal(r.status,200,label+" unavailable");
 assert.match(r.headers.get("x-robots-tag")||"",/noindex/,label+" must not be indexed");
 assert.equal(r.headers.get("cache-control"),"no-store");
}
const homeHtml=await home.text(),adminHtml=await admin.text();
assert.ok(homeHtml.length>3000&&adminHtml.length>3000,"Assets missing");
assert.ok(homeHtml.includes("CELEBRATIONS_STAGING_BACKEND=location.origin"),
 "Public candidate must boot ONLY Cloudflare backend");
assert.ok(!homeHtml.includes("cdn.jsdelivr.net/npm/@supabase/supabase-js"));
assert.ok(!adminHtml.includes("cdn.jsdelivr.net/npm/@supabase/supabase-js"));
assert.match(await robots.text(),/Disallow: \/?/);
for(const route of ["/api/auth","/api/admin","/api/stats","/api/media-admin",
                      "/api/safe-save","/api/footer-admin","/api/participants-admin"]){
 const r=await call(route,"POST",{"Content-Type":"application/json"});
 assert.equal(r.status,405,"Preview must refuse mutations on "+route);
}
const invisible=await call("/api/public-data?table=celebrations_participants");
assert.equal(invisible.status,404,"Private credentials must not be exposed publicly");
const [cards,events,links,settings]=await Promise.all([
 "celebrations_contents","celebrations_events","celebrations_event_contents","celebrations_public_settings"
].map(async table=>{
 const r=await call("/api/public-data?table="+table);
 assert.equal(r.status,200,"Programme table "+table+" is unavailable");
 return await r.json();
}));
assert.equal(cards.length,211);
assert.equal(events.length,62);
assert.equal(links.length,124);
assert.equal(settings.length,1);
const publicRows=await select("SELECT storage_path FROM public_media WHERE approved=1 AND revoked_at IS NULL");
assert.equal(publicRows.length,112,"Published allowlist drift");
const committee=await select("SELECT slug FROM committee_media WHERE published=1 AND revoked_at IS NULL");
assert.equal(committee.length,9,"Committee invite count drift");
let progress=0;
async function checkPublic(row){
 const k=row.storage_path;
 assert.ok(typeof k==="string"&&k.length>0&&!k.startsWith("committee/"));
 const path="/media/"+k.split("/").map(encodeURIComponent).join("/");
 const res=await call(path,"HEAD");
 if(res.status!==200)throw Error("Protected public asset HEAD unavailable status="+res.status);
 progress++;
}
for(let index=0;index<publicRows.length;index+=6){
 await Promise.all(publicRows.slice(index,index+6).map(checkPublic));
}
for(const row of committee){
 assert.ok(typeof row.slug==="string"&&row.slug.length>8);
 const res=await call("/letter/"+encodeURIComponent(row.slug),"HEAD");
 assert.equal(res.status,200,"Committee invitation unavailable");
}
for(const deny of ["/media/committee/nonexistent.pdf","/media/not-in-approved-manifest.pdf",
                   "/letter/not-a-real-invitation"]){
 const response=await call(deny,"HEAD");
 assert.equal(response.status,404,"Non approved document must stay denied");
}
console.log("CÉLÉBRATIONS_READONLY_PRODUCTION_DATA_PREVIEW_PASS "+
 JSON.stringify({
  url:site,preview_only:true,
  public_media_http_200:progress,private_committee_slugs_http_200:committee.length,
  programme_contents:cards.length,events:events.length,
  event_content_relations:links.length,public_settings:settings.length,
  sensitive_table_http:invisible.status,
  unauthorized_media_http:404,
  production_d1_mutations:0,production_r2_mutations:0,
  stats_tracking_mutations:0,public_dns_changed:false,
  admin_real_login_tested:false
 }));
