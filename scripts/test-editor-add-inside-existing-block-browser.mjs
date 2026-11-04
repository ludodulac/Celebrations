// Browser smoke for adding several elements INSIDE a pre-existing title/text/photo.
// Uses fixture-only localStorage; every server write is mocked.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.EDITOR_BASE||'https://celebrations-exit-staging.rondes.workers.dev';
const browser=await chromium.launch();
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:850},
   isMobile:width===390,hasTouch:width===390});
  const page=await context.newPage();page.setDefaultTimeout(17000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const writes=[];
  await page.route('**/api/editor-open-draft**',async route=>{
   const method=route.request().method();
   if(method==='POST')writes.push('intercepted');
   const result=method==='GET'?
    {ok:true,revision:0,record:null,shared:{pages:[],homeId:''},plans:[]}:
    {ok:true,revision:1,updatedAt:'2026-11-04T00:00:00Z'};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
  });
  const response=await page.goto(base+'/__editor/demo-preparation?celebration=101',{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200);
  await page.evaluate(()=>{
   const seed=window.__PREPARATION_SEED__;
   const home={id:'neutral-accueil-general',name:'Accueil général',group:'page',blocks:[
    {id:'legacy-head-in',kind:'heading',text:'Ronde des Archanges Universelle',align:'center',bold:true,color:'#643f2f'},
    {id:'legacy-text-in',kind:'text',text:'Bienvenue sur notre site',align:'center'},
    {id:'legacy-image-in',kind:'image',text:'Image ancienne',align:'center',
     src:'/media/media/1791723108110/file-1791723109615-1000040461.jpg'}
   ]};
   const rest=JSON.parse(JSON.stringify(seed.pages)).filter(p=>p.group==='celebration');
   const payload={pages:[...rest,home],siteHomeId:home.id,celebrationDates:{},celebrationTimes:{}};
   localStorage.setItem('celebrations-demo-preparation-'+seed.celebrationId,JSON.stringify(payload));
   localStorage.setItem('celebrations-demo-shared-pages-v1',JSON.stringify({pages:[home],homeId:home.id}));
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="pages"]').click();
  const title=page.locator('.canvas>.block[data-id="legacy-head-in"]');
  const image=page.locator('.canvas>.block[data-id="legacy-image-in"]');
  await title.waitFor();await image.waitFor();
  assert.equal(await title.locator('.existing-block-add').isVisible(),false,'green button initially hidden on an unselected old block');
  await title.locator('.ed').click();
  assert.equal(await title.locator('.existing-block-add-button').isVisible(),true,'tap on old title reveals its green plus');
  assert.equal(await title.locator('.existing-block-add-menu').isVisible(),false);
  await title.getByRole('button',{name:'Ajouter dans ce bloc'}).click();
  assert.equal(await title.locator('.existing-block-add-menu').isVisible(),true,'plus reveals item menu inside original block');
  await title.locator('.existing-block-add-menu').getByRole('button',{name:'Image'}).click();
  const first=page.locator('.canvas>.content-section').filter({has:page.locator('.block[data-id="legacy-head-in"]')});
  await first.waitFor();
  assert.equal(await first.locator('.section-column>.block').count(),2,'original heading and new photo share one section');
  assert.equal(await first.locator('.block[data-id="legacy-head-in"] .ed').textContent(),'Ronde des Archanges Universelle');
  assert.equal(await first.locator('.block[data-id="legacy-head-in"] .ed').evaluate(n=>n.style.fontSize),'28px',
   'original primary title keeps its font size');
  assert.equal(await first.locator('.block[data-id="legacy-head-in"] .ed').evaluate(n=>n.style.color),'rgb(100, 63, 47)',
   'original text formatting remains unchanged');
  assert.equal(await first.locator('.section-column>.block').nth(1).locator('.picture').count(),1,'new image is added inside existing section');

  // Add a third element to the same section, without another blue insertion bar.
  const within=first.getByRole('button',{name:'Ajouter à gauche'});
  await within.click();
  const afterPlus=await first.locator('.section-element-menu').evaluateAll(nodes=>nodes.map(n=>({
   hidden:n.hidden,display:getComputedStyle(n).display,buttons:[...n.querySelectorAll('button')].map(b=>b.textContent)
  })));
  const expanded=await within.getAttribute('aria-expanded');
  console.log('AFTER_PLUS_DEBUG',JSON.stringify({width,expanded,afterPlus}));
  if(afterPlus[0]?.hidden){
   await within.evaluate(x=>x.click());
   console.log('AFTER_DOM_CLICK_DEBUG',JSON.stringify(await first.locator('.section-element-menu').evaluateAll(nodes=>nodes.map(n=>({hidden:n.hidden,display:getComputedStyle(n).display})))));
  }
  await first.locator('.section-element-menu:not([hidden])').getByRole('button',{name:'Titre',exact:true}).click();
  assert.equal(await first.locator('.section-column>.block').count(),3,'section can receive a second added item');
  assert.equal(await first.locator('.section-column>.block').nth(2).locator('.heading').count(),1,'section now has second title');

  // An old stand-alone photograph gets the same green + and can accept text.
  await image.locator('.picture').click();
  assert.equal(await image.getByRole('button',{name:'Ajouter dans ce bloc'}).isVisible(),true);
  await image.getByRole('button',{name:'Ajouter dans ce bloc'}).click();
  await image.locator('.existing-block-add-menu').getByRole('button',{name:'Texte',exact:true}).click();
  const photoSection=page.locator('.canvas>.content-section').filter({has:page.locator('.block[data-id="legacy-image-in"]')});
  assert.equal(await photoSection.locator('.section-column>.block').count(),2);
  assert.equal(await photoSection.locator('.block[data-id="legacy-image-in"] img').getAttribute('src'),
    '/media/media/1791723108110/file-1791723109615-1000040461.jpg',
    'original photo URL is preserved');

  await page.locator('#save-btn').click();
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('celebrations-demo-shared-pages-v1')));
  const blocks=state.pages[0].blocks;
  assert.equal(blocks.length,3,'no original page section was deleted or split into extra page blocks');
  assert.equal(blocks[0].kind,'section');
  assert.deepEqual(blocks[0].columns[0].map(x=>x.kind),['heading','image','heading']);
  assert.equal(blocks[0].columns[0][0].id,'legacy-head-in');
  assert.equal(blocks[0].columns[0][0].color,'#643f2f');
  assert.deepEqual(blocks[2].columns[0].map(x=>x.kind),['image','text']);
  assert.equal(blocks[1].text,'Bienvenue sur notre site');
  assert.ok(writes.length>=1,'save request was intercepted without changing remote draft');

  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="pages"]').click();
  assert.equal(await page.locator('.canvas>.content-section').count(),2,'both composed sections survive refresh');
  assert.equal(await page.locator('.canvas>.content-section').first().locator('.section-column>.block').count(),3);
  assert.equal(await page.locator('.canvas>.block').count(),1,'nested image must not be re-added to homepage after reload');
  assert.equal(await page.locator('.canvas>.block[data-id="legacy-image-in"]').count(),0,'old image now belongs only to its section');
  assert.deepEqual(errors,[],'no JS errors on phone or desktop');
  console.log('ADD_INSIDE_EXISTING_BLOCK_PASS',JSON.stringify({width,
   originalPreserved:true,itemsInOneBlock:3,secondPhotoSupportsText:true,
   saveAndReload:true,serverWritesMocked:writes.length}));
  await context.close();
 }
}finally{await browser.close()}
