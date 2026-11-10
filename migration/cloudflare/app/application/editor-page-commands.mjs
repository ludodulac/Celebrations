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
 return {restoreSharedPages,sharedSnapshot,moveGeneralPage,
  deletionPlan,removeConfirmedPage,rememberDeletedPage};
}
