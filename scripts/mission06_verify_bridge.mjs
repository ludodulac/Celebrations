// REAL HTTP audit of nine mailed PDF links: original literal URL format,
// same PDF bytes as the still-active Supabase endpoint, no external redirect.
// Also checks the original historical site's immutable pinned main assets.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const mode=process.env.MISSION06_MODE;
assert.ok(["preview","historic"].includes(mode));
const host=mode==="preview"?"celebrations-legacy-links-qa.rondes.workers.dev":"celebrations.rondes.workers.dev";
const origin="https://"+host;
const source="https://jwyayfkssyagvnablttg.supabase.co/functions/v1/celebrations-committee-public";
const account=process.env.CLOUDFLARE_ACCOUNT_ID||"";
const db=process.env.PROD_D1_ID||"";
assert.match(account,/^[a-f0-9]{32}$/i);
assert.equal(db,"28736d2a-479b-472b-bf82-703ad0affe10");
const token=process.env.CLOUDFLARE_API_TOKEN;
assert.ok(token);
const api="https://api.cloudflare.com/client/v4/accounts/"+account+"/d1/database/"+db+"/query";
const result=await fetch(api,{method:"POST",headers:{
 "authorization":"Bearer "+token,"content-type":"application/json"
},body:JSON.stringify({sql:"SELECT slug FROM committee_media WHERE published=1 AND revoked_at IS NULL ORDER BY slug"}),
signal:AbortSignal.timeout(25000)});
assert.equal(result.status,200);
const d=await result.json();
assert.ok(d.success&&d.result?.[0]?.success===true);
assert.equal(d.result[0].meta?.rows_written,0);
const slugs=d.result[0].results?.map(x=>x.slug)||[];
assert.equal(slugs.length,9);
const hex=x=>createHash("sha256").update(x).digest("hex");
const staticRoutes=[["/","index.html"],["/index.html","index.html"],["/admin.html","admin.html"],
["/styles.css","styles.css"],["/admin-committee-links.js","admin-committee-links.js"]];
// A brand-new workers.dev route can be briefly unavailable while it propagates.
let ready=false;
for(let attempt=0;attempt<15;attempt++){
 try{
  const home=await fetch(origin+"/",{redirect:"follow",signal:AbortSignal.timeout(12000)});
  if(home.status===200 && home.headers.get("x-celebrations-legacy-pdf-bridge")==="mission06-safe-v2"){
   const bytes=Buffer.from(await home.arrayBuffer());
   if(hex(bytes)===hex(readFileSync("legacy-main/index.html"))){ready=true;break}
  }
 }catch{}
 await new Promise(done=>setTimeout(done,1500));
}
assert.ok(ready,"Legacy bridge Worker did not become ready with original homepage");
const fresh=async(path,{method="GET",redirect="manual",timeout=25000}={})=>{
 for(let retry=0;retry<20;retry++){
  const response=await fetch(origin+path,{method,redirect,signal:AbortSignal.timeout(timeout)});
  if(response.headers.get("x-celebrations-legacy-pdf-bridge")==="mission06-safe-v2")
   return response;
  // The historic hostname may temporarily serve its previous assets-only version
  // from another edge point even after the new homepage has propagated.
  try{await response.arrayBuffer()}catch{}
  await new Promise(done=>setTimeout(done,1200));
 }
 throw Error("Cloudflare edge did not serve the updated historic bridge for this route");
};
for(const [route,file] of staticRoutes){
 const r=await fresh(route,{redirect:"follow",timeout:20000});
 assert.equal(r.status,200,"Historic static route unavailable");
 assert.equal(hex(Buffer.from(await r.arrayBuffer())),hex(readFileSync("legacy-main/"+file)),
  "Historic public static bytes changed");
}
for(const restricted of ["/.git/HEAD","/.github/workflows/pages.yml","/scripts/copy_supabase_media_to_r2.py","/tests/test_copy_supabase_media_to_r2.py"]){
 const r=await fresh(restricted,{timeout:15000});
 assert.equal(r.headers.get("x-celebrations-legacy-pdf-bridge"),"mission06-safe-v2","Wrong Worker version on sensitive route");
 // An SPA fallback may legitimately return the PUBLIC index with HTTP 200.
 // It must never return the corresponding private Git/CI file.
 if(r.status===200){
  const body=Buffer.from(await r.arrayBuffer());
  assert.equal(hex(body),hex(readFileSync("legacy-main/index.html")),"Sensitive repository file leaked instead of public SPA fallback");
 }else assert.equal(r.status,404,"Sensitive repository internals must not be served");
}
let checked=0;
for(const slug of slugs){
 assert.match(slug,/^[\p{L}\p{N}_-]{8,159}$/u);
 const path="/?lettre="+encodeURIComponent(slug);
 const head=await fresh(path,{method:"HEAD",timeout:25000});
 assert.equal(head.status,200,"Old emailed URL not serving PDF");
 assert.match(head.headers.get("content-type")||"",/application\/pdf/i);
 assert.equal(head.headers.get("location"),null,"Old emailed URL redirected");
 const r=await fresh(path,{timeout:25000});
 assert.equal(r.status,200);
 assert.equal(r.headers.get("location"),null);
 const bytes=Buffer.from(await r.arrayBuffer());
 assert.ok(bytes.length>1000&&bytes.length<8*1024*1024&&bytes.subarray(0,5).toString()==="%PDF-",
  "Original PDF invalid");
 const sup=await fetch(source+"?slug="+encodeURIComponent(slug),{
  redirect:"manual",signal:AbortSignal.timeout(30000)
 });
 assert.equal(sup.status,200,"Original source letter PDF unavailable");
 const original=Buffer.from(await sup.arrayBuffer());
 assert.equal(hex(bytes),hex(original),"R2 PDF differs bytewise from historic Supabase letter");
 checked++;
}
const missing=await fresh("/?lettre=not-a-valid-historical-slug",{method:"HEAD",timeout:15000});
assert.equal(missing.status,404,"Unknown private invitation must remain inaccessible");
const post=await fresh("/?lettre=not-a-valid-historical-slug",{method:"POST",timeout:15000});
assert.equal(post.status,405,"Legacy PDF URLs must reject POST");
let redirects=0;
for(const path of ["/communique","/rituel-court","/rituel-long","/preparation"]){
 const x=await fresh(path,{timeout:15000});
 assert.equal(x.status,302,"Historical Drive link redirect unavailable");
 assert.ok((x.headers.get("location")||"").startsWith("https://drive.google.com/file/d/"));
 redirects++;
}
console.log("MISSION06_NINE_LEGACY_PDFS_REAL_HTTP_PASS "+JSON.stringify({
 mode,hostname:host,unchanged_literal_query_links:checked,
 http_200_direct_pdf:checked,byte_exact_supabase_to_r2:checked,
 no_302_pdf_redirects:true,original_static_pages_byte_identical:staticRoutes.length,
 old_drive_redirects:redirects,invalid_slug_http_404:true,post_denied_405:true,
 original_slugs_logged:false,real_pdf_bytes_logged:false,
 production_d1_r2_writes:0,dns_updates:0,supabase_writes:0
}));
