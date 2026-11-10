import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const origin=process.env.EDITOR_BASE||'https://celebrations-visual-candidate.rondes.workers.dev';
const browser=await chromium.launch();
try{
 for(const width of [1280,390]){
  const ctx=await browser.newContext({viewport:{width,height:850},
   isMobile:width===390,hasTouch:width===390});
  const page=await ctx.newPage();
  page.setDefaultTimeout(12000);
  const failures=[];page.on('pageerror',error=>failures.push(error.message));
  await page.route('**/api/editor-open-draft**',async route=>{
   const payload={ok:true,revision:0,record:null,
    shared:{pages:[],homeId:'neutral-accueil-general'},plans:[],mediaCatalogue:[]};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
  await page.goto(origin+'/__editor/demo-preparation?celebration=101',
   {waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="pages"]').click();
  const place=page.locator('.canvas>.section-insert').first();
  await place.locator('.section-add-blue').evaluate(el=>el.click());
  await place.getByRole('button',{name:'Ressource : image + document'}).evaluate(el=>el.click());
  const card=page.locator('.canvas>.content-section[data-presentation="resource"]').first();
  await card.waitFor();
  assert.equal(await card.getAttribute('data-layout'),'columns');
  assert.equal(await card.locator('.section-column').count(),2);
  assert.equal(await card.locator('.section-column').nth(0).locator('.picture').count(),1);
  assert.equal(await card.locator('.section-column').nth(1).locator('.ed.heading').count(),1);
  assert.equal(await card.locator('.section-column').nth(1).locator('.ed.text').count(),1);
  assert.equal(await card.locator('.section-column').nth(1).locator('.link-line').count(),1);
  const cols=await card.locator('.section-columns').evaluate(n=>getComputedStyle(n).gridTemplateColumns
   .split(' ').filter(Boolean).length);
  assert.equal(cols,width===1280?2:1,'Resource layout is responsive');
  assert.ok(failures.length===0,'No admin javascript error');
  const publicPage={id:'preparation-101',group:'celebration',name:'Préparation',blocks:[
   {id:1,kind:'heading',text:'Travail de Préparation',align:'center'},
   {id:'card',kind:'section',layout:'columns',presentation:'resource',
    columns:[
     [{id:2,kind:'image',text:'Image',src:'/media/media/1791723108110/file-1791723109615-1000040461.jpg'}],
     [{id:3,kind:'heading',text:'Un enseignement'},
      {id:4,kind:'heading',text:'Un enseignement',hideOnSite:true},
      {id:5,kind:'button',text:'Ouvrir le PDF : Un enseignement',href:'/media/media/document.pdf'}]
    ]},
   {id:'docs',kind:'section',layout:'single',presentation:'documents',
    columns:[[{id:6,kind:'heading',text:'Document A'},
      {id:7,kind:'button',text:'Ouvrir le PDF : Document A',href:'/media/media/a.pdf'}],[]]}
  ]};
  await page.route('**/api/editor-publication?**',async route=>{
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    ok:true,revision:1,record:{pages:[publicPage],celebrationDates:{},celebrationTimes:{}},
    shared:{pages:[],homeId:'neutral-accueil-general'},media:[],plans:[],
    celebrationVisible:true,celebrationVisibility:{}
   })});
  });
  await page.goto(origin+'/__editor/voir-le-site?celebration=101&page=preparation',
   {waitUntil:'domcontentloaded'});
  const resource=page.locator('.trial-content-section[data-presentation="resource"]');
  await resource.waitFor();
  assert.equal(await resource.locator('.trial-heading').count(),1,'Duplicate title hidden only on public page');
  const image=resource.locator('.trial-figure img');
  assert.equal(await image.count(),1);
  const button=resource.locator('.trial-button');
  assert.equal(await button.textContent(),'📄 Ouvrir le PDF');
  assert.equal(await button.getAttribute('aria-label'),'Ouvrir le PDF : Un enseignement');
  const doc=page.locator('.trial-content-section[data-presentation="documents"] .trial-document-item');
  assert.equal(await doc.count(),1);
  assert.equal(await doc.locator('.trial-heading').innerText(),'Document A');
  assert.equal(await doc.locator('.trial-button').innerText(),'📄 Ouvrir le PDF');
  const layout=await resource.locator('.trial-content-columns').evaluate(n=>({
   columns:getComputedStyle(n).gridTemplateColumns.split(' ').filter(Boolean).length,
   imageWidth:n.querySelector('img')?.getBoundingClientRect().width||0,
   cardWidth:n.closest('section')?.getBoundingClientRect().width||0
  }));
  assert.equal(layout.columns,width===1280?2:1);
  assert.ok(layout.cardWidth>250);
  assert.ok(layout.imageWidth<240,'Resource illustrations are never enormous');
  assert.deepEqual(failures,[],'No public preview javascript errors');
  console.log('MICHAEL_RESOURCE_LAYOUT_BROWSER_PASS '+JSON.stringify({width,layout}));
  await ctx.close();
 }
}finally{await browser.close()}
