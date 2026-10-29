// E1 visual-editing page is a wrapper around the same safe D/D3 preview renderer.
// Imported content is never re-parsed/executed as HTML/JS. Only trusted JS
// controls a small editable overlay. Editing API requires a live admin token.
import {handleEditorD,canPreview} from './editor-d-preview.mjs';
import {E1_CLIENT} from './editor-e1-client.mjs';
const HOST='celebrations-exit-staging.rondes.workers.dev';
const pilot=new Set(['home','celebration:101:step:Mercredi']);
const css=`
.e1-toolbar{position:sticky;top:0;z-index:90;display:flex;justify-content:center;align-items:center;gap:8px;flex-wrap:wrap;background:#fff9e9;border-bottom:2px solid #dca961;padding:9px 11px}
.e1-toolbar button,.e1-toolbar a{min-height:43px;padding:10px 13px;border:1px solid #b5a99c;border-radius:10px;font-weight:650;text-decoration:none;background:#fff;color:#352d24;font-size:.89rem;cursor:pointer}
.e1-toolbar button:disabled{opacity:.48;cursor:not-allowed}
.e1-toolbar #e1-save{background:#a64c23;color:white}
#e1-status{width:100%;text-align:center;font-size:.82rem;margin:0}
.e1-panel{max-width:1100px;margin:12px auto;padding:14px;background:#fffdf7;border:1px solid #e4d5ba;border-radius:12px}
.e1-panel input,.e1-panel select{width:100%;min-height:44px;padding:10px;border:1px solid #989898;border-radius:9px}
.e1-panel button{min-height:44px;padding:8px 12px;border:1px solid #968e82;border-radius:9px;background:#fff}
.e1-panel label{display:block;margin:8px 0 4px}
.e1-panel .e1-actions{display:flex;gap:8px;margin:10px 0;flex-wrap:wrap}
.e1-touch{outline:2px dashed #d28b37!important;outline-offset:4px;border-radius:5px;min-height:25px;cursor:text;touch-action:manipulation}
.e1-touch:focus{outline:3px solid #a64c23!important;background:#fffbf2}
.e1-active .d-event,.e1-active .d-day{border-color:#edc686}
.e1-active .d-welcome-actions a{outline:2px dashed #d28b37;outline-offset:4px}
.e1-empty-hint{font-size:.8rem;color:#666}
.e2a-new{padding:12px;border:2px dashed #c4802b;border-radius:10px;background:#fffaf1;margin:12px 0}
.e2a-new p{min-height:44px;margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.e2a-new p:empty:before{content:"Saisissez votre paragraphe…";color:#7a736b;pointer-events:none}
#e1-page-menu a{display:block;padding:8px;border-radius:8px;border:1px solid #dfd6c6;margin:3px;text-decoration:none}
@media(max-width:560px){.e1-toolbar{justify-content:stretch;gap:5px;padding:7px}.e1-toolbar button,.e1-toolbar a{flex:1;font-size:.78rem;padding:8px 5px;text-align:center}
 .e1-panel{margin:8px;padding:11px}.e1-toolbar #e1-status{font-size:.77rem}}
`;
const toolbar=`
<div class="e1-toolbar" role="toolbar" aria-label="Modifier la page">
<button id="e1-pages" type="button">Pages</button>
<button id="e1-edit" type="button" disabled>Modifier cette page</button>
<button id="e1-save" type="button" disabled>Enregistrer</button>
<button id="e2a-add" type="button" hidden>+ Ajouter un bloc</button>
<button id="e1-cancel" type="button" disabled>Annuler</button>
<button id="e1-history" type="button">Versions</button>
<p id="e1-status" role="status" aria-live="polite">Chargement du brouillon…</p>
</div>
<div id="e2a-choice" class="e1-panel" hidden>
<strong>Choisir le type de bloc</strong>
<button id="e2a-paragraph" type="button">Paragraphe</button>
</div>
<div id="e1-page-menu" class="e1-panel" hidden>
<strong>Choisir une page</strong>
<a href="/__editor/edit?key=home">Accueil général</a>
<a href="/__editor/edit?key=celebration%3A101%3Astep%3AMercredi">Programme du mercredi</a>
<a href="/__editor/preview?key=bibliotheque">Voir les autres pages (lecture seule)</a>
</div>
<div id="e1-picture" class="e1-panel" hidden>
<label for="e1-image-choices">Image d’accueil existante</label>
<select id="e1-image-choices"><option value="">Garder la photo d’accueil actuelle</option></select>
<p class="e1-empty-hint">La photo sélectionnée reste un brouillon tant que vous n’avez pas enregistré.</p></div>
<div id="e1-history-panel" class="e1-panel" hidden>
<label for="e1-versions">Anciennes versions</label><select id="e1-versions"></select>
<button id="e1-restore" type="button">Restaurer cette version</button>
<p class="e1-empty-hint">La version actuelle restera disponible dans l’historique.</p></div>
<div id="e1-button-box" class="e1-panel" role="dialog" aria-label="Modifier le bouton" hidden>
<h2>Modifier le bouton</h2>
<label for="e1-button-text">Texte du bouton</label><input id="e1-button-text" maxlength="800">
<label for="e1-button-url">Lien du bouton</label><input id="e1-button-url" maxlength="800">
<div class="e1-actions"><button type="button" id="e1-button-apply">Valider le bouton</button><button id="e1-button-cancel" type="button">Annuler</button></div></div>
`;
export async function handleEditorE1Page(request,env){
 const url=new URL(request.url);
 if(url.hostname!==HOST||request.method!=='GET')return new Response('Not found',{status:404});
 const key=url.searchParams.get('key')||'home';
 if(!pilot.has(key))return new Response('Page encore en lecture seule',{status:404,headers:{'cache-control':'no-store'}});
 const base=await handleEditorD(request,env);
 if(!base.ok)return base;
 const html=await base.text();
 if(!html.includes('<main class="d-shell">'))return new Response('Indisponible',{status:503});
 // Prevent duplicate preview buttons: replace D's inert bar only.
 const upgraded=html.replace(/<div class="e1-previewbar"[\s\S]*?<\/div>/,'')
  .replace('</head>','<style>'+css+'</style></head>')
  .replace('<main class="d-shell">',toolbar+'<main class="d-shell">')
  .replace('</body>','<script defer src="/__editor/e1-client.js"></script></body>');
 const headers=new Headers(base.headers);
 headers.set('content-security-policy',"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self'; media-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
 headers.set('cache-control','no-store');
 return new Response(upgraded,{headers});
}
export async function handleEditorE1Client(request,env){
 if(new URL(request.url).hostname!==HOST||request.method!=='GET')return new Response('Not found',{status:404});
 if(!await canPreview(request,env))return new Response('Authentication required',{status:401,headers:{'cache-control':'no-store'}});
 return new Response(E1_CLIENT,{headers:{
  'content-type':'application/javascript; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff','x-robots-tag':'noindex,nofollow'
 }});
}
