import test from 'node:test';
import assert from 'node:assert/strict';
import {readEditorState,publicSnapshot,discoverMedia,handleEditorPublication,
 handleEditorMedia} from '../migration/cloudflare/editor-publication-api.mjs';
import {handleServerDraft} from '../migration/cloudflare/editor-server-draft-api.mjs';

const host='https://www.ronde-des-archanges-universelle.eu';
const initial=()=>({version:1,updatedAt:'2026-11-04T00:00:00.000Z',drafts:{
 '101':{pages:[
  {id:'mercredi-101',name:'Mercredi',group:'celebration',blocks:[
    {id:'a',kind:'image',src:'/media/media/historical.jpg'}]},
  {id:'extra-01234567-89ab-4cde-8f01-123456789abc-101',name:'Page en cours',
   group:'celebration',visibility:'draft',blocks:[
    {id:'b',kind:'video',href:'https://youtu.be/abcdEFghI12'}]}
 ],celebrationDates:{},celebrationTimes:{}}
 },plans:[],shared:{homeId:'neutral-accueil-general',
 pages:[
  {id:'neutral-accueil-general',name:'Accueil',group:'page',blocks:[
   {id:'home',kind:'text',text:'Bienvenue'}]},
  {id:'neutral-12345678-aaaa-4bbb-8ccc-123456789abc',name:'En préparation',
   group:'page',visibility:'draft',blocks:[{id:'private',kind:'text',text:'secret en construction'}]}
 ]},mediaCatalogue:[]});
class Bucket {
 constructor(value=initial()){this.map=new Map([['editor-trials/server-drafts-v1.json',JSON.stringify(value)]]);this.serial=1;}
 async get(key){const content=this.map.get(key);if(content===undefined)return null;
  return {etag:String(this.serial),body:true,text:async()=>content,
   httpMetadata:{contentType:'image/jpeg'}}}
 async put(key,value,{onlyIf}={}){
  if(onlyIf?.etagMatches&&String(this.serial)!==onlyIf.etagMatches)return null;
  if(onlyIf?.etagDoesNotMatch==='*'&&this.map.has(key))return null;
  this.map.set(key,typeof value==='string'?value:JSON.stringify(value));
  this.serial++;
  return {etag:String(this.serial)};
 }
 async delete(key){this.map.delete(key)}
}
const SECRET='a'.repeat(64);
async function signedCookie(){
 const payload=String(Date.now())+'.'+'b'.repeat(32);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(SECRET),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const data=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('site-editor-v1:'+payload));
 return 'celebrations_editor_access='+payload+'.'+Buffer.from(data).toString('hex');
}
const env=async bucket=>({EDITOR_BUCKET:bucket,MEDIA_BUCKET:bucket,DB:{},ADMIN_PASSWORD_HASH:SECRET});
const body=(args,cookie)=>new Request(host+'/api/editor-publication',{method:'POST',
 headers:{origin:host,cookie,'content-type':'application/json'},body:JSON.stringify(args)});
test('new pages stay private, existing pages remain public and no admin data is returned',()=>{
 const snapshot=publicSnapshot(initial(),'101');
 assert.deepEqual(snapshot.record.pages.map(x=>x.id),['mercredi-101']);
 assert.deepEqual(snapshot.shared.pages.map(x=>x.id),['neutral-accueil-general']);
 assert.equal(JSON.stringify(snapshot).includes('secret en construction'),false);
 assert.equal(JSON.stringify(snapshot).includes('https://youtu.be/abcdEFghI12'),false);
});
test('Saving a draft preserves independent old published snapshot',async()=>{
 const bucket=new Bucket(),e=await env(bucket),cookie=await signedCookie();
 const original=initial();
 const edited=structuredClone(original.drafts['101']);
 edited.pages[0].blocks[0].src='/media/media/new-edited-photo.jpg';
 const request=new Request(host+'/api/editor-open-draft',{
  method:'POST',headers:{origin:host,cookie,'content-type':'application/json'},
  body:JSON.stringify({celebration:'101',expectedRevision:1,record:edited,plans:[],
    shared:original.shared})});
 assert.equal((await handleServerDraft(request,e)).status,200);
 const {state}=await readEditorState(bucket);
 assert.equal(state.version,2);
 assert.equal(state.drafts['101'].pages[0].blocks[0].src,'/media/media/new-edited-photo.jpg');
 assert.equal(publicSnapshot(state,'101').record.pages[0].blocks[0].src,
  '/media/media/historical.jpg','saved changes must not leak to visitor before publish');
});
test('Page publication, masking and unpublished celebration are protected and reversible',async()=>{
 const bucket=new Bucket(),e=await env(bucket),cookie=await signedCookie();
 const first=await handleEditorPublication(body({kind:'page',celebration:'101',
   expectedRevision:1,visibility:'published',
   pageId:'extra-01234567-89ab-4cde-8f01-123456789abc-101'},cookie),e);
 assert.equal(first.status,200);
 let state=(await readEditorState(bucket)).state;
 assert.equal(publicSnapshot(state,'101').record.pages.length,2);
 let res=await handleEditorPublication(body({kind:'page',celebration:'101',expectedRevision:2,
   visibility:'hidden',pageId:'mercredi-101'},cookie),e);
 assert.equal(res.status,200);
 state=(await readEditorState(bucket)).state;
 assert.deepEqual(publicSnapshot(state,'101').record.pages.map(p=>p.name),['Page en cours']);
 res=await handleEditorPublication(body({kind:'celebration',celebration:'101',
  expectedRevision:3,visibility:'hidden'},cookie),e);
 assert.equal(res.status,200);
 state=(await readEditorState(bucket)).state;
 assert.equal(publicSnapshot(state,'101').record,null);
 res=await handleEditorPublication(body({kind:'celebration',celebration:'101',
  expectedRevision:4,visibility:'published'},cookie),e);
 assert.equal(res.status,200);
 state=(await readEditorState(bucket)).state;
 assert.equal(publicSnapshot(state,'101').record.pages.length,1);
});
test('Unauthenticated publication is rejected; stale revisions never overwrite',async()=>{
 const bucket=new Bucket(),e=await env(bucket);
 const request=body({kind:'page',celebration:'101',expectedRevision:1,
   visibility:'hidden',pageId:'mercredi-101'},'');
 assert.equal((await handleEditorPublication(request,e)).status,401);
 const cookie=await signedCookie();
 assert.equal((await handleEditorPublication(body({kind:'page',celebration:'101',expectedRevision:0,
   visibility:'hidden',pageId:'mercredi-101'},cookie),e)).status,409);
});
test('All media links from nested sections appear in private global media index',()=>{
 const state=initial();
 state.drafts['101'].pages[0].blocks.push({id:'nested',kind:'section',columns:[[
  {id:'img',kind:'image',src:'https://example.org/photo.png'},
  {id:'pdf',kind:'button',href:'https://example.org/file.pdf'}
 ],[
  {id:'vid',kind:'video',href:'https://youtube.com/watch?v=abcDEF12345'}
 ]]});
 const index=discoverMedia(state);
 assert.ok(index.some(x=>x.type==='image'&&x.src==='https://example.org/photo.png'));
 assert.ok(index.some(x=>x.type==='pdf'&&x.src==='https://example.org/file.pdf'));
 assert.ok(index.some(x=>x.type==='video'&&x.src.includes('youtube.com')));
});
test('External media may be added without server upload and made public only by explicit choice',async()=>{
 const bucket=new Bucket(),e=await env(bucket),cookie=await signedCookie();
 const added=await handleEditorMedia(new Request(host+'/api/editor-media?action=external',{
  method:'POST',headers:{origin:host,cookie,'content-type':'application/json'},
  body:JSON.stringify({type:'pdf',src:'https://example.org/doc.pdf',name:'PDF extérieur'})}),e);
 assert.equal(added.status,200);
 const info=await added.json();
 assert.equal(info.item.general,false);
 let state=(await readEditorState(bucket)).state;
 assert.equal(publicSnapshot(state,'101').media.length,0);
 const shown=await handleEditorPublication(body({kind:'media',celebration:'101',
  expectedRevision:info.revision,mediaId:info.item.id,general:true},cookie),e);
 assert.equal(shown.status,200);
 state=(await readEditorState(bucket)).state;
 assert.equal(publicSnapshot(state,'101').media[0].src,'https://example.org/doc.pdf');
});
