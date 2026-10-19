// D1 authentication compatible with existing participant PBKDF2 hashes.
// This module is staging-only and never exposes stored hashes to the browser.
// Workers production WebCrypto rejects PBKDF2 >100k iterations; the original
// Supabase credentials require 180k. The supported Node crypto API is used
// as a separate runtime path, preserving the original 180k password format.
import {pbkdf2 as nodePbkdf2} from "node:crypto";
const encoder=new TextEncoder();
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");
export async function sha256(value){return hex(await crypto.subtle.digest("SHA-256",encoder.encode(value)))}
export async function pbkdf(value,salt){
 return new Promise((resolve,reject)=>{
  nodePbkdf2(String(value),String(salt),180000,32,"sha256",(error,key)=>{
   if(error)reject(error);else resolve(Buffer.from(key).toString("hex"));
  });
 });
}
function equal(a,b){if(!a||!b||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
const result=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});
const token=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const email=v=>String(v||"").trim().toLowerCase();
const now=()=>new Date().toISOString();
async function readSession(db,raw,admin=false){
 if(typeof raw!=="string"||raw.length<32)return null;
 const table=admin?"celebrations_admin_sessions":"celebrations_participant_sessions";
 const col=admin?"admin_email":"participant_email";
 const row=await db.prepare(`SELECT ${col} AS email, expires_at FROM ${table} WHERE token_hash=?`).bind(await sha256(raw)).first();
 return row&&Date.parse(row.expires_at)>Date.now()?row.email:null;
}
export async function authorize(request,env,admin=false){
 const bearer=request.headers.get("authorization")||"";
 if(!bearer.startsWith("Bearer "))return null;
 return readSession(env.DB,bearer.slice(7),admin);
}

const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=254;
const questions=new Set(["first_school","memorable_teacher","childhood_book","childhood_game","memorable_trip_city","dream_destination","fictional_character","favorite_childhood_dish"]);
const answer=v=>String(v||"").trim().toLocaleLowerCase("fr-FR").normalize("NFKC");
async function blocked(db,key){
 const row=await db.prepare("SELECT locked_until FROM celebrations_login_attempts WHERE identity_hash=?").bind(await sha256(key)).first();
 return !!row?.locked_until&&Date.parse(row.locked_until)>Date.now();
}
async function failure(db,key){
 const hash=await sha256(key);
 await db.prepare("INSERT INTO celebrations_login_attempts(identity_hash,failed_count,locked_until,updated_at) VALUES(?,1,NULL,?) ON CONFLICT(identity_hash) DO UPDATE SET failed_count=CASE WHEN updated_at<? THEN 1 ELSE failed_count+1 END,locked_until=CASE WHEN updated_at<? THEN NULL WHEN failed_count>=4 THEN ? ELSE locked_until END,updated_at=?").bind(hash,now(),new Date(Date.now()-3600000).toISOString(),new Date(Date.now()-3600000).toISOString(),new Date(Date.now()+900000).toISOString(),now()).run();
}
async function reset(db,key){await db.prepare("DELETE FROM celebrations_login_attempts WHERE identity_hash=?").bind(await sha256(key)).run()}
export async function handleAuth(request,env){
 if(request.method!=="POST")return result({ok:false,error:"Method not allowed"},405);
 if(!env.DB)return result({ok:false,error:"Database unavailable"},503);
 let b;try{b=await request.json()}catch{return result({ok:false,error:"Invalid JSON"},400)}
 if(!b||typeof b!=="object")return result({ok:false,error:"Invalid request"},400);
 const action=String(b.action||"");
 try{
  if(action==="participant_status"){
   const row=await env.DB.prepare("SELECT password_hash FROM celebrations_participants WHERE email=?").bind(email(b.email)).first();
   return result({ok:true,authorized:!!row,registered:!!row?.password_hash});
  }
  if(action==="participant_login"){
   const e=email(b.email),password=String(b.password||"");
   if(!validEmail(e)||await blocked(env.DB,"participant:"+e))return result({ok:false,error:"Réessayez plus tard."},429);
   const row=await env.DB.prepare("SELECT password_salt,password_hash FROM celebrations_participants WHERE email=?").bind(e).first();
   const expected=row?.password_hash||"0".repeat(64);
   const computed=await pbkdf(password,row?.password_salt||"invalid-salt");
   if(!equal(computed,expected)){await failure(env.DB,"participant:"+e);return result({ok:false,error:"Identifiants incorrects."},401)}
   await reset(env.DB,"participant:"+e);
   const raw=token(),expires=new Date(Date.now()+30*24*3600*1000).toISOString();
   await env.DB.prepare("INSERT INTO celebrations_participant_sessions(token_hash,participant_email,expires_at) VALUES(?,?,?)").bind(await sha256(raw),e,expires).run();
   return result({ok:true,token:raw,email:e,expires_at:expires});
  }
  if(action==="participant_session"){
   const e=await readSession(env.DB,b.participant_token);
   return e?result({ok:true,email:e}):result({ok:false,error:"Session expirée."},401);
  }
  if(action==="participant_logout"){
   if(typeof b.participant_token==="string"&&b.participant_token.length>=32)
    await env.DB.prepare("DELETE FROM celebrations_participant_sessions WHERE token_hash=?").bind(await sha256(b.participant_token)).run();
   return result({ok:true});
  }
  if(action==="admin_login"){
   if(!env.ADMIN_PASSWORD_HASH||!env.ADMIN_PASSWORD_SALT)return result({ok:false,error:"Admin not configured"},503);
   if(await blocked(env.DB,"admin"))return result({ok:false,error:"Réessayez plus tard."},429);
   const computed=await pbkdf(String(b.password||""),env.ADMIN_PASSWORD_SALT);
   if(!equal(computed,env.ADMIN_PASSWORD_HASH)){await failure(env.DB,"admin");return result({ok:false,error:"Identifiants incorrects."},401)}
   await reset(env.DB,"admin");
   const raw=token(),expires=new Date(Date.now()+12*3600*1000).toISOString();
   await env.DB.prepare("INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)").bind(await sha256(raw),email(b.email),expires).run();
   return result({ok:true,token:raw,expires_at:expires});
  }
  if(action==="admin_session"){
   const e=await readSession(env.DB,b.admin_token,true);
   return e!==null?result({ok:true,email:e}):result({ok:false,error:"Session expirée."},401);
  }
  if(action==="admin_logout"){
   if(typeof b.admin_token==="string"&&b.admin_token.length>=32)
    await env.DB.prepare("DELETE FROM celebrations_admin_sessions WHERE token_hash=?").bind(await sha256(b.admin_token)).run();
   return result({ok:true});
  }

  if(action==="participant_register"){
   const e=email(b.email),password=String(b.password||""),q1=String(b.question_1||""),q2=String(b.question_2||""),a1=answer(b.answer_1),a2=answer(b.answer_2);
   if(!validEmail(e)||password.length<8||password.length>256||!questions.has(q1)||!questions.has(q2)||q1===q2||a1.length<2||a2.length<2)return result({ok:false,error:"Inscription invalide"},400);
   if(await blocked(env.DB,"register:"+e))return result({ok:false,error:"Réessayez plus tard"},429);
   const ps=token(),s1=token(),s2=token();
   const [ph,h1,h2]=await Promise.all([pbkdf(password,ps),pbkdf(a1,s1),pbkdf(a2,s2)]);
   const updated=await env.DB.prepare("UPDATE celebrations_participants SET password_salt=?,password_hash=?,question_1=?,answer_1_salt=?,answer_1_hash=?,question_2=?,answer_2_salt=?,answer_2_hash=?,registered_at=?,updated_at=? WHERE email=? AND password_hash IS NULL").bind(ps,ph,q1,s1,h1,q2,s2,h2,now(),now(),e).run();
   if(!updated.meta?.changes){await failure(env.DB,"register:"+e);return result({ok:false,error:"Compte indisponible"},403)}
   await reset(env.DB,"register:"+e);return result({ok:true});
  }
  if(action==="recovery_questions"){
   const e=email(b.email);
   if(!validEmail(e)||await blocked(env.DB,"recovery:"+e))return result({ok:false,error:"Réessayez plus tard"},429);
   const row=await env.DB.prepare("SELECT question_1,question_2,password_hash,recovery_locked_until FROM celebrations_participants WHERE email=?").bind(e).first();
   if(!row?.password_hash||!row.question_1||!row.question_2)return result({ok:false,error:"Compte indisponible"},404);
   if(row.recovery_locked_until&&Date.parse(row.recovery_locked_until)>Date.now())return result({ok:false,error:"Réessayez plus tard"},429);
   return result({ok:true,question_1:row.question_1,question_2:row.question_2});
  }
  if(action==="recover_password"){
   // Production and the existing public form use new_password, not password.
   const e=email(b.email),password=String(b.new_password||""),a1=answer(b.answer_1),a2=answer(b.answer_2);
   if(!validEmail(e)||password.length<8||password.length>256||!a1||!a2)return result({ok:false,error:"Demande invalide"},400);
   if(await blocked(env.DB,"recovery:"+e))return result({ok:false,error:"Réessayez plus tard"},429);
   const row=await env.DB.prepare("SELECT answer_1_salt,answer_1_hash,answer_2_salt,answer_2_hash,recovery_locked_until FROM celebrations_participants WHERE email=?").bind(e).first();
   if(row?.recovery_locked_until&&Date.parse(row.recovery_locked_until)>Date.now())return result({ok:false,error:"Réessayez plus tard"},429);
   const h1=await pbkdf(a1,row?.answer_1_salt||"invalid"),h2=await pbkdf(a2,row?.answer_2_salt||"invalid");
   if(!equal(h1,row?.answer_1_hash)||!equal(h2,row?.answer_2_hash)){await failure(env.DB,"recovery:"+e);return result({ok:false,error:"Réponses incorrectes"},401)}
   const salt=token(),hash=await pbkdf(password,salt);
   await env.DB.batch([
    env.DB.prepare("UPDATE celebrations_participants SET password_salt=?,password_hash=?,recovery_failed_count=0,recovery_locked_until=NULL,updated_at=? WHERE email=?").bind(salt,hash,now(),e),
    env.DB.prepare("DELETE FROM celebrations_participant_sessions WHERE participant_email=?").bind(e)
   ]);
   await reset(env.DB,"recovery:"+e);return result({ok:true});
  }
  return result({ok:false,error:"Action not implemented"},501);
 }catch(err){
  // Synthetic staging-only diagnostics: classification only, never reveal
  // query text, stored hashes, salts, passwords, IPs or stack traces.
  const message=String(err?.message||"");
  let category="OTHER";
  if(/100000|iteration counts above|PBKDF2/i.test(message))category="PBKDF_LIMIT";
  else if(/table|no such column/i.test(message))category="SCHEMA";
  else if(/D1|SQLITE|database|statement/i.test(message))category="DATABASE";
  else if(/not implemented|not supported|unsupported/i.test(message))category="UNSUPPORTED";
  else if(/not a function|undefined|cannot read/i.test(message))category="RUNTIME";
  else if(/cpu|limit|time/i.test(message))category="RESOURCE";
  const synthetic=/^migration-check-[a-f0-9-]{36}@invalid\.example$/.test(email(b?.email));
  return result({ok:false,error:"Authentication unavailable",
   ...(synthetic?{diagnostic_category:category,diagnostic_name:String(err?.name||"unknown").slice(0,45)}:{})},503);
 }
}
