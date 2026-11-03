// Test-only, site-shaped preview of the already-public seven-stage programme.
// This is not publication: reads server public records and overlays browser-local saved edits.
import {loadSevenStageContent,STAGES} from './editor-demo-preparation-page.mjs';
import {TRIAL_SITE_CLIENT,TRIAL_SITE_STYLE} from './editor-trial-site-client.mjs';
import {SERVER_PREVIEW_PREFETCH} from './editor-server-sync-client.mjs';
const HOST='celebrations-exit-staging.rondes.workers.dev';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeJson=x=>JSON.stringify(x).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export async function handleTrialSite(request,env){
 const url=new URL(request.url);
 if(url.hostname!==HOST)return new Response('Not found',{status:404});
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 if(!env.DB)return new Response('Site d’essai momentanément indisponible',{status:503});
 const slug=url.searchParams.get('page');
 if(slug&&slug!=='celebrations'&&slug!=='mediatheque'&&!STAGES.some(p=>p.slug===slug)&&slug!=='neutral-accueil-general'&&!/^neutral-[0-9a-f-]{30,45}$/.test(slug)&&!/^extra-[0-9a-f-]{30,45}$/.test(slug))return new Response('Étape introuvable',{status:404});
 let result;
 try{result=await loadSevenStageContent(env,url.searchParams.get('celebration'))}
 catch{return new Response('Célébration introuvable',{status:404,headers:{'cache-control':'no-store'}})}
 const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
 const siteClient=TRIAL_SITE_CLIENT
  .replace("(()=>{\'use strict\';","(async()=>{\'use strict\';")
  .replace("const KEY=\'celebrations-demo-preparation-\'+celebration;",SERVER_PREVIEW_PREFETCH+"\nconst KEY=\'celebrations-demo-preparation-\'+celebration;");
 const html=\'<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Site d’essai — Célébrations</title>'+
 '<style nonce="'+nonce+'">'+TRIAL_SITE_STYLE+'</style></head><body>'+


 '<div class="site-menu-bar"><button type="button" class="menu-toggle" id="menu-toggle" aria-expanded="false" aria-controls="general-navigation">☰ Menu</button></div>'+
 '<nav id="general-navigation" class="general-navigation" aria-label="Pages hors célébration" hidden></nav>'+
 '<nav class="celebration-shortcuts" id="celebration-shortcuts" aria-label="Célébration"></nav>'+
 '<nav class="steps" id="stage-navigation" aria-label="Pages de la célébration"></nav>'+
 '<main class="site-paper" id="site-paper"><div id="stage-main"></div></main>'+
 '<footer class="footer"><a id="back-admin" href="/__editor/demo-preparation?celebration='+encodeURIComponent(result.celebration.id)+'">Administration</a></footer>'+
 '<script nonce="'+nonce+'">window.__TRIAL_SITE_SEED__='+safeJson(result.seed)+';</script>'+
 '<script nonce="'+nonce+'">'+siteClient+'</script></body></html>';
 const h={'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex,nofollow,noarchive','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; img-src 'self' blob: data: https:; media-src 'self' blob: https:; connect-src 'self'; base-uri 'none'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; frame-ancestors 'none'; form-action 'none'"};
 return new Response(request.method==='HEAD'?null:html,{headers:h});
}
