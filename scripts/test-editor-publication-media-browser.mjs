import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.EDITOR_BASE||'https://celebrations-exit-staging.rondes.workers.dev';
const browser=await chromium.launch();
try{
 for(const width of [390,1280]){
  const ctx=await browser.newContext({viewport:{width,height:830},hasTouch:width===390,isMobile:width===390});
  const page=await ctx.newPage();page.setDefaultTimeout(15000);
  const logs=[],calls=[];
  page.on('pageerror',e=>logs.push(e.message));
  let rev=0;
  await page.route('**/api/editor-open-draft**',async route=>{
   if(route.request().method()==='POST'){calls.push('draft');rev++}
   const result=route.request().method()==='GET'?
    {ok:true,revision:rev,record:null,plans:[],shared:{pages:[],homeId:''},mediaCatalogue:[]}:
    {ok:true,revision:rev,updatedAt:new Date().toISOString()};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.route('**/api/editor-publication**',async route=>{
   if(route.request().method()==='POST'){const j=JSON.parse(route.request().postData());calls.push('public:'+j.kind+':'+j.visibility);rev++}
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,revision:rev,updatedAt:new Date().toISOString()})});
  });
  await page.route('**/api/editor-media**',async route=>{
   const items=[
    {id:'image|/media/media/1791723108110/file-1791723109615-1000040461.jpg',type:'image',
     src:'/media/media/1791723108110/file-1791723109615-1000040461.jpg',
     name:'Ronde des Archanges Universelle',source:'link',general:false,
     uses:[{pageId:'neutral-accueil-general',pageName:'Accueil général',
      slug:'neutral-accueil-general',group:'page',celebrationId:''}]},
    {id:'image|/media/new/12345678-1234-4234-8234-123456789abc.jpg',type:'image',
     src:'/media/new/12345678-1234-4234-8234-123456789abc.jpg',
     name:'10000426.jpg',source:'uploaded',general:false,uses:[]},
    {id:'link|https://example.org/visiter',type:'link',src:'https://example.org/visiter',
     name:'Bouton navigation',source:'link',general:false,uses:[]}
   ];
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items})});
  });
  const res=await page.goto(base+'/__editor/demo-preparation?celebration=101',{waitUntil:'domcontentloaded'});
  assert.equal(res.status(),200);
  await page.locator('button[data-tab="pages"]').click();
  const items=page.locator('.general-pages-list .general-page-row');
  assert.ok(await items.count()>0,'General pages available');
  const newName='Brouillon navigateur '+width;
  page.once('dialog',dlg=>dlg.accept(newName));
  await page.getByRole('button',{name:'＋ Page'}).first().click();
  const created=page.locator('.general-pages-list .general-page-row').filter({hasText:newName});
  await created.waitFor();
  assert.equal(await created.locator('.inline-page-state').getAttribute('aria-label'),'Brouillon','New page stays in draft with an orange dot');
  await created.locator('.page-options summary').click();
  const options=created.locator('.page-options-menu');
  assert.ok((await options.innerText()).includes('Publier'));
  await options.getByRole('button',{name:'Publier',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('status')?.textContent?.includes('Publié'));
  assert.ok(calls.some(x=>x==='public:page:published'),'Explicit publish request was submitted');
  const current=page.locator('.general-pages-list .general-page-row').filter({hasText:newName});
  await current.locator('.page-options summary').click();
  page.once('dialog',dlg=>dlg.accept());
  await current.getByRole('button',{name:'Masquer',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('status')?.textContent?.includes('Masqué'));
  assert.ok(calls.includes('public:page:hidden'));
  await page.locator('button[data-tab="celebrations"]').click();
  assert.ok(await page.locator('.celebration-publication-controls').count()>0,
   'Celebration has independent publication controls');
  const stageNav=page.locator('.celebration-editor .panel > .list');
  const stageRow=stageNav.locator('.general-page-row').first();
  await stageRow.waitFor();
  const indicator=stageRow.locator('.inline-page-state');
  assert.ok(['Publiée','Brouillon','Masquée'].includes(await indicator.getAttribute('aria-label')));
  const geometry=await indicator.evaluate(e=>({width:Math.round(e.getBoundingClientRect().width),
   height:Math.round(e.getBoundingClientRect().height),text:e.textContent}));
  assert.deepEqual(geometry,{width:12,height:12,text:''},'Status is a small colored disk without text');
  if(width===1280){
   const navWidth=await stageNav.evaluate(e=>Math.round(e.getBoundingClientRect().width));
   assert.ok(navWidth<=230,'Desktop celebration navigation must remain compact');
   const titleWidth=await stageRow.locator('.item').evaluate(e=>Math.round(e.getBoundingClientRect().width));
   assert.ok(titleWidth>95,'Stage titles have room for normal horizontal words');
  }
  await page.locator('button[data-tab="media"]').click();
  await page.locator('.file-category-tabs').waitFor();
  for(const label of ['Images','PDF','Audios','Vidéos','Autres']){
   assert.ok((await page.locator('.file-category-tabs').innerText()).includes(label));
  }
  assert.equal(await page.getByRole('button',{name:'＋ Référencer un média externe'}).count(),1);
  assert.equal(await page.locator('.file-category-tabs button').filter({hasText:'Liens'}).count(),0);
  assert.equal(await page.locator('.cards button').filter({hasText:/^(Insérer|Ouvrir)$/}).count(),0,
   'Neither the Insert nor the Open button belongs to the global catalogue');
  const home=page.locator('.global-media-card').filter({hasText:'Ronde des Archanges Universelle'});
  await home.waitFor();
  assert.equal(await home.locator('.file-location-link').count(),1);
  assert.match(await home.locator('.file-location-link').first().innerText(),/Accueil général/);
  assert.equal(await home.locator('.media-unused-ribbon').count(),0);
  assert.equal(await home.locator('.media-picture-link').getAttribute('href'),
   '/media/media/1791723108110/file-1791723109615-1000040461.jpg');
  const unreferenced=page.locator('.global-media-card').filter({hasText:'10000426.jpg'});
  await unreferenced.waitFor();
  assert.equal((await unreferenced.locator('.media-unused-ribbon').innerText()).toLowerCase(),'inutilisé');
  assert.equal(await page.locator('.global-media-card').filter({hasText:'Bouton navigation'}).count(),0);
  // Editing a large photo must not hide the confirmation controls as the
  // editor is scrolled, nor must a modal exceed the zoomed viewport.
  await page.locator('button[data-tab="pages"]').click();
  const imageBlock=page.locator('.canvas .block').filter({has:page.locator('.picture img')}).first();
  await imageBlock.waitFor();
  await imageBlock.locator('.picture').click();
  assert.equal(await imageBlock.getByRole('button',{name:'Télécharger une image'}).count(),1);
  assert.equal(await imageBlock.getByRole('button',{name:'Images du site'}).count(),1);
  assert.equal(await imageBlock.getByRole('button',{name:'Choisir une image'}).count(),0);
  await imageBlock.getByRole('button',{name:'Images du site'}).click();
  const picker=page.locator('.image-picker-dialog');
  await picker.waitFor();
  const bounds=await picker.evaluate(e=>{
    const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight}
  });
  assert.ok(bounds.top>=-1&&bounds.bottom<=bounds.height+1,'Image modal stays inside viewport');
  await picker.getByRole('button',{name:'Fermer la fenêtre'}).click();
  await picker.waitFor({state:'detached'});
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  const validate=imageBlock.getByRole('button',{name:'Valider cet élément et enregistrer le brouillon'});
  await validate.waitFor({state:'visible'});
  const confirmBox=await validate.evaluate(e=>{
    const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight}
  });
  assert.ok(confirmBox.top>=-1&&confirmBox.bottom<=confirmBox.height+1,
    'Validate stays visible after scrolling a selected photo');
  page.once('dialog',d=>d.accept());
  await imageBlock.getByRole('button',{name:'Supprimer l’image'}).click();
  assert.equal(await imageBlock.locator('.picture img').count(),0,'Image removed without deleting block');
  assert.ok(await imageBlock.locator('.picture').count()>0,'Empty image block retained for a replacement');
  assert.deepEqual(logs,[],'No console page errors');
  console.log('EDITOR_PUBLICATION_MEDIA_UI_PASS',JSON.stringify({width,createdDraft:true,
   published:true,hidden:true,celebrationControls:true,globalLibrary:true,
   remoteWritesIntercepted:calls.length}));
  await ctx.close();
 }
}finally{await browser.close()}
