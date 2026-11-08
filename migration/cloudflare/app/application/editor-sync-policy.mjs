// M10 — browser-side save policy. Pure functions are injected once into the
// nonce-protected editor client; no request, storage or UI side effect.
export function createEditorSyncPolicy(){
 const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
 function unchangedRemote(fresh,baseRecord,baseShared,basePlans){
  return same(fresh.record,baseRecord)&&same(fresh.shared,baseShared)&&
   same(fresh.plans,basePlans);
 }
 function noNewEdits(started,current){return started===current}
 function readbackConfirmed(saved,revision,pageId,record,shared){
  if(!saved||saved.revision<revision)return false;
  if(!pageId)return true;
  const expected=record.pages.find(p=>p.id===pageId)||
   shared.pages.find(p=>p.id===pageId);
  const actual=saved.record?.pages?.find(p=>p.id===pageId)||
   saved.shared?.pages?.find(p=>p.id===pageId);
  // A selected page cannot be declared saved if the server lost it.
  return !!expected&&!!actual&&same(expected.blocks,actual.blocks);
 }
 return {same,unchangedRemote,noNewEdits,readbackConfirmed};
}
