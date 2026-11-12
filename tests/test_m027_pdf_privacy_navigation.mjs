import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 navigationPreference,validNavigationPreference,managedPdfUrl,withPdfPrivacy,
 pdfIsPrivate,privatePdfSources
} from '../migration/cloudflare/app/domain/editor-site-preferences.mjs';
import {handlePublicEditorUpload} from '../migration/cloudflare/public-upload-gateway.mjs';
import {handleMedia} from '../migration/cloudflare/media-gateway.mjs';
import {handleEditorMedia,publicSnapshot,publishedMedia} from '../migration/cloudflare/editor-publication-api.mjs';
import {handleSiteIdentity} from '../migration/cloudflare/site-identity-api.mjs';

const HOST='https://www.ronde-des-archanges-universelle.eu';
const ID='12345678-1234-4234-8234-123456789abc';
const PDF='/media/new/'+ID+'.pdf';
const HISTORIC='/media/media/older.pdf';
const SECRET='a'.repeat(64);
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
class Bucket{
 constructor(state){
  this.state=structuredClone(state);this.serial=1;
 }
 async get(key){
  if(key==='editor-trials/server-drafts-v1.json'){
   const state=this.state;
   return {etag:String(this.serial),body:true,text:async()=>JSON.stringify(state)};
  }
  if(key==='editor-trials/uploads/'+ID+'.pdf')
   return {size:4,body:'%PDF',httpMetadata:{contentType:'application/pdf'}};
  return null;
 }
 async head(key){
  return key==='editor-trials/uploads/'+ID+'.pdf'?{size:4}:null;
 }
 async put(key,value,{onlyIf}={}){
  if(onlyIf?.etagMatches!==String(this.serial))return null;
  this.state=JSON.parse(value);this.serial++;
  return {etag:String(this.serial)};
 }
}
function fixture(){
 const home={id:'neutral-accueil-general',group:'page',name:'Accueil',visibility:'published',
  blocks:[{id:'a',kind:'button',href:PDF,text:'Document public'}]};
 return {version:1,drafts:{'101':{pages:[],spaces:[]}},plans:[],
  shared:{pages:[home],homeId:home.id},
  published:{shared:{pages:[home],homeId:home.id},drafts:{},plans:[],celebrationVisibility:{}},
  mediaCatalogue:[{id:'pdf|'+PDF,type:'pdf',src:PDF,name:'Document.pdf',source:'uploaded',general:false}],
  navigation:{title:'',position:'center'}};
}
async function cookie(){
 const payload=String(Date.now())+'.'+'b'.repeat(32);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(SECRET),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const data=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('site-editor-v1:'+payload));
 return 'celebrations_editor_access='+payload+'.'+Buffer.from(data).toString('hex');
}
const legacyDb={prepare(sql){
 return {
  bind(...args){return {async first(){
   return sql.includes('public_media')?{approved:1,revoked_at:null}:null;
  }}},
  async all(){return {results:[{storage_path:'media/older.pdf',cover_storage_path:null,external_url:null}]}}
 }
}};
function env(bucket){
 return {EDITOR_BUCKET:bucket,MEDIA_ACL:legacyDb,MEDIA_BUCKET:{
  async get(){return {size:4,body:'%PDF',httpEtag:'"fake"',
   writeHttpMetadata(h){h.set('content-type','application/pdf')}}}
 },DB:legacyDb,ADMIN_PASSWORD_HASH:SECRET};
}
test('site-owned PDFs public by default; private checkbox uses explicit boolean, not page access',()=>{
 assert.equal(managedPdfUrl(PDF),true);
 assert.equal(managedPdfUrl(HISTORIC),true);
 for(const path of ['/media/new/private-members/f.pdf','https://elsewhere.fr/x.pdf',
  '/media/new/%2e%2e/a.pdf','/letter/doc.pdf','/media/private-members/doc.pdf'])
  assert.equal(managedPdfUrl(path),false,path);
 const state=fixture();
 assert.equal(pdfIsPrivate(state,PDF),false);
 assert.deepEqual(privatePdfSources(state),[]);
 state.pdfPrivacy=withPdfPrivacy(state.pdfPrivacy,PDF,true);
 assert.equal(pdfIsPrivate(state,PDF),true);
 assert.deepEqual(privatePdfSources(state),[PDF]);
 state.pdfPrivacy=withPdfPrivacy(state.pdfPrivacy,PDF,false);
 assert.equal(pdfIsPrivate(state,PDF),false);
 assert.deepEqual(state.pdfPrivacy,{});
});
test('a newly uploaded PDF is anonymously accessible even before publication; ticking private denies it',async()=>{
 const draft=fixture();
 draft.published=undefined;draft.shared.pages=[];draft.drafts['101'].pages=[{
  id:'mercredi-101',group:'celebration',visibility:'draft',
  blocks:[{kind:'button',href:PDF}]
 }];
 const bucket=new Bucket(draft),e=env(bucket);
 let response=await handlePublicEditorUpload(new Request(HOST+PDF),e);
 assert.equal(response.status,200,'Public-by-default PDF in a draft must open from an email');
 bucket.state.pdfPrivacy={[PDF]:true};
 response=await handlePublicEditorUpload(new Request(HOST+PDF),e);
 assert.equal(response.status,404,'Private PDF must not be anonymously available');
 response=await handlePublicEditorUpload(new Request(HOST+PDF,{headers:{cookie:await cookie()}}),e);
 assert.equal(response.status,200,'Admin can still preview a private PDF');
});
test('authenticated privacy toggle is persisted with revision and not published by page mutation',async()=>{
 const bucket=new Bucket(fixture()),e=env(bucket),signed=await cookie();
 const post=(src,isPrivate,expectedRevision)=>new Request(HOST+'/api/editor-media?action=pdf-privacy',{
  method:'POST',headers:{origin:HOST,cookie:signed,'content-type':'application/json'},
  body:JSON.stringify({src,private:isPrivate,expectedRevision})
 });
 const noAuth=await handleEditorMedia(new Request(HOST+'/api/editor-media'),e);
 assert.equal(noAuth.status,401);
 let response=await handleEditorMedia(post(PDF,true,1),e);
 assert.equal(response.status,200);
 assert.equal(bucket.state.pdfPrivacy[PDF],true);
 assert.equal(bucket.state.mediaCatalogue[0].src,PDF);
 assert.equal(bucket.state.published.shared.pages[0].blocks[0].href,PDF);
 assert.equal(bucket.state.publishedAt,undefined);
 assert.equal((await handleEditorMedia(post(PDF,false,1),e)).status,409,'Stale editor revision refused');
 response=await handleEditorMedia(post(PDF,false,2),e);
 assert.equal(response.status,200);assert.deepEqual(bucket.state.pdfPrivacy,{});
 assert.equal((await handleEditorMedia(post('https://external.fr/f.pdf',true,3),e)).status,400);
});
test('historic PDF can be privately blocked and made public again without touching legacy D1 ACL',async()=>{
 const state=fixture();state.pdfPrivacy={[HISTORIC]:true};
 const bucket=new Bucket(state),e=env(bucket);
 assert.equal((await handleMedia(new Request(HOST+HISTORIC),e)).status,404);
 const signed=await cookie();
 assert.equal((await handleMedia(new Request(HOST+HISTORIC,{headers:{cookie:signed}}),e)).status,200);
 const response=await handleEditorMedia(new Request(HOST+'/api/editor-media?action=pdf-privacy',{
  method:'POST',headers:{origin:HOST,cookie:signed,'content-type':'application/json'},
  body:JSON.stringify({src:HISTORIC,private:false,expectedRevision:1})
 }),e);
 assert.equal(response.status,200,'Historic privacy can be undone');
 assert.equal((await handleMedia(new Request(HOST+HISTORIC),e)).status,200);
});
test('private PDF is excluded from public projections, despite historic published references',()=>{
 const state=fixture();
 assert.equal(publicSnapshot(state,'101').shared.pages[0].blocks.length,1);
 state.pdfPrivacy={[PDF]:true};
 assert.equal(publicSnapshot(state,'101').shared.pages[0].blocks.length,0);
 assert.equal(publishedMedia(state).some(item=>item.src===PDF),false);
});
test('desktop navigation title is independent of legacy site identity and mode',async()=>{
 assert.deepEqual(navigationPreference(null),{title:'',position:'center'});
 assert.deepEqual(navigationPreference({title:' Bonjour  ',position:'left'}),
  {title:'Bonjour',position:'left'});
 assert.equal(validNavigationPreference({title:'Bonjour',position:'right'}),true);
 assert.equal(validNavigationPreference({title:'  Bonjour',position:'right'}),false);
 assert.equal(validNavigationPreference({title:'Bonjour',position:'bad'}),false);
 const state=fixture();state.siteIdentity={title:'ancien'};
 state.adminMode={memberAccessUiEnabled:true};
 const bucket=new Bucket(state),e=env(bucket),signed=await cookie();
 const r=await handleSiteIdentity(new Request(HOST+'/api/site-identity',{
  method:'POST',headers:{origin:HOST,cookie:signed,'content-type':'application/json'},
  body:JSON.stringify({expectedRevision:1,navigation:{
   title:'Ronde des Archanges Universelle',position:'center'
  }})
 }),e);
 assert.equal(r.status,200);
 assert.equal(bucket.state.navigation.title,'Ronde des Archanges Universelle');
 assert.equal(bucket.state.adminMode.memberAccessUiEnabled,true);
 assert.deepEqual(bucket.state.siteIdentity,{title:'ancien'});
});
test('navigation in existing bar, no mobile duplicate, PDF checkbox under admin cards',()=>{
 const page=read('migration/cloudflare/editor-trial-site-page.mjs');
 const client=read('migration/cloudflare/editor-demo-client-source.js');
 assert.match(page,/class="site-menu-bar'/);
 assert.match(page,/navigationHtml/);
 assert.match(page,/site-nav-title/);
 assert.match(page,/@media\(max-width:700px\)\{\.site-nav-title\{display:none!important\}\}/);
 const settings=client.slice(client.indexOf('function settings(){'),client.indexOf('function m018LanguagesCategories(){'));
 assert.match(settings,/Titre dans la barre du menu/);
 assert.match(settings,/Position du titre/);
 assert.doesNotMatch(settings,/Identité du site/);
 assert.match(client,/function pdfPrivacyControl\(record\)/);
 assert.match(client,/record\.type==='pdf'/);
 assert.match(client,/record\.category==='pdf'/);
});
