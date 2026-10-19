// Live staging D1 test of real participant management, using ONE synthetic email.
// The synthetic account cannot receive mail; it is removed in finally.
// Existing participants and all production resources must remain untouched.
import assert from "node:assert/strict";
import {pbkdf2Sync,randomBytes} from "node:crypto";
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
 // 180k PBKDF2 is computed in browser (here: Node test), not by
 // Cloudflare Workers, whose free runtime limits derivations to 100k.
 const derive=(v,salt)=>pbkdf2Sync(String(v),String(salt),180000,32,"sha256").toString("hex");
 const salt=()=>randomBytes(32).toString("hex");
 const firstPassword="synthetic-pass-2026-strong",updatedPassword="synthetic-rotated-2026-strong";
 const ps=salt(),s1=salt(),s2=salt();
 const register=await auth("participant_register_derived",{
  email,question_1:"first_school",question_2:"childhood_book",
  password_salt:ps,password_proof:derive(firstPassword,ps),
  answer_1_salt:s1,answer_1_proof:derive("école test fictive",s1),
  answer_2_salt:s2,answer_2_proof:derive("livre fictif",s2)
 });
 assert.equal(register.status,200,"Cloudflare participant registration failed");
 const begin=await auth("participant_begin",{email});
 assert.equal(begin.status,200,"Registered participant PBKDF2 salt unavailable");
 const login=await auth("participant_login_derived",{email,password_proof:derive(firstPassword,begin.salt)});
 assert.equal(login.status,200,"Original password login failed");
 assert.match(login.token||"",/^[a-f0-9]{64}$/);
 const session=await auth("participant_session",{participant_token:login.token});
 assert.equal(session.status,200,"Participant session validation failed");
 const audience=await access(login.token);
 assert.equal(audience.status,200);assert.equal(audience.audience,"angel");
 const question=await auth("recovery_questions",{email});
 assert.equal(question.status,200,"Recovery questions not available");
 assert.equal(question.question_1,"first_school");
 const newSalt=salt();
 const recovered=await auth("recover_password_derived",{
  email,password_salt:newSalt,password_proof:derive(updatedPassword,newSalt),
  answer_1_proof:derive("école test fictive",question.answer_1_salt),
  answer_2_proof:derive("livre fictif",question.answer_2_salt)
 });
 assert.equal(recovered.status,200,"Password recovery compatibility failed");
 const oldSession=await auth("participant_session",{participant_token:login.token});
 assert.equal(oldSession.status,401,"Recovery failed to revoke old sessions");
 const renew=await auth("participant_begin",{email});
 assert.equal(renew.status,200);
 const relogin=await auth("participant_login_derived",{email,password_proof:derive(updatedPassword,renew.salt)});
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
