// Mission 12: public DNS and email-route evidence ONLY. No DNS account edits.
// TXT bodies (SPF, DKIM, verification tokens) are never printed. Public DNS
// can NOT enumerate the whole zone; this is NOT a complete zone backup.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import dns from "node:dns/promises";
const apex="ronde-des-archanges-universelle.eu";
const www="www."+apex;
const optional=async(promise)=>{
 try{return await promise}
 catch(e){if(["ENODATA","ENOTFOUND","ENOTIMP","ENOTINITIALIZED","ESERVFAIL","ETIMEOUT","ENODOMAIN","EAI_AGAIN"].includes(e.code))return null;throw e}
};
const ns=(await dns.resolveNs(apex)).map(x=>x.toLowerCase().replace(/\.$/,"")).sort();
assert.ok(ns.length>=2,"No verifiable authoritative DNS servers");
const [wwwCname,wwwA,wwwAaaa,rootA,rootAaaa,mx,spfTxt,dmarcTxt,caa]=await Promise.all([
 optional(dns.resolveCname(www)),optional(dns.resolve4(www,{ttl:true})),
 optional(dns.resolve6(www,{ttl:true})),optional(dns.resolve4(apex,{ttl:true})),
 optional(dns.resolve6(apex,{ttl:true})),optional(dns.resolveMx(apex)),
 optional(dns.resolveTxt(apex)),optional(dns.resolveTxt("_dmarc."+apex)),
 optional(dns.resolveCaa(apex))
]);
const joined=(records)=>Array.isArray(records)?records.map(x=>x.join("")):[];
const spf=joined(spfTxt).filter(x=>x.toLowerCase().startsWith("v=spf1"));
const dmarc=joined(dmarcTxt).filter(x=>x.toLowerCase().startsWith("v=dmarc1"));
assert.ok(spf.length<=1,"Multiple SPF records are invalid");
assert.ok(dmarc.length<=1,"Multiple DMARC records are invalid");
const mxSafe=Array.isArray(mx)?mx.map(x=>({
 priority:x.priority,exchange:x.exchange.toLowerCase().replace(/\.$/,"")
})).sort((a,b)=>a.priority-b.priority||a.exchange.localeCompare(b.exchange)):[];
const norm=(x)=>Array.isArray(x)?x:[];
const v4=s=>norm(s).map(x=>({address:x.address,ttl_seconds:x.ttl}));
const v6=s=>norm(s).map(x=>({address:x.address,ttl_seconds:x.ttl}));
const target=norm(wwwCname).map(x=>x.replace(/\.$/,"").toLowerCase()).sort();
const dnsSnapshot={
 domain:apex,
 nameservers:ns,
 www_cname:target,
 www_ipv4:v4(wwwA),www_ipv6:v6(wwwAaaa),
 root_ipv4:v4(rootA),root_ipv6:v6(rootAaaa),
 mail_exchangers:mxSafe,
 spf_txt:spf,
 dmarc_txt:dmarc,
 caa_records:norm(caa)
};
const fingerprint=createHash("sha256").update(
 JSON.stringify(dnsSnapshot)).digest("hex");
const selectors=["default","selector1","selector2","mail"];
const dkim=await Promise.all(selectors.map(async selector=>{
 const name=selector+"._domainkey."+apex;
 const [txt,cname]=await Promise.all([
  optional(dns.resolveTxt(name)),optional(dns.resolveCname(name))
 ]);
 const present=joined(txt).some(x=>/\bv=DKIM1\b/i.test(x))||norm(cname).length>0;
 return {selector,detected_in_common_selector_check:present};
}));
// DNSSEC: query the parent zone's DS, never mistake a DNSKEY at the apex
// for confirmed parent delegation. No DS => inactive/undetermined.
let ds={status:"unknown",count:null};
try{
 const u=new URL("https://cloudflare-dns.com/dns-query");
 u.searchParams.set("name",apex);u.searchParams.set("type","DS");
 const response=await fetch(u,{headers:{"accept":"application/dns-json"},
  signal:AbortSignal.timeout(12000)});
 if(response.ok){
  const x=await response.json();
  if(x.Status===0){
   const answers=(x.Answer||[]).filter(a=>a.type===43);
   ds={status:answers.length?"present":"not_reported",count:answers.length,
    minimum_ttl_seconds:answers.length?Math.min(...answers.map(x=>x.TTL)):null};
  }else ds={status:"resolver_status_"+x.Status,count:null};
 }
}catch{}
const out={
 domain:apex,
 nameservers:ns,
 www_cname:target,
 www_a:v4(wwwA),www_aaaa:v6(wwwAaaa),
 apex_a:v4(rootA),apex_aaaa:v6(rootAaaa),
 mx:mxSafe,
 spf_record_count:spf.length,
 spf_present:spf.length===1,
 dmarc_record_count:dmarc.length,
 dmarc_present:dmarc.length===1,
 dkim_common_selectors_checked:dkim,
 dkim_full_selector_inventory_possible:false,
 caa_record_count:norm(caa).length,
 dnssec_parent_ds:ds,
 public_dns_fingerprint:fingerprint,
 txt_values_or_mail_validation_tokens_logged:false,
 dns_zone_complete_exported:false,
 registrar_access_verified:false,
 dns_updates:0,email_changes:0,
 migration_custom_domain_connected:false,
 existing_domain_cutover_authorized:false
};
console.log("MISSION12_PUBLIC_DNS_EMAIL_BASELINE "+JSON.stringify(out));
if(!target.length&&!norm(wwwA).length&&!norm(wwwAaaa).length)
 throw Error("The official WWW hostname is not resolvable");
