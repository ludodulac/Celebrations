import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('migration/cloudflare/editor-demo-client-source.js','utf8');
const upload=source.slice(source.indexOf('async function uploadToMediaServer('),source.indexOf('async function createExternalMedia('));
test('MP3 progress remains below success until server acknowledgement; rejected uploads never enter catalogue',async()=>{
 for(const success of [true,false]){
  const progress=[],feedback=[];let pending;
  class XHR{
   upload={};status=success?200:413;response=success?{ok:true,item:{id:'mp3',name:'Chant.mp3'},revision:4}:{ok:false,error:'Fichier trop volumineux'};
   open(){}send(){pending=this;this.upload.onprogress({lengthComputable:true,loaded:10,total:10})}
  }
  const api=new Function('XMLHttpRequest','mediaUploadFeedback',`let globalMedia=[],serverRevision=null;${upload};return {uploadToMediaServer,items:()=>globalMedia}`)(XHR,(...args)=>feedback.push(args));
  const file=new File(['MP3'],'Chant.mp3',{type:'audio/mpeg'});
  const promise=api.uploadToMediaServer(file,p=>progress.push(p));
  assert.deepEqual(api.items(),[]);assert.deepEqual(progress,[99]);assert.match(feedback[0][1],/Vérification/);
  pending.onload();
  if(success){await promise;assert.equal(api.items().length,1)}
  else{await assert.rejects(promise,/volumineux/);assert.deepEqual(api.items(),[])}
 }
});
