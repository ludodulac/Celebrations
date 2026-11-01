import test from 'node:test';
import assert from 'node:assert/strict';
import {handleTrialAudio} from '../migration/cloudflare/editor-trial-audio-api.mjs';
const BASE='https://celebrations-exit-staging.rondes.workers.dev/api/editor-trial-audio';
const adminToken='a'.repeat(64);
const headers={authorization:'Bearer '+adminToken};
const MAX=300*1024*1024;
const body=(action,obj)=>new Request(BASE+'?action='+action,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(obj)});
function context(){
 const state={actions:[],data:null,objects:[],current:null};
 const key='editor-trials/audio/123e4567-e89b-12d3-a456-426614174000.mp3';
 const uploadId='abc123def456';
 const r2={
  async list(opts){state.actions.push('list:'+String(opts.prefix||'all'));return {objects:state.objects,truncated:false}},
  async head(k){return state.current?.key===k?state.current:null},
  async get(k,options){state.actions.push('get:'+k);if(k!==key)return null;return {size:128,body:new Uint8Array([1,2,3]),range:null,httpEtag:'"xyz"'}},
  async createMultipartUpload(k,opts){state.actions.push('begin:'+k);state.expected=k;state.metadata=opts;return {uploadId}},
  resumeMultipartUpload(k,id){state.actions.push('resume:'+k);if(id!==uploadId)throw Error('wrong upload');return {
   async uploadPart(number,bytes){state.actions.push('part:'+number);return {partNumber:number,etag:'abc123abcd1234'}},
   async complete(parts){state.actions.push('complete');state.current={key:k,size:128,customMetadata:state.metadata.customMetadata,httpEtag:'"xyz"'};return state.current},
   async abort(){state.actions.push('abort')}
  }},
  async delete(k){state.actions.push('delete:'+k)}
 };
 const db={prepare(){return {bind(){return {first:async()=>({email:'admin@staging.local',expires_at:new Date(Date.now()+3600000).toISOString()})}}}}};
 return {state,env:{DB:db,MEDIA_BUCKET:r2},key,uploadId};
}
const call=(url,env)=>handleTrialAudio(url,env);
test('staging-only audio denies production host and unauthenticated inventory, upload and stream',async()=>{
 const {env,key}=context();
 assert.equal((await call(new Request('https://www.ronde-des-archanges-universelle.eu/api/editor-trial-audio?action=inventory'),env)).status,404);
 assert.equal((await call(new Request(BASE+'?action=inventory'),env)).status,401);
 assert.equal((await call(new Request(BASE+'?action=stream&key='+key),env)).status,401);
 assert.equal((await call(new Request(BASE+'?action=begin',{method:'POST',body:'{}'}),env)).status,401);
});
test('admin can inventory all R2 prefixes without modifying any objects',async()=>{
 const {env,state}=context();
 state.objects=[{key:'committee/secret.pdf',size:500,httpMetadata:{contentType:'application/pdf'}},{key:'media/old.mp3',size:900,httpMetadata:{contentType:'audio/mpeg'}}];
 const r=await call(new Request(BASE+'?action=inventory',{headers}),env);
 const data=await r.json();assert.equal(r.status,200);
 assert.equal(data.items.length,2);
 assert.equal(data.items[0].restricted,true);
 assert.equal(data.items[1].key,'media/old.mp3');
 assert.deepEqual(state.actions,['list:all']);
});
test('300 MiB upload: begin, 10 MiB multipart, verify metadata and finish',async()=>{
 const {env,state,key,uploadId}=context();
 const tooBig=await call(body('begin',{name:'conference.mp3',size:MAX+1}),env);
 assert.equal(tooBig.status,400);
 const begin=await call(body('begin',{name:'conférence.mp3',size:128}),env);
 const init=await begin.json();
 assert.equal(begin.status,200);assert.equal(init.partSize,10*1024*1024);
 assert.equal(init.parts,1);assert.ok(init.key.startsWith('editor-trials/audio/'));
 // The R2 fake returns the same named key for this test as when it receives begin.
 const bytes=new Uint8Array(128);bytes.set([73,68,51],0);
 const url=new URL(BASE);url.searchParams.set('action','part');url.searchParams.set('key',init.key);url.searchParams.set('uploadId',uploadId);url.searchParams.set('number','1');
 const part=await call(new Request(url,{method:'PUT',headers:{...headers,'content-type':'application/octet-stream','content-length':'128'},body:bytes}),env);
 assert.equal(part.status,200);
 const etag=(await part.json()).etag;
 const finish=await call(body('finish',{key:init.key,uploadId,parts:[{partNumber:1,etag}]}),env);
 assert.equal(finish.status,200);
 assert.equal((await finish.json()).size,128);
 assert.ok(state.actions.some(x=>x.startsWith('begin:')));
 assert.ok(state.actions.includes('part:1'));
 assert.ok(state.actions.includes('complete'));
});
test('admin session creates HttpOnly SameSite cookie for range audio, no token in URL',async()=>{
 const {env,key}=context();
 const session=await call(new Request(BASE+'?action=session',{method:'POST',headers}),env);
 const cookie=session.headers.get('set-cookie');
 assert.equal(session.status,200);assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
 const playback=await call(new Request(BASE+'?action=stream&key='+key,{headers:{cookie:'staging_audio_token='+adminToken,range:'bytes=0-20'}}),env);
 assert.equal(playback.status,200);
 assert.equal(playback.headers.get('content-type'),'audio/mpeg');
 assert.equal(playback.headers.get('accept-ranges'),'bytes');
});
test('cannot use arbitrary R2 path or delete any existing object through trial audio API',async()=>{
 const {env}=context();
 const r=await call(new Request(BASE+'?action=stream&key=committee%2Fsecret.pdf',{headers:{cookie:'staging_audio_token='+adminToken}}),env);
 assert.equal(r.status,404);
 const remove=await call(body('delete',{key:'media/old.mp3'}),env);
 assert.equal(remove.status,405);
});
