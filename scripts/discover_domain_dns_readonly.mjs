// Public DNS-only lookup. No Cloudflare tokens, no mutations, no D1 reads.
import {resolveNs,resolveCname,resolveMx} from "node:dns/promises";
const apex="ronde-des-archanges-universelle.eu";
const nameservers=(await resolveNs(apex)).map(x=>x.toLowerCase()).sort();
if(nameservers.length<1)throw Error("No authoritative nameserver available");
async function optional(fqdn,query){
 try{return await query(fqdn)}catch(e){if(["ENODATA","ENOTFOUND","ENODOMAIN"].includes(e.code))return [];throw e}
}
const wwwCname=(await optional("www."+apex,resolveCname)).sort();
const mx=(await optional(apex,resolveMx)).map(x=>x.exchange.toLowerCase()).sort();
const provider=nameservers.every(n=>n.endsWith(".ns.cloudflare.com"))?"Cloudflare":
 nameservers.every(n=>n.endsWith(".ovh.net"))?"OVH":
 nameservers.every(n=>n.endsWith(".gandi.net"))?"Gandi":
 nameservers.every(n=>n.endsWith(".ui-dns.com")||n.endsWith(".ui-dns.de")||n.endsWith(".ui-dns.org")||n.endsWith(".ui-dns.biz"))?"IONOS":
 "à confirmer auprès du fournisseur";
console.log("CELEBRATIONS_PUBLIC_DNS_SOURCE_DISCOVERY "+
 JSON.stringify({dns_domain:apex,nameservers,dns_host_fingerprint:provider,
  www_cname:wwwCname,mail_exchangers:mx,
  full_dns_zone_exported:false,zone_edit_performed:false,
  dns_provider_api_access_verified:false}));
