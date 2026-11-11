import {ACCESS_MODES} from '../domain/member-access.mjs';
import {isPrivateMediaReference} from './public-media-boundary.mjs';
const own=(x,k)=>Object.hasOwn(x??{},k);
export function managedPage(p){
 return !!p&&(p.privateManaged===true||own(p,'spaceId')||p.private===true||
  p.isPrivate===true||p.restricted===true||
  ['private','restricted'].includes(p.visibility)||['private','restricted'].includes(p.status)||
  ['private','restricted'].includes(p.publicationStatus)||
  own(p,'accessPolicy')&&(p.accessPolicy?.mode!==ACCESS_MODES.PUBLIC||
   Object.keys(p.accessPolicy??{}).some(k=>k!=='mode')));
}
export function managedCelebration(state,id){
 return !!state.published?.privateReleaseRevisions?.[id]||
  [state.drafts?.[id],state.published?.drafts?.[id]].some(r=>
   (r?.spaces?.length??0)>0||(r?.pages??[]).some(managedPage));
}
export function managedPageId(state,cid,id){
 return [...Object.values(state.drafts??{}),...Object.values(state.published?.drafts??{}),state.shared,state.published?.shared]
  .some(r=>r?.pages?.some(p=>p.id===id&&managedPage(p)))||
  !!state.published?.privatePageReleases?.[id];
}
export function legacyRecord(record){
 if(!record)return record;
 const {spaces,...rest}=record;
 return {...rest,pages:(record.pages??[]).filter(p=>!managedPage(p))};
}
export function mergeLegacyRecord(previous,incoming){
 if(own(incoming,'spaces')||incoming.pages.some(managedPage))
  throw Error('D1 private editor required');
 const held=(previous?.pages??[]).filter(managedPage);
 if(incoming.pages.some(p=>held.some(h=>h.id===p.id)))
  throw Error('D1 private editor required');
 return {...incoming,pages:[...incoming.pages,...held],
  ...(own(previous,'spaces')?{spaces:previous.spaces}:{})};
}
export function legacyEditorView(state){
 const drafts=Object.fromEntries(Object.entries(state.drafts??{}).map(([id,r])=>[id,legacyRecord(r)]));
 const shared=legacyRecord(state.shared),hidden=new Set();
 for(const r of [state.shared,...Object.values(state.drafts??{})]){
  for(const p of r?.pages??[])if(managedPage(p))hidden.add(p.id);
  for(const s of r?.spaces??[])for(const p of s.pages??[])hidden.add(p.id);
 }
 const localization=state.localization?{...state.localization,pages:Object.fromEntries(
  Object.entries(state.localization.pages??{}).filter(([id])=>!hidden.has(id)))}:null;
 return {...state,drafts,shared,localization,
  mediaCatalogue:(state.mediaCatalogue??[]).filter(m=>!isPrivateMediaReference(m?.src??'')&&!managedPage(m)),
  published:state.published?{...state.published,
   drafts:Object.fromEntries(Object.entries(state.published.drafts??{}).map(([id,r])=>[id,legacyRecord(r)])),
   shared:legacyRecord(state.published.shared)}:undefined};
}
