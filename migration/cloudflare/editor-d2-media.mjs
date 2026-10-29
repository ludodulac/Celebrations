// Mission D2: admin-preview media proxy, read-only existing R2.
// A historical content ID is required; raw R2 object keys are NEVER accepted.
// Explicit ACL revocation wins even for administrators; committee PDFs stay in
// the original unlisted /letter/<slug> gateway, never exposed here.
import {canPreview} from './editor-d-preview.mjs';
const HOST='celebrations-exit-staging.rondes.workers.dev';
const json=(s,status)=>new Response(JSON.stringify({error:s}),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-robots-tag':'noindex,nofollow'}});
const allowedKey=k=>typeof k==='string'&&k.length>0&&k.length<1024&&!k.startsWith('/')&&!k.startsWith('committee/')&&!k.split('/').some(p=>!p||p==='..'||p==='.')&&!/[\\\u0000-\u001f]/.test(k);
const MIMES=new Set(['image/png','image/jpeg','image/gif','image/webp','image/avif','audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/aac','video/mp4','video/webm','video/quicktime','application/pdf','text/plain']);
export async function handleEditorDMedia(request,env){
 const u=new URL(request.url);
 if(u.hostname!==HOST||u.pathname!=='/__editor/media')return json('Not found',404);
 if(request.method!=='GET'&&request.method!=='HEAD')return json('Method not allowed',405);
 if(!env.DB||!env.MEDIA_BUCKET||!env.MEDIA_ACL)return json('Unavailable',503);
 if(!await canPreview(request,env))return json('Authentication required',401);
 const id=u.searchParams.get('id');
 const cover=u.searchParams.get('cover')==='1';
 const asset=u.searchParams.get('asset');
 if(asset&&asset!=='welcome')return json('Not found',404);
 if(!asset&&(!id||id.length>160))return json('Not found',404);
 // Exact staging welcome key, no untrusted R2 path parameter.
 const item=asset==='welcome'
  ?{id:'staging-welcome',source_type:'file',storage_path:'media/celebrations-staging-welcome-autumn-2026.jpg',mime_type:'image/jpeg'}
  :await env.DB.prepare('SELECT id,source_type,storage_path,cover_storage_path,mime_type,content_type FROM celebrations_contents WHERE id=?').bind(id).first();
 if(!item)return json('Not found',404);
 if(!cover&&item.source_type!=='file')return json('Not found',404);
 const key=cover?item.cover_storage_path:item.storage_path;
 if(!allowedKey(key))return json('Not found',404);
 const acl=await env.MEDIA_ACL.prepare('SELECT approved,revoked_at FROM public_media WHERE storage_path=?').bind(key).first();
 if(acl&&(acl.approved!==1||acl.revoked_at))return json('Not found',404);
 const range=request.headers.get('range');
 if(range&&!/^bytes=\d*-\d*$/.test(range))return json('Invalid range',416);
 let obj;
 try{obj=await env.MEDIA_BUCKET.get(key,range?{range:request.headers}:undefined)}catch{return json('Media unavailable',502)}
 if(!obj)return json('Not found',404);
 const headers=new Headers();
 obj.writeHttpMetadata?.(headers);
 const mime=(headers.get('content-type')||item.mime_type||'').split(';')[0].trim().toLowerCase();
 const mimeSafe=MIMES.has(mime)?mime:'application/octet-stream';
 headers.set('content-type',mimeSafe);
 headers.set('cache-control','no-store');
 headers.set('x-robots-tag','noindex,nofollow,noarchive');
 headers.set('x-content-type-options','nosniff');
 headers.set('referrer-policy','no-referrer');
 headers.set('content-security-policy',"default-src 'none'; sandbox");
 headers.set('accept-ranges','bytes');
 if(mimeSafe==='application/octet-stream')headers.set('content-disposition','attachment');
 if(range&&obj.range){
  const offset=obj.range.offset??0, len=obj.range.length??obj.size;
  headers.set('content-range','bytes '+offset+'-'+(offset+len-1)+'/'+obj.size);
  headers.set('content-length',String(len));
 }else headers.set('content-length',String(obj.size));
 return new Response(request.method==='HEAD'?null:obj.body,{status:range&&obj.range?206:200,headers});
}
