// Read-only proof: does the HISTORIC emailed host still handle all existing
// invitation slugs? Never print the slug, URL path, body or recipient.
const endpoint="https://celebrations.rondes.workers.dev";
const source="https://jwyayfkssyagvnablttg.supabase.co/functions/v1/celebrations-committee-public";
const cf="https://api.cloudflare.com/client/v4/accounts/"+
 process.env.CLOUDFLARE_ACCOUNT_ID+"/d1/database/"+process.env.PROD_D1_ID+"/query";
if(!process.env.CLOUDFLARE_API_TOKEN||!/^[a-f0-9-]{36}$/.test(process.env.PROD_D1_ID||""))
 throw Error("Private read credential missing");
const r=await fetch(cf,{method:"POST",headers:{
 "authorization":"Bearer "+process.env.CLOUDFLARE_API_TOKEN,
 "content-type":"application/json"
},body:JSON.stringify({sql:"SELECT slug FROM committee_media WHERE published=1 AND revoked_at IS NULL"}),signal:AbortSignal.timeout(20000)});
if(!r.ok)throw Error("Cannot retrieve protected active slug counts");
const d=await r.json();
if(!d.success||d.result?.[0]?.success!==true||d.result[0].results?.length!==9)
 throw Error("Expected exactly nine published committee links");
const slugs=d.result[0].results.map(x=>x.slug);
if(slugs.some(x=>typeof x!=="string"||x.length<8))throw Error("Invalid slug");
const root=await fetch(endpoint+"/",{redirect:"manual",signal:AbortSignal.timeout(25000)});
if(root.status!==200)throw Error("Historic emailed workers.dev hostname no longer loads");
const html=await root.text();
if(!html.includes("celebrations-committee-public?slug=")||
   !html.includes("URLSearchParams")||!html.includes("lettre"))
 throw Error("Historic host no longer contains mailed invitation redirect");
let live=0;
for(const slug of slugs){
 const landing=await fetch(endpoint+"/?lettre="+encodeURIComponent(slug),{
  redirect:"manual",signal:AbortSignal.timeout(20000)
 });
 if(landing.status!==200)throw Error("Historic literal mailed URL no longer resolves");
 // The browser currently redirects to this specific Supabase Edge Function.
 // Confirm the underlying anonymous PDF still exists. Do not log its URL.
 const pdf=await fetch(source+"?slug="+encodeURIComponent(slug),{
  method:"GET",signal:AbortSignal.timeout(25000),redirect:"manual"
 });
 if(pdf.status!==200||!(pdf.headers.get("content-type")||"").includes("application/pdf"))
  throw Error("Original Supabase legacy invitation PDF unavailable");
 const bytes=await pdf.arrayBuffer();
 if(bytes.byteLength<1000||bytes.byteLength>8*1024*1024)
  throw Error("Unexpected legacy PDF size");
 live++;
}
console.log("LEGACY_EMAILED_LINKS_AUDIT_PASS "+JSON.stringify({
 original_emailed_host:endpoint,
 original_query_route:"/?lettre=<original-slug>",
 hosted_original_link_landing_http_200:live,
 linked_original_supabase_pdf_http_200:live,
 old_host_currently_uses_supabase_edge_function:true,
 original_host_modified:false,
 source_supabase_modified:false,
 new_cloudflare_preview_modified:false,
 dns_modified:false,
 caveat:"Old hostname must receive a Cloudflare-R2 bridge before retiring Supabase"
}));
