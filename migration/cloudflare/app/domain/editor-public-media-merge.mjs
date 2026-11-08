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
  let pages=seenByMedia.get(id);
  if(!pages){
   pages=new Map();
   for(const use of existing.uses){
    const pageId=use.pageId,celebrationId=use.celebrationId;
    if(Number.isNaN(pageId)||Number.isNaN(celebrationId))continue;
    let celebrations=pages.get(pageId);
    if(!celebrations){celebrations=new Set();pages.set(pageId,celebrations)}
    celebrations.add(celebrationId);
   }
   seenByMedia.set(id,pages);
  }
  for(const use of item.uses||[]){
   const pageId=use.pageId,celebrationId=use.celebrationId;
   // The previous algorithm uses strict equality, where NaN !== NaN.
   if(Number.isNaN(pageId)||Number.isNaN(celebrationId)){
    existing.uses.push(use);
    continue;
   }
   let celebrations=pages.get(pageId);
   if(celebrations?.has(celebrationId))continue;
   existing.uses.push(use);
   if(!celebrations){celebrations=new Set();pages.set(pageId,celebrations)}
   celebrations.add(celebrationId);
  }
  if(item.general)existing.general=true;
 }
 return [...merged.values()];
}
