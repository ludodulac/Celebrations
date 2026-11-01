// STAGING ONLY — authenticated audio workshop. Never uses the production bucket.
// R2 is the source of truth: the inventory lists real objects, never just a local cache.
import {authorize} from './auth-api.mjs';

const HOST='celebrations-exit-staging.rondes.workers.dev';
const ROOT='editor-trials/audio/';
const MAX=300*1024*1024; // 300 MiB
const PART=10*1024*1024; // 10 MiB; R2 multipart non-final parts must be >=5 MiB.
const keyOk=v=>typeof v==='string'&&/^editor-trials\/audio\/[0-9a-f-]{36}\.mp3$/.test(v);
const uploadOk=v=>typeof v==='string'&&v.length>=8&&v.length<=300&&/^[a-zA-Z0-9_./=+:-]+$/.test(v);
const json=(payload,status=200)=>Response.json(payload,{status,headers:{'cache-control':'no-store','x-robots-tag':'noindex,nofollow,noarchive','x-content-type-options':'nosniff'}});
const fail=(error,status)=>json({ok:false,error},status);
const secure={'cache-control':'no-store','x-robots-tag':'noindex,nofollow,noarchive','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const nameOk=v=>typeof v==='string'&&v.trim().length>0&&v.length<=180&&!/[\x00-\x1f\x7f]/.test(v)&&/\.mp3$/i.test(v.trim());
async function admin(request,env){
 if(!env.DB)return false;
 try{return !!await authorize(request,env,true)}catch{return false}
}
async function fromStreamCookie(request,env){
 const raw=(request.headers.get('cookie')||'').match(/(?:^|;\s*)staging_audio_token=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(!raw)return false;
 const headers=new Headers(request.headers);headers.set('authorization','Bearer '+raw);
 return admin(new Request(request,{headers}),env);
}
function streamHeaders(obj,request){
 const headers=new Headers(secure);
 headers.set('content-type','audio/mpeg');
 headers.set('accept-ranges','bytes');
 headers.set('content-disposition','inline');
 if(obj.httpEtag)headers.set('etag',obj.httpEtag);
 const range=request.headers.get('range');
 if(range&&obj.range){
  const offset=obj.range.offset??0,length=obj.range.length??obj.size;
  headers.set('content-range','bytes '+offset+'-'+(offset+length-1)+'/'+obj.size);
  headers.set('content-length',String(length));
 }else headers.set('content-length',String(obj.size));
 return headers;
}
export async function handleTrialAudio(request,env){
 const url=new URL(request.url),action=url.searchParams.get('action')||'';
 if(url.hostname!==HOST||url.pathname!=='/api/editor-trial-audio')return fail('Introuvable',404);
 if(!env.MEDIA_BUCKET||!env.DB)return fail('Bibliothèque staging indisponible',503);
 if((action==='stream')&&(request.method==='GET'||request.method==='HEAD')){
  if(!await fromStreamCookie(request,env))return fail('Connexion administrateur requise',401);
  const key=url.searchParams.get('key');
  if(!keyOk(key))return fail('Fichier indisponible',404);
  const range=request.headers.get('range');
  if(range&&!/^bytes=\d*-\d*$/.test(range))return fail('Plage invalide',416);
  try{
   const obj=await env.MEDIA_BUCKET.get(key,range?{range:request.headers}:undefined);
   if(!obj)return fail('Fichier introuvable',404);
   return new Response(request.method==='HEAD'?null:obj.body,{status:range&&obj.range?206:200,headers:streamHeaders(obj,request)});
  }catch{return fail('Lecture indisponible',503)}
 }
 if(!await admin(request,env))return fail('Connexion administrateur requise (atelier de test)',401);
 try{
  if(action==='session'&&request.method==='POST'){
   // The browser's native <audio> can issue Range requests without exposing a bearer token in the URL.
   const token=request.headers.get('authorization')?.slice(7)||'';
   if(!/^[a-f0-9]{64}$/.test(token))return fail('Session non reconnue',401);
   const res=json({ok:true});
   res.headers.set('set-cookie','staging_audio_token='+token+'; Path=/api/editor-trial-audio; Max-Age=3600; HttpOnly; Secure; SameSite=Strict');
   return res;
  }
  if(action==='list'&&request.method==='GET'){
   const cursor=url.searchParams.get('cursor');
   if(cursor&&(cursor.length>1500||!/^[a-zA-Z0-9_+=:/.-]+$/.test(cursor)))return fail('Curseur invalide',400);
   const opts={prefix:ROOT,limit:100,include:['httpMetadata','customMetadata']};
   if(cursor)opts.cursor=cursor;
   const result=await env.MEDIA_BUCKET.list(opts);
   return json({ok:true,items:result.objects.map(x=>({key:x.key,size:x.size,name:x.customMetadata?.originalName||x.key.split('/').at(-1),uploadedAt:x.uploaded||null,declaredBytes:Number(x.customMetadata?.declaredBytes)||null})),cursor:result.truncated?result.cursor:null,complete:!result.truncated});
  }
  if(action==='inventory'&&request.method==='GET'){
   // All prefixes, including archived/unlinked and committee keys. Names only,
   // never public URLs or bytes. Access controlled above.
   const cursor=url.searchParams.get('cursor');
   if(cursor&&(cursor.length>1500||!/^[a-zA-Z0-9_+=:/.-]+$/.test(cursor)))return fail('Curseur invalide',400);
   const opts={limit:100,include:['httpMetadata','customMetadata']};
   if(cursor)opts.cursor=cursor;
   const r=await env.MEDIA_BUCKET.list(opts);
   return json({ok:true,items:r.objects.map(x=>({key:x.key,size:x.size,type:x.httpMetadata?.contentType||'inconnu',restricted:x.key.startsWith('committee/'),testAudio:x.key.startsWith(ROOT)})),cursor:r.truncated?r.cursor:null,complete:!r.truncated});
  }
  if(action==='begin'&&request.method==='POST'){
   const b=await request.json().catch(()=>null);
   if(!nameOk(b?.name)||!Number.isSafeInteger(b?.size)||b.size<128||b.size>MAX)return fail('MP3 invalide ou supérieur à 300 Mio',400);
   const key=ROOT+crypto.randomUUID()+'.mp3';
   const upload=await env.MEDIA_BUCKET.createMultipartUpload(key,{
    httpMetadata:{contentType:'audio/mpeg'},
    customMetadata:{originalName:b.name.trim(),declaredBytes:String(b.size),uploadedAt:new Date().toISOString()}
   });
   return json({ok:true,key,uploadId:upload.uploadId,partSize:PART,parts:Math.ceil(b.size/PART),maximumBytes:MAX});
  }
  if(action==='part'&&request.method==='PUT'){
   const key=url.searchParams.get('key'),uploadId=url.searchParams.get('uploadId'),partNumber=Number(url.searchParams.get('number'));
   if(!keyOk(key)||!uploadOk(uploadId)||!Number.isInteger(partNumber)||partNumber<1||partNumber>30)return fail('Partie invalide',400);
   const declared=Number(request.headers.get('content-length'));
   if(!Number.isSafeInteger(declared)||declared<1||declared>PART||(partNumber<30&&partNumber!==1&&declared<5*1024*1024))return fail('Taille de partie invalide',413);
   const body=await request.arrayBuffer();
   if(body.byteLength!==declared)return fail('Partie incomplète',400);
   if(partNumber===1){
    const bytes=new Uint8Array(body);
    const id3=bytes[0]===0x49&&bytes[1]===0x44&&bytes[2]===0x33;
    const frame=bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0;
    if(!id3&&!frame)return fail('Ce fichier ne paraît pas être un MP3',400);
   }
   const upload=env.MEDIA_BUCKET.resumeMultipartUpload(key,uploadId);
   const p=await upload.uploadPart(partNumber,body);
   return json({ok:true,partNumber:p.partNumber,etag:p.etag});
  }
  if(action==='finish'&&request.method==='POST'){
   const b=await request.json().catch(()=>null);
   if(!keyOk(b?.key)||!uploadOk(b?.uploadId)||!Array.isArray(b?.parts)||b.parts.length<1||b.parts.length>30)return fail('Transfert invalide',400);
   if(b.parts.some((p,i)=>p?.partNumber!==i+1||typeof p.etag!=='string'||p.etag.length<8||p.etag.length>150||!/^[a-zA-Z0-9"-]+$/.test(p.etag)))return fail('Parties invalides',400);
   const upload=env.MEDIA_BUCKET.resumeMultipartUpload(b.key,b.uploadId);
   const result=await upload.complete(b.parts);
   const verified=await env.MEDIA_BUCKET.head(b.key);
   if(!verified||verified.size<128||verified.size>MAX||verified.size!==Number(verified.customMetadata?.declaredBytes)){
    await env.MEDIA_BUCKET.delete(b.key);
    return fail('Taille non vérifiée : transfert annulé',409);
   }
   return json({ok:true,key:b.key,name:verified.customMetadata.originalName,size:verified.size,etag:result.httpEtag});
  }
  if(action==='abort'&&request.method==='POST'){
   const b=await request.json().catch(()=>null);
   if(!keyOk(b?.key)||!uploadOk(b?.uploadId))return fail('Transfert invalide',400);
   await env.MEDIA_BUCKET.resumeMultipartUpload(b.key,b.uploadId).abort();
   return json({ok:true,aborted:true});
  }
  return fail('Action non autorisée',405);
 }catch{
  return fail('Opération de stockage indisponible ; réessayez sans effacer vos fichiers',503);
 }
}
