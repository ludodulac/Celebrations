import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {
 handleEditorMultipartUpload,MAX_MP3_BYTES,MP3_CHUNK_BYTES
} from '../migration/cloudflare/app/application/editor-multipart-upload.mjs';

const route='https://ronde-des-archanges-universelle.eu/api/editor-media?action=';
const text=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function simulation(){
 const objects=new Map(),uploads=new Map(),initial={version:2,mediaCatalogue:[],
  shared:{pages:[]},drafts:{},published:{},localization:{}};
 let state=structuredClone(initial),written=0;
 function session(key,uploadId){
  const upload=uploads.get(uploadId);
  if(!upload||upload.key!==key)throw Error('Multipart upload expired');
  return {
   uploadId,key,
   async uploadPart(number,value){
    const bytes=new Uint8Array(value);
    upload.parts.set(number,new Uint8Array(bytes));
    return {partNumber:number,etag:createHash('md5').update(bytes).digest('hex')};
   },
   async complete(parts){
    let total=0;
    for(const item of parts){
     const bytes=upload.parts.get(item.partNumber);
     if(!bytes||createHash('md5').update(bytes).digest('hex')!==item.etag)
      throw Error('Invalid ETag');
     total+=bytes.byteLength;
    }
    const result=new Uint8Array(total);let offset=0;
    for(const part of parts){const bytes=upload.parts.get(part.partNumber);
     result.set(bytes,offset);offset+=bytes.byteLength}
    objects.set(key,result);uploads.delete(uploadId);return {size:total,key};
   },
   async abort(){uploads.delete(uploadId)}
  };
 }
 const bucket={
  async createMultipartUpload(key,metadata){
   assert.equal(metadata.httpMetadata.contentType,'audio/mpeg');
   const uploadId='cloudflare-'+randomUUID();
   uploads.set(uploadId,{key,parts:new Map()});
   return session(key,uploadId);
  },
  resumeMultipartUpload:session,
  async put(key,value){
   objects.set(key,typeof value==='string'?value:new Uint8Array(value));
   return {size:objects.get(key).length,key};
  },
  async get(key){
   const body=objects.get(key);
   if(body===undefined)return null;
   return {json:async()=>JSON.parse(typeof body==='string'?body:new TextDecoder().decode(body))};
  },
  async head(key){
   const value=objects.get(key);
   return value===undefined?null:{size:value.length,key};
  },
  async delete(key){objects.delete(key)}
 };
 const dependencies={
  readEditorState:async()=>({state:structuredClone(state),etag:String(state.version)}),
  writeEditorState:async(_,previous,next)=>{
   if(previous.etag!==String(state.version))return false;
   next.version=state.version+1;state=structuredClone(next);written++;
   return true;
  },
  discoverMedia:record=>record.mediaCatalogue||[]
 };
 async function call(action,body={},headers={}){
  const binary=action==='mpu-part';
  const request=new Request(route+action,{
   method:'POST',
   headers:binary?{
    'content-type':'application/octet-stream',
    'x-mp3-upload-id':body.id,
    'x-mp3-r2-upload-id':body.uploadId,
    'x-mp3-part-number':String(body.number),
    ...headers
   }:{'content-type':'application/json',...headers},
   body:binary?body.chunk:JSON.stringify(body)
  });
  const response=await handleEditorMultipartUpload(action,request,
   {EDITOR_BUCKET:bucket},dependencies);
  return {status:response.status,...await response.json()};
 }
 return {objects,uploads,bucket,call,getState:()=>state,writes:()=>written};
}
test('200 Mo limit uses twenty 10 Mo parts and does not compress audio',async()=>{
 assert.equal(MAX_MP3_BYTES,200_000_000);
 assert.equal(MP3_CHUNK_BYTES,10_000_000);
 const sim=simulation();
 const limit=await sim.call('mpu-start',{name:'Conte entier.mp3',size:200_000_000,mime:'audio/mpeg'});
 assert.equal(limit.status,200);assert.equal(limit.parts,20);
 assert.equal(limit.chunkSize,10_000_000);
 assert.equal(sim.uploads.size,1);
 assert.equal((await sim.call('mpu-start',{name:'Trop gros.mp3',size:200_000_001,mime:'audio/mpeg'})).status,415);
 assert.equal((await sim.call('mpu-start',{name:'Contournement.wav',size:150_000_000,mime:'audio/mpeg'})).status,415);
 assert.equal((await sim.call('mpu-start',{name:'code.mp3',size:130_000_000,mime:'application/javascript'})).status,415);
 assert.equal((await sim.call('mpu-start',{name:'Petit.mp3',size:25_000_000,mime:'audio/mpeg'})).status,415);
 assert.equal(sim.uploads.size,1,'Rejected files do not create R2 sessions');
});
test('resume uploaded chunks, reject malicious part sizes, complete and persist exactly once',async()=>{
 const sim=simulation(),total=25_000_001;
 const init=await sim.call('mpu-start',{name:'Vingt cinq Mo.mp3',size:total,mime:'audio/mpeg'});
 assert.equal(init.parts,3);
 const body={id:init.id,uploadId:init.uploadId};
 const status=await sim.call('mpu-status',body);
 assert.equal(status.completed,false);assert.equal(status.size,total);
 assert.equal((await sim.call('mpu-part',{...body,number:1,
  chunk:new Uint8Array(10_000_000-1)})).status,400);
 assert.equal((await sim.call('mpu-part',{...body,uploadId:'wrong',number:1,
  chunk:new Uint8Array(10_000_000)})).status,403);
 const first=await sim.call('mpu-part',{...body,number:1,chunk:new Uint8Array(10_000_000).fill(3)});
 assert.equal(first.status,200);assert.match(first.etag,/^[a-f0-9]{32}$/);
 assert.equal((await sim.call('mpu-complete',{...body,parts:[{
  partNumber:1,etag:first.etag}]})).status,400);
 // Reconnected phone retains this ETag in localStorage and skips part 1.
 assert.equal((await sim.call('mpu-status',body)).status,200);
 const second=await sim.call('mpu-part',{...body,number:2,chunk:new Uint8Array(10_000_000).fill(4)});
 const third=await sim.call('mpu-part',{...body,number:3,chunk:new Uint8Array(5_000_001).fill(5)});
 const parts=[first,second,third].map((p,i)=>({partNumber:i+1,etag:p.etag}));
 const done=await sim.call('mpu-complete',{...body,parts});
 assert.equal(done.status,200);assert.equal(done.completed,true);
 assert.equal(done.item.name,'Vingt cinq Mo.mp3');
 assert.equal(done.item.src,'/media/new/'+init.id+'.mp3');
 assert.equal(sim.objects.get('editor-trials/uploads/'+init.id+'.mp3').length,total);
 assert.equal(sim.getState().mediaCatalogue.length,1);
 assert.equal(sim.writes(),1,'Catalogue is written once');
 assert.equal((await sim.call('mpu-status',body)).completed,true,
  'A lost response can be recovered after the multipart is already finalized');
 assert.equal((await sim.call('mpu-complete',{...body,parts})).completed,true,
  'Completion is idempotent when the browser retries');
 assert.equal(sim.writes(),1,'Idempotent retry never duplicates the catalogue');
});
test('never publish a partial R2 object or accept incomplete manifest',async()=>{
 const sim=simulation(),init=await sim.call('mpu-start',{name:'Livre.mp3',size:30_000_000,mime:'audio/mpeg'});
 const body={id:init.id,uploadId:init.uploadId};
 assert.equal((await sim.call('mpu-complete',{...body,parts:[]})).status,400);
 assert.equal(sim.getState().mediaCatalogue.length,0);
 assert.equal(sim.objects.has('editor-trials/uploads/'+init.id+'.mp3'),false);
 const abort=await sim.call('mpu-abort',body);
 assert.equal(abort.status,200);assert.equal(abort.aborted,true);
 assert.equal(sim.uploads.size,0);
 assert.equal((await sim.call('mpu-status',body)).status,404);
});
test('client and API share the existing route, maintain <= 25 Mo normal upload',()=>{
 const client=text('migration/cloudflare/editor-demo-client-source.js');
 const server=text('migration/cloudflare/editor-publication-api.mjs');
 assert.match(client,/MAX_MP3_UPLOAD=200_000_000/);
 assert.match(client,/MP3_SINGLE_REQUEST=25_000_000/);
 assert.match(client,/async function uploadLargeMp3/);
 assert.match(client,/localStorage\.setItem\(localKey,JSON\.stringify\(saved\)\)/);
 assert.match(client,/command\('mpu-status'/);
 assert.match(client,/command\('mpu-complete'/);
 assert.match(client,/file\.slice\(begin,Math\.min\(begin\+saved\.chunkSize,file\.size\)\)/);
 assert.match(server,/handleEditorMultipartUpload\(action,request,env/);
 assert.match(server,/if\(size>26_000_000\)/,'Existing small upload has unchanged request guard');
 assert.match(text('migration/cloudflare/app/domain/editor-upload-formats.mjs'),
  /'audio\/mpeg',\{extension:'\.mp3',type:'audio',max:25_000_000\}/);
 assert.match(client,/Importez des MP3 jusqu’à 200 Mo sans compression/);
});
