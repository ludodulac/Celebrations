// M12 — Data boundary between admin drafts and the public website.
// Pure functions, no localStorage, no fetch, no DOM and no publication writes.
export function createPublicVisitorModel(){
 function published(page,ids){
  return !!page&&Array.isArray(ids)&&ids.some(id=>String(id)===String(page.id));
 }
 function assetIds(pages){
  const found=new Set();
  function walk(items){
   for(const item of items||[]){
    if(!item||typeof item!=='object')continue;
    for(const field of ['assetId','coverAssetId'])
     if(typeof item[field]==='string'&&item[field])found.add(item[field]);
    if(item.kind==='section')for(const col of item.columns||[])
     if(Array.isArray(col))walk(col);
   }
  }
  for(const page of pages||[])walk(page.blocks);
  return found;
 }
 function publicSnapshot(result){
  if(result?.ok!==true||!Array.isArray(result.shared?.pages))return null;
  return {
   record:result.record||null,shared:result.shared,
   plans:Array.isArray(result.plans)?result.plans:[],
   ids:[...(result.record?.pages||[]),...result.shared.pages].map(page=>page.id),
   visible:result.celebrationVisible===true,
   visibility:result.celebrationVisibility||{},
   media:Array.isArray(result.media)?result.media:[]
  };
 }
 return {published,assetIds,publicSnapshot};
}
