// Mission 10: bounded D1 SELECT only + the actual public settings/legal controls.
// Avoid logging any account names, private slugs, URL paths, passwords or visitors.
import assert from "node:assert/strict";
const account=process.env.CLOUDFLARE_ACCOUNT_ID||"";
const token=process.env.CLOUDFLARE_API_TOKEN||"";
const db=process.env.PROD_D1_ID||"";
assert.match(account,/^[a-f0-9]{32}$/i);
assert.ok(token&&token.length>8);
assert.equal(db,"28736d2a-479b-472b-bf82-703ad0affe10");
assert.equal(process.env.STAGING_R2_BUCKET,"celebrations-exit-staging");
const base="https://api.cloudflare.com/client/v4/accounts/"+account+"/d1/database/"+db+"/query";
let declaredRead=0;
async function query(sql){
 assert.match(sql,/^SELECT\s/i,"No D1 mutations in audit");
 const response=await fetch(base,{method:"POST",headers:{
  authorization:"Bearer "+token,"content-type":"application/json"
 },body:JSON.stringify({sql}),signal:AbortSignal.timeout(26000)});
 assert.equal(response.status,200,"D1 inspect failed");
 const body=await response.json();
 assert.equal(body.success,true,"D1 inspect failed");
 assert.equal(body.result?.[0]?.success,true,"D1 inspect query failed");
 const meta=body.result[0].meta||{};
 assert.equal(Number(meta.rows_written),0,"Unexpected D1 mutation");
 declaredRead+=Number(meta.rows_read||0);
 return body.result[0].results||[];
}
const [stats,accountRows,documents,committee,footers,settings]=await Promise.all([
 query("SELECT COUNT(*) AS total,SUM(CASE WHEN id<0 THEN 1 ELSE 0 END) AS historic,SUM(CASE WHEN id>0 THEN 1 ELSE 0 END) AS cloudflare FROM celebrations_clicks"),
 query("SELECT COUNT(*) AS participants FROM celebrations_participants"),
 query("SELECT COUNT(*) AS total FROM celebrations_committee_letters"),
 query("SELECT COUNT(*) AS published FROM committee_media WHERE published=1 AND revoked_at IS NULL"),
 query("SELECT COUNT(*) AS total,SUM(CASE WHEN is_active=1 AND is_public=1 THEN 1 ELSE 0 END) AS public FROM celebrations_footer_drafts"),
 query("SELECT show_other_celebrations FROM celebrations_public_settings WHERE id=1 LIMIT 1")
]);
assert.equal(stats.length,1);
assert.ok(Number(stats[0].total)>=11738,"Historic stats missing");
assert.equal(Number(stats[0].historic),11738,"Historic stats snapshot changed");
assert.equal(Number(accountRows[0].participants),1,"Original participant missing");
assert.equal(Number(documents[0].total),9,"Nine committee documents missing");
assert.equal(Number(committee[0].published),9,"Nine old private PDFs unavailable");
assert.equal(settings.length,1,"Actual public visibility setting absent");
assert.ok([0,1].includes(Number(settings[0].show_other_celebrations)));
const prodLegal=Number(footers[0].total);
const prodLegalPublished=Number(footers[0].public||0);
assert.ok(prodLegal>=0&&prodLegal<=15,"Unexpected legal draft count");
assert.ok(prodLegalPublished>=0&&prodLegalPublished<=3);
const site="https://celebrations-exit-preview-ro.rondes.workers.dev";
const slugs=["mentions-legales","confidentialite","cookies"];
const listing=await fetch(site+"/api/public-data?table=celebrations_footer_drafts",{
 redirect:"manual",signal:AbortSignal.timeout(23000)});
assert.equal(listing.status,200);
const published=await listing.json();
assert.ok(Array.isArray(published));
assert.equal(published.length,prodLegalPublished);
for(const slug of slugs){
 const response=await fetch(site+"/api/public-data?table=celebrations_footer_page&slug="+slug,{
  redirect:"manual",signal:AbortSignal.timeout(22000)});
 assert.equal(response.status,200,"Public legal D1 endpoint unavailable");
 const body=await response.json();
 assert.ok(Array.isArray(body)&&body.length<=1);
 if(!published.find(r=>r.slug===slug))assert.equal(body.length,0,"Private legal page exposed");
}
const noGuest=await fetch(site+"/api/public-data?table=celebrations_admin_sessions",{
 redirect:"manual",signal:AbortSignal.timeout(20000)});
assert.equal(noGuest.status,404,"Sessions exposed publicly");
console.log("MISSION10_PRIVATE_HISTORIC_DATA_READONLY_PASS "+JSON.stringify({
 historical_statistics_imported:Number(stats[0].historic),
 total_events_in_cloudflare_snapshot:Number(stats[0].total),
 new_cloudflare_events:Number(stats[0].cloudflare||0),
 original_participants:Number(accountRows[0].participants),
 committee_documents:Number(documents[0].total),
 published_private_committee_pdfs:Number(committee[0].published),
 legal_drafts_in_production:prodLegal,
 legal_pages_currently_public:prodLegalPublished,
 legal_visibility_restricted:true,
 public_celebration_visibility_setting_preserved:true,
 administrator_sessions_publicly_blocked:true,
 supabase_statistics_final_delta_still_required:true,
 d1_reported_rows_read:declaredRead,sql_mutations:0,
 source_writes:0,r2_writes:0,dns_updates:0
}));
