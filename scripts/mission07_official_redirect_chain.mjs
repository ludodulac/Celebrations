// Strictly read-only, zero D1/Supabase queries. Do historic shortlinks on the
// STILL-LIVE public domain ultimately lead to the intended Drive files?
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const official="https://www.ronde-des-archanges-universelle.eu";
const routes=readFileSync("_redirects","utf8").trim().split(/\r?\n/).map(x=>x.trim().split(/\s+/));
assert.equal(routes.length,4);
let ok=0;
for(const [route,want,code] of routes){
 assert.equal(code,"302");
 let url=official+route;
 const chain=[];
 let reached=false;
 for(let depth=0;depth<5;depth++){
  const r=await fetch(url,{method:"GET",redirect:"manual",signal:AbortSignal.timeout(15000)});
  const u=new URL(url);
  const host=u.hostname;
  const label=host.includes("google.com")?"google-drive":host.includes("ronde-des-archanges-universelle.eu")?"official":"other";
  chain.push({status:r.status,host:label});
  if(r.status>=300&&r.status<400){
   const location=r.headers.get("location");
   if(!location)break;
   const target=new URL(location,url);
   if(target.href===want){reached=true;chain.push({status:"destination",host:"google-drive"});break}
   if(target.protocol!=="https:")break;
   // Never follow arbitrary new hosts or reveal paths or query values.
   if(!/^(?:www\.)?ronde-des-archanges-universelle\.eu$/.test(target.hostname)&&
      !/^(?:drive|docs)\.google\.com$/.test(target.hostname))break;
   url=target.href;
   continue;
  }
  break;
 }
 if(reached)ok++;
 console.log("MISSION07_OFFICIAL_SHORTLINK_CHAIN "+JSON.stringify({
  route,forwarded_to_exact_drive_file:reached,chain
 }));
}
console.log("MISSION07_OFFICIAL_SHORTLINK_CHAIN_SUMMARY "+JSON.stringify({
 correct_redirects:ok,expected:4,public_domain_modified:false,
 dns_modified:false,supabase_modified:false,cloudflare_d1_rows_read:0
}));
if(process.env.MISSION07_REQUIRE_OFFICIAL_SHORTLINKS==="1")
 assert.equal(ok,4,"CUTOVER BLOCKED: four historic official-domain Drive links must reach their exact destinations");

