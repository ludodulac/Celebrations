import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {createBlockModel} from '../migration/cloudflare/app/domain/editor-block-model.mjs';
import {DEMO_CSS} from '../migration/cloudflare/editor-demo-style.mjs';
import {TRIAL_SITE_CLIENT,TRIAL_SITE_STYLE} from '../migration/cloudflare/editor-trial-site-client.mjs';

// Step 3 covers presentation only; the stored links/media and publication rules
// must remain unchanged. These tests need no real user data or staging writes.
function fakeElement(tag,className='',textContent=''){
 const node={
  tag,className,textContent,dataset:{},style:{},children:[],
  append(...items){this.children.push(...items)},
  prepend(...items){this.children.unshift(...items)},
  setAttribute(name,value){(this.attributes??={})[name]=String(value)}
 };
 node.classList={contains(value){return node.className.split(/\s+/).includes(value)}};
 return node;
}
function flattened(node){return [node,...(node.children||[]).flatMap(flattened)]}
function editorHelpers(){
 const start=DEMO_CLIENT.lastIndexOf('function columnVerticalAlign(section,index){');
 const end=DEMO_CLIENT.indexOf('\nfunction sectionColumn(section,p,index,single=false){',start);
 assert.ok(start>=0&&end>start,'Find the column settings helpers');
 let marked=0,rendered=0;
 const fn=new Function('n','mark','render','editorBlockModel',
  DEMO_CLIENT.slice(start,end)+
  ';return {columnVerticalAlign,columnButtonLayout,columnPresentationSettings};');
 const helpers=fn(fakeElement,()=>marked++,()=>rendered++,createBlockModel());
 return {...helpers,counts:()=>({marked,rendered})};
}
function publicRenderer(){
 const start=TRIAL_SITE_CLIENT.indexOf('function appendPageBlock(b,root){');
 const end=TRIAL_SITE_CLIENT.indexOf('\n for(const b of page.blocks||[])appendPageBlock',start);
 assert.ok(start>=0&&end>start,'Find public content renderer');
 return new Function('make','urlOk','siteVideoInfo','blobUrls','validClock',
  'applyStyle','siteLinkCard','mainHeadingRendered',
  TRIAL_SITE_CLIENT.slice(start,end)+';return appendPageBlock;')(
   fakeElement,value=>/^(?:https:\/\/|\/)/.test(value||'')?value:'',
   href=>/youtu|vimeo/i.test(href||'')?{thumbnail:'/thumb.png',embed:'https://example.org/embed'}:null,
   new Map(),()=>false,()=>{},
   (href,title)=>fakeElement('span','site-link-card',title),false
  );
}
test('free columns default to top, while existing image/resource presentations remain centered',()=>{
 const {columnVerticalAlign,columnButtonLayout}=editorHelpers();
 const free={kind:'section',layout:'columns',columns:[[],[]]};
 const legacy={...free,presentation:'resource'};
 assert.deepEqual([0,1].map(i=>columnVerticalAlign(free,i)),['top','top']);
 assert.deepEqual([0,1].map(i=>columnVerticalAlign(legacy,i)),['center','center']);
 assert.equal(columnVerticalAlign({...legacy,columnAlignments:['bottom','top']},0),'bottom');
 assert.equal(columnVerticalAlign({...legacy,columnAlignments:['bottom','top']},1),'top');
 assert.equal(columnVerticalAlign({...free,columnAlignments:['invalid']},0),'top');
 assert.equal(columnButtonLayout(free,0),'stack','Stacked buttons are the default');
});
test('each column has independent vertical alignment and button-row controls',()=>{
 const {columnPresentationSettings,counts}=editorHelpers();
 const section={kind:'section',layout:'columns',presentation:'resource',columns:[[],[]]};
 const right=columnPresentationSettings(section,1);
 const selects=flattened(right).filter(n=>n.tag==='select');
 assert.equal(selects.length,2);
 assert.match(selects[0].attributes['aria-label'],/Alignement vertical/);
 selects[0].value='bottom';selects[0].onchange();
 assert.deepEqual(section.columnAlignments,['center','bottom'],
  'Changing right alignment preserves left resource center');
 const left=columnPresentationSettings(section,0);
 const leftSelects=flattened(left).filter(n=>n.tag==='select');
 leftSelects[0].value='top';leftSelects[0].onchange();
 assert.deepEqual(section.columnAlignments,['top','bottom']);
 selects[1].value='row';selects[1].onchange();
 assert.deepEqual(section.columnButtonLayouts,['stack','row']);
 assert.equal(counts().marked,3,'A choice marks the page as modified');
 assert.equal(counts().rendered,3,'A choice refreshes the visual editor');
});
test('section configuration is serialized, and the public viewer applies the same settings',()=>{
 const section={id:'preset',kind:'section',layout:'columns',presentation:'resource',
  columnAlignments:['top','center'],columnButtonLayouts:['stack','row'],
  columns:[[],[
   {kind:'button',displayAsButton:true,text:'YouTube',href:'https://youtu.be/demo'},
   {kind:'button',displayAsButton:true,text:'Vimeo',href:'https://vimeo.com/123'}
  ]]};
 const stored=JSON.parse(JSON.stringify(section));
 const root=fakeElement('main');
 publicRenderer()(stored,root);
 const columns=flattened(root).filter(n=>n.className==='trial-content-column');
 assert.equal(columns.length,2);
 assert.deepEqual(columns.map(n=>n.dataset.verticalAlign),['top','center']);
 assert.deepEqual(columns.map(n=>n.dataset.buttonLayout),['stack','row']);
 const links=flattened(root).filter(n=>n.tag==='a');
 assert.equal(links.length,2);
 assert.deepEqual(links.map(n=>n.textContent),['YouTube','Vimeo']);
 assert.deepEqual(links.map(n=>n.href),['https://youtu.be/demo','https://vimeo.com/123']);
 assert.equal(flattened(root).filter(n=>n.className==='trial-video').length,0,
  'Button links must not turn into media thumbnails');
});
test('single sections can also offer side-by-side buttons without becoming two columns',()=>{
 const section={kind:'section',layout:'single',columnButtonLayouts:['row','stack'],
  columns:[[
   {kind:'button',displayAsButton:true,text:'PDF',href:'/media/a.pdf'},
   {kind:'button',displayAsButton:true,text:'Site',href:'https://example.org'}
  ],[]]};
 const root=fakeElement('main');
 publicRenderer()(section,root);
 const col=flattened(root).find(n=>n.className==='trial-content-column');
 assert.ok(col);
 assert.equal(col.dataset.buttonLayout,'row');
 assert.equal(flattened(root).filter(n=>n.tag==='a').length,2);
});
test('mobile resets vertical centering and stacks button rows; card/image styles stay intact',()=>{
 assert.match(TRIAL_SITE_STYLE,/\.trial-content-section\[data-layout="columns"\]>.trial-content-columns>.trial-content-column\[data-vertical-align="center"\]\{align-self:center\}/);
 assert.match(TRIAL_SITE_STYLE,/@media\(max-width:680px\)\{[\s\S]*?align-self:start!important/);
 assert.match(TRIAL_SITE_STYLE,/@media\(max-width:680px\)\{[\s\S]*?\.trial-content-column\[data-button-layout="row"\]\{display:block\}/);
 assert.match(DEMO_CSS,/\.section-column\[data-button-layout="row"\]\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(DEMO_CSS,/@media\(max-width:680px\)\{[\s\S]*?\.section-column\[data-button-layout="row"\]\{[\s\S]*?display:flex!important/);
 assert.match(TRIAL_SITE_STYLE,/grid-template-columns:minmax\(145px,28fr\) minmax\(0,72fr\)/);
 assert.match(TRIAL_SITE_STYLE,/max-height:195px;object-fit:contain/);
 assert.match(TRIAL_SITE_STYLE,/box-shadow:0 2px 9px #252c2510/);
});
