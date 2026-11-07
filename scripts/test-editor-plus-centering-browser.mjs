import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {DEMO_CSS} from '../migration/cloudflare/editor-demo-style.mjs';
// Only geometric alignment and click behaviour of blue/green insertion disks.
// No server, login, publication or content writes.
const browser=await chromium.launch({headless:true});
try{
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:820}});
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div class="stage-editor"><div class="canvas"><div class="section-insert"><button class="section-add-blue" aria-label="Ajouter une section">＋</button></div><div class="content-section" data-layout="single"><div class="section-columns"><div class="section-column"><div class="section-column-actions"><button class="section-add-green" aria-label="Ajouter un élément">＋</button></div></div></div></div><div class="existing-block-add"><button class="section-add-green existing-block-add-button" aria-label="Ajouter dans ce bloc">＋</button></div></div></div></body></html>');
  await page.addStyleTag({content:DEMO_CSS});
  const result=await page.evaluate(()=>{
   const buttons=[...document.querySelectorAll('button.section-add-blue,button.section-add-green')];
   return buttons.map(el=>{
    const box=el.getBoundingClientRect(),
     before=getComputedStyle(el,'::before'),
     after=getComputedStyle(el,'::after');
    const border=parseFloat(getComputedStyle(el).borderLeftWidth)||0;
    // Relative pseudo-element offset + border compensation.
    const horizontal=border+parseFloat(before.left);
    const vertical=border+parseFloat(before.top);
    return {
     className:el.className,
     width:box.width,height:box.height,
     hBar:{w:parseFloat(before.width),h:parseFloat(before.height)},
     vBar:{w:parseFloat(after.width),h:parseFloat(after.height)},
     crossCenter:{x:horizontal,y:vertical},
     diskCenter:{x:box.width/2,y:box.height/2},
     pseudoTransform:before.transform,
     text:el.textContent
    };
   });
  });
  assert.equal(result.length,3);
  for(const icon of result){
   assert.equal(icon.hBar.w,15);
   assert.equal(icon.hBar.h,2);
   assert.equal(icon.vBar.w,2);
   assert.equal(icon.vBar.h,15);
   assert.ok(Math.abs(icon.crossCenter.x-icon.diskCenter.x)<=1,
    'Plus horizontal center '+JSON.stringify(icon));
   assert.ok(Math.abs(icon.crossCenter.y-icon.diskCenter.y)<=1,
    'Plus vertical center '+JSON.stringify(icon));
   assert.match(icon.pseudoTransform,/matrix\(/);
   assert.equal(icon.text,'＋','The accessible button text must be retained');
  }
  console.log('CELEBRATIONS_PLUS_CENTERED_PASS '+JSON.stringify({width,buttons:result.length}));
  await page.close();
 }
}finally{await browser.close()}
