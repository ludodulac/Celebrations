// E2A-ACCESS: unauthenticated navigation recovery only, staging editor.
// Never exposes draft HTML or session identifiers on the recovery response.
const HOST='celebrations-exit-staging.rondes.workers.dev';
export const PILOT_KEYS=['home','celebration:101:step:Mercredi'];
export function handleEditorRecovery(request,key){
 const url=new URL(request.url);
 if(url.hostname!==HOST||!PILOT_KEYS.includes(key)||request.method!=='GET')
  return new Response('Not found',{status:404,headers:{'cache-control':'no-store'}});
 const nonce=[...crypto.getRandomValues(new Uint8Array(18))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const destination='/__editor/edit?key='+encodeURIComponent(key);
 const login='/__editor/access?return='+encodeURIComponent(key);
 // All destinations are derived exclusively from the two approved keys,
 // never from a full user-provided URL or arbitrary return parameter.
 const js=`(async()=>{const destination=${JSON.stringify(destination)};
  const status=document.getElementById('recover-status');
  const reconnect=document.getElementById('reconnect');
  const show=()=>{status.textContent='Votre accès à la prévisualisation a expiré. Reconnectez-vous pour revenir à cette page.';reconnect.hidden=false;};
  const token=localStorage.getItem('celebrations-admin-token')||'';
  if(!token){show();return;}
  // A rejected or blocked cookie must not trigger an infinite navigation loop.
  const retryKey='celebrations-preview-retry:'+destination;
  const previous=Number(sessionStorage.getItem(retryKey)||0);
  if(Date.now()-previous<12000){show();return;}
  sessionStorage.setItem(retryKey,String(Date.now()));
  try{
   const result=await fetch('/__editor/session',{method:'POST',headers:{authorization:'Bearer '+token},credentials:'same-origin',cache:'no-store'});
   if(!result.ok){show();return;}
   location.replace(destination);
  }catch{show()}
 })();`;
 const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8">
 <meta name="viewport" content="width=device-width,initial-scale=1">
 <meta name="robots" content="noindex,nofollow">
 <title>Retrouver votre éditeur — Célébrations</title>
 <style nonce="${nonce}">
 *{box-sizing:border-box}body{background:#faf8f5;color:#263247;font:16px system-ui,Arial,sans-serif;padding:18px}
 main{max-width:480px;margin:9vh auto;padding:26px;border-radius:16px;background:white;border:1px solid #e0d7ca}
 h1{font-size:1.55rem}p{line-height:1.5}a{display:block;min-height:48px;text-align:center;
 background:#a64c23;color:white;border-radius:10px;padding:13px;font-weight:700;text-decoration:none}
 [hidden]{display:none!important}
 </style></head><body><main><h1>Retrouver votre éditeur</h1>
 <p id="recover-status" role="status" aria-live="polite">Vérification de votre accès…</p>
 <a id="reconnect" href="${login}" hidden>Se reconnecter</a>
 </main><script nonce="${nonce}">${js}</script></body></html>`;
 return new Response(html,{status:401,headers:{
  'content-type':'text/html; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
  'x-robots-tag':'noindex,nofollow,noarchive',
  'content-security-policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
 }});
}
