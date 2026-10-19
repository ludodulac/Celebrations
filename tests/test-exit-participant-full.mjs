import {test} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFile} from "node:fs/promises";
import {handleAuth} from "../migration/cloudflare/auth-api.mjs";
const schema=await readFile(new URL("../migration/cloudflare/celebrations-schema.sql",import.meta.url),"utf8");
test("real SQLite participant registration lifecycle",async()=>{
 const db=new DatabaseSync(":memory:");db.exec(schema);
 db.prepare("INSERT INTO celebrations_participants(email,audience) VALUES(?,?)").run("temporary@invalid.example","angel");
 function prep(sql,args=[]){return {bind(...v){return prep(sql,v)},async first(){return db.prepare(sql).get(...args)||null},async run(){return {meta:{changes:db.prepare(sql).run(...args).changes}}}}}
 const env={DB:{prepare:prep,async batch(items){db.exec("BEGIN");try{for(const x of items)db.prepare(x.sql).run(...x.args);db.exec("COMMIT")}catch(e){db.exec("ROLLBACK");throw e}}}};
 const call=async(action,data={})=>{const res=await handleAuth(new Request("https://local.invalid/api/auth",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,...data})}),env);return {status:res.status,...await res.json()}};
 try{
 const email="temporary@invalid.example",password="local-test-password-123";
 const reg=await call("participant_register",{email,password,question_1:"first_school",question_2:"childhood_book",answer_1:"school fictional",answer_2:"book fictional"});
 assert.equal(reg.status,200,JSON.stringify(reg));
 const login=await call("participant_login",{email,password});
 assert.equal(login.status,200);
 const recovered=await call("recover_password",{email,new_password:"local-test-password-456",answer_1:"school fictional",answer_2:"book fictional"});
 assert.equal(recovered.status,200,JSON.stringify(recovered));
 assert.equal((await call("participant_session",{participant_token:login.token})).status,401);
 }finally{db.close()}
});
