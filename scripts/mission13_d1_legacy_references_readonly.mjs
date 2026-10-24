// Privacy-safe D1-only audit. Returns COUNTS ONLY, no content, URLs, or personal data.
// Does not change D1, R2, DNS, Workers, legacy site, or Supabase.
const token=process.env.CLOUDFLARE_API_TOKEN||"";
const account=process.env.CLOUDFLARE_ACCOUNT_ID||"";
const database=process.env.CELEBRATIONS_PROD_D1_ID||"";
if(!/^[0-9a-f]{32}$/i.test(account)||!/^[0-9a-f-]{36}$/i.test(database)||!token)
 throw Error("Protected production D1 read scope unavailable");
const api="https://api.cloudflare.com/client/v4/accounts/"+account+"/d1/database/"+database+"/query";
const lookups=[
 ["contents_storage","SELECT COUNT(*) AS total, SUM(CASE WHEN lower(coalesce(storage_path,'')||coalesce(cover_storage_path,'')) LIKE '%supabase%' THEN 1 ELSE 0 END) AS legacy FROM celebrations_contents"],
 ["contents_external","SELECT COUNT(*) AS total, SUM(CASE WHEN lower(coalesce(external_url,'')) LIKE '%supabase%' THEN 1 ELSE 0 END) AS legacy FROM celebrations_contents"],
 ["contents_description","SELECT COUNT(*) AS total, SUM(CASE WHEN lower(coalesce(description,'')||coalesce(inline_text,'')) LIKE '%supabase%' THEN 1 ELSE 0 END) AS legacy FROM celebrations_contents"],
 ["published_links","SELECT COUNT(*) AS total, SUM(CASE WHEN lower(coalesce(url,'')) LIKE '%supabase%' THEN 1 ELSE 0 END) AS legacy FROM celebrations_links"],
 ["day_text","SELECT COUNT(*) AS total, SUM(CASE WHEN lower(coalesce(body_text,'')) LIKE '%supabase%' THEN 1 ELSE 0 END) AS legacy FROM celebrations_steps"],
 ["events","SELECT COUNT(*) AS total, SUM(CASE WHEN lower(coalesce(description,'')) LIKE '%supabase%' THEN 1 ELSE 0 END) AS legacy FROM celebrations_events"],
 ["legal_active","SELECT COUNT(*) AS total, SUM(CASE WHEN lower(coalesce(content,'')) LIKE '%supabase%' THEN 1 ELSE 0 END) AS legacy FROM celebrations_footer_drafts WHERE is_active=1"],
 ["legal_public","SELECT COUNT(*) AS total, SUM(CASE WHEN lower(coalesce(content,'')) LIKE '%supabase%' THEN 1 ELSE 0 END) AS legacy FROM celebrations_footer_drafts WHERE is_active=1 AND is_public=1"],
 ["committee_storage","SELECT COUNT(*) AS total, SUM(CASE WHEN lower(coalesce(storage_path,'')) LIKE '%supabase%' THEN 1 ELSE 0 END) AS legacy FROM celebrations_committee_letters"]
];
const report={};
for(const [name,sql] of lookups){
 const r=await fetch(api,{method:"POST",headers:{Authorization:"Bearer "+token,"content-type":"application/json"},
  body:JSON.stringify({sql}),signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw Error("Production D1 read denied at "+name+" HTTP "+r.status);
 const data=await r.json();
 const batch=data.result?.[0];
 if(!data.success||!batch?.success||Number(batch.meta?.rows_written)!==0)
  throw Error("Invalid/unsafe read response for "+name);
 const count=batch.results?.[0];
 if(!count||!Number.isFinite(Number(count.total))||!Number.isFinite(Number(count.legacy)))
  throw Error("Incomplete count "+name);
 report[name]={total:Number(count.total),supabase_references:Number(count.legacy)};
}
console.log("MISSION13_D1_LEGACY_REFERENCE_READONLY_COUNTS "+JSON.stringify(report));
console.log("MISSION13_PRIVACY_NO_RAW_CONTENT_NO_WRITE_PASS");
