// M032 — regression on real official API functions with in-memory Cloudflare
// R2 and a valid test-only editor PIN cookie. NO live R2/D1 writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EDITOR_SNAPSHOT_KEY} from '../migration/cloudflare/app/ports/editor-snapshot-contract.mjs';
import {handleEditorMedia,publicSnapshot,readEditorState} from '../migration/cloudflare/editor-publication-api.mjs';
import {handlePublicEditorUpload} from '../migration/cloudflare/public-upload-gateway.mjs';
import {canSafelyDeleteMedia} from '../migration/cloudflare/app/domain/editor-media-usage-safety.mjs';
import {canShareStandaloneMedia,standalonePublicLinkAllowed} from '../migration/cloudflare/app/domain/editor-standalone-public-link.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';

const HOST='https://ronde-des-archanges-universelle.eu';
const SECRET='a'.repeat(64);
const UUID='12345678-1234-4234-8234-123456789abc';
const JPG='/media/new/'+UUID+'.jpg';
const PDF='/media/new/'+UUID+'.pdf';
const DOCX='/media/new/'+UUID+'.docx';
const upload=(src=JPG,type='image')=>({
 id:type+'|'+src,type,src,source:'uploaded',name:'Illustration conservée',
 general:false
});
function state(src=JPG,type='image'){
 return {
  version:14,mediaCatalogue:[upload(src,type)],
  drafts:{'101':{pages:[{id:'mercredi-101',name:'Mercredi',group:'celebration',
   visibility:'published',blocks:[{id:'photo',kind:type==='image'?'image':'button',
   ...(type==='image'?{src}:{href:src})}]}]}},
  shared:{pages:[],homeId:''},plans:[],
  published:{
   drafts:{'101':{pages:[{id:'mercredi-101',name:'Mercredi',group:'celebration',
    visibility:'published',blocks:[{id:'photo',kind:type==='image'?'image':'button',
    ...(type==='image'?{src}:{href:src})}]}]}},
   shared:{pages:[],homeId:''},plans:[],celebrationVisibility:{'101':'hidden'}
  }
 };
}
class Bucket {
 constructor(initial){
  this.data=structuredClone(initial);this.serial=1;this.fileReads=0;this.fileWrites=0;
  this.objectExists=true;
 }
 async get(key){
  if(key===EDITOR_SNAPSHOT_KEY)
   return {etag:String(this.serial),text:async()=>JSON.stringify(this.data)};
  if(!key.startsWith('editor-trials/uploads/')||!this.objectExists)return null;
  this.fileReads++;
  const mime=key.endsWith('.jpg')?'image/jpeg':key.endsWith('.pdf')?'application/pdf':
   'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return {size:4,body:new TextEncoder().encode('DATA'),httpMetadata:{contentType:mime}};
 }
 async head(key){return this.objectExists&&key.startsWith('editor-trials/uploads/')?
  {size:4}:null}
 async put(key,value,{onlyIf}={}){
  assert.equal(key,EDITOR_SNAPSHOT_KEY,'Must never rewrite stored media bytes');
  if(onlyIf?.etagMatches&&onlyIf.etagMatches!==String(this.serial))return null;
  this.data=JSON.parse(String(value));this.serial++;
  return {etag:String(this.serial)};
 }
 async delete(){this.fileWrites++;throw Error('M032 must never delete media bytes')}
}
async function signedCookie(){
 const payload=String(Date.now())+'.'+'b'.repeat(32);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(SECRET),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const data=await crypto.subtle.sign('HMAC',key,
  new TextEncoder().encode('site-editor-v1:'+payload));
 return 'celebrations_editor_access='+payload+'.'+Buffer.from(data).toString('hex');
}
const env=bucket=>({EDITOR_BUCKET:bucket,ADMIN_PASSWORD_HASH:SECRET});
async function toggle(bucket,id,publicLink,{cookie,revision,origin=HOST}={}){
 return handleEditorMedia(new Request(HOST+'/api/editor-media?action=public-link',{
  method:'POST',
  headers:{origin,cookie:cookie??'', 'content-type':'application/json'},
  body:JSON.stringify({id,publicLink,expectedRevision:revision??bucket.data.version})
 }),env(bucket));
}
const publicGet=(bucket,src)=>handlePublicEditorUpload(new Request(HOST+src),env(bucket));
test('M032: unused private JPG has stable URL, owner can preview inline, stranger cannot',async()=>{
 const state0=state();state0.drafts['101'].pages[0].blocks=[];
 state0.published.drafts['101'].pages[0].blocks=[];
 const bucket=new Bucket(state0);
 const deny=await publicGet(bucket,JPG);
 assert.equal(deny.status,404);
 assert.equal(bucket.fileReads,0);
 const c=await signedCookie();
 const owner=await handlePublicEditorUpload(new Request(HOST+JPG,{headers:{cookie:c}}),env(bucket));
 assert.equal(owner.status,200);
 assert.equal(owner.headers.get('content-type'),'image/jpeg');
 assert.equal(owner.headers.get('content-disposition'),'inline');
 assert.equal(await owner.text(),'DATA');
 assert.equal(bucket.fileWrites,0);
});
test('M032: explicit standalone public JPG remains inline after celebration hidden, not in public gallery',async()=>{
 const bucket=new Bucket(state()),c=await signedCookie();
 assert.equal((await publicGet(bucket,JPG)).status,404,
  'The celebration was hidden: no implicit image publication');
 const res=await toggle(bucket,'image|'+JPG,true,{cookie:c});
 assert.equal(res.status,200,await res.text().catch(()=>'')); // response is read for status only
 assert.equal(bucket.data.mediaCatalogue[0].publicLink,true);
 assert.equal(bucket.data.published.celebrationVisibility['101'],'hidden');
 const page=publicSnapshot(bucket.data,'101');
 assert.equal(page.celebrationVisible,false);
 assert.ok(!page.media.some(m=>m.src===JPG),
  'Standalone direct link does not add hidden celebration image to a public gallery');
 const direct=await publicGet(bucket,JPG);
 assert.equal(direct.status,200);
 assert.equal(await direct.text(),'DATA');
 assert.equal(direct.headers.get('content-type'),'image/jpeg');
 assert.equal(direct.headers.get('content-disposition'),'inline');
 assert.equal(direct.headers.get('cache-control').includes('no-store'),true);
 assert.equal(bucket.fileWrites,0);
 assert.equal(canSafelyDeleteMedia(bucket.data.mediaCatalogue[0],bucket.data,new Set()),false,
  'A deliberately shared link is never automatically deletable when unused');
});
test('M032: same stable address works for PDF inline, DOCX stays download',async()=>{
 const cookie=await signedCookie();
 for(const [src,type,expected] of [[PDF,'pdf','inline'],[DOCX,'file','attachment']]){
  const bucket=new Bucket(state(src,type));
  const res=await toggle(bucket,type+'|'+src,true,{cookie});
  assert.equal(res.status,200);
  const view=await publicGet(bucket,src);
  assert.equal(view.status,200);
  assert.equal(view.headers.get('content-disposition'),expected);
  const head=await handlePublicEditorUpload(new Request(HOST+src,{method:'HEAD'}),env(bucket));
  assert.equal(head.status,200);
  assert.equal(head.headers.get('content-disposition'),expected);
  assert.equal(bucket.fileWrites,0);
 }
});
test('M032: disabling standalone public link revokes anonymous access but preserves bytes and admin preview',async()=>{
 const bucket=new Bucket(state()),cookie=await signedCookie();
 assert.equal((await toggle(bucket,'image|'+JPG,true,{cookie})).status,200);
 assert.equal((await publicGet(bucket,JPG)).status,200);
 assert.equal((await toggle(bucket,'image|'+JPG,false,{cookie})).status,200);
 assert.equal((await publicGet(bucket,JPG)).status,404);
 const owner=await handlePublicEditorUpload(new Request(HOST+JPG,{headers:{cookie}}),env(bucket));
 assert.equal(owner.status,200);
 assert.equal(owner.headers.get('content-disposition'),'inline');
 assert.equal(bucket.fileWrites,0);
});
test('M032: private member page/space/celebration/category cannot be released publicly',async()=>{
 const cases=[
  s=>{s.drafts['101'].pages[0].accessPolicy={mode:'SELECTED_TYPES',typeIds:['member:1']}},
  s=>{s.drafts['101'].spaces=[{id:'space:private',pages:[{
   id:'secret',blocks:[{src:JPG}],accessPolicy:{mode:'SELECTED_TYPES',typeIds:['member:1']}}]}]},
  s=>{s.published.celebrationAccessPolicies={'101':{mode:'ALL_PRIVATE_TYPES'}}},
  s=>{s.celebrationMetadata={'101':{versions:[{
   key:'SELECTED_TYPES|member:1|fr',audience:{scope:'SELECTED_TYPES'},
   pages:[{blocks:[{src:JPG}]}]
  }]}}},
  s=>{s.mediaCatalogue[0].visibility='private'},
  s=>{s.privateDrafts={secret:{contents:[{src:JPG}]}}}
 ];
 const cookie=await signedCookie();
 for(const mutate of cases){
  const data=state();mutate(data);const bucket=new Bucket(data);
  const result=await toggle(bucket,'image|'+JPG,true,{cookie});
  assert.equal(result.status,403,'No private-member file may become publicly shared');
  assert.equal(bucket.data.version,14);
  assert.equal(bucket.data.mediaCatalogue[0].publicLink,undefined);
  assert.equal((await publicGet(bucket,JPG)).status,404);
  assert.equal(bucket.fileReads,0);
  // A hand-crafted publicLink flag cannot bypass the same private owner guard.
  bucket.data.mediaCatalogue[0].publicLink=true;
  assert.equal(standalonePublicLinkAllowed(bucket.data,bucket.data.mediaCatalogue[0]),false);
  assert.equal((await publicGet(bucket,JPG)).status,404);
 }
});
test('M032: anonymous or forged-origin public-link write denied; stale revision denied',async()=>{
 const bucket=new Bucket(state());const cookie=await signedCookie();
 const anonymous=await toggle(bucket,'image|'+JPG,true);
 assert.equal(anonymous.status,401);
 const cross=await toggle(bucket,'image|'+JPG,true,{cookie,origin:'https://evil.invalid'});
 assert.equal(cross.status,403);
 const stale=await toggle(bucket,'image|'+JPG,true,{cookie,revision:13});
 assert.equal(stale.status,409);
 assert.equal(bucket.data.version,14);
});
test('M032: publishing requires the actual R2 object, never just a catalogue entry',async()=>{
 const bucket=new Bucket(state()),cookie=await signedCookie();
 bucket.objectExists=false;
 const result=await toggle(bucket,'image|'+JPG,true,{cookie});
 assert.equal(result.status,404);
 assert.equal(bucket.data.mediaCatalogue[0].publicLink,undefined);
});
test('M032: browser editor is syntactically valid and exposes actual URL & explicit consent',()=>{
 assert.doesNotThrow(()=>new Function(DEMO_CLIENT));
 const src=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
 assert.match(src,/function copyPermanentMediaUrl/);
 assert.match(src,/async function setStandalonePublicLink/);
 assert.match(src,/siteConfirm\(publicLink\?/);
 assert.match(src,/Copier l’URL/);
 assert.match(src,/Rendre le lien public/);
 assert.match(src,/new URL\(media.src,location.origin\)/);
 assert.match(src,/serverRevision=result.revision/);
});
