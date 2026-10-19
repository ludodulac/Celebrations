// Live smoke checks for the isolated Cloudflare test site. All requests
// are GET/HEAD except unauthorized POST probes, which must never write data.
import assert from "node:assert/strict";
const origin="https://celebrations-exit-staging.rondes.workers.dev";
const check=async(path,{method="GET",body,headers={},follow=false}={})=>{
 const response=await fetch(origin+path,{
  method,headers,body,redirect:follow?"follow":"manual",signal:AbortSignal.timeout(20000)
 });
 return response;
};
const record={origin};
const root=await check("/");
record.root_status=root.status;
// Worker-first asset routing must force the isolated staging mode.
assert.equal(root.status,302,"Staging root must enter isolated mode before assets");
assert.ok((root.headers.get("location")||"").includes("staging=1"));
const adminNoQuery=await check("/admin.html");
record.admin_default_status=adminNoQuery.status;
assert.ok([302,307].includes(adminNoQuery.status),
 "Admin entry must not bypass the staging-mode redirect");
const adminDefault=await check("/admin.html",{follow:true});
assert.equal(adminDefault.status,200);
assert.equal(new URL(adminDefault.url).searchParams.get("staging"),"1",
 "Admin entry without query must end in staging mode");
for(const [label,path] of [
 ["home","/?staging=1"],
 ["admin","/admin.html?staging=1"],
 ["bridge","/migration/cloudflare/preview-client.js"]]){
 const r=await check(path,{follow:true});
 record[label+"_status"]=r.status;
 if(label!=="bridge")assert.equal(new URL(r.url).searchParams.get("staging"),"1",label+" must remain staging-only after redirects");
 assert.equal(r.status,200,label+" page/static asset should load");
 const data=await r.text();
 assert.ok(data.length>100,label+" returned an unexpectedly empty document");
 if(label==="bridge") assert.ok(data.includes("celebrationsStagingMedia")&&data.includes("https://"),
  "Staging media URL mapper missing");
}
for(const [table,minExpected] of [
 ["celebrations_celebrations",4],
 ["celebrations_events",62],
 ["celebrations_contents",100],
 ["celebrations_event_contents",1],
 ["celebrations_step_contents",0]
]){
 const r=await check("/api/public-data?table="+table);
 assert.equal(r.status,200,"Cannot read public "+table+" from staging D1");
 const rows=await r.json();
 assert.ok(Array.isArray(rows)&&rows.length>=minExpected,"Empty or incorrect "+table);
 record[table+"_count"]=rows.length;
}
const privateRead=await check("/api/public-data?table=celebrations_participants");
record.private_table_status=privateRead.status;
assert.equal(privateRead.status,404,"Private participant data must not be readable");
const unauthorizedSave=await check("/api/safe-save",{
 method:"POST",headers:{"content-type":"application/json"},
 body:JSON.stringify({action:"safe_merge",groups:[],contents:[],celebrations:[],events:[]})
});
record.unauthorized_save_status=unauthorizedSave.status;
assert.equal(unauthorizedSave.status,401,"Unauthenticated save must not write to D1");
const unauthorizedAdmin=await check("/api/admin",{
 method:"POST",headers:{"content-type":"application/json"},
 body:JSON.stringify({action:"list",table:"celebrations_participants"})
});
record.unauthorized_admin_status=unauthorizedAdmin.status;
assert.equal(unauthorizedAdmin.status,401,"Unauthenticated admin must not expose participants");
const forbidden=await check("/api/not-a-route");
record.unknown_api_status=forbidden.status;
assert.equal(forbidden.status,404);
console.log("STAGING_PUBLIC_SMOKE "+JSON.stringify(record));
