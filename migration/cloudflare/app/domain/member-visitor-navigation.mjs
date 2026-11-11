// M018-B — visitor display projection of an ALREADY server-authorized list.
// No client-side entitlement inference: the canonical /api/participant/space-pages
// and /api/participant/space-page endpoints remain the only access gates.
// Preserve the selected language; never substitute another category or version.
export function projectAuthorizedMemberPages(response,languageId){
 if(!response||!Array.isArray(response.pages))throw new TypeError('Liste invalide');
 const seen=new Set(),menu=[];
 for(const page of response.pages){
  if(!page||typeof page.id!=='string'||!/^page:[0-9a-f-]{36}$/.test(page.id)||
     typeof page.name!=='string'||typeof page.celebrationId!=='string'||
     !page.celebrationId||(page.languageId!==languageId&&!(page.languageId==='fr'&&page.requestedLanguageId===languageId&&page.usedFallback===true))||seen.has(page.id))continue;
  seen.add(page.id);
  // Copy only fields required for labels and navigation, never returned ACLs,
  // draft translations, media paths or credentials.
  const item={id:page.id,name:page.name,celebrationId:page.celebrationId,
   languageId:page.languageId,requestedLanguageId:page.requestedLanguageId,usedFallback:page.usedFallback===true};
  for(const field of ['celebrationLabel','spaceName'])
   if(typeof page[field]==='string')item[field]=page[field];
  menu.push(item);
 }
 return menu;
}
