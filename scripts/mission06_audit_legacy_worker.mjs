// Mission 06 READ ONLY inventory of the currently mailed celebrations Worker.
// Compare public bytes with a checkout of main BEFORE authorizing ANY overwrite.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const origin="https://celebrations.rondes.workers.dev";
const expectedMainDir="legacy-main";
const digest=x=>createHash("sha256").update(x).digest("hex");
const checks=[
 ["/","index.html"],
 ["/index.html","index.html"],
 ["/styles.css","styles.css"],
 ["/admin-committee-links.js","admin-committee-links.js"],
 ["/admin.html","admin.html"]
];
const matches=[];
for(const [route,file] of checks){
 const response=await fetch(origin+route,{redirect:"follow",signal:AbortSignal.timeout(25000)});
 const actual=Buffer.from(await response.arrayBuffer());
 const fromMain=readFileSync(expectedMainDir+"/"+file);
 const match=response.status===200&&digest(actual)===digest(fromMain);
 matches.push({path:route,status:response.status,same_main_bytes:match,source_bytes:fromMain.length,live_bytes:actual.length});
}
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const token=process.env.CLOUDFLARE_API_TOKEN;
assert.match(account||"",/^[0-9a-f]{32}$/i);
assert.ok(token);
const url="https://api.cloudflare.com/client/v4/accounts/"+account+"/workers/scripts/celebrations";
let source,settings;
for(const [key,path] of [["script",url],["settings",url+"/settings"]]){
 const r=await fetch(path,{headers:{authorization:"Bearer "+token},signal:AbortSignal.timeout(25000)});
 let safe={
  http_status:r.status,
  content_type:(r.headers.get("content-type")||"").split(";")[0],
  bytes:Number(r.headers.get("content-length")||0)
 };
 if(key==="script"){
  // The response body may be source/multipart and MUST NEVER be logged.
  const data=Buffer.from(await r.arrayBuffer());
  safe.bytes=data.length;
  safe.present=r.status===200&&data.length>0;
  safe.sha256=safe.present?digest(data):null;
  source=safe;
 }else{
  let json={};try{json=await r.json()}catch{}
  const s=json.result||{};
  safe.success=json.success===true;
  safe.bindings=Array.isArray(s.bindings)?s.bindings.map(b=>({type:b.type,name:b.name})):null;
  safe.main_module=typeof s.main_module==="string"?s.main_module:null;
  safe.has_assets=!!(s.assets||s.assets_config);
  safe.compatibility_date=s.compatibility_date||null;
  settings=safe;
 }
}
console.log("MISSION06_ORIGINAL_WORKER_PREFLIGHT "+JSON.stringify({
 source_host:origin,comparison:matches,script:source,settings,
 all_files_exact_main:matches.every(x=>x.same_main_bytes),
 original_worker_changed:false,dns_changed:false,r2_changed:false
}));
if(matches.some(x=>!x.same_main_bytes))
 throw Error("Historic Cloudflare Worker content differs from current GitHub main; do not overwrite");
// The original "celebrations" is an ASSETS-ONLY Worker: Cloudflare GET
// /workers/scripts/celebrations returns HTTP 204 by design, because there is
// no uploaded JS source. The original recoverable asset build is GitHub main.
const originalAssetsOnly=(source.http_status===204&&!source.present&&
 settings.success&&Array.isArray(settings.bindings)&&settings.bindings.length===0&&
 settings.compatibility_date==="2026-09-22"&&matches.every(x=>x.same_main_bytes));
if(!source.present&&!originalAssetsOnly)
 throw Error("Cannot recover original Worker from pinned main and settings; do not overwrite");
console.log("MISSION06_ROLLBACK_BASELINE_PASS "+JSON.stringify({
 historic_assets_only:originalAssetsOnly,old_script_http:source.http_status,
 recoverable_git_main:"4b5edd9c19ce989af2eae33445017dd30fcbbe92",
 original_static_equality:matches.length,dns_changed:false,
 old_worker_modified:false
}));
