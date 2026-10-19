// Read-only public HTTP smoke test of the isolated Cloudflare staging Worker.
// No credentials, D1 writes, R2 mutations, or production requests.
const origin="https://celebrations-exit-staging.rondes.workers.dev";
const timeout=20_000;
async function request(url,method="GET"){
 const response=await fetch(url,{method,redirect:"manual",signal:AbortSignal.timeout(timeout),headers:{"cache-control":"no-cache"}});
 return response;
}
async function table(name){
 const r=await request(origin+"/api/public-data?table="+encodeURIComponent(name));
 if(r.status!==200)throw Error("Public D1 endpoint for "+name+" returned "+r.status);
 const rows=await r.json();
 if(!Array.isArray(rows))throw Error("Unexpected "+name+" data shape");
 return rows;
}
const [contents,events,stepLinks,eventLinks]=await Promise.all([
 "celebrations_contents","celebrations_events","celebrations_step_contents","celebrations_event_contents"
].map(table));
const publicEvents=new Set(events.filter(e=>e.audience==="all").map(e=>String(e.id)));
const eligibleIds=new Set([
 ...stepLinks.map(x=>String(x.content_id)),
 ...eventLinks.filter(x=>publicEvents.has(String(x.event_id))).map(x=>String(x.content_id))
]);
const keys=new Set();
let ignoredCommittee=0, externalLinks=0;
for(const c of contents){
 if(c.audience!=="all"||!eligibleIds.has(String(c.id)))continue;
 for(const path of [c.storage_path,c.cover_storage_path]){
  if(typeof path!=="string"||!path.trim())continue;
  if(/^https?:\/\//i.test(path)){externalLinks++;continue} // External links are not private R2 object keys.
  if(path.startsWith("committee/")){ignoredCommittee++;continue}
  keys.add(path);
 }
}
if(!keys.size)throw Error("No linked, public D1 media paths to verify; cannot assert success");
const paths=[...keys].sort();
const statuses=new Map(),errors=[];
let cursor=0;
async function worker(){
 while(cursor<paths.length){
  const key=paths[cursor++];
  const url=origin+"/media/"+key.split("/").map(encodeURIComponent).join("/");
  try{
   const r=await request(url,"HEAD");
   statuses.set(r.status,(statuses.get(r.status)||0)+1);
   if(r.status!==200 && errors.length<8) errors.push({path:key,status:r.status});
  }catch(e){
   statuses.set("NETWORK_ERROR",(statuses.get("NETWORK_ERROR")||0)+1);
   if(errors.length<8)errors.push({path:key,error:e.name||"error"});
  }
 }
}
await Promise.all(Array.from({length:Math.min(8,paths.length)},worker));
const denyCommittee=await request(origin+"/media/committee/__staging_smoke_denied__.pdf","HEAD");
const denyUnlisted=await request(origin+"/media/__unlisted_staging_smoke__.pdf","HEAD");
const report={
 origin,contents:contents.length,public_events:publicEvents.size,
 eligible_content_ids:eligibleIds.size,media_keys_tested:paths.length,
 ignored_committee_paths:ignoredCommittee,external_links:externalLinks,
 statuses:Object.fromEntries([...statuses].sort((a,b)=>String(a[0]).localeCompare(String(b[0])))),
 denied_committee_status:denyCommittee.status,
 denied_unknown_status:denyUnlisted.status,
 sample_failures:errors
};
console.log("STAGING_HTTP_MEDIA_AUDIT "+JSON.stringify(report));
if(process.env.GITHUB_STEP_SUMMARY){
 const {appendFile}=await import("node:fs/promises");
 await appendFile(process.env.GITHUB_STEP_SUMMARY,
 "## Staging HTTP media verification (read-only)\n\n"+ 
 "- Public linked media paths: "+paths.length+"\n"+
 "- HTTP response codes: "+JSON.stringify(report.statuses)+"\n"+
 "- Committee-denial: "+denyCommittee.status+"; unknown-media denial: "+denyUnlisted.status+"\n"+
 "- No production requests, R2 edits, or D1 writes.\n");
}
if(statuses.get(200)!==paths.length||denyCommittee.status!==404||denyUnlisted.status!==404)
 process.exitCode=1;
