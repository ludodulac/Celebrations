import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createMediaCatalogue} from '../migration/cloudflare/app/domain/editor-media-catalogue.mjs';
import {createEditorMediaCommands} from '../migration/cloudflare/app/application/editor-media-commands.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';

const catalogue=createMediaCatalogue({validHref:s=>{
 const v=String(s||'');return v.startsWith('/')&&!v.startsWith('//')||v.startsWith('https://');
}});
const commands=createEditorMediaCommands();
const clone=x=>JSON.parse(JSON.stringify(x));

test('M08: browser script compiles and actually consumes the two new ESM modules',()=>{
 new vm.Script(DEMO_CLIENT);
 for(const needle of ['function createMediaCatalogue(','function createEditorMediaCommands(']){
  assert.equal(DEMO_CLIENT.split(needle).length-1,1,needle);
 }
 for(const needle of ['mediaCatalogue.pickerItems(','mediaCatalogue.imageItems(',
   'mediaCatalogue.libraryCollections(','mediaCatalogue.makeLibraryBlock(',
   'editorMediaCommands.chooseFile(','editorMediaCommands.chooseImage('])
  assert.ok(DEMO_CLIENT.includes(needle),needle);
 assert.ok(DEMO_CLIENT.includes("fetch('/api/editor-media?action=upload'"));
 assert.ok(DEMO_CLIENT.includes("fetch('/api/editor-media?action=delete'"));
 // Media is published through its published page. The former direct-toggle
 // helper was unreachable; do not require dead code to satisfy a string test.
 assert.ok(DEMO_CLIENT.includes("serverPublish({kind:'page'"));
 assert.ok(DEMO_CLIENT.includes("fetch('/api/editor-publication'"));
 assert.ok(!DEMO_CLIENT.includes('function showMediaPublicOption('));
 const publication=readFileSync('migration/cloudflare/editor-publication-api.mjs','utf8');
 assert.ok(publication.includes('projectPublicMediaItem'));
 assert.ok(publication.includes('mergePublicMediaIndexed'));
});
test('M08: known source categories and legacy local classifications remain stable',()=>{
 assert.deepEqual(catalogue.categories,[['images','Images'],['pdf','PDF'],['audios','Audios'],
  ['videos','Vidéos'],['autres','Autres']]);
 for(const [item,want] of [
  [{type:'image/png',name:'a'},'images'],[{type:'',name:'portrait.JPG'},'images'],
  [{type:'application/pdf',name:'livret'},'pdf'],[{type:'',name:'méditation.PDF'},'pdf'],
  [{type:'audio/mpeg',name:'chant'},'audios'],[{type:'',name:'musique.wav'},'audios'],
  [{type:'video/mp4',name:'film.mp4'},'autres'],[{type:'',name:'archive.docx'},'autres']
 ])assert.equal(catalogue.categoryOfLocal(item),want,JSON.stringify(item));
 for(const [type,want] of [['image','images'],['audio','audios'],['video','videos'],
  ['pdf','pdf'],['link','links'],['unknown','autres']])
  assert.equal(catalogue.mediaCategoryOf({type}),want);
});
test('M08: public seed inventory does not expose private links, bogus or unsafe paths',()=>{
 const source=[
  {name:'Photo',category:'images',src:'/media/photo.jpg'},
  {name:'Audio',category:'audios',src:'/media/chant.mp3'},
  {name:'Document',category:'pdf',src:'/media/p.pdf'},
  {name:'Refus',category:'images',src:'/media/../secret.jpg'},
  {name:'Refus',category:'images',src:'/private/server-draft.jpg'},
  {name:'Refus',category:'images',src:'https://another.site/p.png'},
  {name:'Refus',category:'not-public',src:'/media/secret.txt'},
  {name:'Refus',category:'images',src:'/media/p.png?token=secret'},
  {name:55,category:'pdf',src:'/media/no.pdf'}
 ];
 const saved=JSON.stringify(source);
 assert.deepEqual(catalogue.publicFiles(source).map(x=>x.name),['Photo','Audio','Document']);
 assert.equal(JSON.stringify(source),saved,'never change the original seed');
 assert.deepEqual(catalogue.publicFiles(undefined),[]);
});
test('M08: picker deduplicates historical/server entries by URL and preserves original provenance',()=>{
 const historical=[
  {name:'Ancien PDF',category:'pdf',src:'/media/p.pdf'},
  {name:'Photo historique',category:'images',src:'/media/photo.jpg'},
  {name:'Privé',category:'images',src:'javascript:alert(1)'}
 ];
 const server=[
  {name:'PDF recopié',type:'pdf',src:'/media/p.pdf'},
  {name:'Présentation.mp4',type:'video',src:'/media/vid.mp4'},
  {name:'Enregistrement',type:'audio',src:'/media/voice.mp3'},
  {name:'Photo du serveur',type:'image',src:'/media/new/image.jpg'},
  {name:'Lien web',type:'link',src:'https://example.org'},
  {name:'Adresse rejetée',type:'image',src:'javascript:evil(1)'}
 ];
 const before=JSON.stringify({historical,server});
 const actual=catalogue.pickerItems(historical,server);
 assert.equal(actual.length,6);
 assert.equal(actual.find(x=>x.src==='/media/p.pdf').name,'Ancien PDF');
 assert.equal(actual.find(x=>x.src==='/media/vid.mp4').category,'videos');
 assert.equal(actual.find(x=>x.src==='/media/voice.mp3').category,'audios');
 assert.equal(actual.find(x=>x.src==='https://example.org').category,'autres');
 assert.ok(actual.every(x=>!x.src.startsWith('javascript:')));
 assert.deepEqual(actual.map(x=>x.name),actual.map(x=>x.name).sort((a,b)=>a.localeCompare(b,'fr')));
 assert.equal(JSON.stringify({historical,server}),before);
});
test('M08: chosen video remains a video with intact caption/thumbnail; no conversion to button',()=>{
 const video={id:'v',kind:'video',href:'',text:'Titre déjà écrit',
  cover:'/media/affiche.jpg',extra:{quality:'HD'}};
 const original=clone(video);
 assert.equal(commands.chooseFile(video,{src:'/media/photo.jpg',name:'Photo',category:'images'},true),false);
 assert.deepEqual(video,original);
 assert.equal(commands.chooseFile(video,{src:'/media/film.mp4',name:'Film.mp4',category:'videos'},true),true);
 assert.equal(video.kind,'video');assert.equal(video.href,'/media/film.mp4');
 assert.equal(video.text,'Titre déjà écrit');assert.equal(video.cover,'/media/affiche.jpg');
 assert.deepEqual(video.extra,{quality:'HD'});
 const blank={kind:'video',text:'',assetId:'device-id'};
 commands.chooseFile(blank,{src:'/media/film.webm',name:'Film.webm',category:'videos'},true);
 assert.equal(blank.text,'Film');assert.equal(blank.kind,'video');assert.ok(!('assetId' in blank));
});
test('M08: button assignment clears stale cover but never modifies adjacent blocks',()=>{
 const first={kind:'button',text:'Mon bouton',href:'',assetId:'old',cover:'old.jpg',coverAssetId:'old-id'};
 const second={kind:'button',text:'Important',href:'/letter/a.pdf'};
 const snapshot=JSON.stringify(second);
 assert.equal(commands.chooseFile(first,{name:'Texte.pdf',src:'/media/texte.pdf',category:'pdf'},false),true);
 assert.equal(first.text,'Ouvrir : Texte.pdf');assert.equal(first.displayAsButton,true);
 assert.equal(first.href,'/media/texte.pdf');
 assert.ok(!('assetId' in first));assert.ok(!('cover' in first));
 assert.ok(!('coverAssetId' in first));assert.equal(JSON.stringify(second),snapshot);
});
test('M08: image chooser includes nested pages and deduplicates without changing stored records',()=>{
 const historical=[{name:'Ancienne',category:'images',src:'/media/photo.jpg'},
  {name:'Ignoré',category:'pdf',src:'/media/doc.pdf'}];
 const pages=[{blocks:[
  {kind:'image',src:'/media/photo.jpg',text:'Ceci est une copie'},
  {kind:'section',columns:[
   [{kind:'image',src:'/media/inner.jpg',text:'Colonne'}],
   [{kind:'text',text:'Ne pas convertir'}]
  ]}
 ]}];
 const server=[{type:'image',name:'Publié',src:'/media/new/photo.jpg'},
  {type:'image',name:'Même photo',src:'/media/photo.jpg'},
  {type:'video',name:'Film',src:'/media/film.mp4'}];
 const locals=[{id:'local-1',name:'Sur cet appareil',type:'image/png'}];
 const urls=new Map([['local-1','blob:https://local.test/a']]);
 const before=JSON.stringify({historical,pages,server,locals});
 const result=catalogue.imageItems({historical,pages,globalMedia:server,fileRecords:locals,assetUrls:urls});
 assert.deepEqual(result.entries.map(x=>x.src),['/media/photo.jpg','/media/inner.jpg','/media/new/photo.jpg']);
 assert.deepEqual(result.local,[{name:'Sur cet appareil',src:'blob:https://local.test/a',assetId:'local-1'}]);
 assert.equal(result.entries[0].name,'Ancienne','archive name keeps precedence');
 assert.equal(JSON.stringify({historical,pages,server,locals}),before);
});
test('M08: assigning thumbnail never clears video file link; assigning image retains other data',()=>{
 const video={kind:'video',href:'https://example.org/video',text:'Conférence',coverAssetId:'old'};
 commands.chooseImage(video,{src:'/media/new/cover.jpg'},true);
 assert.equal(video.href,'https://example.org/video');
 assert.equal(video.cover,'/media/new/cover.jpg');assert.equal(video.coverAssetId,'');
 const img={kind:'image',src:'/media/ancien.jpg',assetId:'old-device',widthPct:45,rich:'legacy'};
 commands.chooseImage(img,{assetId:'new-device'},false);
 assert.equal(img.src,'');assert.equal(img.assetId,'new-device');
 assert.equal(img.widthPct,45);assert.equal(img.rich,'legacy');
});
test('M08: global cards count every source only once by already-visible precedence',()=>{
 const historical=[{name:'PDF',src:'/media/doc.pdf',category:'pdf'},{name:'Image',src:'/media/p.jpg',category:'images'}];
 const local=[{id:1,type:'image/png',name:'new.png',createdAt:'2026-10-01'},
  {id:2,type:'audio/mpeg',name:'chant.mp3',createdAt:'2026-11-01'}];
 const remote=[{src:'/media/doc.pdf',type:'pdf'},
  {src:'/media/film.mp4',type:'video'},{src:'/media/new/wav.mp3',type:'audio'},
  {src:'/media/new/pic.jpg',type:'image'},{src:'/media/path',type:'link'}];
 const saved=JSON.stringify({historical,local,remote});
 const result=catalogue.libraryCollections(historical,local,remote);
 assert.deepEqual(result.local.map(x=>x.id),[2,1]);
 assert.equal(result.remote.length,4,'external link remains outside visible category cards');
 assert.equal(result.countFor('pdf'),1,'same historical PDF is not shown twice');
 assert.equal(result.countFor('images'),3,'historical, local and new remote images each count once');
 assert.equal(result.countFor('audios'),2);
 assert.equal(result.countFor('videos'),1);
 assert.equal(JSON.stringify({historical,local,remote}),saved);
});
test('M08: library block types, time labels and source fields remain compatible',()=>{
 for(const [category,kind,field] of [
  ['images','image','src'],['audios','audio','src'],
  ['videos','video','href'],['pdf','button','href'],['autres','button','href']
 ]){
  const result=catalogue.makeLibraryBlock({category,name:'Document',src:'/media/source'},'18:15','block-id');
  assert.equal(result.id,'block-id');assert.equal(result.kind,kind);assert.equal(result[field],'/media/source');
  assert.equal(result.atTime,'18:15');
 }
 const rich=catalogue.makeLibraryBlock({category:'autres',name:'Texte',text:'Manuscrit'},null,44);
 assert.equal(rich.kind,'text');assert.equal(rich.text,'Manuscrit');
 const file=catalogue.makeLibraryBlock({category:'audios',name:'MP3',remoteKey:'editor-trials/audio/a.mp3',assetId:'device'},null,'a');
 assert.equal(file.remoteKey,'editor-trials/audio/a.mp3');assert.ok(!('assetId' in file));
});
test('M08: catalogue/selection modules remain side-effect-free by construction',()=>{
 for(const file of [
  'migration/cloudflare/app/domain/editor-media-catalogue.mjs',
  'migration/cloudflare/app/application/editor-media-commands.mjs']){
  const text=readFileSync(file,'utf8');
  for(const forbidden of ['fetch(', 'localStorage', 'serverPublish(', 'serverSave(', 'indexedDB.open', 'navigator.serviceWorker'])
   assert.ok(!text.includes(forbidden),file+': '+forbidden);
 }
});
