import test from 'node:test';
import assert from 'node:assert/strict';
import {readEditorState,publicSnapshot,discoverMedia,publishedMedia,publicHistoricalMedia,
 mergePublicMedia,videoMediaUrl,handleEditorPublication,handleEditorMedia} from '../migration/cloudflare/editor-publication-api.mjs';
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
// Regression for the on-phone “Échec — réessayer” /
// “Traductions ou registre multilingue invalides” reported on many pages.
// The editor submits one global translation catalogue while saving only
// the currently selected celebration.
test('saving Michaël keeps already-saved Gabriel translations without rejecting the whole page',async()=>{
 const state=initial();
 state.drafts['202']={pages:[{
  id:'preparation-202',name:'Préparation',group:'celebration',blocks:[
   {id:'gabriel-intro',kind:'text',text:'Texte original'}]
 }],celebrationDates:{},celebrationTimes:{}};
 state.localization={registry:{version:1,defaultLanguageId:'fr',languages:[
  {id:'fr',name:'Français',active:true},{id:'en',name:'English',active:true}
 ]},pages:{'preparation-202':{en:{
  name:'Preparation',blocks:[{id:'gabriel-intro',kind:'text',text:'English text'}]
 }}}};
 const bucket=new Bucket(state),e=await env(bucket),cookie=await signedCookie();
 const response=await handleServerDraft(new Request(host+'/api/editor-open-draft',{
  method:'POST',headers:{origin:host,cookie,'content-type':'application/json'},
  body:JSON.stringify({celebration:'101',expectedRevision:1,
   record:state.drafts['101'],plans:[],shared:state.shared,localization:state.localization,
   publishPageId:'mercredi-101'})
 }),e);
 assert.equal(response.status,200,await response.text());
 const saved=(await readEditorState(bucket)).state;
 assert.deepEqual(saved.localization,state.localization);
 assert.equal(saved.drafts['202'].pages[0].blocks[0].text,'Texte original');
 assert.equal(saved.drafts['101'].pages[0].blocks[0].src,'/media/media/historical.jpg');
});
test('a fabricated or private-language page cannot be smuggled into the global catalogue',async()=>{
 const state=initial();
 const bucket=new Bucket(state),e=await env(bucket),cookie=await signedCookie();
 const invalid={registry:{version:1,defaultLanguageId:'fr',languages:[
  {id:'fr',name:'Français',active:true},{id:'en',name:'English',active:true}
 ]},pages:{'unknown-private-page':{en:{name:'Secret',blocks:[]}}}};
 const response=await handleServerDraft(new Request(host+'/api/editor-open-draft',{
  method:'POST',headers:{origin:host,cookie,'content-type':'application/json'},
  body:JSON.stringify({celebration:'101',expectedRevision:1,record:state.drafts['101'],
   plans:[],shared:state.shared,localization:invalid})
 }),e);
 assert.equal(response.status,400);
 assert.match((await response.json()).error,/Traductions ou registre multilingue invalides/);
 assert.equal((await readEditorState(bucket)).state.version,1);
});
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
 assert.ok(!publicSnapshot(state,'101').media.some(m=>m.src==='https://example.org/doc.pdf'),'Unpublished uploaded file stays private');
 const shown=await handleEditorPublication(body({kind:'media',celebration:'101',
  expectedRevision:info.revision,mediaId:info.item.id,general:true},cookie),e);
 assert.equal(shown.status,200);
 state=(await readEditorState(bucket)).state;
 assert.ok(publicSnapshot(state,'101').media.some(m=>m.src==='https://example.org/doc.pdf'),'Explicit general item visible alongside already published media');
});

test('media index excludes arbitrary link buttons and tracks general/draft/published usages',()=>{
 const state=initial();
 state.shared.pages[0].blocks.push({id:'home-photo',kind:'image',
  src:'/media/media/1791723108110/file-1791723109615-1000040461.jpg'});
 state.shared.pages[0].blocks.push({id:'nav',kind:'button',text:'Visiter le site',href:'https://example.org/'});
 state.shared.pages[0].blocks.push({id:'file',kind:'button',text:'Ouvrir le PDF',
  href:'https://example.org/existing.pdf'});
 state.mediaCatalogue=[
  {id:'image|/media/new/12345678-1234-4234-8234-123456789abc.jpg',type:'image',
   src:'/media/new/12345678-1234-4234-8234-123456789abc.jpg',name:'10000426.jpg',source:'uploaded'},
  {id:'link|https://example.org/',type:'link',src:'https://example.org/',name:'Menu'}
 ];
 state.published=structuredClone(state);
 state.published.shared.pages[0].blocks=[
  {id:'historic-visible',kind:'image',src:'/media/media/still-online.jpg'}];
 const result=discoverMedia(state);
 assert.ok(!result.some(x=>x.type==='link'), 'Navigation button is never a media file');
 const home=result.find(x=>x.src.includes('1791723108110'));
 assert.equal(home.uses[0].pageName,'Accueil');
 assert.equal(home.uses[0].group,'page');
 assert.equal(home.uses[0].slug,'neutral-accueil-general');
 assert.equal(result.find(x=>x.name==='10000426.jpg')?.uses.length,0);
 assert.ok(result.find(x=>x.src.endsWith('still-online.jpg'))?.uses.length===1,
  'A published-only media remains listed as in use');
 assert.ok(result.find(x=>x.src==='https://example.org/existing.pdf')?.uses.length===1);
});

test('visitor general media includes all published page files, not draft uploads or buttons',()=>{
 const state=initial();
 state.drafts['101'].pages[0].blocks.push({id:'public-pdf',kind:'button',text:'PDF',
  href:'/media/public-programme.pdf'});
 state.drafts['101'].pages[1].blocks.push({id:'private-image',kind:'image',
  src:'/media/never-show-draft.jpg'});
 state.shared.pages[1].blocks.push({id:'hidden-file',kind:'image',src:'/media/hidden-shared.jpg'});
 state.mediaCatalogue=[
  {type:'image',src:'/media/new/unpublished-upload.jpg',name:'Private upload',general:false},
  {type:'audio',src:'https://example.org/public-audio.mp3',name:'Shared audio',general:true}
 ];
 const media=publicSnapshot(state,'101').media;
 assert.ok(media.some(m=>m.type==='image'&&m.src==='/media/media/historical.jpg'),
  'Published celebration photo appears by default');
 assert.ok(media.some(m=>m.type==='pdf'&&m.src==='/media/public-programme.pdf'));
 assert.ok(media.some(m=>m.src==='https://example.org/public-audio.mp3'));
 assert.ok(!media.some(m=>m.src.includes('unpublished-upload')));
 assert.ok(!media.some(m=>m.src.includes('never-show-draft')));
 assert.ok(!media.some(m=>m.src.includes('hidden-shared')));
});
test('historic public D1 files from all published celebrations are included, without private or hidden pages',async()=>{
 const state=initial();
 state.drafts['101'].pages.push({id:'samedi-101',name:'Samedi',group:'celebration',
  visibility:'hidden',blocks:[]});
 state.drafts['202']={pages:[{id:'preparation-202',name:'Préparation',group:'celebration',
  blocks:[]}]};
 state.shared.celebrationVisibility={'202':'hidden'};
 const publicContent=[
  {celebration_id:101,step_key:'mercredi-101',name:'Archive PDF',
   source_type:'file',storage_path:'media/archives/programme.pdf'},
  {celebration_id:101,step_key:'mercredi-101',name:'Chant',
   source_type:'file',storage_path:'media/archives/chant.mp3'},
  {celebration_id:101,step_key:'mercredi-101',name:'Dossier texte',
   source_type:'file',storage_path:'media/documents/explications.txt'},
  {celebration_id:101,step_key:'mercredi-101',name:'Photo',
   source_type:'file',storage_path:'media/galerie/photo.jpg',has_cover:1,
   cover_storage_path:'media/galerie/couverture.jpg'},
  {celebration_id:101,step_key:'mercredi-101',name:'Chant vidéo',
   content_type:'Video',source_type:'url',external_url:'https://youtu.be/dQw4w9WgXcQ'},
  {celebration_id:101,step_key:'mercredi-101',name:'Lecture YouTube',
   content_type:'Lien',source_type:'url',external_url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ'},
  {celebration_id:101,step_key:'mercredi-101',name:'Film Vimeo',
   content_type:'external',source_type:'url',external_url:'https://vimeo.com/123456789'},
  {celebration_id:101,step_key:'mercredi-101',name:'Menu web à exclure',
   content_type:'Lien',source_type:'url',external_url:'https://example.org/accueil'},
  {celebration_id:101,step_key:'samedi-101',name:'Image cachée',
   source_type:'file',storage_path:'media/cache.jpg'},
  {celebration_id:202,step_key:'preparation-202',name:'Célébration masquée',
   source_type:'file',storage_path:'media/secret.jpg'},
  {celebration_id:101,step_key:'mercredi-101',name:'Comité interne',
   source_type:'file',storage_path:'committee/private.pdf'}
 ];
 const db={prepare(sql){return {all:async()=>({results:
  sql.includes('FROM celebrations_event_contents')?publicContent:[]})}}};
 const historic=await publicHistoricalMedia(db,state);
 for(const name of ['Archive PDF','Chant','Dossier texte','Photo','Chant vidéo','Lecture YouTube','Film Vimeo'])
  assert.ok(historic.some(x=>x.name===name),name);
 assert.ok(historic.some(x=>x.src.endsWith('couverture.jpg')),'A cover is an actual image file');
 assert.ok(historic.some(x=>x.type==='file'&&x.src.endsWith('.txt')),'Text file is not inline text');
 assert.ok(!historic.some(x=>x.src.includes('cache.jpg')));
 assert.ok(!historic.some(x=>x.src.includes('secret.jpg')));
 assert.ok(!historic.some(x=>x.src.includes('private.pdf')));
 assert.ok(!historic.some(x=>x.name==='Menu web à exclure'));
 assert.ok(historic.every(x=>x.uses.length>0));
 const merged=mergePublicMedia(publishedMedia(state),historic,historic);
 assert.equal(merged.filter(x=>x.src.endsWith('programme.pdf')).length,1,'URLs de-duplicated');
});

test('general visitor library extracts real videos from published links, never arbitrary websites',()=>{
 const state=initial();
 state.drafts['101'].pages[0].blocks.push(
  {id:'youtube-button',kind:'button',text:'Enregistrement filmé',href:'https://youtu.be/dQw4w9WgXcQ'},
  {id:'video',kind:'video',text:'Vidéo du programme',href:'https://vimeo.com/123456789'},
  {id:'menu',kind:'button',text:'Site web',href:'https://example.org/bonjour'});
 state.drafts['101'].pages[1].blocks.push(
  {id:'private-vid',kind:'button',text:'Brouillon',href:'https://youtu.be/abcdefghijk'});
 const videos=publishedMedia(state).filter(x=>x.type==='video');
 assert.equal(videos.length,2,'Both video kinds appear in public media');
 assert.ok(videos.some(x=>x.name==='Enregistrement filmé'));
 assert.ok(videos.some(x=>x.name==='Vidéo du programme'));
 assert.ok(!videos.some(x=>x.src.includes('abcdefghijk')));
 assert.equal(videoMediaUrl('https://example.org/bonjour'),'');
 assert.equal(videoMediaUrl('https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ'),'');
 assert.ok(videoMediaUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'));
 assert.ok(videoMediaUrl('https://vimeo.com/123456789'));
 assert.ok(videoMediaUrl('https://www.dailymotion.com/video/x123456'));
});
