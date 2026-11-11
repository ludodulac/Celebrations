import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {createMediaCatalogue} from '../migration/cloudflare/app/domain/editor-media-catalogue.mjs';
import {DEMO_CSS} from '../migration/cloudflare/editor-demo-style.mjs';
const source=readFileSync('migration/cloudflare/editor-demo-client-source.js','utf8');
const helpers=source.slice(source.indexOf('function libraryTypeLabel('),source.indexOf('function attachChosenAudio('));
const ui=source.slice(source.indexOf('// Preview the existing URL:'),source.indexOf('/* Entire administration guide:'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
try{
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:844}});
  await page.route('https://fixture.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body class="stage-editor"><main id="workspace"></main></body></html>'}));
  await page.goto('https://fixture.test/');await page.addStyleTag({content:DEMO_CSS});
  await page.evaluate(({helpers,ui,catalogue})=>{
   const n=(tag,cls='',text)=>{const e=document.createElement(tag);e.className=cls;if(text!==undefined)e.textContent=text;return e};
   const b=(text,fn,cls='')=>{const e=n('button','btn '+cls,text);e.onclick=fn;return e};
   const w=document.querySelector('main'),mediaCatalogue=new Function('return ('+catalogue+')')()({validHref:()=>true});
   const mediaCategoryOf=mediaCatalogue.mediaCategoryOf,localCategory=mediaCatalogue.categoryOfLocal;
   const globalMedia=[{id:'1',name:'Chant du matin.mp3',type:'audio',src:'/media/chant.mp3'},{id:'2',name:'Conférence.mp3',type:'audio',src:'/media/conference.mp3'},{id:'3',name:'Film.mp4',type:'video',src:'/media/film.mp4'},{id:'4',name:'Livret.pdf',type:'pdf',src:'/media/livret.pdf'},{id:'5',name:'Notes.docx',type:'file',src:'/media/notes.docx'}];
   const noop=()=>{},args={n,b,w,mediaCatalogue,mediaCategoryOf,localCategory,globalMedia,IS_STAGE:true,remoteMediaLoading:false,globalMediaLoaded:true,globalFilesLoading:true,globalFiles:[],fileRecords:new Map(),assetUrls:new Map(),chosenBlock:null,LIVE_MEDIA_UPLOAD_HOST:true,storageReady:true,mediaUploadState:null,globalFilesComplete:true,mediaLinksFor:()=>[],fileUses:()=>[],refreshGlobalMedia:noop,createExternalMedia:noop,deleteGlobalMedia:noop};
   new Function(...Object.keys(args),helpers+ui+`;window.chooseCategory=value=>{mediaCategory=value;w.replaceChildren();media()};let mediaCategory='audios';function render(){w.replaceChildren();media()}media();`)(...Object.values(args));
  },{helpers,ui,catalogue:createMediaCatalogue.toString()});
  assert.equal(await page.locator('audio[controls]').count(),2);
  assert.equal(await page.locator('audio').first().getAttribute('preload'),'metadata');
  await page.getByRole('searchbox').fill('matin');assert.equal(await page.locator('.cards article:visible').count(),1);
  await page.getByRole('searchbox').fill('absent');assert.equal(await page.locator('.cards article:visible').count(),0);
  await page.getByRole('searchbox').fill('');
  await page.evaluate(()=>window.chooseCategory('autres'));assert.equal(await page.locator('.cards article').count(),2);
  await page.getByText('Prévisualiser le PDF').click();await page.locator('iframe').waitFor();
  await page.evaluate(()=>window.chooseCategory('videos'));assert.equal(await page.locator('video[controls]').count(),1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow');
  await page.close();
 }
 console.log('M020C media cards/search/PDF/audio/video: desktop + smartphone PASS');
}finally{await browser.close()}
