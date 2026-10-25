// Mission 12D — compare assigned pending Cloudflare authoritative DNS against
// live Spaceship authoritative records. GET DNS queries only, never NS updates.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";

assert.equal(process.env.GITHUB_REF,"refs/heads/feat/celebrations-supabase-exit-001");
const apex="ronde-des-archanges-universelle.eu";
const expectedA=["185.199.108.153","185.199.109.153","185.199.110.153","185.199.111.153"];
const www="www."+apex;
const normalize=x=>String(x).trim().toLowerCase().replace(/\.$/,"");
const nameservers={
  Spaceship:["launch1.spaceship.net","launch2.spaceship.net"],
  Cloudflare:["luke.ns.cloudflare.com","maria.ns.cloudflare.com"]
};
function query(nameServer,name,type){
  const result=spawnSync("dig",["@"+nameServer,name,type,
    "+norecurse","+time=4","+tries=1","+noall","+comments","+answer"],{
      encoding:"utf8",timeout:10000
    });
  assert.equal(result.status,0,"DNS server not reachable: "+nameServer);
  const raw=result.stdout||"";
  assert.match(raw,/status:\s*NOERROR\b/,"DNS status not NOERROR: "+nameServer);
  assert.match(raw,/flags:\s*[^;\n]*\baa\b/,"DNS response not authoritative: "+nameServer);
  return raw.split(/\r?\n/).filter(x=>x.trim()&&!x.startsWith(";"))
    .map(x=>x.trim().split(/\s+/))
    .filter(x=>x.length>=5&&x[2]==="IN"&&x[3]===type)
    .map(x=>normalize(x.slice(4).join(" "))).sort();
}
const results=[];
for(const [provider,servers] of Object.entries(nameservers)){
  for(const server of servers){
    const a=query(server,apex,"A");
    const cname=query(server,www,"CNAME");
    results.push({
      provider,server,
      root_a_count:a.length,root_a_match:JSON.stringify(a)===JSON.stringify([...expectedA].sort()),
      www_cname_count:cname.length,www_cname_match:
        JSON.stringify(cname)===JSON.stringify(["ludodulac.github.io"])
    });
  }
}
const pass=results.length===4&&results.every(x=>x.root_a_match&&x.www_cname_match);
console.log("MISSION12D_WEB_DNS_PARITY_READONLY "+JSON.stringify({
  domain:apex,
  exact_known_web_records_match_both_authoritative_providers:pass,
  records:results,
  full_zone_exported:false,email_or_redirects_certified:false,
  cloudflare_proxy_setting_api_verified:false,
  dns_changed:false,worker_changed:false,supabase_changed:false
}));
assert.ok(pass,"Pending Cloudflare DNS differs from live Spaceship Web DNS; no NS cutover");
