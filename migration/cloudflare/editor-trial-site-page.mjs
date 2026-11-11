// Read-only visitor renderer. Only the filtered published projection is displayed.
// Browsing the site never modifies an administrator's locally saved drafts.
import {loadSevenStageContent,STAGES} from './editor-demo-preparation-page.mjs';
import {readEditorState} from './editor-publication-api.mjs';
import {mayUseIsolatedMemberApi} from './app/security/editor-route-policy.mjs';
import {TRIAL_SITE_CLIENT,TRIAL_SITE_STYLE} from './editor-trial-site-client.mjs';
const HOST='celebrations-exit-staging.rondes.workers.dev';
// M008-A responsive switcher; uses the existing CSP nonce and M006 DOM component.
export const PUBLIC_LANGUAGE_STYLE=`
.site-menu-bar{display:flex;align-items:center;justify-content:space-between;gap:12px}
#public-language-control{margin-left:auto;min-width:0}
.public-language-selector{position:relative;font-size:.95rem}
.public-language-selector>summary{cursor:pointer;display:flex;align-items:center;gap:7px;border:1px solid #cbd2d7;border-radius:8px;padding:7px 11px;background:#fff;color:#25313b;list-style:none}
.public-language-selector>summary::-webkit-details-marker{display:none}
.public-language-selector>summary::after{content:"▾";margin-left:8px}
.public-language-options{position:absolute;right:0;top:100%;z-index:60;min-width:150px;max-height:60vh;overflow:auto;background:#fff;border:1px solid #cbd2d7;border-radius:8px;box-shadow:0 5px 18px #0002;padding:5px;margin:5px 0;list-style:none}
.public-language-options a{display:flex;align-items:center;gap:8px;padding:9px 10px;color:#25313b;text-decoration:none;white-space:nowrap}
.public-language-options a[aria-current=true]{font-weight:700;background:#f0f5f8}
.public-language-options a:focus-visible,.public-language-selector>summary:focus-visible{outline:2px solid #194c76;outline-offset:2px}
.public-language-flag{display:inline-flex;align-items:center;justify-content:center;min-width:1.5em;height:1.3em}
img.public-language-flag{object-fit:contain}
@media(max-width:600px){.site-menu-bar{gap:6px;flex-wrap:wrap}.public-language-selector{font-size:.86rem}.public-language-selector>summary{padding:8px}.public-language-options{max-width:90vw}}
`;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeJson=x=>JSON.stringify(x).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export async function handleTrialSite(request,env){
 const url=new URL(request.url);
 const memberSite=mayUseIsolatedMemberApi(url,env)&&env.MEMBER_PAGE_READ_API_ENABLED==='true';
 if(!memberSite&&url.hostname!==HOST&&!['ronde-des-archanges-universelle.eu','www.ronde-des-archanges-universelle.eu','celebrations-visual-candidate.rondes.workers.dev'].includes(url.hostname))return new Response('Not found',{status:404});
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 if(!env.DB)return new Response('Site d’essai momentanément indisponible',{status:503});
 const slug=url.searchParams.get('page');
 if(slug&&!(memberSite&&slug==='member-area')&&slug!=='celebrations'&&slug!=='mediatheque'&&slug!=='mediatheque-generale'&&!STAGES.some(p=>p.slug===slug)&&slug!=='neutral-accueil-general'&&!/^neutral-[0-9a-f-]{30,45}$/.test(slug)&&!/^extra-[0-9a-f-]{30,45}$/.test(slug)&&!/^page:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(slug))return new Response('Étape introuvable',{status:404});
 let publishedState=null;
 if(env.EDITOR_BUCKET){
  try{({state:publishedState}=await readEditorState(env.EDITOR_BUCKET))}
  catch{return new Response('Publication temporairement indisponible',{status:503,
   headers:{'cache-control':'no-store'}})}
 }
 let result;
 try{result=await loadSevenStageContent(env,url.searchParams.get('celebration'),
  {publicOnly:true,publishedState})}
 catch{return new Response('Célébration introuvable',{status:404,headers:{'cache-control':'no-store'}})}
 const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
 const isOfficial=['ronde-des-archanges-universelle.eu','www.ronde-des-archanges-universelle.eu'].includes(url.hostname);
 const siteClient=TRIAL_SITE_CLIENT;
 const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+(isOfficial?'<title>Célébrations des Archanges</title>':'<meta name="robots" content="noindex,nofollow"><title>Site d’essai — Célébrations</title>')+
 '<style nonce="'+nonce+'">'+TRIAL_SITE_STYLE+PUBLIC_LANGUAGE_STYLE+'</style></head><body data-member-site="'+(memberSite?'1':'0')+'">'+


 '<div class="site-menu-bar"><div class="site-menu-group"><button type="button" class="menu-toggle" id="menu-toggle" aria-expanded="false" aria-haspopup="true" aria-controls="general-navigation">☰ Menu</button>'+
 '<nav id="general-navigation" class="general-navigation" aria-label="Pages hors célébration" hidden></nav></div><div id="public-language-control" aria-label="Langues du site"></div></div>'+
 '<nav class="celebration-shortcuts" id="celebration-shortcuts" aria-label="Célébration"></nav>'+
 '<nav class="steps" id="stage-navigation" aria-label="Pages de la célébration"></nav>'+
 '<main class="site-paper" id="site-paper"><div id="stage-main"></div></main>'+
 '<footer class="footer"><nav id="footer-pages" class="footer-pages" aria-label="Pages de bas de page"></nav><a id="back-admin" href="/__editor/demo-preparation?celebration='+encodeURIComponent(result.celebration.id)+'">Administration</a></footer>'+
 '<script nonce="'+nonce+'">window.__TRIAL_SITE_SEED__='+safeJson(result.seed)+';</script>'+

 '<script nonce="'+nonce+'">'+siteClient+'</script></body></html>';
 const h={'content-type':'text/html; charset=utf-8','cache-control':'no-store',...(isOfficial?{}:{'x-robots-tag':'noindex,nofollow,noarchive'}),'x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; img-src 'self' blob: data: https:; media-src 'self' blob: https:; connect-src 'self'; base-uri 'none'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; frame-ancestors 'none'; form-action 'none'"};
 return new Response(request.method==='HEAD'?null:html,{headers:h});
}
