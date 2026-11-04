// Site-wide administration gate. No access code is stored in source or sent to visitors.
// The public presentation and all historical file/PDF routes are unchanged.
import {pbkdf,sha256} from './auth-api.mjs';

const COOKIE='celebrations_editor_access';
const FORM_COOKIE='celebrations_editor_form';
const DOMAIN='ronde-des-archanges-universelle.eu';
const TTL=7*24*60*60*1000;
const PIN_SALT='c16cde110a7a5b98b45d1e08b94c02053eab24879c0b220f';
const PIN_VERIFIER='e84a7dc7085d9cb09b887f4686d410674ac7715d77efc28248ceb2d2a6b8abdc';
const noCache={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-robots-tag':'noindex,nofollow,noarchive'};
const official=host=>host===DOMAIN||host==='www.'+DOMAIN;
const encoder=new TextEncoder();
function secret(env){const v=env?.ADMIN_PASSWORD_HASH;return typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v)?v:''}
function match(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
 let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);
 return n===0;
}
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
function readCookie(request,name){
 const part=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='));
 return part?part.slice(name.length+1):'';
}
const cookie=request=>readCookie(request,COOKIE);
// Allow official-domain forms through a www-to-apex redirect, and privacy
// browsers which omit Origin. A short-lived double-submit cookie below
// independently proves the form was served from this site.
function legitimateOrigin(request){
 const origin=request.headers.get('origin');
 if(!origin||origin==='null')return true;
 try{const u=new URL(origin);return u.protocol==='https:'&&official(u.hostname)&&u.pathname==='/'&&u.search===''&&u.hash===''}
 catch{return false}
}
function csrfFormValid(request,form){
 const field=form.get('_csrf'),stored=readCookie(request,FORM_COOKIE);
 return typeof field==='string'&&/^[a-f0-9]{64}$/.test(field)&&match(field,stored);
}
async function signature(env,payload){
 const key=secret(env);
 if(!key)return '';
 const hmac=await crypto.subtle.importKey('raw',encoder.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=await crypto.subtle.sign('HMAC',hmac,encoder.encode('site-editor-v1:'+payload));
 return hex(sig);
}
export async function hasEditorAccess(request,env){
 const host=new URL(request.url).hostname;
 if(!official(host))return false;
 const raw=cookie(request),parts=raw.split('.');
 if(parts.length!==3||!/^\d{13}$/.test(parts[0])||!/^[a-f0-9]{32}$/.test(parts[1])||!/^[a-f0-9]{64}$/.test(parts[2]))return false;
 const at=Number(parts[0]);
 if(at>Date.now()+30000||Date.now()-at>TTL)return false;
 const signed=await signature(env,parts[0]+'.'+parts[1]);
 return !!signed&&match(parts[2],signed);
}
export function editorLoginPage(request,wrong=false){
 const nonce=hex(crypto.getRandomValues(new Uint8Array(16)));
 const csrf=hex(crypto.getRandomValues(new Uint8Array(32)));
 const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Administration — Célébrations</title><style nonce="${nonce}">:root{font-family:system-ui,-apple-system,Arial,sans-serif;background:#fcfaf7;color:#243028}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:18px}main{width:min(100%,420px);border-radius:18px;padding:clamp(22px,5vw,36px);background:white;border:1px solid #e6dfd5;box-shadow:0 14px 34px #1e24130f}h1{font-size:clamp(1.55rem,5vw,1.95rem);margin:0 0 14px}p{line-height:1.5;color:#576459;margin:0 0 20px}label{font-size:.95rem;font-weight:650}input{display:block;width:100%;font:inherit;padding:14px;border-radius:10px;border:1px solid #aeb6ae;margin:8px 0 16px}input:focus{outline:3px solid #b1d9bf;outline-offset:1px}button{width:100%;padding:14px;border:0;border-radius:10px;background:#35734d;color:white;font:700 1rem system-ui;cursor:pointer}.error{color:#ad2937;margin-bottom:13px}.return{display:block;text-align:center;margin-top:20px;color:#365c45;text-decoration:none;font-size:.92rem}</style></head><body><main><h1>Administration</h1><p>Entrez votre code pour modifier les pages de Célébrations.</p>${wrong?'<p class="error" role="alert">Code incorrect ou trop de tentatives. Réessayez.</p>':''}<form action="/api/editor-access" method="post"><input type="hidden" name="_csrf" value="${csrf}"><label for="code">Code d’accès</label><input id="code" name="code" type="password" required maxlength="32" autocomplete="off" autocapitalize="none" spellcheck="false" autofocus><button type="submit">Ouvrir l’administration</button></form><a class="return" href="/">← Retour au site</a></main></body></html>`;
 return new Response(request.method==='HEAD'?null:html,{status:200,headers:{...noCache,'set-cookie':`${FORM_COOKIE}=${csrf}; Max-Age=600; Path=/; Domain=${DOMAIN}; HttpOnly; Secure; SameSite=Lax`,'content-type':'text/html; charset=utf-8','content-security-policy':`default-src 'none'; style-src 'nonce-${nonce}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`}});
}
const setCookie=(value,maxAge)=>`${COOKIE}=${value}; Max-Age=${maxAge}; Path=/; Domain=${DOMAIN}; HttpOnly; Secure; SameSite=Lax`;
function toHome(status,cookieValue){
 return new Response(null,{status:303,headers:{...noCache,'location':status?'/admin.html?erreur=1':'/admin.html',...(cookieValue?{'set-cookie':cookieValue}:{})}});
}
async function lockKey(request){
 const ip=request.headers.get('cf-connecting-ip')||'unknown';
 return sha256('celebrations-editor-code:'+ip);
}
async function blocked(db,hash){
 const row=await db.prepare('SELECT locked_until FROM celebrations_login_attempts WHERE identity_hash=?').bind(hash).first();
 return !!row?.locked_until&&Date.parse(row.locked_until)>Date.now();
}
async function failure(db,hash){
 const n=new Date().toISOString(),since=new Date(Date.now()-3600000).toISOString();
 const until=new Date(Date.now()+900000).toISOString();
 await db.prepare("INSERT INTO celebrations_login_attempts(identity_hash,failed_count,locked_until,updated_at) VALUES(?,1,NULL,?) ON CONFLICT(identity_hash) DO UPDATE SET failed_count=CASE WHEN updated_at<? THEN 1 ELSE failed_count+1 END,locked_until=CASE WHEN updated_at<? THEN NULL WHEN failed_count>=4 THEN ? ELSE locked_until END,updated_at=?")
  .bind(hash,n,since,since,until,n).run();
}
export async function editorAccessAction(request,env){
 const url=new URL(request.url);
 if(!official(url.hostname))return new Response('Introuvable',{status:404,headers:noCache});
 if(request.method!=='POST')return new Response('Méthode interdite',{status:405,headers:noCache});
 if(!legitimateOrigin(request))return new Response('Origine interdite',{status:403,headers:noCache});
 if(!env.DB||!secret(env))return new Response('Accès indisponible',{status:503,headers:noCache});
 try{
  const length=Number(request.headers.get('content-length')||0);
  if(length>300)return new Response('Code invalide',{status:413,headers:noCache});
  const form=await request.formData();
  if(!csrfFormValid(request,form))return new Response('Formulaire expiré. Rechargez la page Administration.',{status:403,headers:noCache});
  const input=form.get('code');
  if(typeof input!=='string'||input.length>32)return toHome(true);
  const key=await lockKey(request);
  if(await blocked(env.DB,key))return toHome(true);
  const computed=await pbkdf(input,PIN_SALT);
  if(!match(computed,PIN_VERIFIER)){await failure(env.DB,key);return toHome(true);}
  await env.DB.prepare('DELETE FROM celebrations_login_attempts WHERE identity_hash=?').bind(key).run();
  const payload=String(Date.now())+'.'+hex(crypto.getRandomValues(new Uint8Array(16)));
  const digest=await signature(env,payload);
  if(!digest)return new Response('Accès indisponible',{status:503,headers:noCache});
  return toHome(false,setCookie(payload+'.'+digest,Math.floor(TTL/1000)));
 }catch{return new Response('Connexion indisponible',{status:503,headers:noCache})}
}
export function editorLogout(){
 return new Response(null,{status:303,headers:{...noCache,location:'/', 'set-cookie':setCookie('',0)}});
}
