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
async function readSessionRow(db,raw,admin=false){
 if(typeof raw!=="string"||raw.length<32)return null;
 const table=admin?"celebrations_admin_sessions":"celebrations_participant_sessions";
 const col=admin?"admin_email":"participant_email";
 const row=await db.prepare(`SELECT ${col} AS email, expires_at FROM ${table} WHERE token_hash=?`).bind(await sha256(raw)).first();
 return row&&Date.parse(row.expires_at)>Date.now()?row:null;
}
async function readSession(db,raw,admin=false){
 const row=await readSessionRow(db,raw,admin);
 return row?row.email:null;
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
  // Cloudflare Workers Free caps PBKDF2 at 100k per invocation. Supabase
  // historical hashes require 180k; the browser computes this unchanged.
  // D1 stores SHA256(PBKDF2_180k), NOT the replayable browser proof.
  // Never transmit the raw password or recovery answer to this endpoint.
  const proof=v=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
  const salt=v=>typeof v==="string"&&/^[a-f0-9]{32,128}$/.test(v);
  if(action==="admin_salt"){
   return env.ADMIN_PASSWORD_SALT?result({ok:true,salt:env.ADMIN_PASSWORD_SALT}):
    result({ok:false,error:"Admin not configured"},503);
  }
  if(action==="participant_begin"){
   const e=email(b.email);
   if(!validEmail(e)||await blocked(env.DB,"participant:"+e))return result({ok:false,error:"Réessayez plus tard"},429);
   const row=await env.DB.prepare("SELECT password_salt,password_hash FROM celebrations_participants WHERE email=?").bind(e).first();
   if(!row?.password_hash||!row.password_salt?.startsWith("client180:"))
    return result({ok:false,error:"Compte indisponible"},404);
   return result({ok:true,salt:row.password_salt.slice(10)});
  }
  if(action==="admin_login_derived"){
   if(!env.ADMIN_PASSWORD_HASH||!env.ADMIN_PASSWORD_SALT||!proof(b.password_proof))
    return result({ok:false,error:"Identifiants incorrects"},401);
   if(await blocked(env.DB,"admin"))return result({ok:false,error:"Réessayez plus tard"},429);
   if(!equal(b.password_proof,env.ADMIN_PASSWORD_HASH)){
    await failure(env.DB,"admin");return result({ok:false,error:"Identifiants incorrects"},401);
   }
   await reset(env.DB,"admin");
   return result({ok:true,...await issueAdminSession(env.DB,email(b.email))});
  }
  if(action==="participant_login_derived"){
   const e=email(b.email);
   if(!validEmail(e)||!proof(b.password_proof)||await blocked(env.DB,"participant:"+e))
    return result({ok:false,error:"Identifiants incorrects"},401);
   const row=await env.DB.prepare("SELECT password_salt,password_hash FROM celebrations_participants WHERE email=?").bind(e).first();
   if(!row?.password_salt?.startsWith("client180:")||
      !equal(await sha256(b.password_proof),row.password_hash)){
    await failure(env.DB,"participant:"+e);return result({ok:false,error:"Identifiants incorrects"},401);
   }
   await reset(env.DB,"participant:"+e);
   const raw=token(),expires=new Date(Date.now()+30*24*3600*1000).toISOString();
   await env.DB.prepare("INSERT INTO celebrations_participant_sessions(token_hash,participant_email,expires_at) VALUES(?,?,?)")
    .bind(await sha256(raw),e,expires).run();
   return result({ok:true,token:raw,email:e,expires_at:expires});
  }
  if(action==="participant_register_derived"){
   const e=email(b.email),q1=String(b.question_1||""),q2=String(b.question_2||"");
   if(!validEmail(e)||!questions.has(q1)||!questions.has(q2)||q1===q2||
      !proof(b.password_proof)||!proof(b.answer_1_proof)||!proof(b.answer_2_proof)||
      !salt(b.password_salt)||!salt(b.answer_1_salt)||!salt(b.answer_2_salt))
    return result({ok:false,error:"Inscription invalide"},400);
   if(await blocked(env.DB,"register:"+e))return result({ok:false,error:"Réessayez plus tard"},429);
   const hashes=await Promise.all([sha256(b.password_proof),sha256(b.answer_1_proof),sha256(b.answer_2_proof)]);
   const updated=await env.DB.prepare(
    "UPDATE celebrations_participants SET password_salt=?,password_hash=?,question_1=?,answer_1_salt=?,answer_1_hash=?,question_2=?,answer_2_salt=?,answer_2_hash=?,registered_at=?,updated_at=? WHERE email=? AND password_hash IS NULL"
   ).bind("client180:"+b.password_salt,hashes[0],q1,b.answer_1_salt,hashes[1],q2,b.answer_2_salt,hashes[2],now(),now(),e).run();
   if(!updated.meta?.changes)return result({ok:false,error:"Compte indisponible"},403);
   await reset(env.DB,"register:"+e);return result({ok:true});
  }
  if(action==="recover_password_derived"){
   const e=email(b.email);
   if(!validEmail(e)||!proof(b.answer_1_proof)||!proof(b.answer_2_proof)||
      !proof(b.password_proof)||!salt(b.password_salt))
    return result({ok:false,error:"Demande invalide"},400);
   if(await blocked(env.DB,"recovery:"+e))return result({ok:false,error:"Réessayez plus tard"},429);
   const row=await env.DB.prepare(
    "SELECT password_salt,answer_1_hash,answer_2_hash,recovery_locked_until FROM celebrations_participants WHERE email=?"
   ).bind(e).first();
   if(!row?.password_salt?.startsWith("client180:"))return result({ok:false,error:"Compte indisponible"},404);
   if(row.recovery_locked_until&&Date.parse(row.recovery_locked_until)>Date.now())
    return result({ok:false,error:"Réessayez plus tard"},429);
   if(!equal(await sha256(b.answer_1_proof),row.answer_1_hash)||
      !equal(await sha256(b.answer_2_proof),row.answer_2_hash)){
    await failure(env.DB,"recovery:"+e);return result({ok:false,error:"Réponses incorrectes"},401);
   }
   await env.DB.batch([
    env.DB.prepare("UPDATE celebrations_participants SET password_salt=?,password_hash=?,recovery_failed_count=0,recovery_locked_until=NULL,updated_at=? WHERE email=?")
      .bind("client180:"+b.password_salt,await sha256(b.password_proof),now(),e),
    env.DB.prepare("DELETE FROM celebrations_participant_sessions WHERE participant_email=?").bind(e)
   ]);
   await reset(env.DB,"recovery:"+e);
   return result({ok:true});
  }
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
   return result({ok:true,...await issueAdminSession(env.DB,email(b.email))});
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
   const row=await env.DB.prepare("SELECT question_1,question_2,password_salt,password_hash,answer_1_salt,answer_2_salt,recovery_locked_until FROM celebrations_participants WHERE email=?").bind(e).first();
   if(!row?.password_hash||!row.question_1||!row.question_2)return result({ok:false,error:"Compte indisponible"},404);
   if(row.recovery_locked_until&&Date.parse(row.recovery_locked_until)>Date.now())return result({ok:false,error:"Réessayez plus tard"},429);
   return result({ok:true,question_1:row.question_1,question_2:row.question_2,answer_1_salt:row.answer_1_salt,answer_2_salt:row.answer_2_salt});
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


// M012-A: additional isolated editor authentication transport, NOT a new
// identity/session store. Existing D1 credential, rate limiter, random bearer,
// hashed session table and authorize() are shared with the historical API.
// Never exchange the legacy Supabase bearer or signed visual-editor cookie.
const EDITOR_ADMIN_ACTOR='admin@celebrations.local';
const ADMIN_SESSION_TTL=12*3600*1000;
const CHALLENGE_TTL=2*60*1000;
const hex64=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
async function issueAdminSession(db,actor,replaceRaw=null){
 const raw=token(),at=now(),expires=new Date(Date.now()+ADMIN_SESSION_TTL).toISOString();
 const hash=await sha256(raw);
 if(replaceRaw){
  // Atomic rotation: at most one renewal can replace this live bearer.
  const changed=await db.prepare("UPDATE celebrations_admin_sessions SET token_hash=?,admin_email=?,created_at=?,expires_at=? WHERE token_hash=? AND expires_at>?")
   .bind(hash,actor,at,expires,await sha256(replaceRaw),at).run();
  if(changed.meta?.changes!==1)return null;
 }else{
  await db.prepare("INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)")
   .bind(hash,actor,expires).run();
 }
 return {token:raw,expires_at:expires};
}
const editorSessionResult=(body,status=200)=>Response.json(body,{status,headers:{
 "cache-control":"private, no-store, max-age=0","pragma":"no-cache",
 "vary":"Authorization, Origin, Cookie","x-content-type-options":"nosniff",
 "referrer-policy":"no-referrer","x-robots-tag":"noindex, nofollow, noarchive"
}});
const editorDenied=(status,error)=>editorSessionResult({ok:false,error},status);
async function editorHmac(secret,message){
 const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return hex(await crypto.subtle.sign("HMAC",key,encoder.encode(message)));
}
const challengeMessage=(origin,payload)=>"celebrations-admin-challenge-v1:"+origin+":"+payload;
const responseMessage=(origin,challenge)=>"celebrations-admin-login-v1:"+origin+":"+challenge;
async function newEditorChallenge(origin,secret){
 const payload=String(Date.now())+"."+token();
 return payload+"."+await editorHmac(secret,challengeMessage(origin,payload));
}
async function checkEditorChallenge(origin,secret,challenge){
 if(typeof challenge!=="string"||!/^\d{13}\.[a-f0-9]{64}\.[a-f0-9]{64}$/.test(challenge))return null;
 const [stamp,nonce,signature]=challenge.split(".");
 const at=Number(stamp),age=Date.now()-at;
 if(age<0||age>=CHALLENGE_TTL)return null;
 const expected=await editorHmac(secret,challengeMessage(origin,stamp+"."+nonce));
 return equal(signature,expected)?new Date(at+CHALLENGE_TTL).toISOString():null;
}
async function readEditorCommand(request){
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))
  throw new TypeError("JSON required");
 const reader=request.body?.getReader();
 if(!reader)throw new TypeError("Body required");
 let size=0,text="";
 const decoder=new TextDecoder("utf-8",{fatal:true});
 try{
  for(;;){
   const {value,done}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>4096){await reader.cancel();throw new TypeError("Body too large")}
   text+=decoder.decode(value,{stream:true});
  }
  text+=decoder.decode();
 }finally{reader.releaseLock()}
 const b=JSON.parse(text);
 if(!b||typeof b!=="object"||Array.isArray(b))throw new TypeError("Invalid command");
 const allowed=b.action==="login"?["action","challenge","response"]:["action"];
 if(Object.keys(b).some(k=>!allowed.includes(k)))throw new TypeError("Unexpected field");
 return b;
}
function editorBearer(request){
 const value=request.headers.get("authorization")||"";
 return /^Bearer [a-f0-9]{64}$/.test(value)?value.slice(7):null;
}
export async function handleEditorAdminSession(request,env,{hasEditorAccess=async()=>false}={}){
 const url=new URL(request.url),origin=url.origin;
 if(request.method!=="POST")return editorDenied(405,"Méthode interdite");
 if(url.protocol!=="https:"||request.headers.get("origin")!==origin||
    request.headers.get("sec-fetch-site")==="cross-site")return editorDenied(403,"Origine refusée");
 if(!env?.DB)return editorDenied(503,"Service indisponible");
 let b;try{b=await readEditorCommand(request)}catch{return editorDenied(400,"Requête invalide")}
 try{
  const raw=editorBearer(request);
  // M018: one-time exchange of an ALREADY VERIFIED official editor PIN
  // cookie for the SAME short-lived D1 bearer. The cookie itself NEVER
  // authorizes member mutations: every subsequent API call requires bearer.
  // The explicit same-origin custom header prevents silent cross-site forms.
  if(b.action==="editor-pin-session"){
   if(!((env.MEMBER_DIRECTORY_OFFICIAL_ENABLED==="true" && env.EDITOR_PIN_D1_BRIDGE_ENABLED==="true" &&
       ["ronde-des-archanges-universelle.eu","www.ronde-des-archanges-universelle.eu"].includes(url.hostname)) ||
       (env.M016_PREPROD_WRITE_ENABLED==="true" && env.EDITOR_PIN_D1_BRIDGE_ENABLED==="true" &&
        url.hostname==="celebrations-m016-admin-preprod.rondes.workers.dev" && env.M016_ADMIN_PREPROD_HOST===url.hostname)))
    return editorDenied(404,"Introuvable");
   if(request.headers.has("authorization") ||
      request.headers.get("x-celebrations-editor-bridge")!=="1")
    return editorDenied(403,"Action interdite");
   if(!await hasEditorAccess(request,env))
    return editorDenied(401,"Code administrateur nécessaire");
   const issued=await issueAdminSession(env.DB,EDITOR_ADMIN_ACTOR);
   if(!issued)return editorDenied(503,"Session indisponible");
   return editorSessionResult({ok:true,email:EDITOR_ADMIN_ACTOR,...issued});
  }
  if(b.action==="session"||b.action==="logout"){
   // Same session-row lookup as authorize(), with the admin table only.
   const row=raw?await readSessionRow(env.DB,raw,true):null;
   if(!row?.email)return editorDenied(401,"Session administrateur requise");
   if(b.action==="logout"){
    await env.DB.prepare("DELETE FROM celebrations_admin_sessions WHERE token_hash=?")
     .bind(await sha256(raw)).run();
    return editorSessionResult({ok:true});
   }
   return editorSessionResult({ok:true,email:row.email,expires_at:row.expires_at});
  }
  if(b.action!=="challenge"&&b.action!=="login")return editorDenied(400,"Opération inconnue");
  const secret=env.ADMIN_PASSWORD_HASH,salt=env.ADMIN_PASSWORD_SALT;
  // Independent server-only challenge signer: never publish a known-message
  // HMAC under the password-derived verifier (offline guessing oracle).
  const challengeSecret=env.EDITOR_D1_CHALLENGE_SECRET;
  if(!hex64(secret)||!hex64(challengeSecret)||equal(challengeSecret,secret)||typeof salt!=="string"||!salt||salt.length>256)
   return editorDenied(503,"Service indisponible");
  if(await blocked(env.DB,"admin"))return editorDenied(429,"Réessayez plus tard");
  if(b.action==="challenge"){
   // Stateless issuance, no D1 write or token disclosure.
   return editorSessionResult({ok:true,salt,challenge:await newEditorChallenge(origin,challengeSecret),
    iterations:180000,expires_in:CHALLENGE_TTL/1000});
  }
  // Optional current D1 bearer is for explicit password-based rotation only.
  // A participant, legacy token, or fabricated Authorization is never enough.
  if(request.headers.has("authorization")&&(!raw||!await authorize(request,env,true)))
   return editorDenied(401,"Session administrateur requise");
  const challengeExpiry=await checkEditorChallenge(origin,challengeSecret,b.challenge);
  if(!challengeExpiry||!hex64(b.response)||
      !equal(b.response,await editorHmac(secret,responseMessage(origin,b.challenge)))){
   await failure(env.DB,"admin");
   return editorDenied(401,"Identifiants incorrects ou défi expiré");
  }
  // Claim a signed challenge ONCE, atomically, before creating a session.
  // Only a correct credential reaches this write. No raw challenge is stored.
  // Cleanup BEFORE consumption. The INSERT also checks expiry against the
  // database clock, so an in-flight request cannot re-use an expired challenge
  // after another request has deleted its replay marker.
  await env.DB.prepare("DELETE FROM celebrations_editor_admin_challenges WHERE expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now')").run();
  const consumed=await env.DB.prepare("INSERT OR IGNORE INTO celebrations_editor_admin_challenges(challenge_hash,expires_at) SELECT ?,? WHERE ?>strftime('%Y-%m-%dT%H:%M:%fZ','now')")
   .bind(await sha256(b.challenge),challengeExpiry,challengeExpiry).run();
  if(consumed.meta?.changes!==1)return editorDenied(401,"Défi déjà utilisé ou expiré");
  await reset(env.DB,"admin");
  const issued=await issueAdminSession(env.DB,EDITOR_ADMIN_ACTOR,raw);
  if(!issued)return editorDenied(401,"Session administrateur requise");
  return editorSessionResult({ok:true,email:EDITOR_ADMIN_ACTOR,...issued});
 }catch{
  // Never reflect request payload, D1 errors, hashes, proofs, or tokens.
  return editorDenied(503,"Service indisponible");
 }
}
