// Reads ONLY Cloudflare's GraphQL billing analytics, never D1 SQL.
// Fail closed with large safety reserves on both Free plan daily quotas.
import assert from "node:assert/strict";
import {appendFileSync} from "node:fs";
const account=process.env.CLOUDFLARE_ACCOUNT_ID||"";
const db=process.env.STAGING_D1_ID||"";
assert.match(account,/^[0-9a-f]{32}$/i);
assert.match(db,/^[0-9a-f-]{36}$/i);
assert.equal(process.env.STAGING_R2_BUCKET,"celebrations-exit-staging");
const date=new Date().toISOString().slice(0,10);
const query=`query D1Quota($accountTag:string!,$start:Date,$end:Date){
 viewer { accounts(filter:{accountTag:$accountTag}) {
  d1AnalyticsAdaptiveGroups(limit:1000,filter:{date_geq:$start,date_leq:$end}){
   dimensions{databaseId,date}
   sum{rowsRead rowsWritten readQueries writeQueries}
  }
 }}
}`;
const res=await fetch("https://api.cloudflare.com/client/v4/graphql",{
 method:"POST",
 headers:{"authorization":"Bearer "+process.env.CLOUDFLARE_API_TOKEN,
  "content-type":"application/json"},
 body:JSON.stringify({query,variables:{accountTag:account,start:date,end:date}})
});
assert.equal(res.status,200,"Cloudflare analytics denied: do not modify D1");
const body=await res.json();
assert.ok(!body.errors?.length,"Cloudflare analytics invalid: do not modify D1");
const accounts=body.data?.viewer?.accounts;
assert.ok(Array.isArray(accounts)&&accounts.length===1,"Cannot confirm account's daily D1 usage");
const groups=accounts[0].d1AnalyticsAdaptiveGroups;
assert.ok(Array.isArray(groups),"Daily usage missing; fail closed");
let reads=0,writes=0,queries=0,stagingReads=0;
for(const g of groups){
 reads+=Number(g.sum?.rowsRead||0);
 writes+=Number(g.sum?.rowsWritten||0);
 queries+=Number(g.sum?.readQueries||0);
 if(g.dimensions?.databaseId===db)stagingReads+=Number(g.sum?.rowsRead||0);
}
for(const n of [reads,writes,queries,stagingReads])
 assert.ok(Number.isFinite(n)&&n>=0,"D1 billing analytics contains invalid totals");
const phase=process.argv[2]||"pre";
console.log("CLOUDFLARE_D1_DAILY_FREE_QUOTA "+JSON.stringify({
 phase,utc_date:date,all_databases_rows_read:reads,
 all_databases_rows_written:writes,staging_rows_read:stagingReads,
 limit_read:5000000,limit_written:100000,read_remaining:5000000-reads,
 write_remaining:100000-writes,read_queries:queries
}));
if(phase==="pre"){
 // Reserve a LARGE 2.5M read and 65k write margin for other Cloudflare apps,
 // nightly tasks, analytics reporting lag and future user activity.
 assert.ok(reads<=2500000,"D1 rows-read above safe staging migration threshold; abort");
 assert.ok(writes<=35000,"D1 rows-written above safe staging migration threshold; abort");
 const f=process.env.GITHUB_ENV;
 if(f)appendFileSync(f,"D1_BASELINE_READS="+reads+"\nD1_BASELINE_WRITES="+writes+"\n");
}else if(phase==="post"){
 const readDelta=reads-Number(process.env.D1_BASELINE_READS||0);
 const writeDelta=writes-Number(process.env.D1_BASELINE_WRITES||0);
 console.log("D1_OPTIMIZATION_QUOTA_DELTA "+JSON.stringify({rows_read:readDelta,rows_written:writeDelta}));
 assert.ok(reads<3500000&&writes<80000,"D1 daily quota reserve unexpectedly depleted");
 assert.ok(readDelta<=100000&&writeDelta<=45000,"Migration consumed more than planned; do not repeat");
}else throw Error("Unknown quota check");
