// M025 — Resumable, non-compressing MP3 uploads to the EXISTING editor R2.
// The route caller handles the normal editor PIN, same-origin and CSRF gates.
// Purely additive: historical uploads and ordinary small-file routes unchanged.
export const MAX_MP3_BYTES=200_000_000; // 200 Mo, decimal
export const MP3_CHUNK_BYTES=10_000_000; // 10 Mo; R2 parts >= 5 MiB
const PREFIX='editor-trials/uploads/';
const PENDING='editor-trials/pending-mp3/';
const TTL_MS=24*60*60*1000;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(message,status=400)=>Response.json({ok:false,error:message},
 {status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
const ok=value=>Response.json({ok:true,...value},{headers:{
 'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
const identifier=id=>typeof id==='string'&&uuid.test(id);
const fileKey=id=>PREFIX+id+'.mp3';
const pendingKey=id=>PENDING+id+'.json';
const partCount=size=>Math.ceil(size/MP3_CHUNK_BYTES);
const correctPartSize=(record,number)=>Math.min(MP3_CHUNK_BYTES,
 record.size-(number-1)*MP3_CHUNK_BYTES);
const parseJson=async request=>{
 const size=Number(request.headers.get('content-length')||0);
 if(size>12000)throw Error('Requête trop longue');
 const text=await request.text();
 if(text.length>12000)throw Error('Requête trop longue');
 return JSON.parse(text);
};
async function pending(bucket,id){
 if(!identifier(id))return null;
 const entry=await bucket.get(pendingKey(id));
 if(!entry)return null;
 const record=await entry.json().catch(()=>null);
 if(!record||record.id!==id||!Number.isSafeInteger(record.size)||
  record.size<=25_000_000||record.size>MAX_MP3_BYTES||
  !Number.isSafeInteger(record.createdAt)||typeof record.uploadId!=='string'||
  typeof record.name!=='string')return null;
 return record;
}
async function lookupCompleted(id,bucket,readState,discoverMedia){
 const key=fileKey(id),object=await bucket.head(key);
 if(!object)return null;
 const {state}=await readState(bucket);
 const src='/media/new/'+id+'.mp3';
 const item=discoverMedia(state).find(x=>x.id==='audio|'+src&&x.source==='uploaded');
 return item&&object.size>0?{item,revision:state.version}:null;
}
const matches=(body,record)=>body?.id===record?.id&&body?.uploadId===record?.uploadId;
const expired=record=>Date.now()-record.createdAt>TTL_MS;
async function abandon(bucket,record){
 try{await bucket.resumeMultipartUpload(fileKey(record.id),record.uploadId).abort()}catch{}
 await bucket.delete(pendingKey(record.id));
}
function clientStatus(record){
 return {id:record.id,uploadId:record.uploadId,name:record.name,
  size:record.size,chunkSize:MP3_CHUNK_BYTES,parts:partCount(record.size),
  expiresAt:record.createdAt+TTL_MS};
}
export async function handleEditorMultipartUpload(action,request,env,{
 readEditorState,writeEditorState,discoverMedia
}){
 const bucket=env?.EDITOR_BUCKET;
 if(!bucket)return fail('Stockage audio indisponible',503);
 if(!['mpu-start','mpu-status','mpu-part','mpu-complete','mpu-abort'].includes(action))
  return fail('Opération inconnue',404);
 if(request.method!=='POST')return fail('Méthode interdite',405);
 try{
  if(action==='mpu-start'){
   const body=await parseJson(request);
   const name=String(body?.name||'').trim(),size=body?.size;
   if(!Number.isSafeInteger(size)||size<=25_000_000||size>MAX_MP3_BYTES||
    !name||name.length>120||!/\.mp3$/i.test(name)||
    !['','audio/mpeg','audio/mp3'].includes(String(body?.mime||'').toLowerCase()))
    return fail('MP3 invalide : taille autorisée jusqu’à 200 Mo.',415);
   const id=crypto.randomUUID(),key=fileKey(id);
   const session=await bucket.createMultipartUpload(key,{
    httpMetadata:{contentType:'audio/mpeg'}
   });
   const record={id,uploadId:session.uploadId,name,size,createdAt:Date.now()};
   try{await bucket.put(pendingKey(id),JSON.stringify(record),{
    httpMetadata:{contentType:'application/json'}
   })}
   catch(error){try{await session.abort()}catch{};throw error}
   return ok(clientStatus(record));
  }
  // For binary parts, credentials and metadata are in *headers*. For the
  // other operations, only small JSON is accepted.
  const body=action==='mpu-part'?{
   id:request.headers.get('x-mp3-upload-id'),
   uploadId:request.headers.get('x-mp3-r2-upload-id'),
   number:Number(request.headers.get('x-mp3-part-number'))
  }:await parseJson(request);
  if(!identifier(body?.id))return fail('Identifiant de transfert invalide.',400);
  const record=await pending(bucket,body.id);
  if(!record){
   if(action==='mpu-status'||action==='mpu-complete'){
    const completed=await lookupCompleted(body.id,bucket,readEditorState,discoverMedia);
    if(completed)return ok({completed:true,...completed});
   }
   return fail('Transfert expiré ou introuvable : choisissez à nouveau le fichier.',404);
  }
  if(!matches(body,record))return fail('Transfert non reconnu.',403);
  if(expired(record)){
   await abandon(bucket,record);
   return fail('Transfert expiré après 24 heures. Recommencez l’envoi.',410);
  }
  const session=bucket.resumeMultipartUpload(fileKey(record.id),record.uploadId);
  if(action==='mpu-status'){
   return ok({completed:false,...clientStatus(record)});
  }
  if(action==='mpu-abort'){
   await abandon(bucket,record);
   return ok({aborted:true});
  }
  if(action==='mpu-part'){
   const number=body.number,expected=Number.isSafeInteger(number)&&
    number>0&&number<=partCount(record.size)?correctPartSize(record,number):0;
   if(!expected)return fail('Numéro de morceau invalide.',400);
   const announced=Number(request.headers.get('content-length')||0);
   if(announced&&announced!==expected)return fail('Taille du morceau incorrecte.',413);
   // 10 Mo maximum in memory, never the full file.
   const bytes=await request.arrayBuffer();
   if(bytes.byteLength!==expected)return fail('Morceau incomplet : réessayez.',400);
   const part=await session.uploadPart(number,bytes);
   return ok({number,etag:part.etag});
  }
  if(action==='mpu-complete'){
   const count=partCount(record.size);
   if(!Array.isArray(body.parts)||body.parts.length!==count||
    !body.parts.every((part,i)=>part?.partNumber===i+1&&
     typeof part.etag==='string'&&/^[a-f0-9]{32}$/i.test(part.etag)))
    return fail('Morceaux manquants : reprenez le transfert.',400);
   let object=await bucket.head(fileKey(record.id));
   if(!object){
    try{object=await session.complete(body.parts)}
    catch{return fail('Impossible de terminer les morceaux : réessayez.',503)}
   }
   if(object?.size!==record.size)return fail('La vérification de taille du MP3 a échoué.',409);
   const src='/media/new/'+record.id+'.mp3';
   const item={id:'audio|'+src,type:'audio',src,name:record.name,
    source:'uploaded',general:false};
   // Retry the catalogue update on an optimistic-concurrency collision.
   // If a response was lost after completing R2, head() above recovers.
   for(let attempt=0;attempt<4;attempt++){
    const current=await readEditorState(bucket);
    const items=discoverMedia(current.state);
    if(items.some(x=>x.id===item.id)){
     await bucket.delete(pendingKey(record.id));
     return ok({completed:true,item,revision:current.state.version});
    }
    const state=structuredClone(current.state);
    state.mediaCatalogue=items.concat(item);
    if(await writeEditorState(bucket,current,state)){
     await bucket.delete(pendingKey(record.id));
     return ok({completed:true,item,revision:state.version});
    }
   }
   return fail('Fichier reçu, mais catalogue occupé. Réessayez pour terminer.',409);
  }
 }catch(error){
  // Keep the pending multipart object so a short network failure remains
  // recoverable, rather than losing already uploaded chunks.
  if(error instanceof SyntaxError)return fail('Requête invalide.',400);
  return fail('Transfert R2 momentanément indisponible, reprise possible.',503);
 }
 return fail('Opération inconnue.',404);
}
