import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {createBlockModel} from '../migration/cloudflare/app/domain/editor-block-model.mjs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';

// Focused regression tests for independent buttons inside editable sections.
// The public renderer is exercised without changing staging or published data.
function newButtonFactory(){
 const start=DEMO_CLIENT.indexOf('function createContent(kind){');
 const end=DEMO_CLIENT.indexOf('\nfunction add(kind)',start);
 assert.ok(start>=0&&end>start,'Editor button constructor must exist');
 let id=1000;
 return new Function('uniqueBlockId','STARTER_TEXT','editorBlockModel',
  DEMO_CLIENT.slice(start,end)+';return createContent;')(
   ()=>++id,{heading:'Nouveau titre',text:'Votre paragraphe',
    button:'Mon bouton',event:'Titre de l’événement'},createBlockModel());
}
function element(tag,className='',textContent=''){
 const node={tag,className,textContent,children:[],dataset:{},style:{},
  append(...children){this.children.push(...children)},
  prepend(...children){this.children.unshift(...children)},
  setAttribute(name,value){(this.attributes??={})[name]=String(value)}};
 node.classList={contains(value){return node.className.split(/\s+/).includes(value)}};
 return node;
}
function descendants(el){
 return [el,...(el.children||[]).flatMap(descendants)];
}
function renderer(){
 const start=TRIAL_SITE_CLIENT.indexOf('function appendPageBlock(b,root){');
 const end=TRIAL_SITE_CLIENT.indexOf('\n for(const b of page.blocks||[])appendPageBlock',start);
 assert.ok(start>=0&&end>start,'Public section renderer must exist');
 return new Function('make','urlOk','siteVideoInfo','blobUrls','validClock',
  'applyStyle','siteLinkCard','mainHeadingRendered',
  TRIAL_SITE_CLIENT.slice(start,end)+';return appendPageBlock;')(
   element,
   value=>/^(?:https:\/\/|\/)/.test(value||'')?value:'',
   href=>/youtube|vimeo/i.test(href||'')?{thumbnail:'/video-thumbnail.jpg',embed:'https://video.test/embed'}:null,
   new Map(),()=>false,()=>{},
   (href,title)=>element('span','site-link-card',title),false);
}
function renderSection(buttons){
 const root=element('main');
 renderer()({id:'resource',kind:'section',layout:'columns',presentation:'resource',
  columns:[[],buttons]},root);
 return descendants(root);
}

test('new section buttons have distinct IDs and opt into exact labeled button rendering',()=>{
 const create=newButtonFactory();
 const first=create('button'),second=create('button'),third=create('button');
 assert.notEqual(first.id,second.id);
 assert.notEqual(second.id,third.id);
 for(const item of [first,second,third]){
  assert.equal(item.kind,'button');
  assert.equal(item.displayAsButton,true);
 }
 assert.match(DEMO_CLIENT,/x\.href=v;delete x\.assetId;x\.displayAsButton=true;mark\(\);render\(\)/,
  'Editing an older button URL must also keep its explicit button appearance');
});

test('several independent buttons keep their own titles and URLs, including YouTube and Vimeo',()=>{
 const create=newButtonFactory();
 const entries=[
  ['Voir sur YouTube','https://www.youtube.com/watch?v=abc'],
  ['Voir sur Vimeo','https://vimeo.com/123'],
  ['Lire la prière','/media/priere156.pdf'],
  ['Visiter le site','https://example.org']
 ];
 const buttons=entries.map(([title,url])=>Object.assign(create('button'),{text:title,href:url}));
 const snapshot=JSON.parse(JSON.stringify(buttons));
 assert.deepEqual(snapshot.map(b=>b.href),entries.map(x=>x[1]),'Each URL is saved independently');
 const anchors=renderSection(snapshot).filter(x=>x.tag==='a');
 assert.equal(anchors.length,4,'No button is dropped');
 for(let i=0;i<entries.length;i++){
  assert.equal(anchors[i].className,'trial-button','A button is not converted into a video/site card');
  assert.equal(anchors[i].textContent,entries[i][0],'Custom button title is preserved');
  assert.equal(anchors[i].href,entries[i][1],'Custom URL is preserved');
 }
 assert.equal(renderSection(snapshot).filter(x=>x.className==='trial-video').length,0,
  'A separate user-added video link never turns into another media player');
});

test('updating and deleting one button do not change its neighbors',()=>{
 const create=newButtonFactory();
 const a=Object.assign(create('button'),{text:'Première vidéo',href:'https://youtu.be/one'});
 const b=Object.assign(create('button'),{text:'Deuxième vidéo',href:'https://vimeo.com/two'});
 const section={columns:[[],[a,b]]};
 b.text='Autre hébergeur';b.href='https://video.example.org/new';
 assert.equal(section.columns[1][0].href,'https://youtu.be/one');
 assert.equal(section.columns[1][0].text,'Première vidéo');
 const duplicate=JSON.parse(JSON.stringify(b));duplicate.id=9999;
 section.columns[1].push(duplicate);
 assert.equal(renderSection(section.columns[1]).filter(n=>n.tag==='a').length,3);
 section.columns[1].splice(1,1);
 const remaining=renderSection(section.columns[1]).filter(n=>n.tag==='a');
 assert.deepEqual(remaining.map(n=>n.href),['https://youtu.be/one','https://video.example.org/new']);
});

test('unchanged historical PDF labels and video thumbnails keep their existing appearance',()=>{
 const legacyPdf={kind:'button',text:'Ouvrir le PDF : Prière 156',href:'/media/priere156.pdf'};
 const anchors=renderSection([legacyPdf]).filter(x=>x.tag==='a');
 assert.equal(anchors.length,1);
 assert.equal(anchors[0].className,'trial-button');
 assert.equal(anchors[0].textContent,'📄 Ouvrir le PDF');
 const oldVideo=element('main');
 renderer()({kind:'button',text:'Ancienne conférence',href:'https://youtube.com/watch?v=abc'},oldVideo);
 assert.equal(descendants(oldVideo).filter(x=>x.className==='trial-video').length,1,
  'Existing linked-video thumbnails still appear');
});
