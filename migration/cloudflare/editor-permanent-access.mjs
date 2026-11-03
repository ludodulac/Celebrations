// ACCESS-PERMANENT: staging only. No password or verifier in code or logs.
// The browser derives PBKDF2-SHA256(210000) then sends a proof, not the password.
// The protected Cloudflare secret stores SHA256(proof), non-replayable as a login.
import {sha256} from './auth-api.mjs';
const HOST='celebrations-exit-staging.rondes.workers.dev',DAYS=30;
const ADMIN='ludo-staging@celebrations.invalid',HEX=/^[a-f0-9]{64}$/,SALT=/^[a-f0-9]{32}$/;
const rateKey='staging-permanent-admin';
const hex=a=>Array.from(new Uint8Array(a),v=>v.toString(16).padStart(2,'0')).join('');
const allowed=(r,method)=>new URL(r.url).hostname===HOST&&r.method===method;
const configured=env=>HEX.test(env.STAGING_ADMIN_PASSWORD_VERIFIER||'')&&SALT.test(env.STAGING_ADMIN_PASSWORD_SALT||'');
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer','x-robots-tag':'noindex,nofollow,noarchive'}});
const same=(a,b)=>{if(a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;};
const css=':root{font:16px system-ui,Arial,sans-serif;background:#faf8f5;color:#253144}*{box-sizing:border-box}body{margin:0;padding:16px}main{max-width:500px;margin:5vh auto;padding:clamp(18px,5vw,30px);border-radius:16px;border:1px solid #ddd;background:white}h1{font-size:1.6rem}p{line-height:1.5}input,textarea{display:block;width:100%;padding:12px;font:inherit;border:1px solid #999;border-radius:8px;margin:8px 0 16px}button,a.btn{display:block;width:100%;padding:12px;border:0;border-radius:8px;background:#a64c23;color:white;font:700 1rem system-ui;text-decoration:none;text-align:center;margin:10px 0;cursor:pointer}[hidden]{display:none!important}';
function html(request,body,title){
 if(!allowed(request,'GET'))return json({ok:false},404);
 const n=hex(crypto.getRandomValues(new Uint8Array(16)));
 return new Response('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+title+'</title><style nonce="'+n+'">'+css+'</style></head><body><main>'+body.replaceAll('NONCE_PLACEHOLDER',n)+'</main></body></html>',{headers:{
 'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex,nofollow,noarchive',
 'referrer-policy':'no-referrer','x-content-type-options':'nosniff',
 'content-security-policy':"default-src 'none'; script-src 'nonce-"+n+"'; style-src 'nonce-"+n+"'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"}});
}
const SETUP="<h1>Créer mon mot de passe — Célébrations test</h1>\n<p>Le calcul s'effectue dans ce navigateur, sans envoyer votre mot de passe au serveur. Ne réutilisez pas le mot de passe du site officiel.</p>\n<label for=\"password\">Mot de passe personnel (16 caractères minimum)</label><input id=\"password\" type=\"password\" minlength=\"16\" maxlength=\"128\" autocomplete=\"new-password\">\n<label for=\"confirm\">Confirmation</label><input id=\"confirm\" type=\"password\" minlength=\"16\" maxlength=\"128\" autocomplete=\"new-password\">\n<button id=\"generate\" type=\"button\">Préparer les secrets Cloudflare</button><p id=\"status\" role=\"status\" aria-live=\"polite\"></p>\n<div id=\"result\" hidden><p>Sur Cloudflare, Worker <strong>celebrations-exit-staging</strong> → Settings → Variables and Secrets, créer ces deux variables de type <strong>Secret</strong> :</p>\n<label for=\"salt\">STAGING_ADMIN_PASSWORD_SALT</label><textarea readonly id=\"salt\" rows=\"2\"></textarea>\n<label for=\"verifier\">STAGING_ADMIN_PASSWORD_VERIFIER</label><textarea readonly id=\"verifier\" rows=\"3\"></textarea>\n<p>Copier uniquement dans Cloudflare, jamais dans GitHub, un message ou un log. Enregistrer et déployer les secrets sur le Worker staging uniquement.</p>\n<a href=\"/__editor/access\" class=\"btn\">Connexion après configuration</a></div>\n<script nonce=\"NONCE_PLACEHOLDER\">\n(()=>{const el=id=>document.getElementById(id),hex=a=>Array.from(new Uint8Array(a),x=>x.toString(16).padStart(2,'0')).join('');\nel('generate').onclick=async()=>{\n const password=el('password').value,confirm=el('confirm').value;el('result').hidden=true;\n if(password.length<16||password.length>128||password!==confirm){el('status').textContent='Utilisez deux fois le même mot de passe, d’au moins 16 caractères.';return;}\n el('generate').disabled=true;el('status').textContent='Calcul en cours sur votre appareil…';\n try{\n  const salt=crypto.getRandomValues(new Uint8Array(16)),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);\n  const proof=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},key,256);\n  el('salt').value=hex(salt);el('verifier').value=hex(await crypto.subtle.digest('SHA-256',proof));\n  el('password').value='';el('confirm').value='';el('result').hidden=false;\n  el('status').textContent='Les deux secrets sont prêts à copier dans Cloudflare.';\n }catch{el('status').textContent='Opération indisponible sur ce navigateur.';}\n finally{el('generate').disabled=false;}\n};\n})();\n</script>";
const LOGIN="<h1>Administration Célébrations — test</h1>\n<p>Mot de passe personnel sans date d'expiration. La session peut rester active jusqu'à 30 jours sur cet appareil.</p>\n<form id=\"login\"><label for=\"password\">Mot de passe</label><input id=\"password\" type=\"password\" required autocomplete=\"current-password\" maxlength=\"128\">\n<button id=\"send\" type=\"submit\">Ouvrir mon éditeur</button></form>\n<button id=\"logout\" type=\"button\">Se déconnecter et révoquer cette session</button>\n<p id=\"status\" role=\"status\" aria-live=\"polite\"></p>\n<script nonce=\"NONCE_PLACEHOLDER\">\n(()=>{const el=id=>document.getElementById(id),hex=a=>Array.from(new Uint8Array(a),x=>x.toString(16).padStart(2,'0')).join('');\nconst k=new URLSearchParams(location.search).get('return'),target=['home','celebration:101:step:Mercredi'].includes(k)?k:'home';\nel('login').onsubmit=async event=>{\n event.preventDefault();const password=el('password').value;el('password').value='';el('send').disabled=true;el('status').textContent='Connexion sécurisée…';\n try{\n  const sr=await fetch('/__editor/access/config',{cache:'no-store'});if(!sr.ok)throw Error('Mot de passe non configuré dans Cloudflare.');\n  const cfg=await sr.json();const salt=Uint8Array.from(cfg.salt.match(/../g).map(v=>parseInt(v,16)));\n  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);\n  const proof=hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},key,256));\n  const r=await fetch('/__editor/access/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({proof}),cache:'no-store',credentials:'same-origin'});\n  const d=await r.json();if(!r.ok||!d.ok||!d.token)throw Error(d.error||'Accès refusé.');\n  localStorage.setItem('celebrations-admin-token',d.token);\n  const preview=await fetch('/__editor/session',{method:'POST',headers:{authorization:'Bearer '+d.token},cache:'no-store',credentials:'same-origin'});\n  if(!preview.ok)throw Error('Connexion établie mais accès à la prévisualisation indisponible.');\n  location.replace('/__editor/edit?key='+encodeURIComponent(target));\n }catch(e){el('status').textContent=e.message||'Connexion indisponible.';}\n finally{el('send').disabled=false;}\n};\nel('logout').onclick=async()=>{\n const token=localStorage.getItem('celebrations-admin-token')||'';\n try{\n  const r=await fetch('/__editor/access/logout',{method:'POST',headers:{authorization:'Bearer '+token},cache:'no-store',credentials:'same-origin'});\n  if(!r.ok)throw Error('Révocation impossible. Vérifiez le réseau.');\n  localStorage.removeItem('celebrations-admin-token');el('status').textContent='Session révoquée et déconnexion effectuée.';\n }catch(e){el('status').textContent=e.message||'Erreur.';}\n};\n})();\n</script>";
export const setupPage=request=>html(request,SETUP,'Configurer accès de test');
export const accessPage=request=>html(request,LOGIN,'Connexion Célébrations test');
export function accessConfig(request,env){
 if(!allowed(request,'GET'))return json({ok:false},404);
 if(!configured(env))return json({ok:false,error:'Non configuré'},503);
 return json({ok:true,salt:env.STAGING_ADMIN_PASSWORD_SALT,iterations:210000});
}
const now=()=>new Date().toISOString();
async function blocked(db){const q=await db.prepare('SELECT locked_until FROM celebrations_login_attempts WHERE identity_hash=?').bind(await sha256(rateKey)).first();return !!q?.locked_until&&Date.parse(q.locked_until)>Date.now();}
async function failed(db){
 const h=await sha256(rateKey),last=new Date(Date.now()-3600000).toISOString(),until=new Date(Date.now()+900000).toISOString(),n=now();
 await db.prepare("INSERT INTO celebrations_login_attempts(identity_hash,failed_count,locked_until,updated_at) VALUES(?,1,NULL,?) ON CONFLICT(identity_hash) DO UPDATE SET failed_count=CASE WHEN updated_at<? THEN 1 ELSE failed_count+1 END,locked_until=CASE WHEN updated_at<? THEN NULL WHEN failed_count>=4 THEN ? ELSE locked_until END,updated_at=?")
 .bind(h,n,last,last,until,n).run();
}
export async function accessLogin(request,env){
 if(!allowed(request,'POST'))return json({ok:false},404);
 if(!env.DB||!configured(env))return json({ok:false,error:'Non configuré'},503);
 if(await blocked(env.DB))return json({ok:false,error:'Trop de tentatives. Réessayez plus tard.'},429);
 let b;try{const raw=await request.text();if(raw.length>1000)return json({ok:false},413);b=JSON.parse(raw);}catch{return json({ok:false,error:'Demande invalide'},400);}
 if(!HEX.test(b?.proof||'')||!same(hex(await crypto.subtle.digest('SHA-256',Uint8Array.from(b.proof.match(/../g),v=>parseInt(v,16)))),env.STAGING_ADMIN_PASSWORD_VERIFIER)){
  await failed(env.DB);return json({ok:false,error:'Mot de passe incorrect.'},401);
 }
 await env.DB.prepare('DELETE FROM celebrations_login_attempts WHERE identity_hash=?').bind(await sha256(rateKey)).run();
 const token=hex(crypto.getRandomValues(new Uint8Array(32))),until=new Date(Date.now()+DAYS*86400000).toISOString();
 await env.DB.prepare('INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)')
  .bind(await sha256(token),ADMIN,until).run();
 return json({ok:true,token,expires_at:until,staging:true});
}
export async function accessLogout(request,env){
 if(!allowed(request,'POST'))return json({ok:false},404);
 if(!env.DB)return json({ok:false,error:'Indisponible'},503);
 const header=request.headers.get('authorization')||'',token=header.startsWith('Bearer ')?header.slice(7):'';
 if(!HEX.test(token))return json({ok:false,error:'Session manquante'},401);
 await env.DB.prepare('DELETE FROM celebrations_admin_sessions WHERE token_hash=?').bind(await sha256(token)).run();
 const r=json({ok:true,revoked:true});
 r.headers.set('set-cookie','d2_preview=; Path=/__editor/; Max-Age=0; Secure; HttpOnly; SameSite=Strict');
 return r;
}
