// Mission 12C — DNSSEC clearance evidence only. Read-only public DNS.
// This is NOT permission to change registrar nameservers, Cloudflare or production.
// Verify 2 independent recursive DoH resolvers PLUS authoritative .eu servers.
import assert from "node:assert/strict";
import dns from "node:dns/promises";
import {spawnSync} from "node:child_process";

const domain="ronde-des-archanges-universelle.eu";
const old=["launch1.spaceship.net","launch2.spaceship.net"];
const normalize=x=>String(x).toLowerCase().replace(/\.$/,"");
const sorted=a=>a.map(normalize).sort();
assert.equal(process.env.GITHUB_REF,"refs/heads/feat/celebrations-supabase-exit-001");
const observedNS=sorted(await dns.resolveNs(domain));
assert.deepEqual(observedNS,old,"Official DNS delegation already changed: stop");
const resolvers=[
  {name:"Cloudflare",url:"https://cloudflare-dns.com/dns-query"},
  {name:"Google",url:"https://dns.google/resolve"}
];
const recursive=[];
for(const resolver of resolvers){
  const u=new URL(resolver.url);
  u.searchParams.set("name",domain);
  u.searchParams.set("type","DS");
  const r=await fetch(u,{headers:{accept:"application/dns-json"},signal:AbortSignal.timeout(14000)});
  if(!r.ok)throw Error("DS recursive resolver unavailable: "+resolver.name);
  const data=await r.json();
  assert.equal(data.Status,0,"DNS recursive response inconclusive: "+resolver.name);
  const ds=(data.Answer||[]).filter(x=>Number(x.type)===43);
  recursive.push({resolver:resolver.name,response_status:data.Status,ds_count:ds.length});
}
const euNameservers=sorted(await dns.resolveNs("eu"));
assert.ok(euNameservers.length>=2,"No .eu authoritative server available");
const authoritative=[];
for(const server of euNameservers.slice(0,4)){
  const d=spawnSync("dig",["@"+server,domain,"DS","+norecurse","+time=4","+tries=1","+noall","+comments","+answer"],{
    encoding:"utf8",timeout:10000
  });
  if(d.error||d.status!==0) {
    authoritative.push({server,reachable:false,authoritative:false,ds_count:null});
    continue;
  }
  const result=d.stdout||"";
  const noerror=/status:\s*NOERROR\b/.test(result);
  const aa=/flags:\s*[^;\n]*\baa\b/.test(result);
  const answers=result.split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith(";"));
  const ds=answers.filter(l=>/\sIN\s+DS\s/i.test(l));
  authoritative.push({server,reachable:noerror,authoritative:aa,ds_count:ds.length});
}
const authoritativeConfirmations=authoritative.filter(x=>x.reachable&&x.authoritative);
const allRecursiveClear=recursive.length===2&&recursive.every(x=>x.ds_count===0);
const allAuthoritativeClear=authoritativeConfirmations.length>=2&&
  authoritativeConfirmations.every(x=>x.ds_count===0);
const output={
  domain,public_ns_still_spaceship:true,
  recursive,authoritative,
  ds_absence_confirmed_on_two_recursive_and_two_authoritative:
    allRecursiveClear&&allAuthoritativeClear,
  observation_only:true,registrar_changes:0,cloudflare_changes:0,d1_writes:0,
  permission_to_change_ns:false,full_zone_escrow_certified:false
};
console.log("MISSION12C_DNSSEC_MULTI_RESOLVER_READONLY "+JSON.stringify(output));
assert.ok(allRecursiveClear,"DS still present on a resolver: no DNS delegation change");
assert.ok(allAuthoritativeClear,"Authoritative .eu DS evidence insufficient: no DNS delegation change");
