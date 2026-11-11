import test from 'node:test';
import assert from 'node:assert/strict';
import {handleEditorMediaFile} from '../migration/cloudflare/editor-publication-api.mjs';
import {handlePublicEditorUpload} from '../migration/cloudflare/public-upload-gateway.mjs';
import {EDITOR_SNAPSHOT_KEY} from '../migration/cloudflare/app/ports/editor-snapshot-contract.mjs';
const path='/media/new/12345678-1234-4234-8234-123456789abc.mp3';
const origin='https://www.ronde-des-archanges-universelle.eu';
const data='0123456789';
function fixture(published=true){
 const calls=[];
 const bucket={head:async()=>({size:10}),get:async(key,options)=>{
  calls.push([key,options]);
  if(key===EDITOR_SNAPSHOT_KEY)return {text:async()=>JSON.stringify({version:1,drafts:{},plans:[],shared:{pages:[]},mediaCatalogue:[],published:{shared:{pages:published?[{id:'p',visibility:'published',blocks:[{kind:'audio',src:path}]}]:[]},drafts:{},plans:[]}})};
  const r=options?.range;
  return {size:10,body:r?data.slice(r.offset,r.offset+r.length):data,httpMetadata:{contentType:'audio/mpeg'}};
 }};
 return {env:{EDITOR_BUCKET:bucket},calls};
}
test('MP3 partial reads, seeking, suffix, HEAD and invalid ranges',async()=>{
 for(const [range,status,body,contentRange] of [['bytes=2-4',206,'234','bytes 2-4/10'],['bytes=6-',206,'6789','bytes 6-9/10'],['bytes=-3',206,'789','bytes 7-9/10'],['bytes=20-',416,'','bytes */10'],['bytes=-0',416,'','bytes */10'],['bytes=0-1,3-4',416,'','bytes */10']]){
  const {env}=fixture();const r=await handleEditorMediaFile(new Request(origin+path,{headers:{range}}),env);
  assert.equal(r.status,status,range);assert.equal(await r.text(),body);assert.equal(r.headers.get('content-range'),contentRange);
 }
 const {env}=fixture();const r=await handleEditorMediaFile(new Request(origin+path,{method:'HEAD',headers:{range:'bytes=1-3'}}),env);
 assert.equal(r.status,206);assert.equal(r.headers.get('content-length'),'3');assert.equal(await r.text(),'');
});
test('existing ACL gateway still protects MP3 Range requests',async()=>{
 const visible=fixture();const r=await handlePublicEditorUpload(new Request(origin+path,{headers:{range:'bytes=2-4'}}),visible.env);
 assert.equal(r.status,206);assert.equal(await r.text(),'234');assert.match(r.headers.get('cache-control'),/no-store/);
 const privateFile=fixture(false);const denied=await handlePublicEditorUpload(new Request(origin+path,{headers:{range:'bytes=2-4'}}),privateFile.env);
 assert.equal(denied.status,404);assert.equal(privateFile.calls.some(([key])=>key.startsWith('editor-trials/uploads/')),false);
});
