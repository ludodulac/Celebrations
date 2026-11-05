import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Candidate-only browser regression: no real server writes. All editor API
// calls are intercepted, including final private-draft saving.
const base=process.env.EDITOR_BASE||'https://celebrations-visual-candidate.rondes.workers.dev';
const browser=await chromium.launch();
try{
 for(const width of [1280,390]){
  const context=await browser.newContext({
   viewport:{width,height:850},hasTouch:width===390,isMobile:width===390
  });
  const page=await context.newPage();
  page.setDefaultTimeout(18000);
  const errors=[],calls=[],saves=[];
  page.on('pageerror',error=>errors.push(error.message));
  let revision=0;
  await page.route('**/api/editor-open-draft**',async route=>{
   if(route.request().method()==='POST'){
    saves.push(JSON.parse(route.request().postData()));
    calls.push('save-draft');revision++;
   }
   const result=route.request().method()==='GET'?
    {ok:true,revision,record:null,plans:[],shared:{pages:[],homeId:''},mediaCatalogue:[]}:
    {ok:true,revision,updatedAt:new Date().toISOString()};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.route('**/api/editor-publication**',async route=>{
   if(route.request().method()==='POST')calls.push('PUBLICATION');
   await route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({ok:true,revision,media:[],record:null,
     shared:{pages:[],homeId:''},celebrationVisible:true})});
  });
  await page.goto(base+'/__editor/demo-preparation?celebration=101',
   {waitUntil:'domcontentloaded'});
  await page.locator('button[data-tab="pages"]').click();
  const original=page.locator('.canvas>.block[data-id]').first();
  await original.waitFor();
  const blockId=await original.getAttribute('data-id');
  const blockKind=await original.getAttribute('data-kind');
  const originalContent=await original.evaluate(el=>({
   html:el.querySelector('.ed')?.innerHTML||'',
   image:el.querySelector('.picture img')?.getAttribute('src')||'',
   video:el.querySelector('.video-preview')?.textContent||''
  }));
  assert.ok(blockId&&blockKind,'A real historical page element is present');
  const firstMenu=page.locator('.canvas>.section-insert').first();
  // The first legacy insertion bar is intentionally 8px tall and can
  // intercept normal clicks. Activate its two existing controls directly for
  // test setup; the actual drag gesture below still uses real mouse input.
  await firstMenu.locator('.section-add-blue').evaluate(e=>e.click());
  await firstMenu.getByRole('button',{name:'Deux colonnes'}).evaluate(e=>e.click());
  let section=page.locator('.canvas>.content-section').first();
  await section.waitFor();
  const sectionId=await section.getAttribute('data-section-id');
  assert.equal(await section.locator('.section-column').count(),2);
  const right=section.locator('.section-column').nth(1);
  const handle=page.locator('.canvas>.block[data-id="'+blockId+'"]>.editor-move-handle');
  assert.equal(await handle.count(),1,'Existing content has a dedicated move handle');
  assert.match(await handle.getAttribute('aria-label'),/Déplacer/);

  if(width===1280){
   await original.hover();
   const h=await handle.boundingBox(),target=await right.boundingBox();
   assert.ok(h&&target);
   await page.mouse.move(h.x+h.width/2,h.y+h.height/2);
   await page.mouse.down();
   await page.mouse.move(target.x+target.width/2,target.y+Math.min(20,target.height/2),
    {steps:15});
   await page.mouse.up();
  }else{
   const result=await page.evaluate(async ({id,sectionId})=>{
    const source=document.querySelector('.canvas>.block[data-id="'+id+'"]>.editor-move-handle');
    const destination=document.querySelector('.content-section[data-section-id="'+sectionId+'"] .section-column[data-column-index="1"]');
    if(!source||!destination)return false;
    const a=source.getBoundingClientRect(),b=destination.getBoundingClientRect(),
     ax=a.left+a.width/2,ay=a.top+a.height/2,
     bx=b.left+b.width/2,by=b.top+Math.min(20,b.height/2);
    const pointer=(type,x,y)=>new PointerEvent(type,{
     bubbles:true,cancelable:true,pointerId:701,pointerType:'touch',
     button:0,buttons:type==='pointerup'?0:1,isPrimary:true,clientX:x,clientY:y
    });
    source.dispatchEvent(pointer('pointerdown',ax,ay));
    await new Promise(resolve=>setTimeout(resolve,510)); // touch long press
    document.dispatchEvent(pointer('pointermove',bx,by));
    document.dispatchEvent(pointer('pointerup',bx,by));
    return true;
   },{id:blockId,sectionId});
   assert.equal(result,true,'Touch gesture was sent to the existing element');
  }
  let moved=page.locator('.content-section[data-section-id="'+sectionId+'"] .section-column[data-column-index="1"] .block[data-id="'+blockId+'"]');
  await moved.waitFor({timeout:6000});
  assert.equal(await page.locator('.canvas>.block[data-id="'+blockId+'"]').count(),0,
   'The source was moved, not duplicated');
  assert.equal(await page.locator('.canvas .block[data-id="'+blockId+'"]').count(),1,
   'One and only one copy exists after the drag');
  assert.deepEqual(await moved.evaluate(el=>({
   html:el.querySelector('.ed')?.innerHTML||'',
   image:el.querySelector('.picture img')?.getAttribute('src')||'',
   video:el.querySelector('.video-preview')?.textContent||''
  })),originalContent,'Full original content survives the move');

  if(width===1280){
   // The layout can be toggled without losing a block parked in column two.
   await section.locator('.section-layout-toggle').click();
   section=page.locator('.content-section[data-section-id="'+sectionId+'"]');
   assert.equal(await section.getAttribute('data-layout'),'single');
   assert.equal(await section.locator('.block[data-id="'+blockId+'"]').count(),1);
   await section.locator('.section-layout-toggle').click();
   section=page.locator('.content-section[data-section-id="'+sectionId+'"]');
   assert.equal(await section.getAttribute('data-layout'),'columns');
   assert.equal(await section.locator('.section-column').nth(1).locator('.block[data-id="'+blockId+'"]').count(),1);
   // Move between the two columns, again retaining the exact same block.
   const movedHandle=section.locator('.section-column').nth(1)
    .locator('.block[data-id="'+blockId+'"]>.editor-move-handle');
   const leftColumn=section.locator('.section-column').nth(0);
   const movedBox=section.locator('.section-column').nth(1)
    .locator('.block[data-id="'+blockId+'"]');
   await movedBox.hover();
   const from=await movedHandle.boundingBox(),to=await leftColumn.boundingBox();
   assert.ok(from&&to);
   await page.mouse.move(from.x+from.width/2,from.y+from.height/2);
   await page.mouse.down();
   await page.mouse.move(to.x+to.width/2,to.y+Math.min(18,to.height/2),{steps:12});
   await page.mouse.up();
   assert.equal(await section.locator('.section-column').nth(0)
    .locator('.block[data-id="'+blockId+'"]').count(),1);
  }

  // The move changes the private draft only. It must not publish automatically.
  assert.ok(!calls.includes('PUBLICATION'));
  assert.ok((await page.locator('#save-btn').innerText()).includes('Enregistrer'));
  await page.locator('#save-btn').click();
  await page.waitForFunction(()=>document.getElementById('save-btn')?.textContent?.includes('Enregistré'),
   null,{timeout:10000});
  assert.ok(saves.length>0,'An explicit Save persists to the private draft server');
  assert.ok(!calls.includes('PUBLICATION'),'Drag and save never publish an existing page');
  const saved=saves.at(-1),allPages=[
   ...(saved.record?.pages||[]),...(saved.shared?.pages||[])
  ];
  const serverPage=allPages.find(p=>p.id&&p.blocks?.some(b=>
   b.kind==='section'&&String(b.id)===String(sectionId)));
  assert.ok(serverPage,'Moved section survives the private server serialization');
  const savedSection=serverPage.blocks.find(b=>String(b.id)===String(sectionId));
  assert.ok(savedSection.columns.flat().some(b=>String(b.id)===String(blockId)),
   'Original block is present in the saved section');
  assert.deepEqual(errors,[],'No drag gesture caused JavaScript errors');
  console.log('EDITOR_DRAG_DROP_PASS width='+width+' historical_element='+blockKind+
   ' private_saved=true mobile_long_press='+(width===390));
  await context.close();
 }
}finally{await browser.close()}
