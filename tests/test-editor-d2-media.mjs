import assert from 'node:assert/strict';
import {test} from 'node:test';
import {handleEditorDMedia} from '../migration/cloudflare/editor-d2-media.mjs';
const root='https://celebrations-exit-staging.rondes.workers.dev';
const token='q'.repeat(64);
function envFixture({revoked=false}={}){
 let r2Reads=0;
 const media={
  async get(key){
   r2Reads++;
   if(key==='committee/private.pdf')return null;
   return {size:3,body:new Uint8Array([1,2,3]),writeHttpMetadata(h){h.set('content-type',key.endsWith('.pdf')?'application/pdf':'image/jpeg')}};
  }
 };
 const row={
  id:'synthetic-pdf',source_type:'file',storage_path:'media/synthetic.pdf',mime_type:'application/pdf',content_type:'PDF',
  cover_storage_path:null
 };
 const db={prepare(_sql){return{bind(id){return{
  async first(){return id==='synthetic-pdf'?row:id==='committee-pdf'?{...row,id,storage_path:'committee/private.pdf'}:null}
 }}}}};
 const acl={prepare(){return{bind(){return{async first(){return revoked?{approved:0,revoked_at:'2026-01-01'}:null}}}}}};
 return {env:{DB:db,MEDIA_BUCKET:media,MEDIA_ACL:acl,EDITOR_D_PREVIEW_TOKEN:token},reads:()=>r2Reads};
}
test('D2 R2 is admin-only by reference; explicit revocation and committee paths are hard denies',async()=>{
 const {env,reads}=envFixture();
 const req=(path,headers)=>new Request(root+'/__editor/media'+path,{headers});
 assert.equal((await handleEditorDMedia(req('?id=synthetic-pdf'),env)).status,401);
 assert.equal(reads(),0,'Anonymous was able to access the R2 binding');
 const h={'x-editor-d-preview-token':token};
 const served=await handleEditorDMedia(req('?id=synthetic-pdf',h),env);
 assert.equal(served.status,200);
 assert.equal(served.headers.get('content-type'),'application/pdf');
 assert.equal(served.headers.get('cache-control'),'no-store');
 assert.equal((await served.arrayBuffer()).byteLength,3);
 assert.equal((await handleEditorDMedia(req('?id=committee-pdf',h),env)).status,404);
 assert.equal((await handleEditorDMedia(req('?id=%2Fmedia%2Fother',h),env)).status,404);
 assert.equal((await handleEditorDMedia(req('?asset=unknown',h),env)).status,404);
 const welcome=await handleEditorDMedia(req('?asset=welcome',h),env);
 assert.equal(welcome.status,200);
 assert.equal(welcome.headers.get('content-type'),'image/jpeg');
 const rev=envFixture({revoked:true});
 assert.equal((await handleEditorDMedia(req('?id=synthetic-pdf',h),rev.env)).status,404);
 assert.equal(rev.reads(),0,'Revoked media reached R2');
 console.log('MISSION_D2_MEDIA_SECURITY_PASS anonymous_denied=true committee_blocked=true explicit_acl_revocation_wins=true existing_r2_only=true');
});
