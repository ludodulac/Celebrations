// M011-B — read-only canonical published content from the EXISTING editor R2
// snapshot. Not imported by any live Worker. No D1/R2 writes or draft fallbacks.
// A publishedRevision alone does not release copied M005 drafts: each private
// page/space/media MUST also carry its own explicit publicationStatus.
import {readEditorSnapshot} from '../adapters/editor-r2-repository.mjs';
import {ACCESS_MODES, SPACE_VISIBILITIES, isMemberTypeId}
  from '../domain/member-access.mjs';
import {isPrivateMediaReference} from '../security/public-media-boundary.mjs';

const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const obj=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
const stable=s=>typeof s==='string'&&s.length>0&&s.length<=254&&s.trim()===s;
const cid=s=>typeof s==='string'&&/^[1-9][0-9]{0,7}$/.test(s);
const safeKey=s=>typeof s==='string'&&s.length<1024&&
  /^private-members\/[A-Za-z0-9._/-]+$/.test(s)&&
  s.split('/').every(p=>p&&p!=='.'&&p!=='..')&&!isPrivateMediaReference(s.replace(/^private-members\//,''));
const released=x=>obj(x)&&x.visibility==='published'&&
  x.publicationStatus==='published'&&x.published!==false&&
  x.isPublished!==false&&x.status!=='draft'&&x.status!=='hidden';
const policy=x=>obj(x)&&(x.mode===ACCESS_MODES.PUBLIC||
  x.mode===ACCESS_MODES.ALL_PRIVATE_TYPES||
  (x.mode===ACCESS_MODES.SELECTED_TYPES&&Array.isArray(x.typeIds)&&
    x.typeIds.length>0&&x.typeIds.every(isMemberTypeId)));

function releasedPage(page,celebrationId,spaceId) {
  return released(page)&&stable(page.id)&&Array.isArray(page.blocks)&&
    page.celebrationId===celebrationId&&policy(page.accessPolicy)&&
    (spaceId ? page.spaceId===spaceId : !own(page,'spaceId'));
}
function releasedSpace(space,celebrationId) {
  return obj(space)&&stable(space.id)&&space.celebrationId===celebrationId&&
    space.publicationStatus==='published'&&space.published!==false&&
    (space.visibility===SPACE_VISIBILITIES.PRIVATE||
      space.visibility===SPACE_VISIBILITIES.PUBLIC)&&policy(space.accessPolicy)&&
    (space.visibility!==SPACE_VISIBILITIES.PUBLIC||
      space.accessPolicy.mode===ACCESS_MODES.PUBLIC)&&Array.isArray(space.pages);
}
function makeIndex(state) {
  const published=state?.published;
  if(!obj(published)||!Number.isSafeInteger(state.publishedRevision)||
      state.publishedRevision<1||!obj(published.drafts)||
      !obj(published.celebrationVisibility))return null;

  const pages=new Map(),spaces=new Map(),media=new Map();
  const duplicatePages=new Set(),duplicateSpaces=new Set(),duplicateMedia=new Set();
  const put=(index,duplicates,id,value)=>{
    if(!stable(id))return;
    if(index.has(id)){duplicates.add(id);index.delete(id);}
    else if(!duplicates.has(id))index.set(id,value);
  };
  // Even an unpublished sibling with a repeated ID invalidates the lookup.
  // Otherwise a copied/draft object could borrow another page's canonical ID.
  const seenPages=new Set(),seenSpaces=new Set();
  const observe=(seen,duplicates,id)=>{
    if(!stable(id))return;
    if(seen.has(id))duplicates.add(id);
    seen.add(id);
  };
  let examined=0;
  for(const [celebrationId,record] of Object.entries(published.drafts)){
    if(!cid(celebrationId)||!obj(record))continue;
    const visible=published.celebrationVisibility[celebrationId]==='published';
    for(const page of Array.isArray(record.pages)?record.pages:[]){
      if(++examined>10000)throw Error('Canonical snapshot too large');
      observe(seenPages,duplicatePages,page?.id);
      if(visible&&releasedPage(page,celebrationId,null))
        put(pages,duplicatePages,page.id,page);
    }
    for(const space of Array.isArray(record.spaces)?record.spaces:[]){
      if(++examined>10000)throw Error('Canonical snapshot too large');
      observe(seenSpaces,duplicateSpaces,space?.id);
      const spaceOK=visible&&releasedSpace(space,celebrationId);
      if(spaceOK)put(spaces,duplicateSpaces,space.id,space);
      for(const page of Array.isArray(space?.pages)?space.pages:[]){
        if(++examined>10000)throw Error('Canonical snapshot too large');
        observe(seenPages,duplicatePages,page?.id);
        if(spaceOK&&releasedPage(page,celebrationId,space.id))
          put(pages,duplicatePages,page.id,page);
      }
    }
  }
  // Shared pages have no canonical M005 celebration ownership, therefore
  // cannot become private member pages by mere page ID or accessPolicy.
  for(const page of published.shared?.pages??[])
    observe(seenPages,duplicatePages,page?.id);
  for(const id of duplicatePages)pages.delete(id);
  for(const id of duplicateSpaces)spaces.delete(id);
  // Eliminate orphaned or cross-celebration space pages even if they were
  // valid when scanned (e.g. two spaces with a colliding permanent ID).
  for(const [id,page] of pages)
    if(page.spaceId&&(!spaces.has(page.spaceId)||
       spaces.get(page.spaceId).celebrationId!==page.celebrationId))
      pages.delete(id);

  // Private files have an EXPLICIT, published manifest distinct from the
  // old public mediaCatalogue and from the editor draft. Never derive R2
  // keys from arbitrary block URL, translated text, or URL query params.
  for(const item of Array.isArray(published.privateMedia)?published.privateMedia:[]){
    if(++examined>10000)throw Error('Canonical snapshot too large');
    const id=item?.id;
    if(!stable(id))continue;
    if(media.has(id)||duplicateMedia.has(id)){
      duplicateMedia.add(id);media.delete(id);continue;
    }
    if(!obj(item)||item.visibility!=='private'||
        item.publicationStatus!=='published'||!stable(item.pageId)||
        !cid(item.celebrationId)||!safeKey(item.storageKey)||
        !item.storageKey.startsWith('private-members/'+item.celebrationId+'/')||
        !stable(item.mimeType)||item.mimeType.length>120)continue;
    const page=pages.get(item.pageId);
    if(!page||page.celebrationId!==item.celebrationId||
        (page.spaceId??null)!==(item.spaceId??null))continue;
    if(!pageReferencesMedia(page.blocks,id))continue;
    media.set(id,{id,visibility:'private',publicationStatus:'published',
      pageId:page.id,storageKey:item.storageKey,mimeType:item.mimeType});
  }
  return {published,pages,spaces,media};
}
function pageReferencesMedia(blocks,id,depth=0){
  if(!Array.isArray(blocks)||depth>12)return false;
  return blocks.some(block=>obj(block)&&(block.mediaId===id||
    (block.kind==='section'&&Array.isArray(block.columns)&&
      block.columns.some(col=>pageReferencesMedia(col,id,depth+1)))));
}

// Snapshot read is lazy and memoized PER request, never across identities or
// successive HTTP requests. A D1 revocation is still checked on every gate.
export function createCanonicalPrivateLoaders(env) {
  let pending;
  const index=()=>{
    if(!pending)pending=(async()=>{
      if(!env?.EDITOR_BUCKET||typeof env.EDITOR_BUCKET.get!=='function')
        throw Error('Editorial R2 binding unavailable');
      const {state}=await readEditorSnapshot(env.EDITOR_BUCKET,{
        empty:()=>null,requireBody:true,
        validate:x=>x===null||obj(x)
      });
      return makeIndex(state);
    })();
    return pending;
  };
  return Object.freeze({
    async loadPublishedPage(id){
      const data=await index();
      return stable(id)?data?.pages.get(id)??null:null;
    },
    async loadPublishedSpace(id){
      const data=await index();
      return stable(id)?data?.spaces.get(id)??null:null;
    },
    async loadPrivateMedia(id){
      const data=await index();
      return stable(id)?data?.media.get(id)??null:null;
    },
    async candidatePageIds(celebrationId){
      const data=await index();
      return cid(celebrationId)&&data
        ?[...data.pages.values()].filter(p=>p.celebrationId===celebrationId).map(p=>p.id)
        :[];
    },
    async publishedLanguageData(){
      const data=await index();
      return data?{languageRegistry:data.published.languageRegistry,
        privateTranslationReleases:data.published.privateTranslationReleases}:null;
    }
  });
}
