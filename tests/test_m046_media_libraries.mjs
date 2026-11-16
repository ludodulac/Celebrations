// M046: non-destructive media library and four user-approved video categories.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {createMediaCatalogue} from '../migration/cloudflare/app/domain/editor-media-catalogue.mjs';

const admin=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
const server=readFileSync(new URL('../migration/cloudflare/editor-publication-api.mjs',import.meta.url),'utf8');
const catalogue=createMediaCatalogue({validHref:x=>String(x).startsWith('/media/')?x:''});

test('M046: embedded visitor and administrator scripts parse',()=>{
 assert.doesNotThrow(()=>new Function(TRIAL_SITE_CLIENT));
 assert.doesNotThrow(()=>new Function(DEMO_CLIENT));
});

test('M046: visitor gallery excludes original images but retains PDF/audio/video',()=>{
 assert.match(TRIAL_SITE_CLIENT,/published page images are NOT|published page images/i);
 assert.match(TRIAL_SITE_CLIENT,/\.filter\(item=>item\.type!=='image'\)/);
 assert.doesNotMatch(TRIAL_SITE_CLIENT,/\['image',t\('Images'\)\]/);
 assert.match(TRIAL_SITE_CLIENT,/\['audio',t\('Audios'\)\],\['video',t\('Vidéos'\)\],\['text',t\('Documents'\)\]/);
});

test('M049: three video categories, old exercises and explanations still recognized',()=>{
 const types=['Conférences','Rituels','Exercices et explications'];
 for(const type of types){
  assert.ok(TRIAL_SITE_CLIENT.includes(type));
  assert.ok(server.includes(type));
  assert.ok(admin.includes(type));
 }
 assert.match(TRIAL_SITE_CLIENT,/item.videoType==='Exercices'\|\|item.videoType==='Explications'/);
 assert.match(server,/action==='set-video-type'/);
 assert.match(server,/VIDEO_TYPES\.includes\(input\.videoType\)/);
});

test('M046: media category can be restricted by celebration AND page on all tabs',()=>{
 assert.match(admin,/mediaCelebrationFilter/);
 assert.match(admin,/mediaPageFilter/);
 assert.match(admin,/allUses=\[\.\.\.remote\.flatMap/);
 assert.match(admin,/card\._mediaUses=refs/);
 assert.match(admin,/mediaSort==='recent'/);
});

test('M046: image renaming keeps stable source URLs and privileged revision',()=>{
 assert.match(server,/action==='rename'/);
 assert.match(server,/target\.name=name/);
 assert.match(server,/expectedRevisionMatches\(input\.expectedRevision,current\.state\.version\)/);
 assert.match(admin,/renameMediaSource\(image\.src,image\.name\)/);
 assert.match(admin,/Nom de cette image dans la médiathèque/);
});

test('M046: deleting used images is non-destructive, with explicit warning',()=>{
 assert.match(server,/target\.hiddenFromLibrary=true/);
 assert.match(server,/retainedOnPages:true/);
 assert.match(admin,/Pour ne pas casser le site/);
 assert.match(admin,/hiddenMediaUrls/);
});

test('M046: renamed image wins over original filename in picker',()=>{
 const src='/media/new/gabriel.jpg';
 const result=catalogue.imageItems({
  historical:[{category:'images',src,name:'Nom original'}],
  globalMedia:[{type:'image',src,name:'Nom donné par administrateur'}],
  pages:[],fileRecords:[],assetUrls:new Map(),hiddenMediaUrls:new Set()
 });
 assert.deepEqual(result.entries,[{src,name:'Nom donné par administrateur'}]);
});

test('M046: a removed image cannot return through a page or old archive',()=>{
 const src='/media/new/gabriel.jpg';
 const result=catalogue.imageItems({
  historical:[{category:'images',src,name:'Archives'}],
  globalMedia:[],hiddenMediaUrls:new Set([src]),
  pages:[{blocks:[{kind:'image',src,text:'Ancienne photo'}]}],
  fileRecords:[],assetUrls:new Map()
 });
 assert.equal(result.entries.length,0);
});
