// MISSION 02 — authentic editor HTML/JS/CSS with SYNTHETIC data only.
// Generated via the real handlePreparationDemo() handler; no network access
// to the official site, no login, no user data, no Cloudflare mutations.
// All API writes are intercepted in memory; screenshots are CI artifacts.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {handlePreparationDemo,STAGES} from '../migration/cloudflare/editor-demo-preparation-page.mjs';

const OUT=process.env.M02_OUTPUT_DIR||'artifacts/mission02/editor-fixture';
await mkdir(OUT,{recursive:true});
const HOST='https://celebrations-exit-staging.rondes.workers.dev';
const steps=STAGES.map((s,i)=>({
 id:200+i,celebration_id:101,label:s.label,step_key:s.slug+'-101',
 start_date:'2026-10-07',end_date:null,
 body_text:i===2?'Texte fictif de démonstration du mercredi':'Contenu de référence (fictif) '+s.label
}));
const data={
 celebrations:[{id:101,archangel:'Michaël',year:'2026',status:'active'}],
 steps,
 events:[{id:301,step_key:'mercredi-101',title:'Événement de test',
  event_time:'18:00',description:'Rencontre fictive',audience:'all',sort_order:1}],
 eventContents:[{event_id:301,sort_order:1,id:403,name:'Audio de test',
  description:'Audio factice',content_type:'Audio',source_type:'file',
  storage_path:'media/m02-audio.mp3',audience:'all'}],
 stepContents:[
  {step_key:'preparation-101',sort_order:1,id:501,name:'Programme fictif',
   content_type:'PDF',source_type:'file',storage_path:'media/m02-programme.pdf',audience:'all'},
  {step_key:'mercredi-101',sort_order:2,id:502,name:'Exemple de vidéo',
   content_type:'Video',source_type:'file',storage_path:'media/m02-video.mp4',audience:'all'}],
 links:[{id:601,celebration_id:101,step_key:'mercredi-101',event_id:null,
  url:'https://example.org/',label:'Lien extérieur de test',sort_order:1}]
};
const sqls=[];
const env={DB:{prepare(sql){
 sqls.push(sql);
 assert.ok(sql.trim().startsWith('SELECT '),'Fixture is SELECT-only');
 return {bind(..._params){return {async all(){
  if(sql.includes('FROM celebrations_celebrations'))return {results:data.celebrations};
  if(sql.includes("FROM celebrations_contents WHERE audience='all'"))return {results:[]};
  if(sql.includes('FROM celebrations_steps'))return {results:data.steps};
  if(sql.includes('FROM celebrations_links'))return {results:data.links};
  if(sql.includes('FROM celebrations_events WHERE'))return {results:data.events};
  if(sql.includes('FROM celebrations_event_contents'))return {results:data.eventContents};
  if(sql.includes('FROM celebrations_step_contents'))return {results:data.stepContents};
  throw new Error('Unexpected SQL in fixture: '+sql.slice(0,120));
 }}}};
}}};
const response=await handlePreparationDemo(new Request(HOST+'/__editor/demo-preparation?celebration=101'),env);
assert.equal(response.status,200,'Production editor renderer works with fixture');
let html=await response.text();
const match=html.match(/window\.__PREPARATION_SEED__=([\s\S]*?);<\/script>/);
assert.ok(match,'The real editor embeds a serializable seed');
const seed=JSON.parse(match[1]);
assert.equal(seed.pages.filter(p=>p.group==='celebration').length,8);
const wed=seed.pages.find(p=>p.id==='mercredi-101');
assert.ok(wed,'Wednesday page exists in synthetic seed');
// Add one video block only inside the fixture. Existing historical importer
// models videos as buttons; the actual editor must still support a video block.
wed.blocks.push({id:999,kind:'video',text:'Vidéo fictive',
 href:'/media/m02-video.mp4'});
html=html.replace(match[0],
 'window.__PREPARATION_SEED__='+JSON.stringify(seed).replace(/</g,'\\u003c')+';<\/script>');
const fakeFiles=[
 {id:'video|/media/m02-video.mp4',name:'Vidéo de test',type:'video',
  category:'videos',src:'/media/m02-video.mp4',general:true,uses:[]},
 {id:'pdf|/media/m02-programme.pdf',name:'Programme fictif.pdf',
  type:'pdf',category:'pdf',src:'/media/m02-programme.pdf',general:true,uses:[]},
 {id:'audio|/media/m02-audio.mp3',name:'Audio factice.mp3',
  type:'audio',category:'audios',src:'/media/m02-audio.mp3',general:true,uses:[]},
 {id:'image|/media/m02-image.png',name:'Image fictive.png',
  type:'image',category:'images',src:'/media/m02-image.png',general:true,uses:[]}
];
const tinyPng=Buffer.from(
 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMbYAAAAASUVORK5CYII=','base64');
const output={mission:'02',kind:'editeur-fixture',capturedAt:new Date().toISOString(),
 source:'Production editor code, D1 in-memory SELECT-only fixture',screens:[],
 coverage:[],apiWritesMocked:0,productionRequests:0,jsErrors:[],failures:[]};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const [name,width,height,mobile] of [
  ['ordinateur',1280,840,false],['telephone',390,844,true]
 ]){
  const context=await browser.newContext({viewport:{width,height},isMobile:mobile,
   hasTouch:mobile,serviceWorkers:'block',reducedMotion:'reduce',locale:'fr-FR'});
  const page=await context.newPage();
  page.setDefaultTimeout(13000);
  page.on('pageerror',e=>output.jsErrors.push({size:name,error:String(e.message||e)}));
  const actions=[];
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url()),verb=req.method();
   if(u.origin!==HOST){
    output.productionRequests++;
    return route.abort('blockedbyclient');
   }
   if(u.pathname==='/__editor/demo-preparation'&&verb==='GET')
    return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html});
   if(u.pathname==='/api/editor-open-draft'){
    if(verb==='GET')return route.fulfill({status:200,contentType:'application/json',
     body:JSON.stringify({ok:true,revision:0,record:null,plans:[],
      shared:{pages:[],homeId:''},mediaCatalogue:fakeFiles})});
    output.apiWritesMocked++;actions.push('draft-write');
    return route.fulfill({status:200,contentType:'application/json',
     body:JSON.stringify({ok:true,revision:1,updatedAt:new Date().toISOString()})});
   }
   if(u.pathname==='/api/editor-publication'){
    if(verb!=='GET'){output.apiWritesMocked++;actions.push('publication-write');}
    return route.fulfill({status:200,contentType:'application/json',
     body:JSON.stringify({ok:true,revision:1,media:fakeFiles,items:fakeFiles})});
   }
   if(u.pathname==='/api/editor-media'){
    if(verb!=='GET'){output.apiWritesMocked++;actions.push('media-write');}
    return route.fulfill({status:200,contentType:'application/json',
     body:JSON.stringify({ok:true,items:fakeFiles,media:fakeFiles})});
   }
   if(u.pathname==='/__editor/demo-preparation'&&verb!=='GET')throw Error('Unexpected document write');
   if(u.pathname.startsWith('/media/'))
    return route.fulfill({status:200,contentType:'image/png',body:tinyPng});
   if(verb!=='GET'&&verb!=='HEAD'){output.apiWritesMocked++;actions.push('other-write');
    return route.fulfill({status:405,body:'Blocked by M02 fixture'});}
   return route.fulfill({status:404,body:'Not found: fixture URL'});
  });
  const capture=async section=>{
   const ui=await page.evaluate(()=>{
    const qs=s=>document.querySelector(s),qsa=s=>[...document.querySelectorAll(s)];
    const btn=qs('#undo-btn'),nav=qsa('.stage-editor .rail [data-tab]'),
      workspace=qs('#workspace');
    return {
     route:location.pathname+location.search,
     topbarButtons:qsa('.topbar .actions button').map(x=>
      ({text:x.textContent.trim(),label:x.getAttribute('aria-label'),disabled:x.disabled})),
     navTabs:nav.map(x=>x.textContent.trim()),
     selectedPage:qs('.list .item.active')?.textContent.trim()||'',
     topLevelBlocks:qsa('.canvas>.block').length,
     totalBlocks:qsa('.canvas .block').length,
     contentSections:qsa('.canvas .content-section').length,
     blueInserts:qsa('button.section-add-blue').length,
     greenInserts:qsa('button.section-add-green').length,
     undoVisible:!!btn&&getComputedStyle(btn).display!=='none',
     filePickerOpen:!!qs('dialog.file-picker-dialog[open]'),
     previewMode:!!workspace&&workspace.querySelectorAll('[contenteditable="true"]').length===0,
     screenOverflow:document.documentElement.scrollWidth>innerWidth+1
    };
   });
   assert.equal(ui.screenOverflow,false,'Editor does not overflow '+name+' '+section);
   const filename=name+'-'+section+'.png';
   await page.screenshot({path:join(OUT,filename),animations:'disabled'});
   output.screens.push({size:name,section,screenshot:filename,...ui});
   console.log('M02_EDITOR_FIXTURE_PASS '+name+' '+section+' '+JSON.stringify({
    blocks:ui.totalBlocks,sections:ui.contentSections,undo:ui.undoVisible,
    tabs:ui.navTabs}));
  };
  try{
   const visit=await page.goto(HOST+'/__editor/demo-preparation?celebration=101',
    {waitUntil:'domcontentloaded',timeout:25000});
   assert.equal(visit.status(),200);
   await page.locator('#workspace .list .item').first().waitFor({state:'attached'});
   await page.locator('#undo-btn').waitFor({state:'attached'});
   await capture('celebrations');
   output.coverage.push(name+': navigation célébrations + boutons Enregistrer, Aperçu, Undo');
   await page.locator('.list .item').filter({hasText:'Mercredi'}).first().click();
   await page.locator('.block').first().waitFor();
   await capture('mercredi');
   output.coverage.push(name+': ouverture mercredi, blocs, sections et boutons insertion');
   await page.locator('#preview-btn').click();
   await capture('apercu-brouillon');
   await page.locator('#preview-btn').click();
   output.coverage.push(name+': aperçu du brouillon et retour édition');
   // A video-specific picker must preserve the page behind its modal.
   const video=page.locator('.canvas .block[data-kind="video"]').first();
   if(await video.count()){
    const choose=video.getByRole('button',{name:/Choisir une vidéo du site/});
    if(await choose.count()){
     await choose.click();
     const dialog=page.locator('dialog.file-picker-dialog');
     await dialog.waitFor({state:'visible'});
     const cards=await dialog.locator('.file-picker-card').count();
     assert.ok(cards>=1,'Video catalog contains at least one synthetic video');
     await capture('choix-video-mediatheque');
     await dialog.getByRole('button',{name:'Annuler'}).click();
     output.coverage.push(name+': fenêtre modale de sélection vidéo sans fermer la page');
    }
   }
   await page.locator('[data-tab="pages"]').click();
   await capture('pages');
   output.coverage.push(name+': liste et édition des pages générales');
   await page.locator('[data-tab="media"]').click();
   await page.locator('.file-category-tabs').waitFor({state:'attached'});
   await capture('mediatheque');
   output.coverage.push(name+': onglet médiathèque globale et filtres');
   assert.equal(actions.length,0,'Opening and previewing must not save or publish');
  }catch(err){
   output.failures.push({size:name,error:String(err.message||err).slice(0,900)});
   console.error('M02_EDITOR_FIXTURE_FAIL '+name+' '+String(err.message||err));
  }finally{
   await page.close();await context.close();
  }
 }
}finally{await browser.close();}
await writeFile(join(OUT,'reference-editor-fixture.json'),JSON.stringify(output,null,2)+'\n','utf8');
console.log('M02_EDITOR_FIXTURE_RESULT '+JSON.stringify({
 screenshots:output.screens.length,covered:output.coverage.length,
 failures:output.failures.length,apiWritesMocked:output.apiWritesMocked,
 productionRequests:output.productionRequests,jsErrors:output.jsErrors.length
}));
if(output.failures.length||output.productionRequests||output.jsErrors.length)process.exitCode=1;
