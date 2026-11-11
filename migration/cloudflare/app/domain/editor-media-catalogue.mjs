// M08: shared media catalogue and type/selection rules, with no DOM, network,
// storage, publication or automatic changes to saved records.
export function createMediaCatalogue({validHref}){
 const categories=[['images','Images'],['pdf','PDF'],['audios','Audios'],['videos','Vidéos'],['autres','Autres']];
 const supported=new Set(categories.map(row=>row[0]));
 function categoryOfLocal(record){
  const type=String(record.type||'').toLowerCase(),name=String(record.name||'').toLowerCase();
  if(type.startsWith('image/')||/\.(?:png|jpg|jpeg|gif|webp|svg|avif)$/.test(name))return 'images';
  if(type==='application/pdf'||/\.pdf$/.test(name))return 'pdf';
  if(type.startsWith('audio/')||/\.(?:mp3|wav|m4a|ogg|opus|flac)$/.test(name))return 'audios';
  // Preserve current local-demo behaviour. Video uploads to the real server
  // are not enabled by this refactor, and local video remains 'autres'.
  return 'autres';
 }
 function mediaCategoryOf(record){
  return ({image:'images',video:'videos',pdf:'pdf',audio:'audios',file:'autres',link:'links'})[record.type]||'autres';
 }
 function publicFiles(files){
  return Array.isArray(files)?files.filter(record=>record&&
   supported.has(record.category)&&typeof record.name==='string'&&
   /^\/media\/(?!.*\.\.)[^?#]+$/i.test(String(record.src||''))):[];
 }
 function fileKey(record){
  return String(record.category)+':'+String(record.src||record.remoteKey||record.assetId||record.id);
 }
 function fileUses(record){
  return (record.uses||[]).slice().sort((a,b)=>a.name.localeCompare(b.name,'fr')||a.pageName.localeCompare(b.pageName,'fr'));
 }
 function pickerItems(historical,remote){
  const entries=new Map();
  const add=(record,type)=>{
   const src=String(record?.src||'').trim();
   if(!validHref(src))return;
   const category=supported.has(type)?type:'autres';
   const name=String(record.name||src.split('/').at(-1)||'Fichier').slice(0,200);
   if(!entries.has(src))entries.set(src,{src,name,category});
  };
  for(const record of historical||[])add(record,record.category);
  for(const record of remote||[])add(record,mediaCategoryOf(record));
  return [...entries.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr'));
 }
 function imageItems({historical,pages,globalMedia,fileRecords,assetUrls}){
  const entries=new Map(),pageImages=[];
  for(const file of historical||[])if(file?.category==='images'&&
   /^\/media\//.test(String(file.src||''))&&file.src&&!entries.has(file.src))
   entries.set(file.src,{name:file.name,src:file.src});
  function gather(blocks){
   for(const item of blocks||[]){
    if(item?.kind==='image'&&typeof item.src==='string'&&item.src)
     pageImages.push({src:item.src,name:item.text||'Image'});
    if(item?.kind==='section')for(const col of item.columns||[])gather(col);
   }
  }
  for(const page of pages||[])gather(page.blocks);
  for(const image of pageImages)if(image.src&&!entries.has(image.src))
   entries.set(image.src,{name:image.name,src:image.src});
  for(const item of globalMedia||[])if(item.type==='image'&&item.src&&!entries.has(item.src))
   entries.set(item.src,{name:item.name,src:item.src});
  const local=[];
  for(const item of fileRecords||[])if(categoryOfLocal(item)==='images')
   local.push({name:item.name,src:assetUrls.get(item.id)||'',assetId:item.id});
  return {entries:[...entries.values()],local};
 }
 function libraryCollections(historical,fileRecords,globalMedia){
  // Same three source families as before: R2/D1 historical, local IndexedDB,
  // server mediaCatalogue. Historical URLs take display precedence.
  const local=[...fileRecords].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const remote=(globalMedia||[]).filter(item=>['image','pdf','audio','video','file'].includes(item?.type));
  const usedUrls=new Set(historical.map(item=>item.src));
  const countFor=category=>historical.filter(item=>item.category===category).length+
   local.filter(item=>categoryOfLocal(item)===category).length+
   remote.filter(item=>mediaCategoryOf(item)===category&&!usedUrls.has(item.src)).length;
  return {local,remote,usedUrls,countFor};
 }
 function makeLibraryBlock(record,time,id){
  const category=record.category,kind=category==='images'?'image':category==='audios'?'audio':
   category==='videos'?'video':category==='autres'&&typeof record.text==='string'?'text':'button';
  const block={id,kind,align:'left',
   text:kind==='text'?record.text:kind==='button'?'Ouvrir : '+record.name:record.name};
  if(record.remoteKey)block.remoteKey=record.remoteKey;
  else if(record.assetId)block.assetId=record.assetId;
  else if(kind==='image'||kind==='audio')block.src=record.src;
  else if(kind==='button'||kind==='video')block.href=record.src;
  if(time)block.atTime=time;
  return block;
 }
 return {categories,categoryOfLocal,mediaCategoryOf,publicFiles,fileKey,fileUses,
  pickerItems,imageItems,libraryCollections,makeLibraryBlock};
}
