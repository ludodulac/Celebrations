// Dedicated staging-only editor playground. Only browser-local demo data.
// No authentication needed because there is no server persistence and no private content.
import {DEMO_CSS} from './editor-demo-style.mjs';
import {DEMO_CLIENT} from './editor-demo-client.mjs';
const HOST='celebrations-exit-staging.rondes.workers.dev';
export function handleEditorDemo(request){
 const url=new URL(request.url);
 if(url.hostname!==HOST)return new Response('Not found',{status:404});
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
 const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
 const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Atelier visuel | Célébrations</title><style nonce="'+nonce+'">'+DEMO_CSS+'</style></head><body>'+
 '<div class="shell"><aside class="rail"><div class="brand"><div class="mark">✦</div><div><strong>Célébrations</strong><small>Atelier visuel</small></div></div>'+
 '<nav aria-label="Navigation"><button class="navbtn active" data-tab="pages"><span>▤</span> Pages</button><button class="navbtn" data-tab="celebrations"><span>✧</span> Célébrations</button><button class="navbtn" data-tab="media"><span>▧</span> Fichiers</button><button class="navbtn" data-tab="settings"><span>⚙</span> Réglages</button><a class="navbtn" style="text-decoration:none" href="/__editor/demo-preparation"><span>▤</span> Préparation réelle</a></nav>'+
 '<div class="bottom"><b>Mode démonstration</b><br>Sans mot de passe. Aucun changement sur le site officiel.</div></aside>'+
 '<div class="content"><header class="topbar"><div><h1 id="section-title">Éditeur de pages</h1><p>Un site à modifier aussi facilement qu’un document</p></div><div class="actions"><span class="badge">DÉMONSTRATION</span><button id="preview-btn" type="button" class="btn sm">Aperçu</button><button id="save-btn" type="button" class="btn primary">Enregistrer</button></div></header>'+
 '<main class="main"><div class="notice"><b>ⓘ Atelier d’essai sans connexion.</b> Les pages sont fictives. Vos changements restent sur cet appareil et ne modifient ni les 47 pages historiques ni le site officiel.</div><div id="workspace"></div><p class="status" id="status" role="status" aria-live="polite"></p></main></div></div>'+
 '<input id="image-input" type="file" accept="image/jpeg,image/png,image/webp" hidden>'+
 '<script nonce="'+nonce+'">'+DEMO_CLIENT+'</script></body></html>';
 return new Response(request.method==='HEAD'?null:html,{headers:{
  'content-type':'text/html; charset=utf-8','cache-control':'no-store',
  'x-robots-tag':'noindex,nofollow,noarchive','referrer-policy':'no-referrer',
  'x-content-type-options':'nosniff',
  'content-security-policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; img-src data: blob:; connect-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
 }});
}
