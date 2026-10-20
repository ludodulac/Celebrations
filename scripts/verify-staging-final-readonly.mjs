// CÉLÉBRATIONS step 6: final public staging checks, HTTP READS ONLY.
// Does not view the admin with credentials, create stats/clicks, or mutate D1.
import assert from "node:assert/strict";
const origin="https://celebrations-exit-staging.rondes.workers.dev";
const get=async(path,method="GET")=>fetch(origin+path,{method,redirect:"manual",
 signal:AbortSignal.timeout(20_000),headers:{"cache-control":"no-cache"}});
const report={};
const root=await get("/");
assert.equal(root.status,302,"staging must force isolated mode");
assert.ok((root.headers.get("location")||"").includes("staging=1"));
const [home,admin,bridge,events,contents,celebrations]=await Promise.all([
 get("/?staging=1"),get("/admin.html?staging=1"),
 get("/migration/cloudflare/preview-client.js"),
 get("/api/public-data?table=celebrations_events"),
 get("/api/public-data?table=celebrations_contents"),
 get("/api/public-data?table=celebrations_celebrations")
]);
for(const r of [home,admin,bridge,events,contents,celebrations])
 assert.equal(r.status,200,"missing staging page or API");
const [html,adminHtml,bridgeText,evs,cs,cels]=await Promise.all([
 home.text(),admin.text(),bridge.text(),events.json(),contents.json(),celebrations.json()
]);
assert.ok(html.includes("welcome-open-program") && html.includes("CELEBRATIONS_STAGING_BACKEND"));
assert.ok(adminHtml.includes("adminPasswordGate")||adminHtml.includes("admin-auth"));
assert.ok(!html.includes("cdn.jsdelivr.net/npm/@supabase/supabase-js"));
assert.ok(!adminHtml.includes("cdn.jsdelivr.net/npm/@supabase/supabase-js"));
assert.ok(bridgeText.includes("celebrationsStagingMedia"));
assert.ok(Array.isArray(cels)&&cels.length===4,"Expected 4 celebrations");
assert.ok(Array.isArray(evs)&&evs.length===62,"Expected 62 events");
assert.ok(Array.isArray(cs)&&cs.length===211,"Expected 211 resources");
const [cover,unknown,privateMedia,privateDb]=await Promise.all([
 get("/media/media/celebrations-staging-welcome-autumn-2026.jpg","HEAD"),
 get("/media/not-a-real-staging-resource-2026.pdf","HEAD"),
 get("/media/committee/not-a-real-staging-committee-2026.pdf","HEAD"),
 get("/api/public-data?table=celebrations_participants")
]);
assert.equal(cover.status,200,"Public welcome media failed");
assert.equal(unknown.status,404,"Unknown media must be denied");
assert.equal(privateMedia.status,404,"Raw committee paths must be denied");
assert.equal(privateDb.status,404,"Private participant table must not be disclosed");
Object.assign(report,{celebrations:cels.length,events:evs.length,contents:cs.length,
 home_status:home.status,admin_status:admin.status,cover_status:cover.status,
 private_media_denied:true,private_db_denied:true,
 requests_without_staging_auth_or_writes:true,public_site_changed:false});
console.log("CELEBRATIONS_STEP6_LIVE_STAGING_READONLY_PASS "+JSON.stringify(report));
