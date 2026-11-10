// M009-C: a fail-closed namespace boundary for EVERY legacy public media surface.
// This is a deny rule, NOT a member entitlement decision. Future private files
// must live in PRIVATE_MEMBER_BUCKET and be served only through M008-C's
// handlePrivateMedia after checking the canonical published owner and grants.
// Keep this module independent of legacy audience labels: all/angel/nonangel
// are NEVER an authorization for an M002 private page or private file.
// Reuse M008-C's uniform 404 and private anti-cache headers (no new route).
export {privateNotFound as privatePublicAssetNotFound} from './member-private-access.mjs';
const PRIVATE_SEGMENT=/(?:^|\/)(?:private-members|private-member|member-private|members-private|private-media)(?:\/|$)/i;
export function isPrivateMediaReference(value){
 if(typeof value!=='string')return false;
 let current=value;
 for(let n=0;n<3;n++){
  if(PRIVATE_SEGMENT.test(current.replace(/\\/g,'/')))return true;
  try{
   const decoded=decodeURIComponent(current);
   if(decoded===current)break;
   current=decoded;
  }catch{return true;} // never guess access rights for malformed encodings
 }
 return PRIVATE_SEGMENT.test(current.replace(/\\/g,'/'));
}
export function isPrivateMediaRecord(record){
 if(!record||typeof record!=='object')return true;
 if(record.private===true||record.isPrivate===true)return true;
 if(record.visibility!==undefined&&!['public','published'].includes(record.visibility))return true;
 if(record.accessPolicy && record.accessPolicy.mode!=='PUBLIC')return true;
 return ['src','url','href','storage_path','cover_storage_path','external_url','storageKey']
   .some(name=>isPrivateMediaReference(record[name]));
}
export function publicMediaBindingsSafe(env){
 // Never allow a public gateway to read the private members' R2 binding,
 // even after a configuration error. Real bucket isolation is also mandatory.
 return !env?.PRIVATE_MEMBER_BUCKET ||
   (env.MEDIA_BUCKET!==env.PRIVATE_MEMBER_BUCKET &&
    env.EDITOR_BUCKET!==env.PRIVATE_MEMBER_BUCKET);
}
export function isBlockedPublicAssetPath(path){
 // Useful before ASSETS.fetch: files accidentally added to a public bundle
 // must not become private just because their menu links are hidden.
 return isPrivateMediaReference(path);
}
