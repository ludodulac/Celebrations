// Live staging D1 test of real participant management, using ONE synthetic email.
// The synthetic account cannot receive mail; it is removed in finally.
// Existing participants and all production resources must remain untouched.
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
const origin="https://celebrations-exit-staging.rondes.workers.dev";
const bearer=process.env.STAGING_TEMP_ADMIN_BEARER;
assert.match(bearer||"",/^[0-9a-f]{64}$/);
assert.equal(process.env.STAGING_R2_BUCKET,"celebrations-exit-staging",
 "Refusing any non-staging resource");
const email="migration-check-"+randomUUID()+"@invalid.example";
async function action(name,body={}){
 const r=await fetch(origin+"/api/participants-admin",{
  method:"POST",
  headers:{"content-type":"application/json",authorization:"Bearer "+bearer},
  body:JSON.stringify({action:name,...body}),
  signal:AbortSignal.timeout(20000)
 });
 return {status:r.status,...await r.json()};
}
async function list(){
 const a=await action("admin_list_participants");
 const b=await action("admin_list");
 assert.equal(a.status,200);assert.equal(b.status,200);
 return {access:a.participants,audiences:b.participants};
}
const before=await list();
assert.ok(!before.access.some(x=>x.email===email),"Unexpected collision");
let created=false,cleanupError=null;
try{
 const added=await action("admin_add_participant",{email});
 assert.equal(added.status,200,JSON.stringify(added));
 created=true;
 const eligible=await list();
 assert.ok(eligible.access.some(x=>x.email===email),"Added staging participant not visible");
 assert.equal(eligible.access.length,before.access.length+1,"Unexpected participant change");
 const assign=await action("admin_set",{email,audience:"angel"});
 assert.equal(assign.status,200,JSON.stringify(assign));
 const assigned=await list();
 assert.equal(assigned.audiences.find(x=>x.email===email)?.audience,"angel",
  "Access category not persisted in isolated D1");
 console.log("STAGING_PARTICIPANT_ROUNDTRIP stage=create-and-assign passed=true");
}finally{
 if(created){
  try{
   const removed=await action("admin_remove_participant",{email});
   assert.equal(removed.status,200,JSON.stringify(removed));
   const after=await list();
   assert.ok(!after.access.some(x=>x.email===email),"Synthetic participant remains");
   assert.deepEqual(after.access,before.access,
    "Existing participants changed during synthetic staging smoke test");
   assert.deepEqual(after.audiences,before.audiences,
    "Existing participant access assignments changed");
   console.log("STAGING_PARTICIPANT_ROUNDTRIP restored=true production_untouched=true");
  }catch(e){cleanupError=e}
 }
}
if(cleanupError)throw Error("Synthetic participant cleanup failed: "+cleanupError.message);
