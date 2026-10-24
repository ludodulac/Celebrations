// Safe, read-only acceptance of an isolated production candidate Workers.dev URL.
// This is NOT the owner's real domain cutover and never writes to D1/R2.
import assert from "node:assert/strict";
import dns from "node:dns/promises";

const site="https://celebrations-exit-production.rondes.workers.dev";
const official="www.ronde-des-archanges-universelle.eu";
const expectedNs=["launch1.spaceship.net","launch2.spaceship.net"];
async function get(path,method="GET"){
 return fetch(site+path,{method,redirect:"manual",signal:AbortSignal.timeout(25000),
  headers:{"cache-control":"no-cache"}});
}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let home;
for(let n=0;n<12;n++){
 home=await get("/");
 if(home.status===200)break;
 await pause(2500);
}
assert.equal(home.status,200,"Isolated Worker homepage unavailable");
assert.match(home.headers.get("x-robots-tag")||"",/noindex/);
assert.equal(home.headers.get("cache-control"),"no-store");
const html=await home.text();
assert.ok(html.includes("welcome-open-program")&&html.includes("CELEBRATIONS_STAGING_BACKEND=location.origin"));
assert.ok(!html.includes("cdn.jsdelivr.net/npm/@supabase/supabase-js"));
const robots=await get("/robots.txt");
assert.equal(robots.status,200);
assert.match(await robots.text(),/Disallow: \/?/);
for(const page of ["programme","preparation","mercredi","jeudi","vendredi","samedi","dimanche","apres-celebration","bibliotheque","apres-la-ronde"]){
 const response=await get("/"+page+"/");
 assert.equal(response.status,200,"Missing public site page "+page);
 assert.match(response.headers.get("x-robots-tag")||"",/noindex/);
}
for(const [table,count] of [["celebrations_celebrations",4],["celebrations_contents",211],["celebrations_events",62]]){
 const r=await get("/api/public-data?table="+table);
 assert.equal(r.status,200,"Public data endpoint failed "+table);
 const rows=await r.json();
 assert.equal(rows.length,count,"Public table drift "+table);
}
const jpg=await get("/media/media/1791723108110/file-1791723109615-1000040461.jpg","HEAD");
assert.equal(jpg.status,200,"Original homepage photograph missing");
const bad=await get("/?lettre=not-an-invite","HEAD");
assert.equal(bad.status,404,"Invalid invitation must be rejected");
// A DNS-only check. This script has no registrar/Cloudflare DNS write code.
const currentNs=(await dns.resolveNs("ronde-des-archanges-universelle.eu")).map(x=>x.toLowerCase()).sort();
assert.deepEqual(currentNs,expectedNs,"STOP: live domain delegation changed");
const live=await fetch("https://"+official+"/",{signal:AbortSignal.timeout(25000)});
assert.equal(live.status,200,"Old GitHub Pages site no longer available");
assert.match(await live.text(),/welcome-open-program/);
console.log("ISOLATED_PRODUCTION_WORKER_CANDIDATE_PASS "+JSON.stringify({
 hostname:site,public_pages:10,programme_data_tables:3,
 static_photo_status:jpg.status,unknown_pdf_denied:true,
 noindex_preview:true,real_domain_ns:currentNs,old_live_site_unchanged:true,
 dns_changes:0,d1_writes:0,r2_writes:0,supabase_writes:0
}));
