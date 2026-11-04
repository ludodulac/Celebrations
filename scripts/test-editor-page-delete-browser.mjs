import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin='https://celebrations-exit-staging.rondes.workers.dev';
const browser=await chromium.launch();
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width===390,hasTouch:width===390});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  // Browser fixtures never write the real staging R2 draft, even when saving.
  await page.route('**/api/editor-open-draft**',async route=>{
   const method=route.request().method();
   const payload=method==='GET'?{ok:true,revision:0,record:null,plans:[],shared:{pages:[],homeId:''},updatedAt:null}:
    {ok:true,revision:1,updatedAt:new Date().toISOString()};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  let title='';
  page.on('dialog',async dialog=>dialog.accept(dialog.type()==='prompt'?title:undefined));
  const response=await page.goto(origin+'/__editor/demo-preparation?celebration=101',{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200);
  await page.locator('[data-tab="pages"]').click();
  console.log('PAGE_DELETE_DIAGNOSTIC',JSON.stringify({
   viewport:width,buttons:await page.locator('button').allTextContents(),
   preview:(await page.locator('#workspace').innerText()).slice(0,1000),
   errors
  }));
  title='Suppression test page '+width;
  await page.getByRole('button',{name:'＋ Page'}).click();
  const row=page.locator('.general-page-row').filter({hasText:title});
  await row.waitFor();
  assert.equal(await row.count(),1);
  // A protected historical home cannot be deleted via the menu.
  const historical=page.locator('.general-page-row').filter({hasText:'Accueil général'});
  if(await historical.count()){
   await historical.locator('summary').click();
   assert.equal(await historical.getByRole('button',{name:'Supprimer la page'}).count(),0);
   await historical.locator('summary').click();
  }
  await row.locator('summary').click();
  await row.getByRole('button',{name:'Supprimer la page'}).click();
  assert.equal(await row.count(),0,'Created general page disappears after confirmation');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="pages"]').click();
  assert.equal(await page.locator('.general-page-row').filter({hasText:title}).count(),0,'Deleted general page stays deleted after reload');

  await page.locator('[data-tab="celebrations"]').click();
  title='Suppression test étape '+width;
  await page.getByRole('button',{name:'＋ Page'}).click();
  const extra=page.locator('.general-page-row').filter({hasText:title});
  await extra.waitFor();
  assert.equal(await extra.getByLabel('Options de la page '+title).count(),1);
  await extra.locator('summary').click();
  await extra.getByRole('button',{name:'Supprimer la page'}).click();
  assert.equal(await extra.count(),0,'New celebration page removed');
  assert.equal(await page.locator('#workspace .list .item').filter({hasText:'Mercredi'}).count(),1,'Historic Wednesday remains');
  // Check 2-column editing layout and plus/buttons are aligned on narrow phones.
  // Create the fixture with DOM events: this assertion is about layout, not click hit-testing.
  await page.locator('.section-insert .section-add-blue').last().evaluate(el=>el.click());
  await page.locator('.section-insert-choices:not([hidden])').getByRole('button',{name:'Deux colonnes'}).evaluate(el=>el.click());
  const two=page.locator('.content-section[data-layout="columns"]').last();
  await two.waitFor();
  const rects=await two.evaluate(el=>{
   const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,centerX:r.x+r.width/2}};
   const area=el.querySelector(':scope > .section-columns');
   const columns=[...area.querySelectorAll(':scope > .section-column')];
   return {layout:getComputedStyle(area).flexDirection,
    sections:columns.map(x=>({box:rect(x),add:rect(x.querySelector('.section-add-green')),buttons:rect(x.querySelector('.section-column-actions'))})),
    toolbar:rect(el.querySelector(':scope > .section-root-actions')),
    root:rect(el)};
  });
  assert.equal(rects.sections.length,2);
  if(width===390){
   assert.equal(rects.layout,'column','two mobile columns stack');
   assert.ok(rects.sections[1].box.y>=rects.sections[0].box.bottom-1,'second column sits under first');
   assert.ok(rects.toolbar.bottom<=rects.sections[0].box.y+2,'layout and delete icons stay above the columns');
   for(const section of rects.sections){
    assert.ok(Math.abs(section.add.centerX-section.box.centerX)<5,'green plus centered on its column');
    assert.ok(section.add.y>=section.box.y&&section.add.bottom<=section.box.bottom,'plus belongs inside its column');
    assert.ok(section.add.width>=42,'plus is touch-friendly');
   }
  }else{
   assert.ok(rects.sections[1].box.x>=rects.sections[0].box.right-2,'desktop columns stay side by side');
  }
  console.log('MOBILE_TWO_COLUMNS_CONTROL_ALIGNMENT_PASS',JSON.stringify({width,layout:rects.layout}));
  assert.deepEqual(errors,[]);
  console.log('SERVER_PAGE_DELETE_PASS mobile='+(width===390)+' general=true extra=true historic_protected=true');
  await context.close();
 }
}finally{await browser.close()}
