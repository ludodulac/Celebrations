import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {TRIAL_SITE_CLIENT,TRIAL_SITE_STYLE} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {DEMO_CSS} from '../migration/cloudflare/editor-demo-style.mjs';

const browser=await chromium.launch({headless:true});
try{
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:850}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<!DOCTYPE html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main class="site-paper"><div class="celebration-choices"></div><div id="video-slot"></div></main></body></html>');
  await page.addStyleTag({content:TRIAL_SITE_STYLE});
  const metrics=await page.evaluate(({client})=>{
   const root=document.querySelector('.celebration-choices');
   const names=['Michaël','Gabriel','Raphaël','Ouriel',
    'Michaël','Gabriel','Raphaël','Ouriel'];
   const keys=['michael','gabriel','raphael','ouriel'];
   for(let i=0;i<names.length;i++){
    const a=document.createElement('a');
    a.className='celebration-choice';
    a.dataset.archangel=keys[i%4];
    a.href='#';
    a.innerHTML='<strong>'+names[i]+' 2026</strong><small>Voir les pages</small>';
    root.append(a);
   }
   const entries=[...root.children],rows=entries.map(el=>el.getBoundingClientRect().top);
   const stripColors=entries.slice(0,4).map(el=>getComputedStyle(el,'::after').backgroundColor);
   const grid=getComputedStyle(root).gridTemplateColumns.split(' ').filter(Boolean).length;
   const start=client.indexOf('function appendPageBlock(b,root){');
   const end=client.indexOf('\n for(const b of page.blocks||[])appendPageBlock',start);
   if(start<0||end<start)throw Error('Public video renderer missing');
   const make=(tag,cls='',text)=>{
    const element=document.createElement(tag);
    element.className=cls;
    if(text!==undefined)element.textContent=text;
    return element;
   };
   const render=new Function('make','urlOk','siteVideoInfo','blobUrls','validClock',
    'applyStyle','siteLinkCard','mainHeadingRendered',
    client.slice(start,end)+';return appendPageBlock;')(
     make,v=>String(v).startsWith('/')?v:'',()=>null,
     new Map(),()=>false,()=>{},()=>make('span'),false);
   const target=document.getElementById('video-slot');
   render({kind:'video',href:'/media/exemple.mp4',text:'Titre de ma vidéo'},target);
   const video=target.querySelector('video.trial-video-player');
   const caption=target.querySelector('.trial-video-title');
   return {grid,rows,stripColors,
    nativeVideo:!!video,videoSource:video?.getAttribute('src'),
    videoControls:!!video?.controls,caption:caption?.textContent,
    overflow:document.documentElement.scrollWidth>innerWidth};
  },{client:TRIAL_SITE_CLIENT});
  assert.equal(metrics.grid,width===1280?4:2,'Desktop must show 4 per row; phone 2');
  if(width===1280){
   assert.equal(metrics.rows[0],metrics.rows[3],'Four celebrations share the first row');
   assert.ok(metrics.rows[4]>metrics.rows[3]+30,'Fifth celebration starts a new row');
   assert.equal(metrics.rows[4],metrics.rows[7],'Four celebrations share the next row');
  }
  assert.deepEqual(metrics.stripColors,
   ['rgb(234, 52, 47)','rgb(102, 92, 228)',
    'rgb(50, 186, 99)','rgb(239, 187, 31)']);
  assert.equal(metrics.nativeVideo,true);
  assert.equal(metrics.videoSource,'/media/exemple.mp4');
  assert.equal(metrics.videoControls,true);
  assert.equal(metrics.caption,'Titre de ma vidéo');
  assert.equal(metrics.overflow,false);
  assert.deepEqual(errors,[]);
  console.log('ARCHANGELS_VIDEO_PLAYER_BROWSER_PASS '+JSON.stringify({width,...metrics}));
  await page.close();
 }
 // Mobile toolbar: undo must be a real 44px circle rather than a wide control.
 const mobile=await browser.newPage({viewport:{width:390,height:820}});
 await mobile.setContent('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div class="stage-editor"><header class="topbar"><div></div><div class="actions"><button class="btn editor-undo-button" id="undo-btn" aria-label="Annuler la dernière action">↶</button><button class="btn" id="save-btn">Enregistrer</button><button class="btn">Aperçu</button></div></header></div></body></html>');
 await mobile.addStyleTag({content:DEMO_CSS});
 const geo=await mobile.evaluate(()=>{
  const bt=document.querySelector('#undo-btn'),rect=bt.getBoundingClientRect();
  return {width:rect.width,height:rect.height,round:getComputedStyle(bt).borderRadius,
   label:bt.getAttribute('aria-label')};
 });
 assert.equal(geo.width,44);
 assert.equal(geo.height,44);
 assert.equal(geo.round,'50%');
 assert.equal(geo.label,'Annuler la dernière action');
 console.log('EDITOR_MOBILE_UNDO_ARROW_PASS '+JSON.stringify(geo));
 await mobile.close();
}finally{await browser.close()}
