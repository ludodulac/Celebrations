// M027: one small canonical model for the desktop navigation label and
// visibility of PDFs belonging to the public editor's existing media library.
// Private-member media and arbitrary external URLs are NEVER controlled here.
export function navigationPreference(value){
 const raw=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 return {
  title:typeof raw.title==='string'?raw.title.trim().slice(0,110):'',
  position:['left','center','right'].includes(raw.position)?raw.position:'center'
 };
}
export function validNavigationPreference(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const normalized=navigationPreference(value);
 return typeof value.title==='string'&&value.title===normalized.title&&
  value.position===normalized.position;
}
export function managedPdfUrl(value){
 if(typeof value!=='string'||value.length>650||value.includes('?')||
    value.includes('#')||value.includes('\\')||value.includes('..'))return false;
 if(/^\/media\/new\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i.test(value))
  return true;
 // Legacy files may live below /media/media/<opaque namespace>/...
 return /^\/media\/(?!new\/|private-|private\/)[a-z0-9%_./-]+\.pdf$/i.test(value)&&
  !/%(?:2e|2f|5c|00)/i.test(value)&&
  !/(?:^|\/)(?:private-members|private-member|member-private|members-private|private-media)(?:\/|$)/i.test(value);
}
export function privatePdfSources(state){
 return Object.entries(state?.pdfPrivacy||{})
  .filter(([src,flag])=>flag===true&&managedPdfUrl(src))
  .map(([src])=>src);
}
export function pdfIsPrivate(state,src){
 return managedPdfUrl(src)&&state?.pdfPrivacy?.[src]===true;
}
export function withPdfPrivacy(previous,src,isPrivate){
 if(!managedPdfUrl(src)||typeof isPrivate!=='boolean')return null;
 const next={...(previous&&typeof previous==='object'?previous:{})};
 if(isPrivate)next[src]=true;
 else delete next[src]; // Public is the default; no extra flag.
 return next;
}
