// MISSION D4: temporary, staging-only, personal review invitation.
// The access code is never committed to GitHub: only a SHA256 verifier
// is installed as a protected Cloudflare Worker secret by guarded CI.
// No changes to official passwords; session is written only to staging D1.
import {sha256} from './auth-api.mjs';
const HOST='celebrations-exit-staging.rondes.workers.dev';
const EXPIRES='2026-11-03T00:00:00.000Z';
const encoder=new TextEncoder();
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer','x-robots-tag':'noindex,nofollow,noarchive'
}});
const fail=(status=401)=>json({ok:false,error:'Code temporaire invalide ou expiré.'},status);
const validHash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/i.test(s);
const same=(a,b)=>{
 if(!validHash(a)||!validHash(b))return false;
 let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);
 return n===0;
};
const normalize=s=>String(s||'').trim().replace(/[\s-]/g,'').toUpperCase();
const token=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function handleEditorD4Login(request,env){
 if(new URL(request.url).hostname!==HOST)return fail(404);
 if(request.method!=='POST')return fail(405);
 if(!env.DB||!validHash(env.ADMIN_D4_ACCESS_HASH))return fail(503);
 if(Date.now()>=Date.parse(EXPIRES))return fail(403);
 let payload;try{payload=await request.json()}catch{return fail(400)}
 const code=normalize(payload?.code);
 if(code.length<24||code.length>80||!/^[A-Z0-9]+$/.test(code))return fail(401);
 const digest=await sha256(code);
 const personal=same(digest,env.ADMIN_D4_ACCESS_HASH);
 const qa=same(digest,env.ADMIN_D4_QA_HASH);
 if(!personal&&!qa)return fail(401);
 const raw=token(),hash=await sha256(raw);
 const until=new Date(Math.min(Date.now()+2*60*60*1000,Date.parse(EXPIRES))).toISOString();
 await env.DB.prepare('INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)')
  .bind(hash,qa?'d4-qa@celebrations.local':'d4-ludo@celebrations.local',until).run();
 return json({ok:true,token:raw,expires_at:until,staging:true,role:'temporary_admin_review'});
}
const html=`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Accès personnel de test — Célébrations</title>
<style>
:root{font-family:system-ui,Arial,sans-serif;color:#243046;background:#faf8f5}
*{box-sizing:border-box}body{margin:0;padding:clamp(15px,4vw,34px)}
main{margin:5vh auto;max-width:460px;padding:clamp(20px,4vw,32px);background:white;border:1px solid #e9e3da;border-radius:18px;box-shadow:0 6px 24px #0001}
h1{font-size:clamp(1.4rem,5vw,2rem);margin-top:0}p{line-height:1.5}
input{width:100%;font-size:1rem;border:1px solid #a5a9b2;border-radius:12px;padding:14px;margin:8px 0 17px}
button,.btn{display:block;text-align:center;width:100%;background:#a64c23;color:#fff;border:0;padding:14px;border-radius:12px;font-size:1rem;font-weight:700;text-decoration:none;cursor:pointer;margin-top:12px}
.btn.secondary{background:#263d69}
small{display:block;margin-top:18px;color:#606a7c}
.err{color:#a71313}.good{color:#126b3a}
</style></head><body><main><h1>Accès personnel de test</h1>
<p>Vous êtes sur l'administration <strong>staging</strong>, indépendante du site officiel. Votre mot de passe habituel n'est pas nécessaire.</p>
<form id="gate"><label for="code">Code d'accès temporaire</label>
<input id="code" type="password" required autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="D4-…" aria-describedby="status">
<button id="connect" type="submit">Se connecter à l'administration de test</button></form>
<p id="status" role="status" aria-live="polite"></p>
<div id="links" hidden>
<a class="btn secondary" href="/admin.html?staging=1">1. Ouvrir l'administration</a>
<a class="btn" href="/__editor/entry">2. Voir les 47 pages en prévisualisation</a>
</div>
<small>Accès de test personnel à durée limitée. Ne communiquez pas le code et n'utilisez pas votre mot de passe officiel. Les pages restent des brouillons.</small></main>
<script nonce="D4_NONCE_PLACEHOLDER">
(()=>{const form=document.getElementById('gate'),input=document.getElementById('code'),btn=document.getElementById('connect'),status=document.getElementById('status'),links=document.getElementById('links');
form.addEventListener('submit',async e=>{e.preventDefault();btn.disabled=true;status.textContent='Vérification en cours…';
try{const res=await fetch('/__editor/access/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:input.value}),cache:'no-store',credentials:'same-origin'});
input.value='';const data=await res.json();if(!res.ok||!data.ok||!data.token){status.textContent=data.error||'Accès refusé';status.className='err';return}
localStorage.setItem('celebrations-admin-token',data.token);
status.textContent='Accès autorisé. Ouvrez l’administration ou la prévisualisation.';status.className='good';form.hidden=true;links.hidden=false;
}catch{status.textContent='Connexion au site de test indisponible.';status.className='err'}
finally{btn.disabled=false}});
})();
</script></body></html>`;
export async function handleEditorD4Access(request){
 if(new URL(request.url).hostname!==HOST)return new Response('Not found',{status:404});
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});
 const nonce=token().slice(0,32);
 const body=html.replace('D4_NONCE_PLACEHOLDER',nonce);
 return new Response(body,{headers:{
  'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex,nofollow,noarchive',
  'referrer-policy':'no-referrer','x-content-type-options':'nosniff',
  'content-security-policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; connect-src 'self'; style-src 'nonce-"+nonce+"'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
 }});
}
