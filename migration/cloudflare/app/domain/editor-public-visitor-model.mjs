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
  const managedId=(id,kind)=>typeof id==='string'&&new RegExp('^'+kind+':[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$').test(id);
  const spaces=(Array.isArray(result.record?.spaces)?result.record.spaces:[]).flatMap(s=>{
   if(!s||!managedId(s.id,'space')||s.visibility!=='PUBLIC'||s.publicationStatus!=='published'||typeof s.name!=='string')return [];
   const pages=(Array.isArray(s.pages)?s.pages:[]).filter(p=>visible(p)&&p.visibility==='published'&&
    managedId(p.id,'page')&&p.group==='celebration'&&Array.isArray(p.blocks)&&!Object.hasOwn(p,'accessPolicy')&&!Object.hasOwn(p,'spaceId'));
   return pages.length?[{id:s.id,name:s.name,pages}]:[];
  });
  const {spaces:ignoredSpaces,...recordFields}=result.record||{};
  const record=result.record?{...recordFields,
   pages:(Array.isArray(result.record.pages)?result.record.pages:[]).filter(visible),...(spaces.length?{spaces}:{})}:null;
  return {
   record,shared,
   plans:Array.isArray(result.plans)?result.plans:[],
   ids:[...(record?.pages||[]),...shared.pages,...spaces.flatMap(s=>s.pages)].map(page=>page.id),
   visible:result.celebrationVisible===true,
   visibility:result.celebrationVisibility||{},
   media:Array.isArray(result.media)?result.media:[]
  };
 }
 return {published,assetIds,publicSnapshot};
}
