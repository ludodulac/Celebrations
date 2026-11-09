// M11: history policy for exactly one local user action. No database, browser
// storage or network. Publication/visibility are never restored by Ctrl+Z.
export function createEditorUndoPolicy({steps=36,bytes=6000000}={}){
 function snapshot(db){
  return JSON.stringify({pages:db.pages,siteHomeId:db.siteHomeId??null,
   celebrationDates:db.celebrationDates??null,
   celebrationTimes:db.celebrationTimes??null});
 }
 function record(stack,anchor,current,field,now,lastTyping,lastTypedAt){
  if(anchor===null)return {anchor:current,lastTyping,lastTypedAt};
  if(current===anchor)return {anchor,lastTyping,lastTypedAt};
  const continuous=!!field&&field===lastTyping&&now-lastTypedAt<1000&&stack.length>0;
  if(!continuous){
   stack.push(anchor);
   let used=stack.reduce((n,part)=>n+part.length,0);
   while(stack.length>steps||used>bytes){used-=stack.shift()?.length||0}
  }
  return {anchor:current,lastTyping:field,lastTypedAt:now};
 }
 function restorePages(previous,currentPages){
  // Remote visibility is not part of local undo, including implicit published
  // status on legacy pages. A restored deleted page is private by default.
  const visibility=new Map(currentPages.map(page=>[String(page.id),{
   defined:Object.hasOwn(page,'visibility'),value:page.visibility
  }]));
  return previous.map(page=>{
   const restored={...page},current=visibility.get(String(page.id));
   if(!current)restored.visibility='draft';
   else if(current.defined)restored.visibility=current.value;
   else delete restored.visibility;
   return restored;
  });
 }
 return {snapshot,record,restorePages};
}
