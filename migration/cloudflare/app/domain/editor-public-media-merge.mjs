// M17 — Pure, ordered, public media catalogue deduplication.
// On repeated media IDs, the previous algorithm linearly rescanned every use
// (O(uses²)). Index uses on demand; keep first-file metadata, input order,
// first item duplicate uses, and strictly equal page/celebration IDs intact.
// No storage, network, publication, UI or persistent state.
export function mergePublicMediaIndexed(...catalogues){
 const merged=new Map(),seenByMedia=new Map();
 for(const item of catalogues.flat()){
  if(!item?.src||!['image','video','audio','pdf','file'].includes(item.type))continue;
  const id=item.type+'|'+item.src;
  if(!merged.has(id)){
   merged.set(id,{...item,id,uses:[...(item.uses||[])]});
   continue;
  }
  const existing=merged.get(id);
  // Normal page and celebration IDs are strings. A single key per pair is
  // faster and far smaller than creating a Map+Set for every page ID.
  // The length prefix makes collisions impossible even for unusual IDs.
  const identity=(pageId,celebrationId)=>pageId.length+':'+pageId+celebrationId;
  let seen=seenByMedia.get(id);
  if(!seen){
   seen=new Set();
   for(const use of existing.uses)
    if(typeof use.pageId==='string'&&typeof use.celebrationId==='string')
     seen.add(identity(use.pageId,use.celebrationId));
   seenByMedia.set(id,seen);
  }
  for(const use of item.uses||[]){
   if(typeof use.pageId==='string'&&typeof use.celebrationId==='string'){
    const key=identity(use.pageId,use.celebrationId);
    if(seen.has(key))continue;
    seen.add(key);
    existing.uses.push(use);
   }else{
    // Legacy data with numeric/missing/object IDs uses the original strict
    // equality semantics (including NaN !== NaN); never coerce those IDs.
    if(!existing.uses.some(u=>u.pageId===use.pageId&&
     u.celebrationId===use.celebrationId))existing.uses.push(use);
   }
  }
  if(item.general)existing.general=true;
 }
 return [...merged.values()];
}
