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
 // Cloudflare Asset HTML canonicalization may redirect /admin.html to /admin
 // with HTTP 307. Follow only a SAME-ORIGIN redirect, never to the live site.
 if([301,302,307,308].includes(admin.status)){
  const loc=admin.headers.get("location");
  if(!loc)throw Error("Admin canonical redirect missing Location");
  const destination=new URL(loc,site);
  if(destination.origin!==site||destination.pathname==="/admin.html")
   throw Error("Admin redirected outside the private read-only preview");
  admin=await call(destination.pathname+destination.search);
 }
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

const originalHomeImage="/media/media/1791723108110/file-1791723109615-1000040461.jpg";
assert.ok(homeHtml.includes('src="'+originalHomeImage+'"'),
 "The original welcome picture must use its original private-R2 path");
assert.ok(!homeHtml.includes("/media/media/celebrations-staging-welcome-autumn-2026.jpg"),
 "The isolated production preview must not use the staging-only welcome asset");
const homeJpg=await call(originalHomeImage,"HEAD");
assert.equal(homeJpg.status,200,"Original homepage image must be accessible");
assert.match(homeJpg.headers.get("content-type")||"",/image\/jpeg/i);
assert.equal(Number(homeJpg.headers.get("content-length")),167220,
 "Original homepage JPG byte size should match Supabase inventory");

assert.match(await robots.text(),/Disallow: \/?/);
const standaloneRoutes=["programme","mercredi","jeudi","vendredi","samedi",
                        "dimanche","apres-celebration"];
for(const slug of standaloneRoutes){
 const res=await call("/"+slug+"/");
 assert.equal(res.status,200,"Public standalone route "+slug+" must load");
 assert.match(res.headers.get("x-robots-tag")||"",/noindex/,
   "Standalone route must not be indexed");
 const html=await res.text();
 assert.ok(html.length>1500,"Standalone page empty");
 assert.ok(html.includes("CELEBRATIONS_STAGING_BACKEND=location.origin"),
   "Standalone route must activate Cloudflare bridge");
 assert.ok(html.includes("migration/cloudflare/preview-client.js"),
   "Standalone route must load Cloudflare client");
 assert.ok(!html.includes("cdn.jsdelivr.net/npm/@supabase/supabase-js"),
   "Standalone route must not boot Supabase SDK");
}
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
assert.equal(publicRows.length,113,"112 original approved assets plus one recovered public PDF");
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
 // Exactly the same permalink syntax historically generated for recipients:
 // /?lettre=<original-slug> ; do not reveal slugs in CI logs.
 const sentLink=await call("/?lettre="+encodeURIComponent(row.slug),"HEAD");
 assert.equal(sentLink.status,200,"Existing mailed ?lettre= link must still open");
 assert.equal(sentLink.headers.get("location"),null,
   "Do not replace recipient's original emailed URL with a redirect");
 assert.match(sentLink.headers.get("content-type")||"",/application\/pdf/i);
}
for(const deny of ["/media/committee/nonexistent.pdf","/media/not-in-approved-manifest.pdf",
                   "/letter/not-a-real-invitation"]){
 const response=await call(deny,"HEAD");
 assert.equal(response.status,404,"Non approved document must stay denied");
}
for(const path of ["/communique","/rituel-court","/rituel-long","/preparation"]){
 const res=await call(path,"HEAD");
 assert.equal(res.status,302,"Old mailed PDF redirect route must remain active");
 assert.ok((res.headers.get("location")||"").startsWith("https://drive.google.com/file/d/"),
   "Preserve original Drive PDF redirect");
}
const forbidden=await call("/?lettre=not-a-real-invitation","HEAD");
assert.equal(forbidden.status,404,"Unknown invitation link must stay private");

console.log("CÉLÉBRATIONS_READONLY_PRODUCTION_DATA_PREVIEW_PASS "+
 JSON.stringify({
  url:site,preview_only:true,
  public_media_http_200:progress,private_committee_slugs_http_200:committee.length,
  unchanged_mail_permalink_query_http_200:committee.length,
  unchanged_legacy_document_redirects:4,
  standalone_public_routes_verified:standaloneRoutes.length,
  original_homepage_jpg_http_200:homeJpg.status,programme_contents:cards.length,events:events.length,
  event_content_relations:links.length,public_settings:settings.length,
  sensitive_table_http:invisible.status,
  unauthorized_media_http:404,
  production_d1_mutations:0,production_r2_mutations:0,
  stats_tracking_mutations:0,public_dns_changed:false,
  admin_real_login_tested:false
 }));
