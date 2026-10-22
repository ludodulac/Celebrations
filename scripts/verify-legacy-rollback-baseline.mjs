// Read-only fallback rehearsal: verify the currently deployed legacy Pages
// branch is still pinned to a known successful deployment and the public
// origin serves the expected CÉLÉBRATIONS homepage. Never touch DNS.
import assert from "node:assert/strict";
import {lookup} from "node:dns/promises";
const EXPECTED_MAIN="4b5edd9c19ce989af2eae33445017dd30fcbbe92";
const DOMAIN="www.ronde-des-archanges-universelle.eu";
const request=async(url)=>fetch(url,{redirect:"follow",signal:AbortSignal.timeout(25000),
 headers:{"user-agent":"celebrations-readiness-audit","cache-control":"no-cache"}});
const shaResp=await request("https://api.github.com/repos/ludodulac/Celebrations/commits/main");
assert.equal(shaResp.status,200,"Cannot establish GitHub fallback commit");
const commit=await shaResp.json();
assert.equal(commit.sha,EXPECTED_MAIN,"The legacy main SHA changed: refresh rollback evidence");
const page=await request("https://"+DOMAIN+"/");
assert.equal(page.status,200,"Existing public domain unavailable before cutover");
const html=await page.text();
assert.ok(html.includes("welcome-open-program")&&html.includes("Ronde des Archanges"),
 "Legacy public homepage mismatch");
const addr=await lookup(DOMAIN,{all:true});
assert.ok(addr.length>=1,"No public DNS resolution");
const pagesFlow=await request("https://api.github.com/repos/ludodulac/Celebrations/actions/workflows/pages.yml/runs?branch=main&per_page=100");
assert.equal(pagesFlow.status,200,"Cannot verify GitHub Pages deployment history");
const runs=(await pagesFlow.json()).workflow_runs||[];
assert.ok(runs.some(x=>x.path===".github/workflows/pages.yml"&&
 x.head_sha===EXPECTED_MAIN&&x.conclusion==="success"),
 "No successful GitHub Pages workflow for the pinned fallback main SHA");
console.log("CELEBRATIONS_LEGACY_ROLLBACK_BASELINE_READONLY_PASS "+
 JSON.stringify({public_domain_200:true,legacy_pages_commit:EXPECTED_MAIN,
  public_dns_resolves:true,pages_deployed_main_verified:true,
  dns_zone_configuration_exported:false,actual_dns_switch_rehearsed:false,
  cloudflare_data_written:0,source_data_written:0}));
