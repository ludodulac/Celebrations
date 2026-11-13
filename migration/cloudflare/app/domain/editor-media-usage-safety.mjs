// M024: ONE conservative reference policy for editor media actions.
// There are no destructive side effects here. A missing/incomplete source of
// references is UNKNOWN, never a claim that a file is unused.
const object=x=>x!==null&&typeof x==='object';
const CAN_DELETE=new Set(['uploaded','link']);
const SNAPSHOT_ROOTS=['shared','drafts','published','localization','siteIdentity',
 'plans','celebrationMetadata','privateDrafts'];
export function referencesMedia(root,source){
 if(!source||typeof source!=='string')return true;
 const visited=new WeakSet(),pending=[root];
 let steps=0;
 while(pending.length){
  if(++steps>250000)return true; // Incomplete scan => fail closed.
  const item=pending.pop();
  if(typeof item==='string'){
   // Conservatively include cover, HTML/media embed and encoded reference text.
   if(item.includes(source))return true;
   continue;
  }
  if(!object(item)||visited.has(item))continue;
  visited.add(item);
  if(Array.isArray(item))pending.push(...item);
  else pending.push(...Object.values(item));
 }
 return false;
}
export function inSavedContent(state,source){
 if(!object(state)||!source)return true;
 // Do not search mediaCatalogue itself: it is the inventory entry, not a use.
 for(const key of SNAPSHOT_ROOTS)
  if(referencesMedia(state[key],source))return true;
 return false;
}
export async function readLegacyMediaReferences(db){
 if(!db||typeof db.prepare!=='function')return null;
 try{
  const data=await db.prepare('SELECT storage_path,cover_storage_path,external_url FROM celebrations_contents').all();
  if(!Array.isArray(data?.results))return null;
  const refs=new Set();
  for(const row of data.results)
   for(const key of ['storage_path','cover_storage_path','external_url']){
    const value=row?.[key];
    if(typeof value==='string'&&value)refs.add(value);
   }
  return refs;
 }catch{return null}
}
export function canSafelyDeleteMedia(entry,state,legacyRefs){
 if(!entry||!CAN_DELETE.has(entry.source)||entry.general||entry.publicLink===true||
    !entry.src||!(legacyRefs instanceof Set))return false;
 if(inSavedContent(state,entry.src))return false;
 // Legacy D1 data is a second authority; check both old paths and URLs.
 const src=entry.src,relative=src.startsWith('/media/')?src.slice('/media/'.length):src;
 const basename=relative.split('/').at(-1);
 for(const value of legacyRefs){
  if(value===src||value===relative||value.endsWith('/'+relative)||
     value===basename||value.endsWith('/'+basename))return false;
 }
 return true;
}
