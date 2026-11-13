// M09: document-only page commands. Caller owns save, conflict handling,
// confirmed publication/hiding and storage; these functions never call the network.
export function createEditorPageCommands({model}){
 function restoreSharedPages(db,saved){
  if(!Array.isArray(saved?.pages))return false;
  const clean=saved.pages.filter(model.validSharedPage);
  if(!clean.length)return false;
  db.pages=db.pages.filter(p=>p.group!=='page').concat(clean);
  db.siteHomeId=clean.some(p=>p.id===saved.homeId)?saved.homeId:clean[0].id;
  return true;
 }
 function sharedSnapshot(db,before={}){
  return {...before,pages:db.pages.filter(p=>p.group==='page'),
   homeId:db.siteHomeId||'neutral-accueil-general',
   deletedPageIds:Array.isArray(before.deletedPageIds)?before.deletedPageIds:[],
   celebrationVisibility:before.celebrationVisibility||{}};
 }
 function moveGeneralPage(db,page,direction){
  const general=model.groupPages(db.pages,page.placement==='footer'?'footer':'page'),
   index=general.indexOf(page),other=general[index+direction];
  if(index<0||!other)return false;
  const a=db.pages.indexOf(page),b=db.pages.indexOf(other);
  db.pages[a]=other;db.pages[b]=page;return true;
 }
 // Rename user-created pages without changing stable public URL, ID, rights
 // or status. Fixed historical celebration stages keep their canonical names.
 function renameEditablePage(db,page,name,celebrationId){
  if(!db?.pages?.includes(page)||!model.removablePage(page,celebrationId).allowed)
   return {ok:false,error:'Cette page historique conserve son nom.'};
  const value=typeof name==='string'?name.trim():'';
  if(!value||value.length>95)
   return {ok:false,error:'Saisissez un nom de page de 1 à 95 caractères.'};
  const group=page.placement==='footer'?'footer':page.group;
  if(model.groupPages(db.pages,group).some(other=>other!==page&&
     other.name.trim().toLocaleLowerCase('fr')===value.toLocaleLowerCase('fr')))
   return {ok:false,error:'Une page porte déjà ce nom.'};
  const previous=page.name;
  if(previous===value)return {ok:true,changed:false};
  page.name=value;
   return {ok:true,changed:true};
 }
 // The visible navigation label is not a content heading or canonical D1 name.
 // It can be changed on historical pages without changing their stable identity.
 function renameMenuLabel(db,page,label){
  if(!db?.pages?.includes(page))return {ok:false,error:'Page introuvable.'};
  const value=typeof label==='string'?label.trim():'';
  if(!value||value.length>95||/[\\\\\u0000-\u001f\u007f]/.test(value))
   return {ok:false,error:'Nom du menu invalide (1 à 95 caractères).'};
  const group=page.placement==='footer'?'footer':page.group;
  if(model.groupPages(db.pages,group).some(other=>other!==page&&
   String(other.menuLabel||other.name||'').trim().toLocaleLowerCase('fr')===value.toLocaleLowerCase('fr')))
   return {ok:false,error:'Un autre élément porte déjà ce nom dans ce menu.'};
  if((page.menuLabel||page.name)===value)return {ok:true,changed:false};
  // NEVER rewrite page.name or page.blocks. Both have distinct semantics.
  page.menuLabel=value;
  return {ok:true,changed:true};
 }
 function deletionPlan(db,page,celebrationId){
  if(!page||!db.pages.includes(page))return {allowed:false,general:false,siblings:[]};
  const {allowed,general}=model.removablePage(page,celebrationId);
  const siblings=model.groupPages(db.pages,page.placement==='footer'?'footer':page.group)
   .filter(p=>p!==page);
  // A footer can be empty. Other sections retain their existing last-page guard.
  return {allowed:allowed&&(page.placement==='footer'||siblings.length>0),general,siblings};
 }
 function removeConfirmedPage(db,page,currentId,plan){
  // Never call this before the caller has hidden a published page on the server.
  if(!plan?.allowed||!db.pages.includes(page))return null;
  if(plan.general&&db.siteHomeId===page.id)
   db.siteHomeId=plan.siblings.find(p=>p.id==='neutral-accueil-general')?.id||plan.siblings[0].id;
  db.pages=db.pages.filter(p=>p!==page);
  return currentId===page.id?(plan.siblings[0]?.id||db.siteHomeId||'neutral-accueil-general'):currentId;
 }
 function rememberDeletedPage(before,pageId){
  return [...new Set([...(Array.isArray(before?.deletedPageIds)?before.deletedPageIds:[]),pageId])].slice(-100);
 }
 return {restoreSharedPages,sharedSnapshot,moveGeneralPage,renameEditablePage,renameMenuLabel,
  deletionPlan,removeConfirmedPage,rememberDeletedPage};
}
