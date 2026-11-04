import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base='https://celebrations-exit-staging.rondes.workers.dev';
const browser=await chromium.launch();
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:850},
   hasTouch:width===390,isMobile:width===390});
  const page=await context.newPage();page.setDefaultTimeout(12000);
  // Browser fixtures never write the real staging R2 draft, even when saving.
  await page.route('**/api/editor-open-draft**',async route=>{
   const method=route.request().method();
   const payload=method==='GET'?{ok:true,revision:0,record:null,plans:[],shared:{pages:[],homeId:''},updatedAt:null}:
    {ok:true,revision:1,updatedAt:new Date().toISOString()};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  const res=await page.goto(base+'/__editor/demo-preparation?celebration=101',{waitUntil:'domcontentloaded'});
  assert.equal(res.status(),200);
  const fixture=await page.evaluate(()=>{
   const seed=window.__PREPARATION_SEED__;
   const key='celebrations-demo-preparation-'+seed.celebrationId;
   const pages=JSON.parse(JSON.stringify(seed.pages));
   const target=pages.find(p=>p.group==='celebration'&&Array.isArray(p.blocks));
   if(!target)throw Error('No celebration page found');
   const imageCanvas=document.createElement('canvas');imageCanvas.width=360;imageCanvas.height=180;
   const ctx=imageCanvas.getContext('2d');ctx.fillStyle='#75a7b1';ctx.fillRect(0,0,360,180);
   const png=imageCanvas.toDataURL('image/png');
   target.blocks.push({id:'image-width-browser-test',kind:'image',src:png,
    text:'Image pour test de taille',align:'center'});
   localStorage.setItem(key,JSON.stringify({pages,celebrationDates:{},celebrationTimes:{}}));
   return {key,stage:target.id.slice(0,-String(seed.celebrationId).length-1)};
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="celebrations"]').click();
  await page.locator('.list .item').first().click();
  const item=page.locator('.canvas .block[data-id="image-width-browser-test"]');
  await item.waitFor();
  const picture=item.locator('.picture');
  await picture.locator('img').waitFor();
  const slider=item.locator('input.image-size-slider');
  assert.equal(await slider.isVisible(),false,'slider appears only after selecting image');
  await picture.click();
  assert.equal(await slider.isVisible(),true,'tap on an image reveals slider');
  assert.equal(await slider.inputValue(),'100');
  await slider.evaluate(input=>{input.value='45';input.dispatchEvent(new Event('input',{bubbles:true}))});
  assert.equal(await slider.inputValue(),'45');
  assert.equal(await picture.evaluate(element=>element.style.width),'45%','width changes immediately');
  assert.equal(await item.locator('.image-size-value').textContent(),'45 %');
  await page.locator('#save-btn').click();
  const draft=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),fixture.key);
  const block=draft.pages.flatMap(p=>p.blocks||[]).find(b=>b.id==='image-width-browser-test');
  assert.equal(block.widthPct,45,'image percentage included in saved draft');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="celebrations"]').click();
  await page.locator('.list .item').first().click();
  const restored=page.locator('.canvas .block[data-id="image-width-browser-test"]');
  await restored.waitFor();
  assert.equal(await restored.locator('.picture').evaluate(el=>el.style.width),'45%','width survives reload');
  await page.goto(base+'/__editor/voir-le-site?celebration=101&page='+encodeURIComponent(fixture.stage),{waitUntil:'domcontentloaded'});
  const visitor=page.locator('figure.trial-figure').filter({has:page.locator('img[alt="Image pour test de taille"]')});
  await visitor.waitFor();
  assert.equal(await visitor.evaluate(el=>el.style.width),'45%','visitor preview uses same percentage');
  assert.deepEqual(errors,[],'no client errors');
  console.log('IMAGE_WIDTH_SLIDER_PASS',JSON.stringify({width,editable:true,percent:45,reload:true,preview:true}));
  await context.close();
 }
}finally{await browser.close()}
