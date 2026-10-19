import {test} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {pbkdf2Sync,randomBytes} from "node:crypto";
import {readFile} from "node:fs/promises";
import {handleAuth} from "../migration/cloudflare/auth-api.mjs";
const schema=await readFile(new URL("../migration/cloudflare/celebrations-schema.sql",import.meta.url),"utf8");
test("real SQLite participant registration lifecycle",async()=>{
 const db=new DatabaseSync(":memory:");db.exec(schema);
 db.prepare("INSERT INTO celebrations_participants(email,audience) VALUES(?,?)").run("migration-check-00000000-0000-4000-8000-000000000001@invalid.example","angel");
 function prep(sql,args=[]){return {bind(...v){return prep(sql,v)},async first(){return db.prepare(sql).get(...args)||null},async run(){return {meta:{changes:db.prepare(sql).run(...args).changes}}}}}
 const env={DB:{prepare:prep,async batch(items){db.exec("BEGIN");try{for(const x of items)db.prepare(x.sql).run(...x.args);db.exec("COMMIT")}catch(e){db.exec("ROLLBACK");throw e}}}};
 const call=async(action,data={})=>{const res=await handleAuth(new Request("https://local.invalid/api/auth",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,...data})}),env);return {status:res.status,...await res.json()}};
 try{
 const email="migration-check-00000000-0000-4000-8000-000000000001@invalid.example",password="local-test-password-123";
 const salt=()=>randomBytes(24).toString("hex");
 const proof=(v,s)=>pbkdf2Sync(String(v),String(s),180000,32,"sha256").toString("hex");
 const s=salt(),s1=salt(),s2=salt();
 const reg=await call("participant_register_derived",{
  email,question_1:"first_school",question_2:"childhood_book",
  password_salt:s,password_proof:proof(password,s),
  answer_1_salt:s1,answer_1_proof:proof("school fictional",s1),
  answer_2_salt:s2,answer_2_proof:proof("book fictional",s2)
 });
 assert.equal(reg.status,200,JSON.stringify(reg));
 const login=await call("participant_login_derived",{email,password_proof:proof(password,s)});
 assert.equal(login.status,200,JSON.stringify(login));
 assert.equal((await call("participant_session",{participant_token:login.token})).status,200);
 const questions=await call("recovery_questions",{email});
 assert.equal(questions.status,200);
 const newSalt=salt();
 const recovered=await call("recover_password_derived",{
  email,password_salt:newSalt,password_proof:proof("Updated-password-2026",newSalt),
  answer_1_proof:proof("school fictional",questions.answer_1_salt),
  answer_2_proof:proof("book fictional",questions.answer_2_salt)
 });
 assert.equal(recovered.status,200,JSON.stringify(recovered));
 assert.equal((await call("participant_session",{participant_token:login.token})).status,401);
 const second=await call("participant_login_derived",{email,password_proof:proof("Updated-password-2026",newSalt)});
 assert.equal(second.status,200,JSON.stringify(second));
 assert.equal((await call("participant_logout",{participant_token:second.token})).status,200);
 assert.equal((await call("participant_session",{participant_token:second.token})).status,401);
 }finally{db.close()}
});
