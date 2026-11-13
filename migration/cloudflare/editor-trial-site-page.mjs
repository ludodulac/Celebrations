import {visitorText} from './app/domain/visitor-ui-translations.mjs';
// Read-only visitor renderer. Only the filtered published projection is displayed.
// Browsing the site never modifies an administrator's locally saved drafts.
import {loadSevenStageContent,STAGES} from './editor-demo-preparation-page.mjs';
import {readEditorState} from './editor-publication-api.mjs';
import {normalizedSiteIdentity} from './site-identity-api.mjs';
import {navigationPreference} from './app/domain/editor-navigation-label.mjs';
import {mayUseIsolatedMemberApi,isReadonlyCandidateHost,isM016AdminPreprodHost} from './app/security/editor-route-policy.mjs';
import {TRIAL_SITE_CLIENT,TRIAL_SITE_STYLE} from './editor-trial-site-client.mjs';
const HOST='celebrations-exit-staging.rondes.workers.dev';
// M008-A responsive switcher; uses the existing CSP nonce and M006 DOM component.
export const PUBLIC_LANGUAGE_STYLE=`
.m021-site-identity{isolation:isolate;position:relative;display:flex;align-items:center;justify-content:center;min-height:72px;max-height:100px;overflow:hidden;background:#24404f;color:#fff;padding:14px 24px;text-align:center}
.m021-site-image{position:absolute;z-index:-2;inset:0;width:100%;height:100%;object-fit:cover}
.m021-site-identity:after{content:'';position:absolute;z-index:-1;inset:0;background:linear-gradient(90deg,#0b1d2fbd,#122e40ad,#0b1d2fbd)}
.m021-site-title{font-size:clamp(1.05rem,2.7vw,1.65rem);line-height:1.25;font-weight:650;letter-spacing:.01em;text-shadow:0 2px 8px #0009;max-width:850px}
.m021-site-identity.is-home{min-height:clamp(155px,22vw,270px);max-height:none}
.m021-site-identity.is-home .m021-site-title{font-size:clamp(1.45rem,3.3vw,2.6rem)}
@media(max-width:600px){.m021-site-identity{min-height:62px;max-height:100px;padding:8px 12px}.m021-site-identity.is-home{min-height:140px;max-height:190px}.m021-site-title{font-size:clamp(1rem,4.4vw,1.35rem)}.m021-site-identity.is-home .m021-site-title{font-size:clamp(1.25rem,5vw,1.75rem)}}

.site-menu-bar{display:flex;align-items:center;justify-content:space-between;gap:12px}
/* M027: label inside the EXISTING sticky menu bar, not an extra header.
   Grid allocates spare width to the title; ellipsis prevents overlap. */
@media(min-width:701px){
 .site-menu-bar.has-nav-title{display:grid;grid-template-columns:max-content minmax(0,1fr) max-content max-content;gap:12px;flex-wrap:nowrap}
 .site-nav-title{text-decoration:none!important;display:block;cursor:pointer}
 .site-nav-title:hover,.site-nav-title:focus-visible{text-decoration:underline!important;text-underline-offset:3px}
 .site-nav-title{grid-column:2;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#263747;font:650 clamp(14px,1.4vw,20px)/1.35 system-ui,sans-serif}
 .site-nav-title[data-align="left"]{justify-self:start;text-align:left}
 .site-nav-title[data-align="center"]{justify-self:center;text-align:center}
 .site-nav-title[data-align="right"]{justify-self:end;text-align:right}
 .site-menu-bar.has-nav-title #member-connection{grid-column:3}
 .site-menu-bar.has-nav-title #public-language-control{grid-column:4}
}
@media(max-width:700px){.site-nav-title{display:none!important}}
#public-language-control{margin-left:auto;min-width:0}
#member-connection{border:1px solid #35734d;background:#fff;color:#275638;padding:8px 12px;border-radius:8px;cursor:pointer;font:600 .95rem system-ui}
#member-connection[hidden]{display:none!important}
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
// M031/4 — Full-length celebration day labels on a SINGLE desktop row;
// smaller screens retain the existing responsive grid.
export const M031_VISITOR_NAV_STYLE=`
@media(min-width:1051px){
 nav.steps#stage-navigation{
  display:grid;grid-template-columns:none;grid-auto-flow:column;
  grid-auto-columns:minmax(max-content,1fr);
  gap:6px;max-width:none;width:100%;overflow-x:auto;overflow-y:hidden;
  scrollbar-width:thin;padding:14px clamp(10px,1.6vw,28px)
 }
 nav.steps#stage-navigation[hidden]{display:none!important}
 nav.steps#stage-navigation .stage-tab{
  white-space:nowrap!important;overflow-wrap:normal!important;word-break:normal!important;
  padding:10px 8px;min-width:max-content;font-size:clamp(11px,.95vw,13px);line-height:1.25
 }
}
`;
// M033 — Only a published general homepage image becomes a full-window
// entrance; the editor's original image URL, bytes and metadata are unchanged.
export const M033_SPLASH_HOME_CSS=`
/* M034: Borderless CENTRAL page, not photo across viewport.
   Original author headings stay visible, editable and deletable. */
/* Keep the page/home title beside ☰ Menu on phones as well, with a
   normal anchor pointing to /; preserve the separate member/language tools. */
@media(max-width:700px){
 .site-menu-bar .site-nav-title{
  display:block!important;flex:1 1 140px;min-width:0;
  max-width:calc(100vw - 154px);margin:0;
  font-size:clamp(12px,3.5vw,17px);line-height:1.3;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap
 }
 .site-menu-bar.has-nav-title{display:flex;flex-wrap:wrap}
}
body.is-splash-home{width:100%;margin:0!important;background:#fff!important}
body.is-splash-home #site-identity,
body.is-splash-home .site-menu-bar .site-menu-group,
body.is-splash-home .site-menu-bar #member-connection,
body.is-splash-home .site-menu-bar #public-language-control,
body.is-splash-home #celebration-shortcuts,
body.is-splash-home #stage-navigation,
body.is-splash-home .hero{display:none!important}
/* Keep native clickable site name looking like a site title, never a
   default blue browser link; the white band is visible on the home page. */
.site-menu-bar .site-nav-title,
.site-menu-bar .site-nav-title:visited,
.site-menu-bar .site-nav-title:hover{
 color:#263747!important;text-decoration:none!important;text-shadow:none!important
}
.site-menu-bar .site-nav-title:focus-visible{
 outline:2px solid #56786b;outline-offset:4px;border-radius:2px
}
body.is-splash-home .site-menu-bar.has-nav-title{
 display:flex!important;justify-content:center!important;align-items:center;
 box-sizing:border-box;width:100%;min-height:66px;
 padding:12px 20px!important;margin:0!important;
 background:#fff!important;border-bottom:1px solid #e6ece9!important;
 box-shadow:0 1px 5px #1e3b3110;position:relative;z-index:6
}
body.is-splash-home .site-menu-bar .site-nav-title{
 display:block!important;grid-column:auto!important;
 flex:0 1 auto!important;min-width:0;max-width:100%!important;
 margin:0!important;text-align:center!important;
 font:700 clamp(18px,2.2vw,25px)/1.32 system-ui,sans-serif!important;
 letter-spacing:.008em!important;white-space:normal!important;
 overflow:visible!important
}
body.is-splash-home .footer{
 display:flex!important;justify-content:center;align-items:center;
 flex-wrap:wrap;gap:9px;margin:0 auto 18px;padding:15px 12px 21px;
 background:#fff!important;text-align:center
}
body.is-splash-home #back-admin{
 color:#52645d!important;text-decoration:underline!important;
 text-underline-offset:3px;min-height:32px;display:inline-flex;align-items:center
}
body.is-splash-home .site-paper,
body.is-splash-home.is-neutral-preview .site-paper{
 flex:0 0 auto!important;display:block!important;
 width:min(940px,calc(100vw - 24px))!important;
 max-width:940px!important;min-height:0!important;
 margin:clamp(8px,2vw,18px) auto 38px!important;
 padding:0!important;
 border:0!important;border-radius:0!important;
 box-shadow:none!important;background:#fff!important;
 overflow:visible!important
}
body.is-splash-home #stage-main{
 display:block!important;width:100%;max-width:100%;
 margin:0;padding:0;min-height:0
}
/* Cover touches both central page edges, no border/inset. */
body.is-splash-home .m033-splash-enter{
 display:block;position:relative;width:100%;height:min(58svh,610px);
 min-height:320px;margin:0;padding:0;overflow:hidden;
 background:#f2f3f4;text-decoration:none;cursor:pointer
}
body.is-splash-home .m033-splash-image{
 display:block;width:100%!important;height:100%!important;
 object-fit:cover;object-position:center;
 max-width:none!important;max-height:none!important;
 margin:0!important;padding:0!important;
 border:0!important;border-radius:0!important
}
body.is-splash-home .m033-splash-enter:focus-visible{
 outline:4px solid #ffe37b;outline-offset:-4px;z-index:1
}
body.is-splash-home .m034-home-flow{
 box-sizing:border-box;width:100%;max-width:100%;
 padding:clamp(14px,2.7vw,26px) clamp(12px,3.6vw,32px)
}
body.is-splash-home .m034-home-flow .site-block:last-child{margin-bottom:0}
body.is-splash-home .m034-home-flow .trial-heading{margin-top:5px;margin-bottom:14px}

/* Real border, fill and contrast; styling comes from validated HEX values
   and bounded border width/shape. Image and CTA go to the same next page. */
body.is-splash-home .m035-welcome-button{
 box-sizing:border-box;position:absolute;left:50%;bottom:clamp(23px,4.8vw,52px);
 transform:translateX(-50%);z-index:2;display:inline-flex;
 justify-content:center;align-items:center;max-width:calc(100% - 28px);
 min-width:178px;min-height:55px;padding:12px 28px;
 border-style:solid;box-shadow:0 5px 20px #09191055;
 font:700 clamp(16px,1.7vw,21px)/1.3 system-ui,sans-serif;
 letter-spacing:.025em;white-space:normal;text-align:center;
 text-decoration:none;overflow-wrap:anywhere;
 transition:filter .18s ease,box-shadow .18s ease,translate .18s ease
}
body.is-splash-home .m033-splash-enter:hover .m035-welcome-button{
 filter:brightness(1.08);box-shadow:0 8px 26px #09191066;translate:0 -2px
}
body.is-splash-home .m033-splash-enter:focus-visible .m035-welcome-button{
 outline:2px solid #fff;outline-offset:3px
}
@media(prefers-reduced-motion:reduce){
 body.is-splash-home .m035-welcome-button{transition:none!important;translate:none!important}
}

@media(max-width:600px){
 body.is-splash-home .site-paper,
 body.is-splash-home.is-neutral-preview .site-paper{
  width:calc(100vw - 16px)!important;margin:8px auto 28px!important
 }
 body.is-splash-home .m033-splash-enter{height:min(47svh,400px);min-height:230px}
 body.is-splash-home .m034-home-flow{padding:12px 10px}
 body.is-splash-home .site-menu-bar.has-nav-title{min-height:57px;padding:10px 12px!important}
 body.is-splash-home .site-menu-bar .site-nav-title{
  font-size:clamp(16px,4.2vw,20px)!important;line-height:1.3!important
 }
 body.is-splash-home .m035-welcome-button{
  min-height:49px;min-width:156px;padding:11px 22px;
  bottom:22px;font-size:17px
 }
}
`;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeJson=x=>JSON.stringify(x).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export async function handleTrialSite(request,env){
 const url=new URL(request.url);
 const memberSite=mayUseIsolatedMemberApi(url,env)&&env.MEMBER_PAGE_READ_API_ENABLED==='true';
 if(!memberSite&&!isM016AdminPreprodHost(url.hostname,env)&&url.hostname!==HOST&&!['ronde-des-archanges-universelle.eu','www.ronde-des-archanges-universelle.eu','celebrations-visual-candidate.rondes.workers.dev'].includes(url.hostname)&&!isReadonlyCandidateHost(url.hostname))return new Response('Not found',{status:404});
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 if(!env.DB)return new Response('Site d’essai momentanément indisponible',{status:503});
 const slug=url.searchParams.get('page');
 if(slug&&!(memberSite&&slug==='member-area')&&slug!=='celebrations'&&slug!=='mediatheque'&&slug!=='mediatheque-generale'&&!STAGES.some(p=>p.slug===slug)&&slug!=='neutral-accueil-general'&&!/^neutral-[0-9a-f-]{30,45}$/.test(slug)&&!/^extra-[0-9a-f-]{30,45}$/.test(slug)&&!/^page:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(slug))return new Response('Étape introuvable',{status:404});
 let publishedState=null;
 if(env.EDITOR_BUCKET){
  try{({state:publishedState}=await readEditorState(env.EDITOR_BUCKET))}
  catch{return new Response(visitorText(url.searchParams.get('lang'),'Publication temporairement indisponible'),{status:503,
   headers:{'cache-control':'no-store'}})}
 }
 let result;
 try{result=await loadSevenStageContent(env,url.searchParams.get('celebration'),
  {publicOnly:true,publishedState})}
 catch{return new Response(visitorText(url.searchParams.get('lang'),'Célébration introuvable'),{status:404,headers:{'cache-control':'no-store'}})}
 const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
 const identity=normalizedSiteIdentity(publishedState?.siteIdentity);
 const navigation=navigationPreference(publishedState?.navigation);
 const language=(url.searchParams.get('lang')||'fr').toLowerCase().split('-')[0];
 const identityTitle=identity.titles[language]||identity.title;
 const navigationHtml=navigation.title?'<a class="site-nav-title" data-align="'+navigation.position+'" href="/" aria-label="Retour à la page d’accueil">'+esc(navigation.title)+'</a>':'';
 const identityHtml=identityTitle||identity.imageSrc?'<header id="site-identity" class="m021-site-identity" aria-label="Identité du site">'+
  (identity.imageSrc?'<img class="m021-site-image" src="'+esc(identity.imageSrc)+'" alt="'+esc(identity.imageAlt)+'" style="object-position:'+identity.positionX+'% '+identity.positionY+'%">':'')+
  (identityTitle?'<strong class="m021-site-title">'+esc(identityTitle)+'</strong>':'')+'</header>':'';
 const isOfficial=['ronde-des-archanges-universelle.eu','www.ronde-des-archanges-universelle.eu'].includes(url.hostname);
 const siteClient=TRIAL_SITE_CLIENT;
 const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+(isOfficial?'<title>Célébrations des Archanges</title>':'<meta name="robots" content="noindex,nofollow"><title>Site d’essai — Célébrations</title>')+
 '<style nonce="'+nonce+'">'+TRIAL_SITE_STYLE+PUBLIC_LANGUAGE_STYLE+M031_VISITOR_NAV_STYLE+M033_SPLASH_HOME_CSS+'</style></head><body data-member-site="'+(memberSite?'1':'0')+'" data-member-login-visible="'+(memberSite&&publishedState?.adminMode?.memberAccessUiEnabled===true?'1':'0')+'">'+identityHtml+


 '<div class="site-menu-bar'+(navigation.title?' has-nav-title':'')+'"><div class="site-menu-group"><button type="button" class="menu-toggle" id="menu-toggle" aria-expanded="false" aria-haspopup="true" aria-controls="general-navigation">☰ Menu</button>'+
 '<nav id="general-navigation" class="general-navigation" aria-label="Pages hors célébration" hidden></nav></div>'+navigationHtml+'<button type="button" id="member-connection" hidden>Connexion membre</button><div id="public-language-control" aria-label="Langues du site"></div></div>'+
 '<nav class="celebration-shortcuts" id="celebration-shortcuts" aria-label="Célébration"></nav>'+
 '<nav class="steps" id="stage-navigation" aria-label="Pages de la célébration"></nav>'+
 '<main class="site-paper" id="site-paper"><div id="stage-main"></div></main>'+
 '<footer class="footer"><nav id="footer-pages" class="footer-pages" aria-label="Pages de bas de page"></nav><a id="back-admin" href="/__editor/demo-preparation?celebration='+encodeURIComponent(result.celebration.id)+'">Administration</a></footer>'+
 '<script nonce="'+nonce+'">window.__TRIAL_SITE_SEED__='+safeJson(result.seed)+';</script>'+

 '<script nonce="'+nonce+'">'+siteClient+'</script></body></html>';
 const h={'content-type':'text/html; charset=utf-8','cache-control':'no-store',...(isOfficial?{}:{'x-robots-tag':'noindex,nofollow,noarchive'}),'x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; img-src 'self' blob: data: https:; media-src 'self' blob: https:; connect-src 'self'; base-uri 'none'; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; frame-ancestors 'none'; form-action 'none'"};
 return new Response(request.method==='HEAD'?null:html,{headers:h});
}
