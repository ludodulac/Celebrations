// Official CÉLÉBRATIONS final public media & original mailed PDF URLs.
// READ ONLY. Query D1 with a SELECT only, HEAD public R2 and both old link hosts.
// Never print paths, slugs, visitor data, email, authentication values.
import assert from "node:assert/strict";
const domain="https://ronde-des-archanges-universelle.eu";
const www="https://www.ronde-des-archanges-universelle.eu";
const old="https://celebrations.rondes.workers.dev";
const preview="https://celebrations-exit-production.rondes.workers.dev";
const account=process.env.CLOUDFLARE_ACCOUNT_ID||"";
const token=process.env.CLOUDFLARE_API_TOKEN||"";
const db=process.env.PROD_D1_ID||"";
assert.match(account,/^[a-f0-9]{32}$/i);
assert.equal(db,"28736d2a-479b-472b-bf82-703ad0affe10");
assert.ok(token.length>10);
const endpoint="https://api.cloudflare.com/client/v4/accounts/"+account+"/d1/database/"+db+"/query";
async function select(sql){
 const r=await fetch(endpoint,{method:"POST",headers:{"authorization":"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({sql}),signal:AbortSignal.timeout(30000)});
 assert.equal(r.status,200,"D1 SELECT inaccessible");
 const j=await r.json();
 assert.equal(j.success,true);
 assert.equal(j.result?.length,1);
 assert.equal(j.result[0].success,true);
 assert.equal(j.result[0].meta?.rows_written,0,"D1 SELECT wrote data");
 return j.result[0].results;
}
async function request(url,method="HEAD",redirect="manual"){
 let last;
 for(let attempt=0;attempt<2;attempt++){
  try{return await fetch(url,{method,redirect,signal:AbortSignal.timeout(22000)})}
  catch(e){last=e}
 }
 throw new Error("HTTP request failed after two bounded attempts: "+String(last?.name||"network failure"));
}
for(const [host,expected] of [[domain,"ronde-des-archanges-universelle.eu"],[www,"www.ronde-des-archanges-universelle.eu"]]){
 const r=await request(host+"/","GET");
 assert.equal(r.status,200,"Official host not OK");
 const text=await r.text();
 assert.ok(text.includes("Célébrations des Archanges"),"Official host wrong content");
 assert.equal(new URL(r.url).hostname,expected,"Official www must be direct and not redirect through old host");
}
const publicMedia=await select("SELECT storage_path FROM public_media WHERE approved=1 AND revoked_at IS NULL ORDER BY storage_path");
const invitations=await select("SELECT slug FROM committee_media WHERE published=1 AND revoked_at IS NULL ORDER BY slug");
assert.equal(publicMedia.length,113,"Missing approved public media");
assert.equal(invitations.length,9,"Missing approved invitations");
let mediaOK=0,pdfOfficial=0,pdfLegacy=0,pdfPreview=0;
for(let offset=0;offset<publicMedia.length;offset+=4){
 await Promise.all(publicMedia.slice(offset,offset+4).map(async item=>{
  const path=item.storage_path;
  assert.equal(typeof path,"string");
  assert.ok(path.length>5&&!path.startsWith("committee/"));
  const url=domain+"/media/"+path.split("/").map(encodeURIComponent).join("/");
  const r=await request(url);
  assert.equal(r.status,200,"Approved media missing");
  assert.ok(Number(r.headers.get("content-length")||1)>0,"Empty media");
  mediaOK++;
 }));
 if(mediaOK===publicMedia.length||mediaOK%20===0)console.log("FINAL_PUBLIC_MEDIA_PROGRESS "+JSON.stringify({verified:mediaOK,total:publicMedia.length}));

}
for(const {slug} of invitations){
 assert.ok(typeof slug==="string"&&slug.length>=8);
 for(const [host,via] of [[domain,"official"],[old,"legacy"],[preview,"preview"]]){
  // The old printed/emailed URL syntax must be kept exactly; never expose it.
  const r=await request(host+"/?lettre="+encodeURIComponent(slug));
  assert.equal(r.status,200,"Original emailed PDF unavailable");
  assert.match(r.headers.get("content-type")||"",/application\/pdf/i,"Old PDF link not serving a PDF");
  assert.equal(r.headers.get("location"),null,"Emailed PDF unexpectedly redirected");
  if(via==="official")pdfOfficial++;
  if(via==="legacy")pdfLegacy++;
  if(via==="preview")pdfPreview++;
 }
}
const forbidden=await request(domain+"/?lettre=not-a-real-invitation");
assert.equal(forbidden.status,404,"Unknown private PDF slug accessible");
console.log("FINAL_CELEBRATIONS_PUBLIC_MEDIA_PDF_PASS "+JSON.stringify({
 official_both_hosts_http_200:true,
 public_media_verified:mediaOK,expected_public_media:publicMedia.length,
 committee_pdf_links_on_official:pdfOfficial,
 committee_pdf_links_on_historic_host:pdfLegacy,
 committee_pdf_links_on_preview:pdfPreview,
 unknown_private_link_http:forbidden.status,
 no_slug_or_private_path_logged:true,
 d1_writes:0,source_writes:0,r2_writes:0,dns_changes:0
}));
