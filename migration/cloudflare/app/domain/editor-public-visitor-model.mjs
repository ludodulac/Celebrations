// M12 — Data boundary between admin drafts and the public website.
// Pure functions, no localStorage, no fetch, no DOM and no publication writes.
export function createPublicVisitorModel(){
 function published(page,ids){
  return !!page&&page.visibility!=='draft'&&page.visibility!=='hidden'&&
   Array.isArray(ids)&&ids.some(id=>String(id)===String(page.id));
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
  // Defence in depth: exclude any hidden/draft page even if an upstream
  // public endpoint accidentally includes it. Never modify R2 data objects.
  const visible=p=>p&&p.visibility!=='draft'&&p.visibility!=='hidden';
  const shared={...result.shared,pages:result.shared.pages.filter(visible)};
  const record=result.record?{...result.record,
   pages:(Array.isArray(result.record.pages)?result.record.pages:[]).filter(visible)}:null;
  return {
   record,shared,
   plans:Array.isArray(result.plans)?result.plans:[],
   ids:[...(record?.pages||[]),...shared.pages].map(page=>page.id),
   visible:result.celebrationVisible===true,
   visibility:result.celebrationVisibility||{},
   media:Array.isArray(result.media)?result.media:[]
  };
 }
 return {published,assetIds,publicSnapshot};
}
