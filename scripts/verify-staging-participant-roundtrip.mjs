// Live staging D1 test of real participant management, using ONE synthetic email.
// The synthetic account cannot receive mail; it is removed in finally.
// Existing participants and all production resources must remain untouched.
import assert from "node:assert/strict";
const origin="https://celebrations-exit-staging.rondes.workers.dev";
const bearer=process.env.STAGING_TEMP_ADMIN_BEARER;
assert.match(bearer||"",/^[0-9a-f]{64}$/);
assert.equal(process.env.STAGING_R2_BUCKET,"celebrations-exit-staging",
 "Refusing any non-staging resource");
const email=process.env.STAGING_SYNTHETIC_PARTICIPANT_EMAIL;
assert.match(email||"",/^migration-check-[0-9a-f-]{36}@invalid\.example$/);
async function action(name,body={}){
 const r=await fetch(origin+"/api/participants-admin",{
  method:"POST",
  headers:{"content-type":"application/json",authorization:"Bearer "+bearer},
  body:JSON.stringify({action:name,...body}),
  signal:AbortSignal.timeout(20000)
 });
 return {status:r.status,...await r.json()};
}
async function auth(action,body={}){
 const response=await fetch(origin+"/api/auth",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({action,...body}),signal:AbortSignal.timeout(30000)
 });
 return {status:response.status,...await response.json()};
}
async function access(token){
 const r=await fetch(origin+"/api/audience",{method:"POST",
  headers:{"content-type":"application/json"},
  body:JSON.stringify({action:"participant_get",participant_token:token}),signal:AbortSignal.timeout(20000)});
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
 // Exercise the real public registration + PBKDF2 login and password
 // recovery on this disposable account, NOT on the genuine participant.
 const firstPassword="synthetic-pass-2026-strong",updatedPassword="synthetic-rotated-2026-strong";
 const register=await auth("participant_register",{
  email,password:firstPassword,question_1:"first_school",question_2:"childhood_book",
  answer_1:"école test fictive",answer_2:"livre fictif"
 });
 assert.equal(register.status,200,"Cloudflare participant registration failed");
 const login=await auth("participant_login",{email,password:firstPassword});
 assert.equal(login.status,200,"Cloudflare PBKDF2 participant login failed");
 assert.match(login.token||"",/^[a-f0-9]{64}$/);
 const session=await auth("participant_session",{participant_token:login.token});
 assert.equal(session.status,200,"Participant session validation failed");
 const audience=await access(login.token);
 assert.equal(audience.status,200);assert.equal(audience.audience,"angel");
 const question=await auth("recovery_questions",{email});
 assert.equal(question.status,200,"Recovery questions not available");
 assert.equal(question.question_1,"first_school");
 const recovered=await auth("recover_password",{
  email,new_password:updatedPassword,answer_1:"école test fictive",answer_2:"livre fictif"
 });
 assert.equal(recovered.status,200,"Password recovery compatibility failed");
 const oldSession=await auth("participant_session",{participant_token:login.token});
 assert.equal(oldSession.status,401,"Recovery failed to revoke old sessions");
 const relogin=await auth("participant_login",{email,password:updatedPassword});
 assert.equal(relogin.status,200,"New password login failed");
 const logout=await auth("participant_logout",{participant_token:relogin.token});
 assert.equal(logout.status,200,"Logout failed");
 const revoked=await auth("participant_session",{participant_token:relogin.token});
 assert.equal(revoked.status,401,"Logout failed to invalidate session");
 console.log("STAGING_PARTICIPANT_AUTH_FULL_ROUNDTRIP registration=true login=true audience=true recovery=true logout=true");
 console.log("STAGING_PARTICIPANT_ROUNDTRIP stage=create-and-assign passed=true");
}finally{
 try{
  const current=await list();
  if(created||current.access.some(x=>x.email===email)){
   const removed=await action("admin_remove_participant",{email});
   assert.equal(removed.status,200,JSON.stringify(removed));
   const after=await list();
   assert.ok(!after.access.some(x=>x.email===email),"Synthetic participant remains");
   assert.deepEqual(after.access,before.access,
    "Existing participants changed during synthetic staging smoke test");
   assert.deepEqual(after.audiences,before.audiences,
    "Existing participant access assignments changed");
   console.log("STAGING_PARTICIPANT_ROUNDTRIP restored=true production_untouched=true");
  }
 }catch(e){cleanupError=e}
}
if(cleanupError)throw Error("Synthetic participant cleanup failed: "+cleanupError.message);
