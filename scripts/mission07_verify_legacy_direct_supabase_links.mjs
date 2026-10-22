// CÉLÉBRATIONS Mission 07: READ-ONLY real HTTP proof of literal historical URLs.
// Never log slugs, letter IDs, bodies, email addresses, or private PDFs.
// The Supabase-owned hostname cannot be moved to Cloudflare by user DNS.
// KEEP its Edge Function available as a compatibility dependency.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";

const source="https://jwyayfkssyagvnablttg.supabase.co/functions/v1/celebrations-committee-public";
const historic="https://celebrations.rondes.workers.dev";
const preview="https://celebrations-exit-preview-ro.rondes.workers.dev";
const official="https://www.ronde-des-archanges-universelle.eu";
const account=process.env.CLOUDFLARE_ACCOUNT_ID||"";
const token=process.env.CLOUDFLARE_API_TOKEN||"";
const db=process.env.PROD_D1_ID||"";
assert.match(account,/^[a-f0-9]{32}$/i,"Cloudflare account not configured");
assert.ok(token,"Private Cloudflare read credential missing");
assert.equal(db,"28736d2a-479b-472b-bf82-703ad0affe10","Wrong isolated production D1");
assert.equal(process.env.STAGING_R2_BUCKET,"celebrations-exit-staging");
const digest=x=>createHash("sha256").update(x).digest("hex");
const api="https://api.cloudflare.com/client/v4/accounts/"+account+"/d1/database/"+db+"/query";
async function http(url,method="GET"){
 return fetch(url,{method,redirect:"manual",signal:AbortSignal.timeout(30000),
  headers:{"cache-control":"no-cache"}});
}
const result=await fetch(api,{
 method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},
 body:JSON.stringify({sql:"SELECT l.id,l.slug FROM celebrations_committee_letters l JOIN committee_media m ON m.slug=l.slug WHERE m.published=1 AND m.revoked_at IS NULL ORDER BY l.id LIMIT 20"}),
 signal:AbortSignal.timeout(25000)
});
assert.equal(result.status,200,"Private D1 read denied");
const data=await result.json();
assert.equal(data.success,true,"D1 audit failed");
assert.equal(data.result?.[0]?.success,true,"D1 read query failed");
assert.equal(Number(data.result[0]?.meta?.rows_written),0,"D1 must not be mutated");
const links=data.result[0].results;
assert.ok(Array.isArray(links)&&links.length===9,"Expected nine original committee documents");
assert.equal(new Set(links.map(x=>x.slug)).size,9,"Duplicate historic slug");

let slugs=0,ids=0,r2=0;
for(const row of links){
 assert.ok(typeof row.slug==="string"&&row.slug.length>=8&&row.slug.length<160);
 assert.ok(typeof row.id==="string"&&row.id.length>0&&row.id.length<129);
 const path="/?lettre="+encodeURIComponent(row.slug);
 const ref=await http(historic+path);
 assert.equal(ref.status,200,"Historic PDF on Worker unavailable");
 assert.match(ref.headers.get("content-type")||"",/application\/pdf/i);
 assert.equal(ref.headers.get("location"),null,"Historic Worker PDF redirected");
 const bytes=Buffer.from(await ref.arrayBuffer());
 assert.ok(bytes.length>1000&&bytes.subarray(0,5).toString()==="%PDF-");
 const hash=digest(bytes);r2++;
 for(const [key,value] of [["slug",row.slug],["id",row.id]]){
  const response=await http(source+"?"+key+"="+encodeURIComponent(value));
  assert.equal(response.status,200,"A direct Supabase PDF URL has stopped working");
  assert.match(response.headers.get("content-type")||"",/application\/pdf/i);
  const file=Buffer.from(await response.arrayBuffer());
  assert.equal(digest(file),hash,"Direct Supabase PDF differs from original R2 PDF");
  if(key==="slug")slugs++;else ids++;
 }
}
// The direct source endpoint is a required LEGACY service, NOT to be disabled.
const lines=readFileSync("_redirects","utf8").trim().split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
assert.equal(lines.length,4,"Unexpected historical redirect inventory");
const expected=new Map(lines.map(line=>{
 const parts=line.split(/\s+/);
 assert.equal(parts.length,3);
 assert.equal(parts[2],"302");
 assert.ok(parts[1].startsWith("https://drive.google.com/file/d/"));
 return [parts[0],parts[1]];
}));
const required=["/communique","/rituel-court","/rituel-long","/preparation"];
assert.deepEqual([...expected.keys()],required,"Redirect map changed");
let historicalRedirects=0,previewRedirects=0;
const officialObserved=[];
for(const route of required){
 for(const [label,origin] of [["historic",historic],["preview",preview]]){
  const r=await http(origin+route,"HEAD");
  assert.equal(r.status,302,"Historic Google Drive redirect disappeared");
  assert.equal(r.headers.get("location"),expected.get(route),"Google Drive destination drift");
  if(label==="historic")historicalRedirects++;else previewRedirects++;
 }
 // The public official site remains outside the migration scope: inventory
 // only. Github Pages may not interpret Netlify-style _redirects.
 try{
  const r=await http(official+route,"HEAD");
  officialObserved.push({route,status:r.status,location_is_expected:r.headers.get("location")===expected.get(route)});
 }catch{
  officialObserved.push({route,status:"UNREACHABLE",location_is_expected:false});
 }
}
const noSlug=await http(source+"?slug=not-a-real-original-invitation");
assert.notEqual(noSlug.status,200,"Source served unknown secret slug");
const noId=await http(source+"?id=not-a-real-original-invitation");
assert.notEqual(noId.status,200,"Source served unknown secret id");
console.log("MISSION07_SUPABASE_ORIGINAL_HOST_KEEPALIVE_PASS "+JSON.stringify({
 original_direct_supabase_slug_urls_http_200:slugs,
 original_direct_supabase_id_urls_http_200:ids,
 original_pdf_bytes_match_private_cloudflare_r2:r2,
 unknown_slug_and_id_denied:true,source_supabase_deletions:0,source_writes:0,
 source_hostname_controlled_by_supabase:true,
 legacy_edge_function_must_remain_active:true,
 cloudflare_original_worker_changed:false,dns_changed:false
}));
console.log("MISSION07_HISTORIC_DRIVE_REDIRECTS_PASS "+JSON.stringify({
 historic_worker_unchanged_paths_302:historicalRedirects,
 cloudflare_preview_unchanged_paths_302:previewRedirects,
 drive_destination_exactly_preserved:true,
 official_hostname_audit_only:officialObserved,
 source_redirect_file_verified:true,source_writes:0
}));
