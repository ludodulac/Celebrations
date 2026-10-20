// Tiny, source-level bounded READ-ONLY SQL cost proof on isolated staging D1.
// Executes exactly three SELECTs, never scans historical click statistics.
// Fails closed if account identity, query responses or row budget differ.
import assert from "node:assert/strict";
const account=process.env.CLOUDFLARE_ACCOUNT_ID||"";
const db=process.env.STAGING_D1_ID||"";
assert.match(account,/^[0-9a-f]{32}$/i);
assert.match(db,/^[0-9a-f-]{36}$/i);
assert.equal(process.env.STAGING_R2_BUCKET,"celebrations-exit-staging");
const api="https://api.cloudflare.com/client/v4/accounts/"+account+"/d1/database/"+db;
const headers={authorization:"Bearer "+process.env.CLOUDFLARE_API_TOKEN,"content-type":"application/json"};
const idRes=await fetch(api,{headers,signal:AbortSignal.timeout(20000)});
const identity=await idRes.json();
assert.equal(identity?.result?.name,"celebrations-exit-staging","Refuse non-staging D1 database");
let calls=0,reads=0,writes=0;
async function read(sql,params=[]){
 assert.ok(/^SELECT\s/i.test(sql),"Refusing any D1 SQL that is not SELECT");
 assert.ok(calls<3,"Hard limit: at most three D1 SELECTs");
 calls++;
 const r=await fetch(api+"/query",{method:"POST",headers,body:JSON.stringify({sql,params}),signal:AbortSignal.timeout(25000)});
 assert.equal(r.status,200,"D1 read-only query failed");
 const b=await r.json();
 assert.equal(b?.success,true,"D1 read-only query refused");
 const result=b.result?.[0];
 assert.equal(result?.success,true,"D1 read result failed");
 const n=Number(result?.meta?.rows_read);
 const w=Number(result?.meta?.rows_written);
 assert.ok(Number.isFinite(n)&&n>=0&&n<1500,"Unexpectedly expensive staging SELECT: "+n);
 assert.equal(w,0,"Unexpected D1 write operation detected");
 reads+=n;writes+=w;
 return {rows:result.results||[],reads:n};
}
const relation=await read(
 "SELECT ec.event_id,ec.content_id,ec.sort_order FROM celebrations_event_contents ec"+
 " CROSS JOIN celebrations_contents c CROSS JOIN celebrations_events e"+
 " WHERE ec.content_id=c.id AND ec.event_id=e.id"+
 " AND c.audience IN ('all') AND e.audience IN ('all')"
);
assert.ok(relation.rows.length>=1&&relation.rows.length<=1000,"Unexpected public relation data");
const key=await read(
 "SELECT storage_path FROM celebrations_contents WHERE audience='all'"+
 " AND storage_path IS NOT NULL LIMIT 1"
);
assert.equal(key.rows.length,1,"Expected one public media path");
const path=key.rows[0].storage_path;
assert.ok(typeof path==="string"&&path.length>0);
const media=await read(
 "SELECT 1 FROM celebrations_contents c WHERE (c.storage_path=? OR c.cover_storage_path=?)"+
 " AND c.audience='all'"+
 " AND (EXISTS (SELECT 1 FROM celebrations_event_contents ec"+
 " JOIN celebrations_events e ON e.id=ec.event_id"+
 " WHERE ec.content_id=c.id AND e.audience='all')"+
 " OR EXISTS (SELECT 1 FROM celebrations_step_contents sc WHERE sc.content_id=c.id)) LIMIT 1",
 [path,path]
);
assert.ok(media.rows.length<=1);
assert.equal(calls,3);assert.equal(writes,0);assert.ok(reads<3000);
console.log("STAGING_D1_QUERY_META_QUOTA_SAFE "+JSON.stringify({
 relation_returned:relation.rows.length,relation_rows_read:relation.reads,
 media_lookup_rows_read:media.reads,three_selects_total_rows_read:reads,
 historical_stats_queries_executed:0,rows_written:0,
 staging_only:true,earlier_relation_avg_rows_read:13475
}));
