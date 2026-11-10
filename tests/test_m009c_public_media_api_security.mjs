// M009-C: direct URL / MIME / cache / legacy D1 regression tests. No real R2/D1.
// Fake 'private-members' media must NEVER reach a public bucket or ASSETS.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleMedia} from '../migration/cloudflare/media-gateway.mjs';
import {handlePublicData} from '../migration/cloudflare/public-data-api.mjs';
import {handlePublicEditorUpload} from '../migration/cloudflare/public-upload-gateway.mjs';
import {EDITOR_SNAPSHOT_KEY} from '../migration/cloudflare/app/ports/editor-snapshot-contract.mjs';
import production from '../migration/cloudflare/production-worker.mjs';
import staging from '../migration/cloudflare/staging-worker.mjs';
import readonly from '../migration/cloudflare/readonly-preview-worker.mjs';
import legacy from '../migration/cloudflare/legacy-mailed-pdf-worker.mjs';

const SITE='https://www.ronde-des-archanges-universelle.eu';
const UUID='12345678-1234-4234-8234-123456789abc';
const JPG='/media/new/'+UUID+'.jpg';
const PDF='/media/new/'+UUID+'.pdf';
const imagePage=(src=JPG,extra={})=>({
 id:'neutral-public-image',visibility:'published',blocks:[{kind:'image',src}],...extra
});
function state({page=imagePage(),catalogue=[],published=true}={}){
 return {version:1,drafts:{},plans:[],shared:{pages:[],homeId:''},
  mediaCatalogue:catalogue,...(published?{published:{shared:{pages:[page]},
   drafts:{},plans:[],celebrationVisibility:{}}}:{})};
}
function gateway(row={approved:1,revoked_at:null},committeeRow=null){
 const calls=[];
 const env={
  MEDIA_ACL:{prepare(sql){return {bind(...args){return {async first(){
   calls.push(['sql',sql,args]);
   return sql.includes('committee_media')?committeeRow:row;
  }}}}}},
  MEDIA_BUCKET:{async get(key){
   calls.push(['bucket',key]);
   return {size:4,body:'DATA',httpEtag:'"test"',
    writeHttpMetadata(h){h.set('content-type','application/pdf')}};
  }}
 };
 return {env,calls};
}
test('M009-C: ACL approved does not authorize private members, even double encoded and nested',async()=>{
 const {env,calls}=gateway();
 for(const path of [
  '/media/private-members/43/private.pdf',
  '/media/media/private-members/43/private.pdf',
  '/media/%70rivate-members%2Fsecret.pdf',
  '/media/private-members%252Fsecret.pdf',
  '/media/private-member/secret.jpg',
  '/media/private-media/secret.mp4',
  '/media/new/private-members/secret.pdf'
 ]){
  const response=await handleMedia(new Request(SITE+path),env);
  assert.equal(response.status,404,path);
  assert.match(response.headers.get('cache-control'),/no-store/,path);
 }
 assert.equal(calls.some(call=>call[0]==='bucket'),false,
  'Private URL must be denied before any R2 read');
 assert.equal(calls.some(call=>call[0]==='sql'),false,
  'Private URL must not disclose existence with a D1 lookup');
});
test('M009-C: mailed committee slug cannot resolve into a private member R2 key',async()=>{
 const {env,calls}=gateway(null,{storage_path:'committee/private-members/secret.pdf'});
 const res=await handleMedia(new Request(SITE+'/letter/approved-slug'),env);
 assert.equal(res.status,404);
 assert.equal(calls.some(call=>call[0]==='bucket'),false);
});
test('M009-C: public-media binding must never point at PRIVATE_MEMBER_BUCKET',async()=>{
 const {env,calls}=gateway();
 env.PRIVATE_MEMBER_BUCKET=env.MEDIA_BUCKET;
 assert.equal((await handleMedia(new Request(SITE+'/media/media/old-photo.jpg'),env)).status,503);
 assert.equal(calls.length,0);
});
test('M009-C: existing public jpg and committee PDF still work without CDN caches',async()=>{
 const {env}=gateway();
 const historic=await handleMedia(new Request(SITE+'/media/media/old-photo.jpg'),env);
 assert.equal(historic.status,200);
 assert.equal(await historic.text(),'DATA');
 assert.equal(historic.headers.get('content-type'),'application/pdf');
 assert.match(historic.headers.get('vary'),/Authorization/);
 assert.equal(historic.headers.get('cdn-cache-control'),'no-store');
 const committee=gateway(null,{storage_path:'committee/invitation.pdf'});
 const pdf=await handleMedia(new Request(SITE+'/letter/sent-to-members'),committee.env);
 assert.equal(pdf.status,200);
 assert.equal(pdf.headers.get('etag'),null);
 assert.equal(pdf.headers.get('cache-control'),'no-store');
 assert.equal(committee.calls.some(x=>x[0]==='bucket'&&x[1]==='committee/invitation.pdf'),true);
});
function dataDb(rows=[]){
 const queries=[];
 const env={DB:{prepare(sql){queries.push(sql);return {async all(){return {results:rows}},
  bind(...args){queries.push(['bind',args]);return this}}}}};
 return {env,queries};
}
test('M009-C: old public API never SELECT * nor expose new person or private-space tables',async()=>{
 const f=dataDb([{id:'legacy-1',name:'Public',storage_path:'media/a.pdf'}]);
 for(const name of ['celebrations_contents','celebrations_events',
  'celebrations_steps','celebrations_celebrations','celebrations_groups',
  'celebrations_event_contents','celebrations_step_contents','celebrations_links']){
  const res=await handlePublicData(new Request(SITE+'/api/public-data?table='+name),f.env);
  assert.equal(res.status,200,name);
 }
 for(const sql of f.queries.filter(x=>typeof x==='string')){
  assert.equal(/SELECT\s+\*/i.test(sql),false,sql);
 }
 const contentSql=f.queries.find(sql=>typeof sql==='string'&&sql.includes('FROM "celebrations_contents"'));
 assert.match(contentSql,/private-members/);
 assert.match(contentSql,/audience IN/);
 for(const name of ['celebrations_directory_people','celebrations_directory_person_types',
  'celebrations_directory_private_spaces','celebrations_participants','private_media']){
  const res=await handlePublicData(new Request(SITE+'/api/public-data?table='+name),f.env);
  assert.equal(res.status,404,name);
 }
});
test('M009-C: malformed D1 rows never reveal private keys or URLs',async()=>{
 for(const key of ['private-members/41/report.pdf',
  'https://public.example/private-members%2F41%2Freport.pdf']){
  const f=dataDb([{id:'safe',name:'Public',storage_path:'media/a.pdf'},
   {id:'private',storage_path:key,external_url:key,name:'NOT_PUBLIC'}]);
  const res=await handlePublicData(new Request(SITE+'/api/public-data?table=celebrations_contents'),f.env);
  assert.equal(res.status,200);
  const body=await res.json();
  assert.deepEqual(body,[{id:'safe',name:'Public',storage_path:'media/a.pdf'}]);
  assert.equal(JSON.stringify(body).includes('NOT_PUBLIC'),false);
 }
});
test('M009-C: ASSETS cannot bypass private URLs on any Worker entrypoint',async()=>{
 for(const [name,worker] of [['production',production],['staging',staging],
  ['readonly',readonly],['legacy-email',legacy]]){
  let calls=0;
  const env={ASSETS:{async fetch(){calls++;return new Response('SECRET_ASSET_BYTES')}}};
  for(const path of ['/private-members/41/report.pdf',
   '/private-members%2F41%2Freport.pdf',
   '/gallery/private-members/41/report.jpg']){
   const r=await worker.fetch(new Request(SITE+path),env);
   assert.equal(r.status,404,name+':'+path);
   assert.doesNotMatch(await r.text(),/SECRET_ASSET_BYTES/);
   assert.match(r.headers.get('cache-control'),/no-store/);
  }
  assert.equal(calls,0,name+' must not touch asset storage');
 }
});
function editorStorage(s){
 const calls=[];
 const bucket={async get(key){
  calls.push(key);
  if(key===EDITOR_SNAPSHOT_KEY)return {text:async()=>JSON.stringify(s),etag:'snapshot-etag'};
  if(key==='editor-trials/uploads/'+UUID+'.jpg')
   return {size:4,body:'JPEG',httpMetadata:{contentType:'image/jpeg'}};
  return null;
 }};
 return {bucket,calls};
}
test('M009-C: anonymous direct upload UUID denied until an actual public publication',async()=>{
 const f=editorStorage(state({page:imagePage(JPG,{visibility:'draft'})}));
 let r=await handlePublicEditorUpload(new Request(SITE+JPG),{EDITOR_BUCKET:f.bucket});
 assert.equal(r.status,404);
 assert.equal(f.calls.some(k=>k.startsWith('editor-trials/uploads/')),false,
  'Not even a speculative object.get for a draft upload');
 f.calls.length=0;
 const withOwner=editorStorage(state());
 r=await handlePublicEditorUpload(new Request(SITE+JPG),{EDITOR_BUCKET:withOwner.bucket});
 assert.equal(r.status,200);
 assert.equal(await r.text(),'JPEG');
 assert.match(r.headers.get('cache-control'),/no-store/);
 assert.match(r.headers.get('vary'),/Cookie/);
 assert.equal(r.headers.get('etag'),null);
});
test('M009-C: private access policies and private space membership are NOT public upload grants',async()=>{
 for(const extra of [
  {accessPolicy:{mode:'ALL_PRIVATE_TYPES'}},
  {accessPolicy:{mode:'SELECTED_TYPES',typeIds:['member-type:chorale']}},
  {spaceId:'space:41:chapelle',celebrationId:'41',accessPolicy:{mode:'PUBLIC'}}
 ]){
  const f=editorStorage(state({page:imagePage(JPG,extra)}));
  const r=await handlePublicEditorUpload(new Request(SITE+JPG),{EDITOR_BUCKET:f.bucket});
  assert.equal(r.status,404,JSON.stringify(extra));
  assert.equal(f.calls.some(k=>k.startsWith('editor-trials/uploads/')),false);
 }
});
test('M009-C: general gallery cannot promote an explicitly private upload',async()=>{
 const privateRecord={src:JPG,source:'uploaded',general:true,visibility:'private'};
 const f=editorStorage(state({catalogue:[privateRecord]}));
 assert.equal((await handlePublicEditorUpload(new Request(SITE+JPG),
  {EDITOR_BUCKET:f.bucket})).status,404);
 const publicRecord={src:JPG,source:'uploaded',general:true};
 const pub=editorStorage(state({page:imagePage('/media/other.jpg'),
  catalogue:[publicRecord]}));
 assert.equal((await handlePublicEditorUpload(new Request(SITE+JPG),
  {EDITOR_BUCKET:pub.bucket})).status,200);
});
test('M009-C: public editor route refuses private bucket alias and unknown filenames',async()=>{
 const f=editorStorage(state());
 assert.equal((await handlePublicEditorUpload(new Request(SITE+JPG),{
  EDITOR_BUCKET:f.bucket,PRIVATE_MEMBER_BUCKET:f.bucket})).status,503);
 assert.equal((await handlePublicEditorUpload(new Request(SITE+'/media/new/private-members/foo.jpg'),{
  EDITOR_BUCKET:f.bucket})).status,404);
 assert.equal((await handlePublicEditorUpload(new Request(SITE+'/media/new/'+UUID+'.html'),{
  EDITOR_BUCKET:f.bucket})).status,404);
});
test('M009-C: hidden or draft celebration cannot release uploaded media through a published page',async()=>{
 for(const visibility of ['hidden','draft']){
  const s=state({page:imagePage('/media/other.jpg')});
  s.published.drafts['41']={pages:[imagePage(JPG)]};
  s.published.celebrationVisibility['41']=visibility;
  const f=editorStorage(s);
  const r=await handlePublicEditorUpload(new Request(SITE+JPG),{EDITOR_BUCKET:f.bucket});
  assert.equal(r.status,404,visibility);
  assert.equal(f.calls.some(k=>k.startsWith('editor-trials/uploads/')),false);
 }
});
test('M009-C: general gallery cannot publish upload referenced by restricted member page',async()=>{
 const s=state({page:imagePage(JPG,{accessPolicy:{
  mode:'SELECTED_TYPES',typeIds:['member-type:chorale']}}),
  catalogue:[{src:JPG,source:'uploaded',general:true}]});
 const f=editorStorage(s);
 const res=await handlePublicEditorUpload(new Request(SITE+JPG),{EDITOR_BUCKET:f.bucket});
 assert.equal(res.status,404);
 assert.equal(f.calls.some(k=>k.startsWith('editor-trials/uploads/')),false,
  'A general gallery flag cannot reveal private page bytes');
});
test('M009-C: staging checks /media/new before broad /media rather than using legacy ACL',async()=>{
 const s=editorStorage(state({page:imagePage(JPG,{visibility:'draft'})}));
 const env={MEDIA_BUCKET:s.bucket,MEDIA_ACL:{prepare(){throw Error('No legacy media ACL on /media/new')}}};
 let r=await staging.fetch(new Request(SITE+JPG),env);
 assert.equal(r.status,404);
 assert.equal(s.calls.some(k=>k.startsWith('editor-trials/uploads/')),false);
 const publicUpload=editorStorage(state());
 r=await staging.fetch(new Request(SITE+JPG),{
  ...env,MEDIA_BUCKET:publicUpload.bucket
 });
 assert.equal(r.status,200);
 assert.equal(await r.text(),'JPEG');
 assert.match(r.headers.get('cache-control'),/no-store/);
});
test('M009-C: readonly and legacy Worker reject arbitrary editor upload UUIDs before assets',async()=>{
 for(const worker of [readonly,legacy]){
  let assets=0;
  const r=await worker.fetch(new Request(SITE+JPG),{
   ASSETS:{async fetch(){assets++;return new Response('LEAKED_DRAFT')}}
  });
  assert.equal(r.status,404);
  assert.equal(assets,0);
 }
});
test('M009-C: route config and static builder cannot bypass the early asset guard',()=>{
 for(const p of ['production','staging']){
  const source=readFileSync(new URL('../migration/cloudflare/wrangler.'+p+'.example.toml',import.meta.url),'utf8');
  assert.match(source,/run_worker_first\s*=\s*true/);
 }
 const source=readFileSync(new URL('../scripts/build_staging_assets.py',import.meta.url),'utf8');
 assert.match(source,/"private-members"/);
 for(const name of ['production-worker.mjs','staging-worker.mjs']){
  const source=readFileSync(new URL('../migration/cloudflare/'+name,import.meta.url),'utf8');
  assert.equal(source.includes('member-private-access.mjs'),false,
   'Do not activate M008-C private member endpoints');
 }
});
