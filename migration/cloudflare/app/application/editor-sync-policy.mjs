// M045 — pure optimistic collaboration policy. Never overwrite changes made
// on another computer, including edits to a different page of one celebration.
export function createEditorSyncPolicy(){
 const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null);
 const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key);
 const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const uniquePages=pages=>Array.isArray(pages)&&pages.every(p=>object(p)&&typeof p.id==='string'&&p.id)&&new Set(pages.map(p=>p.id)).size===pages.length;
 function choose(base,local,remote,path,conflicts){
  if(same(local,base))return remote;
  if(same(remote,base)||same(local,remote))return local;
  conflicts.push(path);
  return remote;
 }
 function mergePages(base,local,remote,path,conflicts){
  if(!uniquePages(base)||!uniquePages(local)||!uniquePages(remote)){
   conflicts.push(path+' (identifiants de pages invalides)');return remote;
  }
  const m=xs=>new Map(xs.map(p=>[p.id,p]));
  const bm=m(base),lm=m(local),rm=m(remote),merged=new Map();
  for(const id of new Set([...bm.keys(),...lm.keys(),...rm.keys()])){
   const page=choose(bm.get(id),lm.get(id),rm.get(id),path+'/'+id,conflicts);
   if(page!==undefined)merged.set(id,page);
  }
  // Detect contradictory reorders of existing pages without rejecting
  // independent additions or edits on different pages.
  const common=new Set([...bm.keys()].filter(id=>lm.has(id)&&rm.has(id)));
  const order=xs=>xs.map(p=>p.id).filter(id=>common.has(id));
  const before=order(base),left=order(local),right=order(remote);
  const localOrderChanged=!same(left,before),remoteOrderChanged=!same(right,before);
  if(localOrderChanged&&remoteOrderChanged&&!same(left,right))
   conflicts.push(path+' (ordre des pages modifié simultanément)');
  const orderSource=localOrderChanged&&!remoteOrderChanged?local:remote;
  const result=[],seen=new Set();
  for(const p of [...orderSource,...remote,...local]){
   if(merged.has(p.id)&&!seen.has(p.id)){
    seen.add(p.id);result.push(merged.get(p.id));
   }
  }
  return result;
 }
 function mergeFields(base,local,remote,path,conflicts,kind='object'){
  if(!object(base)||!object(local)||!object(remote)){
   return choose(base,local,remote,path,conflicts);
  }
  const result={};
  for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
   const b=base[key],l=local[key],r=remote[key],at=path+'/'+key;
   let value;
   if(key==='pages'&&(kind==='record'||kind==='shared'))
    value=mergePages(b,l,r,at,conflicts);
   else if(key==='pages'&&kind==='localization')
    value=mergeTranslations(b,l,r,at,conflicts);
   else value=choose(b,l,r,at,conflicts);
   if(value!==undefined)result[key]=value;
  }
  return result;
 }
 function mergeTranslations(base,local,remote,path,conflicts){
  if(!object(base)||!object(local)||!object(remote))
   return choose(base,local,remote,path,conflicts);
  const result={};
  for(const pageId of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
   // Different languages on the same page can be edited independently.
   const merged=mergeFields(base[pageId],local[pageId],remote[pageId],path+'/'+pageId,conflicts);
   if(merged!==undefined)result[pageId]=merged;
  }
  return result;
 }
 function mergeSnapshots(base,local,remote){
  if(!base||!local||!remote)return {ok:false,conflicts:['Version de référence indisponible']};
  const conflicts=[];
  const record=mergeFields(base.record,local.record,remote.record,'célébration',conflicts,'record');
  const shared=mergeFields(base.shared,local.shared,remote.shared,'pages générales',conflicts,'shared');
  const plans=choose(base.plans,local.plans,remote.plans,'cycles',conflicts);
  const localization=mergeFields(base.localization??null,local.localization??null,
   remote.localization??null,'traductions',conflicts,'localization');
  return {ok:conflicts.length===0,conflicts,record,shared,plans,localization};
 }
 function unchangedRemote(fresh,baseRecord,baseShared,basePlans,baseLocalization){
  return same(fresh.record,baseRecord)&&same(fresh.shared,baseShared)&&
   same(fresh.plans,basePlans)&&
   (arguments.length<5||same(fresh.localization??null,baseLocalization??null));
 }
 function noNewEdits(started,current){return started===current}
 function readbackConfirmed(saved,revision,pageId,record,shared,localization,plans){
  if(!saved||!Number.isSafeInteger(revision)||!Number.isSafeInteger(saved.revision)||
     saved.revision<revision)return false;
  if(arguments.length>=6&&!same(saved.localization??null,localization??null))return false;
  if(arguments.length>=7&&!same(saved.plans,plans))return false;
  const check=(expected,actual)=>Array.isArray(expected)&&Array.isArray(actual)&&
   expected.every(p=>actual.some(a=>a.id===p.id&&same(a.blocks,p.blocks)&&same(a.name,p.name)));
  if(!check(record.pages,saved.record?.pages)||!check(shared.pages,saved.shared?.pages))return false;
  if(pageId){
   const expected=record.pages.find(p=>p.id===pageId)||shared.pages.find(p=>p.id===pageId);
   if(!expected)return false;
  }
  return true;
 }
 return {same,unchangedRemote,mergeSnapshots,noNewEdits,readbackConfirmed};
}
