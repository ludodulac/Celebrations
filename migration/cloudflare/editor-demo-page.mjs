// Staging-only isolated visual administration demo: no server writes.
const HOST='celebrations-exit-staging.rondes.workers.dev';
export function handleEditorDemo(request){
 const url=new URL(request.url);
 if(url.hostname!==HOST)return new Response('Not found',{status:404});
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});
 const html='<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Célébrations · Atelier</title></head><body><main><h1>Atelier visuel Célébrations</h1><p>Démo locale sans mot de passe. Aucun changement publié.</p><p contenteditable="true">Touchez ce texte pour le modifier.</p></main></body></html>';
 return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex,nofollow'}});
}