import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Browser proof: POST must be followed by a real GET of the saved JSON.
// All writes are intercepted inside this test, never forwarded to Cloudflare.
const base=process.env.EDITOR_BASE||'https://celebrations-visual-candidate.rondes.workers.dev';
const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:1280,height:860}});
 const page=await context.newPage();page.setDefaultTimeout(18000);
 page.on('dialog',dialog=>dialog.accept());
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 let version=0,record=null,plans=[],shared={pages:[],homeId:'neutral-accueil-general'};
 let posts=0,reloads=0,failed=false,forceConflict=false;
 await page.route('**/api/editor-open-draft**',async route=>{
  const request=route.request();
  if(request.method()==='GET'){
   reloads++;
   await route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({ok:true,revision:version,record,plans,shared,mediaCatalogue:[]})});
   return;
  }
  posts++;
  if(failed){
   failed=false;
   await route.fulfill({status:503,contentType:'application/json',
    body:JSON.stringify({ok:false,error:'Panne serveur simulée'})});
   return;
  }
  if(forceConflict){
   forceConflict=false;version++;
  }
  const body=JSON.parse(request.postData());
  if(body.expectedRevision!==version){
   await route.fulfill({status:409,contentType:'application/json',
    body:JSON.stringify({ok:false,error:'Conflit de version simulé'})});
   return;
  }
  version++;
  record=JSON.parse(JSON.stringify(body.record));
  shared=JSON.parse(JSON.stringify(body.shared));
  plans=JSON.parse(JSON.stringify(body.plans));
  await route.fulfill({status:200,contentType:'application/json',
   body:JSON.stringify({ok:true,revision:version,
    publishedPageId:body.publishPageId||null,updatedAt:new Date().toISOString()})});
 });
 await page.route('**/api/editor-publication**',async route=>{
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
   ok:true,revision:version,record,shared,plans,media:[],celebrationVisible:true
  })});
 });
 await page.goto(base+'/__editor/demo-preparation?celebration=101',{waitUntil:'domcontentloaded'});
 await page.locator('button[data-tab="pages"]').click();
 await page.locator('.canvas .block[data-kind="text"],.canvas .block[data-kind="heading"]').first().waitFor();
 const editable=page.locator('.canvas>.block .ed[contenteditable="true"]').first();
 const blockId=await editable.evaluate(el=>el.closest('.block')?.dataset.id);
 assert.ok(blockId,'The editable historical block has an ID');
 const sentinel='Enregistrement réel contrôlé — ' + Date.now();
 await editable.fill(sentinel);
 await page.locator('#save-btn').click();
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('revérifié après enregistrement'));
 assert.ok(posts>0&&reloads>=2,'HTTP POST and read-back GET actually occurred');
 assert.ok(!await page.locator('#save-btn').evaluate(el=>el.classList.contains('save-failed')));
 const pageInShared=shared.pages.find(p=>p.blocks?.some(b=>String(b.id)===String(blockId)));
 assert.ok(pageInShared,'Stored JSON contains the modified historical global page');
 assert.ok(JSON.stringify(pageInShared.blocks).includes(sentinel),
  'Actual server-side draft payload contains the typed text');
 // Remove the browser cache. Only the mocked server still knows this edit.
 await page.evaluate(()=>{
  localStorage.removeItem('celebrations-demo-preparation-101');
  localStorage.removeItem('celebrations-demo-shared-pages-v1');
 });
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('button[data-tab="pages"]').click();
 await page.locator('.canvas .block[data-id="'+blockId+'"] .ed').waitFor();
 assert.equal(await page.locator('.canvas .block[data-id="'+blockId+'"] .ed').innerText(),sentinel,
  'Reload restored the saved server text, not a stale browser cache');
 // Version increments made by a different celebration must not block save.
 const edited=page.locator('.canvas .block[data-id="'+blockId+'"] .ed');
 await edited.fill(sentinel+' ajusté');
 forceConflict=true;
 await page.locator('#save-btn').click();
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('revérifié après enregistrement'));
 assert.ok(posts>=3,'Concurrent version mismatch was retried safely');
 assert.ok(JSON.stringify(shared.pages).includes('ajusté'));
 // Failure path: a failed POST cannot claim success or discard local changes.
 await edited.fill(sentinel+' conservé après panne');
 failed=true;
 await page.locator('#save-btn').click();
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Panne serveur simulée'));
 assert.ok(await page.locator('#save-btn.save-failed').count()>0);
 const pending=await page.evaluate(()=>JSON.parse(localStorage.getItem('celebrations-demo-preparation-101')||'{}')._serverPending);
 assert.equal(pending,true,'Failed write is explicitly retained locally');
 await page.reload({waitUntil:'domcontentloaded'});
 await page.locator('button[data-tab="pages"]').click();
 assert.equal(await page.locator('.canvas .block[data-id="'+blockId+'"] .ed').innerText(),
  sentinel+' conservé après panne',
  'Reload must NOT overwrite a pending local page with old server content');
 await page.locator('#save-btn').click();
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('revérifié après enregistrement'));
 assert.ok(JSON.stringify(shared.pages).includes('conservé après panne'));
 assert.deepEqual(errors,[],'No JavaScript exceptions in save/retry/reload');
 console.log('EDITOR_REAL_SAVE_RELOAD_PASS writes='+posts+' serverReads='+reloads+
  ' preservedAfterFailure=true automaticSafeRevisionRetry=true');
 await context.close();
}finally{await browser.close()}
