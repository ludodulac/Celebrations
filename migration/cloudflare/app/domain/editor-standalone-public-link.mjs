// M032 — Explicit public direct links for files owned by the ADMIN editor bucket.
// A celebration's visibility is not a file's publication decision.
// This module is shared by the authenticated command and the anonymous gateway,
// so every request rechecks private-page/space/category ownership before R2 reads.
// No automatic promotion of "unused" files or hidden celebration assets.
import {editorUploadPath} from './editor-upload-formats.mjs';
import {canAccessPolicy,ACCESS_MODES} from './member-access.mjs';
import {isPrivateMediaRecord,isPrivateMediaReference} from '../security/public-media-boundary.mjs';

const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key);
const object=value=>value!==null&&typeof value==='object';
const PRIVATE=new Set(['private','restricted']);
const publicPolicy=policy=>!policy||canAccessPolicy(policy)&&policy.mode===ACCESS_MODES.PUBLIC;

function references(value,src){
 if(!object(value))return typeof value==='string'&&value.includes(src);
 const visited=new WeakSet(),queue=[value];let scanned=0;
 while(queue.length){
  if(++scanned>250000)return true; // unknown/incomplete evidence => protected
  const item=queue.pop();
  if(typeof item==='string'){if(item.includes(src))return true;continue}
  if(!object(item)||visited.has(item))continue;
  visited.add(item);
  if(Array.isArray(item))queue.push(...item);
  else queue.push(...Object.values(item));
 }
 return false;
}
function restrictedPage(p){
 if(!object(p))return true;
 if(p.private===true||p.isPrivate===true||p.restricted===true||own(p,'spaceId'))return true;
 if(!publicPolicy(p.accessPolicy))return true;
 for(const v of [p.visibility,p.status,p.publicationStatus])
  if(PRIVATE.has(String(v||'').toLowerCase()))return true;
 return false;
}
function restrictedAudience(version){
 const aud=version?.audience;
 const scope=typeof aud==='string'?aud:aud?.scope;
 return scope!==undefined&&scope!=='PUBLIC'&&scope!=='public'&&scope!=='all';
}
function restrictedCelebration(state,cid){
 for(const pub of [state?.published,state]){
  const p=pub?.celebrationAccessPolicies?.[cid];
  if(p&&!publicPolicy(p))return true;
 }
 return false;
}
export function referencedByRestrictedOwner(state,src){
 if(!object(state)||!src)return true;
 for(const aggregate of [state,state.published]){
  for(const page of aggregate?.shared?.pages||[])
   if(restrictedPage(page)&&references(page,src))return true;
  for(const [cid,draft] of Object.entries(aggregate?.drafts||{})){
   const privateCelebration=restrictedCelebration(state,cid);
   for(const page of draft?.pages||[])
    if((privateCelebration||restrictedPage(page))&&references(page,src))return true;
   // Space membership and grants never imply permission to publish editor URLs.
   for(const space of draft?.spaces||[])
    if(references(space,src))return true;
  }
 }
 // Language variants have independent audiences. Do not let a French public
 // page accidentally release its image if a private variant also uses it.
 for(const collection of [state.celebrationMetadata,state.published?.celebrationMetadata]){
  for(const [cid,metadata] of Object.entries(collection||{})){
   for(const version of metadata?.versions||[])
    if((restrictedCelebration(state,cid)||restrictedAudience(version))&&references(version,src))
     return true;
  }
 }
 // Files belonging to canonical member-only drafts remain private even
 // when the old editor snapshot has no corresponding ordinary page.
 if(references(state.privateDrafts,src)||references(state.published?.privateDrafts,src))
  return true;
 return false;
}
export function standalonePublicLinkAllowed(state,entry){
 if(!object(entry)||entry.source!=='uploaded'||entry.publicLink!==true||
    !['image','pdf','audio','file'].includes(entry.type)||
    !editorUploadPath(entry.src)||isPrivateMediaReference(entry.src)||
    isPrivateMediaRecord(entry)||restrictedAudience(entry)||
    referencedByRestrictedOwner(state,entry.src))return false;
 return true;
}
export function canShareStandaloneMedia(state,entry){
 return standalonePublicLinkAllowed(state,{...entry,publicLink:true});
}
