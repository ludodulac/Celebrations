// Stable, human-readable URLs for uploads created after this feature is enabled.
// The underlying /media/new/<uuid> R2 key is immutable. Historic URLs are untouched.
const PREFIX={pdf:'doc',file:'doc',audio:'audio',image:'image'};
const EXT=/\.[a-z0-9]{1,8}$/i;
export function readableMediaPath(name,type,existing=[]){
 const prefix=PREFIX[type];
 if(!prefix)return null;
 const original=String(name||'').split(/[\\/]/).pop().slice(0,120);
 const ext=(original.match(EXT)||[])[0]?.toLowerCase()||'';
 const stem=(ext?original.slice(0,-ext.length):original)
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'fichier';
 const used=new Set(existing);
 let candidate='/'+prefix+'/'+stem+ext,number=0;
 while(used.has(candidate)){number++;candidate='/'+prefix+'/'+stem+'-'+number+ext}
 return candidate;
}
export function isReadableMediaPath(path){
 return /^\/(?:doc|audio|image)\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]{1,8})?$/.test(path);
}
