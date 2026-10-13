// D1 authentication compatible with existing participant PBKDF2 hashes.
// This module is staging-only and never exposes stored hashes to the browser.
const encoder=new TextEncoder();
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");
export async function sha256(value){return hex(await crypto.subtle.digest("SHA-256",encoder.encode(value)))}
export async function pbkdf(value,salt){const k=await crypto.subtle.importKey("raw",encoder.encode(value),"PBKDF2",false,["deriveBits"]);return hex(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:encoder.encode(salt),iterations:180000},k,256))}
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
   const row=await env.DB.prepare("SELECT password_salt,password_hash FROM celebrations_participants WHERE email=?").bind(e).first();
   const expected=row?.password_hash||"0".repeat(64);
   const computed=await pbkdf(password,row?.password_salt||"invalid-salt");
   if(!equal(computed,expected))return result({ok:false,error:"Identifiants incorrects."},401);
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
   const computed=await pbkdf(String(b.password||""),env.ADMIN_PASSWORD_SALT);
   if(!equal(computed,env.ADMIN_PASSWORD_HASH))return result({ok:false,error:"Identifiants incorrects."},401);
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
  return result({ok:false,error:"Action not implemented"},501);
 }catch{return result({ok:false,error:"Authentication unavailable"},503)}
}
