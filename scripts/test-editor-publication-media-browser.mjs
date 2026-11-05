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
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:[]})});
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
  for(const label of ['Images','PDF','Audios','Vidéos','Liens']){
   assert.ok((await page.locator('.file-category-tabs').innerText()).includes(label));
  }
  assert.equal(await page.getByRole('button',{name:'＋ Ajouter un lien web'}).count(),1);
  assert.deepEqual(logs,[],'No console page errors');
  console.log('EDITOR_PUBLICATION_MEDIA_UI_PASS',JSON.stringify({width,createdDraft:true,
   published:true,hidden:true,celebrationControls:true,globalLibrary:true,
   remoteWritesIntercepted:calls.length}));
  await ctx.close();
 }
}finally{await browser.close()}
