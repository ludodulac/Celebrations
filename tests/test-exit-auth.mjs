import {test} from "node:test";
import assert from "node:assert/strict";
import {pbkdf,sha256,handleAuth} from "../migration/cloudflare/auth-api.mjs";
import {handleAdmin} from "../migration/cloudflare/admin-api.mjs";
const request=(action,payload={})=>new Request("https://staging/api/auth",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,...payload})});
function fakeDb(participant){
 const calls=[];
 return {calls,prepare(sql){
  return {bind(...args){
   calls.push({sql,args});
   return {
    async first(){
     if(sql.includes("FROM celebrations_participants"))return participant||null;
     return null;
    },
    async run(){return {success:true}},
    async all(){return {results:[]}}
   };
  },async all(){return {results:[]}}};
 }};
}
test("legacy PBKDF2 SHA256 matches WebCrypto",async()=>{assert.equal((await pbkdf("correct-horse","salt")).length,64);assert.equal(await pbkdf("correct-horse","salt"),await pbkdf("correct-horse","salt"));assert.notEqual(await pbkdf("wrong","salt"),await pbkdf("correct-horse","salt"))});
test("participant login succeeds and stores hash not raw token",async()=>{const password="test-password-123",salt="test-salt";const db=fakeDb({password_salt:salt,password_hash:await pbkdf(password,salt)});const r=await handleAuth(request("participant_login",{email:"USER@TEST.EXAMPLE",password}),{DB:db});const body=await r.json();assert.equal(body.ok,true);assert.equal(body.token.length,64);const insert=db.calls.find(x=>x.sql.includes("INSERT INTO celebrations_participant_sessions"));assert.ok(insert);assert.equal(insert.args[0],await sha256(body.token));assert.equal(insert.args[1],"user@test.example")});
test("wrong participant password denied",async()=>{const db=fakeDb({password_salt:"s",password_hash:await pbkdf("right","s")});const r=await handleAuth(request("participant_login",{email:"u@test.example",password:"wrong"}),{DB:db});assert.equal(r.status,401);assert.equal(db.calls.some(x=>x.sql.includes("INSERT")),false)});
test("unknown participant denied",async()=>{const db=fakeDb(null);const r=await handleAuth(request("participant_login",{email:"u@test.example",password:"test"}),{DB:db});assert.equal(r.status,401)});
test("admin password verified with PBKDF2 secret",async()=>{const db=fakeDb(null),salt="admin-salt";const env={DB:db,ADMIN_PASSWORD_SALT:salt,ADMIN_PASSWORD_HASH:await pbkdf("admin-test",salt)};const ok=await handleAuth(request("admin_login",{email:"admin@celebrations.local",password:"admin-test"}),env);assert.equal((await ok.json()).ok,true);const denied=await handleAuth(request("admin_login",{password:"wrong"}),env);assert.equal(denied.status,401)});
test("admin mutations require authorization",async()=>{const db=fakeDb(null);const r=await handleAdmin(new Request("https://staging/api/admin",{method:"POST",body:JSON.stringify({action:"delete",table:"celebrations_contents",key:{id:"x"}})}),{DB:db});assert.equal(r.status,401);assert.equal(db.calls.some(x=>x.sql.startsWith("DELETE")),false)});
test("participant logout deletes only token hash",async()=>{const db=fakeDb(null);const r=await handleAuth(request("participant_logout",{participant_token:"a".repeat(64)}),{DB:db});assert.equal((await r.json()).ok,true);const expected=await sha256("a".repeat(64));assert.ok(db.calls.some(x=>x.sql.includes("DELETE FROM celebrations_participant_sessions")&&x.args[0]===expected));});
