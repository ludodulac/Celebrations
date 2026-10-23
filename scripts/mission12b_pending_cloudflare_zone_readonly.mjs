// CÉLÉBRATIONS — post-setup DNS preflight (owner 23 Oct 2026).
// Cloudflare API GET and public DNS queries ONLY, no credentials/values exported.
// This is NOT permission to change NS, DS, site, production Worker or email.
import assert from "node:assert/strict";
import dns from "node:dns/promises";
const account=process.env.CLOUDFLARE_ACCOUNT_ID||"";
const token=process.env.CLOUDFLARE_API_TOKEN||"";
const branch=process.env.GITHUB_REF||"";
assert.equal(branch,"refs/heads/feat/celebrations-supabase-exit-001");
assert.match(account,/^[0-9a-f]{32}$/i);
assert.ok(token.length>=10);
const apex="ronde-des-archanges-universelle.eu",www="www."+apex;
const origin="https://api.cloudflare.com/client/v4";
const expectedIps=["185.199.108.153","185.199.109.153","185.199.110.153","185.199.111.153"];
const expectedNS=["luke.ns.cloudflare.com","maria.ns.cloudflare.com"];
const oldNS=["launch1.spaceship.net","launch2.spaceship.net"];
function norm(s){return String(s||"").toLowerCase().replace(/\.$/,"")}
function sorted(a){return a.map(norm).sort()}
async function apiGet(endpoint){
 try {
  const r=await fetch(origin+endpoint,{method:"GET",headers:{
    Authorization:"Bearer "+token,Accept:"application/json"
   },signal:AbortSignal.timeout(25000)});
  if(!r.ok)return {readable:false,http_status:r.status};
  const data=await r.json();
  return data?.success?{readable:true,result:data.result,info:data.result_info||{}}:{readable:false,http_status:r.status};
 }catch {return {readable:false,http_status:null};}
}
const actualNS=sorted(await dns.resolveNs(apex));
const wwwCname=sorted((await dns.resolveCname(www).catch(()=>[])));
const apexIps=(await dns.resolve4(apex)).sort();
const publicStillOnSpaceship=JSON.stringify(actualNS)===JSON.stringify(sorted(oldNS));
const oldSiteExpected=JSON.stringify(apexIps)===JSON.stringify(expectedIps.slice().sort())
 &&wwwCname.includes("ludodulac.github.io");
let ds={state:"unknown"};
try{
 const u=new URL("https://cloudflare-dns.com/dns-query");
 u.searchParams.set("name",apex);u.searchParams.set("type","DS");
 const response=await fetch(u,{headers:{Accept:"application/dns-json"},signal:AbortSignal.timeout(15000)});
 if(response.ok){
  const data=await response.json();
  const answer=Array.isArray(data.Answer)?data.Answer.filter(x=>x.type===43):[];
  ds={state:answer.length?"present":"not_reported",count:answer.length,
    remaining_ttl_seconds:answer.length?Math.min(...answer.map(x=>x.TTL)):null};
 }
}catch{}
const z=await apiGet("/zones?name="+encodeURIComponent(apex)+"&per_page=100");
const candidates=z.readable&&Array.isArray(z.result)?
 z.result.filter(q=>norm(q.name)===apex&&norm(q.account?.id)===norm(account)):[];
let zone=null,recordsReadable=false,zoneDnsNameservers=[];
if(candidates.length===1){
 const item=candidates[0];
 const result=await apiGet("/zones/"+item.id+"/dns_records?per_page=100");
 let parity="not_readable",currentCount=null;
 if(result.readable&&Array.isArray(result.result)){
  recordsReadable=true;
  currentCount=result.result.length;
  // EXACT import (4 A apex, one CNAME www, DNS-only; no extra edits)
  const allowed=[
   ...expectedIps.map(ip=>({type:"A",name:apex,content:ip,proxied:false})),
   {type:"CNAME",name:www,content:"ludodulac.github.io",proxied:false}
  ];
  const canon=a=>a.map(x=>JSON.stringify({
   type:x.type,name:norm(x.name),content:norm(x.content),proxied:x.proxied===true
  })).sort();
  parity=JSON.stringify(canon(result.result))===JSON.stringify(canon(allowed))
   ?"all_five_dns_only_match_spaceship":"DNS_DRIFT_OR_ADDITIONAL_RECORDS_REVIEW";
 }
 zoneDnsNameservers=sorted(item.name_servers||[]);
 zone={
  api_status:item.status,
  plan:item.plan?.legacy_id||item.plan?.name||"unknown",
  assigned_cloudflare_ns:zoneDnsNameservers,
  assigned_ns_match_owner_screenshots:JSON.stringify(zoneDnsNameservers)===JSON.stringify(sorted(expectedNS)),
  cloudflare_account_verified:true,
  dns_record_readable:recordsReadable,
  imported_dns_record_count:currentCount,
  imported_record_parity:parity
 };
}
const outcome={
 source:"Cloudflare zone GET / public delegated DNS read only",
 domain:apex, public_nameservers:actualNS,
 public_still_spaceship:publicStillOnSpaceship,
 official_site_github_dns_unchanged:oldSiteExpected,
 parent_dnssec_ds:ds,
 cloudflare_zone_list_api_readable:z.readable,
 cloudflare_zone_count_with_exact_account:candidates.length,
 cloudflare_zone:zone,
 old_site_preserved:true,public_cutover_authorized:false,
 no_registrar_ns_changes:true,no_ds_changes:true,no_cloudflare_zone_changes:true,
 no_worker_deploy:true,production_d1_writes:0,private_data_logged:false
};
console.log("MISSION12B_PENDING_ZONE_AFTER_OWNER_SETUP "+JSON.stringify(outcome));
if(!publicStillOnSpaceship||!oldSiteExpected)
 throw Error("LIVE_DNS_CHANGED_STOP_FOR_MANUAL_REVIEW");
if(candidates.length>1)throw Error("DUPLICATE_ZONE_AMBIGUITY_STOP");
if(zone&&(zone.assigned_ns_match_owner_screenshots!==true||
          zone.imported_record_parity==="DNS_DRIFT_OR_ADDITIONAL_RECORDS_REVIEW"))
 throw Error("CLOUDFLARE_ZONE_MISMATCH_STOP");
