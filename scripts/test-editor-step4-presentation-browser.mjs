import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {DEMO_CSS} from '../migration/cloudflare/editor-demo-style.mjs';
import {TRIAL_SITE_CLIENT,TRIAL_SITE_STYLE} from '../migration/cloudflare/editor-trial-site-client.mjs';

// Isolated real Chromium layout test. No Cloudflare credentials, no remote site,
// no user records, no deployment. Use the actual viewer renderer and CSS.
const begin=TRIAL_SITE_CLIENT.indexOf('function appendPageBlock(b,root){');
const end=TRIAL_SITE_CLIENT.indexOf('\n for(const b of page.blocks||[])appendPageBlock',begin);
assert.ok(begin>=0&&end>begin,'Find the real viewer renderer');
const rendererSource=TRIAL_SITE_CLIENT.slice(begin,end);
const prepSection={
 id:'prayer-156',kind:'section',layout:'columns',presentation:'resource',
 columnAlignments:['top','center'],columnButtonLayouts:['stack','row'],
 columns:[
  [{id:'image',kind:'image',text:'Bible essénienne',src:'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22100%22%20height=%22160%22%3E%3Crect%20width=%22100%22%20height=%22160%22%20fill=%22%2399826f%22/%3E%3C/svg%3E'}],
  [{id:'heading',kind:'heading',text:'Prière 156'},
   {id:'yt',kind:'button',displayAsButton:true,text:'Voir sur YouTube',href:'https://youtu.be/abc123'},
   {id:'vimeo',kind:'button',displayAsButton:true,text:'Voir sur Vimeo',href:'https://vimeo.com/123456'},
   {id:'pdf',kind:'button',displayAsButton:true,text:'Lire la prière',href:'/media/priere156.pdf'}]
 ]
};
const browser=await chromium.launch({headless:true});
const checks=[];
try{
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:800}});
  const failures=[];page.on('pageerror',e=>failures.push(e.message));
  await page.setContent('<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body><main class="site-paper" data-preparation="true" style="margin:20px auto;width:95%;max-width:1000px"></main></body></html>');
  await page.addStyleTag({content:TRIAL_SITE_STYLE});
  const result=await page.evaluate(async ({rendererSource,section})=>{
   const make=(tag,cls='',text)=>{
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(text!==undefined)el.textContent=text;
    return el;
   };
   const validUrl=x=>/^(?:https:\/\/|\/|data:image\/svg\+xml,)/.test(x||'')?x:'';
   let mainHeadingRendered=false;
   const append=new Function('make','urlOk','siteVideoInfo','blobUrls',
    'validClock','applyStyle','siteLinkCard','formattedText','mainHeadingRendered',
    rendererSource+';return appendPageBlock;')(
     make,validUrl,
     x=>/youtu|vimeo/.test(x||'')?{thumbnail:'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%22160%22%20height=%2290%22/%3E',embed:'https://video.example/embed'}:null,
     new Map(),()=>false,()=>{},
     (href,title)=>make('span','trial-website-card',title),
     (node,b)=>{node.textContent=b.text||''},
     mainHeadingRendered
    );
   const root=document.querySelector('main');
   append(section,root);
   const card=root.querySelector('.trial-content-section');
   const grid=card.querySelector('.trial-content-columns');
   const cols=[...card.querySelectorAll('.trial-content-column')];
   const blocks=[...card.querySelectorAll('.trial-button-block')];
   const links=[...card.querySelectorAll('a.trial-button')];
   const img=card.querySelector('.trial-figure img');
   await img.decode().catch(()=>{});
   await new Promise(requestAnimationFrame);
   const rect=e=>e.getBoundingClientRect();
   const first=cols[0],last=cols[1];
   return {
    viewport:innerWidth,
    columns:getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
    gridDisplay:getComputedStyle(grid).display,
    leftAlign:getComputedStyle(first).alignSelf,
    rightAlign:getComputedStyle(last).alignSelf,
    rightIsBelow:rect(last).top>=rect(first).bottom-2,
    imageWidth:rect(img).width,imageHeight:rect(img).height,
    leftCenter:(rect(first).top+rect(first).bottom)/2,
    rightCenter:(rect(last).top+rect(last).bottom)/2,
    linkLabels:links.map(x=>x.textContent),
    linkUrls:links.map(x=>x.getAttribute('href')),
    linkRows:links.map(x=>Math.round(rect(x).top)),
    cardWidth:rect(card).width,
    wrappers:blocks.length,
    horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth
   };
  },{rendererSource,section:prepSection});
  console.log('STEP4_VIEWPORT_METRICS '+JSON.stringify(result));
  assert.equal(result.columns,width===1280?2:1,'Resource columns must respond to viewport');
  assert.equal(result.linkLabels.length,3,'All three independent buttons must be visible');
  assert.deepEqual(result.linkLabels,['Voir sur YouTube','Voir sur Vimeo','Lire la prière']);
  assert.deepEqual(result.linkUrls,['https://youtu.be/abc123','https://vimeo.com/123456','/media/priere156.pdf']);
  assert.equal(result.wrappers,3,'Independent button block wrappers must remain');
  assert.ok(result.imageWidth>0&&result.imageWidth<=205,'Image should remain compact');
  assert.equal(result.horizontalOverflow,false,'No mobile horizontal page overflow');
  if(width===1280){
   assert.equal(result.rightAlign,'center','Right column uses vertical centering on desktop');
   assert.ok(Math.abs(result.rightCenter-result.leftCenter)<8,
     'Right column is vertically centered relative to image');
   assert.equal(result.linkRows[0],result.linkRows[1],
     'YouTube and Vimeo buttons share a row on desktop');
  }else{
   assert.equal(result.rightAlign,'start','Mobile overrides vertical centering');
   assert.equal(result.rightIsBelow,true,'Text and buttons must stack below illustration');
   assert.ok(result.linkRows[1]>result.linkRows[0],
     'Mobile buttons must stack for readability');
  }
  assert.deepEqual(failures,[],'No browser errors');
  checks.push({width,columns:result.columns,align:result.rightAlign,
   imageWidth:result.imageWidth,rows:result.linkRows,overflow:result.horizontalOverflow});
  await page.close();
 }
 // Editor CSS: ensure controls are reachable at the mobile breakpoint.
 const editor=await browser.newPage({viewport:{width:390,height:850}});
 await editor.setContent('<html><head></head><body><div class="stage-editor"><div class="canvas"><div class="content-section" data-layout="columns" data-presentation="resource"><div class="section-columns"><div class="section-column" data-column-index="0" data-button-layout="stack" data-vertical-align="center"><div class="section-column-actions"><details class="section-column-presentation" open><summary>↕</summary><div class="section-column-presentation-fields"><label>Alignement vertical<select aria-label="Alignement vertical"><option>Centre</option></select></label></div></details></div></div><div class="section-column" data-column-index="1" data-button-layout="row" data-vertical-align="center"><div class="section-column-actions"><details class="section-column-presentation" open><summary>↕</summary><div class="section-column-presentation-fields"><label>Disposition des boutons<select aria-label="Disposition des boutons"><option>Côte à côte</option></select></label></div></details></div></div></div></div></div></div></body></html>');
 await editor.addStyleTag({content:DEMO_CSS});
 const edit=await editor.evaluate(()=>{
  const select=document.querySelector('.section-column:last-child select');
  const r=select.getBoundingClientRect();
  return {minHeight:r.height,withinScreen:r.left>=0&&r.right<=innerWidth,
   display:getComputedStyle(document.querySelector('.section-column[data-button-layout="row"]')).display};
 });
 assert.ok(edit.minHeight>=39,'Touch-friendly settings select');
 assert.equal(edit.withinScreen,true,'Column settings must fit mobile screen');
 checks.push({editorMobile:true,...edit});
 await editor.close();
 console.log('STEP4_BROWSER_LAYOUT_PASS '+JSON.stringify(checks));
}finally{await browser.close()}
