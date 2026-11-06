import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {DEMO_CSS} from '../migration/cloudflare/editor-demo-style.mjs';

const start=DEMO_CLIENT.indexOf('function chooseFile(x){');
const end=DEMO_CLIENT.indexOf('\nfunction attachFile(r){',start);
assert.ok(start>=0&&end>start);
const chooserSource=DEMO_CLIENT.slice(start,end);
const browser=await chromium.launch({headless:true});
try{
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:820},isMobile:width===390,hasTouch:width===390});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div class="stage-editor"><div class="canvas"><h1>Ma page de célébration</h1><p id="page-marker">Un texte déjà saisi</p><button id="open-file-picker">Choisir un fichier</button></div></div></body></html>');
  await page.addStyleTag({content:DEMO_CSS});
  await page.evaluate(chooserSource=>{
   const n=(tag,cls='',title)=>{
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(title!==undefined)el.textContent=title;
    return el;
   };
   const b=(label,fn,cls='')=>{
    const el=n('button','btn '+cls,label);el.type='button';el.onclick=fn;return el;
   };
   const FILE_CATEGORIES=[['images','Images'],['pdf','PDF'],['audios','Audios'],['videos','Vidéos'],['autres','Autres']];
   const globalFiles=[{name:'Ancien texte.docx',category:'autres',src:'/media/ancien.docx'}];
   const publicFiles=()=>[];
   const globalMedia=[
    {name:'Une prière.pdf',type:'pdf',src:'/media/priere.pdf'},
    {name:'Un chant.mp3',type:'audio',src:'/media/chant.mp3'},
    {name:'Une vidéo.mp4',type:'video',src:'/media/video.mp4'},
    {name:'Une photo.jpg',type:'image',src:'https://example.org/photo.jpg'}
   ];
   const mediaCategoryOf=m=>({image:'images',pdf:'pdf',audio:'audios',video:'videos'})[m.type]||'autres';
   const validHref=v=>String(v).startsWith('/')||String(v).startsWith('https://');
   const IS_STAGE=true,globalMediaLoaded=true;
   const loadGlobalFiles=async()=>{},refreshGlobalMedia=async()=>{};
   const mark=()=>window.marked=(window.marked||0)+1;
   const render=()=>window.rerendered=(window.rerendered||0)+1;
   const chooser=new Function('n','b','FILE_CATEGORIES','globalFiles','publicFiles','globalMedia',
    'mediaCategoryOf','validHref','document','IS_STAGE','globalMediaLoaded',
    'loadGlobalFiles','refreshGlobalMedia','mark','render',
    chooserSource+';return chooseFile;')(
    n,b,FILE_CATEGORIES,globalFiles,publicFiles,globalMedia,
    mediaCategoryOf,validHref,document,IS_STAGE,globalMediaLoaded,
    loadGlobalFiles,refreshGlobalMedia,mark,render);
   window.currentButton={kind:'button',text:'Mon bouton',href:''};
   document.querySelector('#open-file-picker').onclick=()=>chooser(window.currentButton);
  },chooserSource);
  await page.getByRole('button',{name:'Choisir un fichier'}).click();
  const modal=page.locator('dialog.file-picker-dialog');
  await modal.waitFor();
  assert.equal(await modal.isVisible(),true);
  const rect=await modal.boundingBox();
  assert.ok(rect&&rect.x>=0&&rect.x+rect.width<=width+1,
   'Media selection modal should fit the viewport');
  for(const filename of ['Une prière.pdf','Un chant.mp3','Une vidéo.mp4','Une photo.jpg','Ancien texte.docx']){
   await modal.getByRole('button',{name:'Choisir '+filename}).waitFor();
  }
  await modal.getByRole('button',{name:/^PDF \(/}).click();
  await modal.getByRole('button',{name:'Choisir Une prière.pdf'}).click();
  await modal.waitFor({state:'detached'}); // dialog close event removes the element asynchronously
  assert.equal(await page.evaluate(()=>window.currentButton.href),'/media/priere.pdf');
  assert.equal(await page.evaluate(()=>window.currentButton.displayAsButton),true);
  assert.equal(await page.evaluate(()=>window.marked),1);
  assert.equal(await page.evaluate(()=>window.rerendered),1);
  assert.equal(await page.locator('#page-marker').textContent(),'Un texte déjà saisi',
   'Editor content behind the picker remains untouched');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  assert.equal(overflow,false,'No horizontal overflow from the modal');
  assert.deepEqual(errors,[],'No browser JS error');
  console.log('FILE_PICKER_BROWSER_PASS '+JSON.stringify({width,visibleTypes:5,picked:'/media/priere.pdf',keepsPage:true}));
  await page.close();
 }
}finally{await browser.close()}
