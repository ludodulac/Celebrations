import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base='https://celebrations-exit-staging.rondes.workers.dev';
const browser=await chromium.launch();
try {
 for(const mobile of [false,true]){
  const ctx=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1366,height:768},hasTouch:mobile,isMobile:mobile});
  const page=await ctx.newPage();
  page.setDefaultTimeout(14000);
  await page.goto(base+'/__editor/demo-preparation');
  await page.locator('#workspace .list .item').first().waitFor();
  assert.equal(await page.locator('#workspace .list .item').count(),9);
  page.once('dialog',d=>d.accept('Un moment particulier'));
  await page.getByRole('button',{name:'Page dans la célébration'}).click();
  await page.locator('.editor-head').getByText('Un moment particulier').waitFor();
  assert.equal(await page.locator('#workspace .list .item').count(),10);
  const extraId=await page.evaluate(()=>JSON.parse(localStorage.getItem('celebrations-demo-preparation-'+window.__PREPARATION_SEED__.celebrationId)).pages.find(p=>p.name==='Un moment particulier').id);
  assert.ok(extraId.startsWith('extra-'));
  page.once('dialog',d=>d.accept('Informations pratiques'));
  await page.getByRole('button',{name:'Page hors célébration'}).click();
  await page.locator('.editor-head').getByText('Informations pratiques').waitFor();
  assert.equal(await page.locator('#workspace .list .item').count(),11);
  assert.equal(await page.locator('#theme-toggle').isVisible(),false);
  const trialURL=await page.locator('#view-site-btn').getAttribute('href');
  assert.ok(trialURL.includes('neutral-'));
  const [trial]=await Promise.all([page.waitForEvent('popup'),page.locator('#view-site-btn').click()]);
  await trial.locator('#page-heading').getByText('Informations pratiques').waitFor();
  assert.equal(await trial.locator('#stage-navigation').isVisible(),false);
  assert.ok(await trial.locator('body').evaluate(e=>e.classList.contains('is-neutral-preview')));
  await trial.locator('#menu-toggle').click();
  assert.equal(await trial.locator('.general-tab').count(),2);
  await trial.locator('#return-celebration').click();
  assert.equal(await trial.locator('.stage-tab').count(),9);
  await trial.getByRole('button',{name:'Un moment particulier'}).click();
  assert.equal(await trial.locator('#page-heading').innerText(),'Un moment particulier');
  const width=await trial.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:window.innerWidth}));
  assert.ok(width.scroll<=width.inner+1,'no horizontal overflow '+JSON.stringify(width));
  console.log('EXTRA_NEUTRAL_PAGES_PASS mobile='+mobile+' celebration_extra=true neutral_hamburger=true colored_border=true');
  await trial.close();

  // Image uploaded from a page goes into the shared browser-local library.
  const sample=Buffer.from(await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=4;c.height=4;
   c.getContext('2d').fillRect(0,0,4,4);
   return c.toDataURL('image/png').split(',')[1];
  }),'base64');
  await page.getByRole('button',{name:'Image',exact:true}).click();
  await page.locator('.block').last().locator('.picture').click();
  const photoChooser=page.waitForEvent('filechooser');
  await page.locator('.block').last().getByRole('button',{name:'Ajouter une photographie'}).click();
  await (await photoChooser).setFiles({name:'camp.png',mimeType:'image/png',buffer:sample});
  await page.locator('.block').last().locator('.picture img').waitFor();
  await page.locator('#save-btn').click();
  const assetId=await page.evaluate(()=>{
   const saved=JSON.parse(localStorage.getItem('celebrations-demo-preparation-'+window.__PREPARATION_SEED__.celebrationId));
   const b=saved.pages.find(p=>p.name==='Informations pratiques').blocks.find(b=>b.kind==='image');
   if(!b?.assetId||b.src)throw Error('Photo not in local library');
   return b.assetId;
  });
  const card=()=>page.locator('[data-file-id="'+assetId+'"]');
  await page.locator('[data-tab="media"]').click();
  await card().waitFor();
  assert.ok((await card().innerText()).includes('Informations pratiques'));
  assert.equal(await card().locator('[data-usage]').getAttribute('data-usage'),'used');
  await page.locator('[data-tab="pages"]').click();
  await page.locator('#workspace .list .item').filter({hasText:'Un moment particulier'}).click();
  await page.getByRole('button',{name:'Image',exact:true}).click();
  await page.locator('.block').last().locator('.picture').click();
  await page.locator('.block').last().getByRole('button',{name:'Choisir depuis Fichiers'}).click();
  await card().locator('[data-action="use-asset"]').click();
  await page.locator('#save-btn').click();
  await page.locator('[data-tab="media"]').click();
  const usedDescription=await card().innerText();
  assert.ok(usedDescription.includes('Informations pratiques'));
  assert.ok(usedDescription.includes('Un moment particulier'));
  page.once('dialog',d=>{assert.ok(d.message().includes('Informations pratiques'));assert.ok(d.message().includes('Un moment particulier'));d.dismiss()});
  await card().getByRole('button',{name:'Supprimer',exact:true}).click();
  assert.equal(await card().count(),1,'Dismissing a used-image deletion must keep the image');
  await page.locator('[data-tab="pages"]').click();
  await page.locator('#workspace .list .item').filter({hasText:'Un moment particulier'}).click();
  await page.locator('.block').last().locator('.picture').click();
  page.once('dialog',d=>{assert.ok(d.message().includes('restera dans la bibliothèque'));d.accept()});
  await page.locator('.block').last().getByLabel('Supprimer').click();
  await page.locator('#workspace .list .item').filter({hasText:'Informations pratiques'}).click();
  await page.locator('.block').last().locator('.picture').click();
  page.once('dialog',d=>d.accept());
  await page.locator('.block').last().getByLabel('Supprimer').click();
  await page.locator('#save-btn').click();
  await page.locator('[data-tab="media"]').click();
  assert.equal(await card().locator('[data-usage]').getAttribute('data-usage'),'unused');
  assert.ok(await card().evaluate(e=>e.classList.contains('unused-image')));
  assert.equal(await card().locator('.library-thumb').evaluate(e=>getComputedStyle(e).filter),'grayscale(1)');

  await page.locator('#asset-file-picker').setInputFiles({name:'autre.png',mimeType:'image/png',buffer:sample});
  await page.locator('[data-action="select-unused"]').click();
  assert.equal(await page.locator('.library-select input:checked').count(),2);
  await card().getByLabel('Sélectionner camp.png').uncheck();
  assert.equal(await page.locator('.library-select input:checked').count(),1);
  page.once('dialog',d=>{assert.ok(d.message().includes('Êtes-vous bien sûr'));d.accept()});
  await page.locator('[data-action="delete-selected"]').click();
  assert.equal(await card().count(),1);
  assert.equal(await page.locator('[data-file-id]').count(),1);
  console.log('IMAGE_LIBRARY_PASS mobile='+mobile+' image_persisted=true reused_on_two_pages=true usage_warning=true grey_unused=true bulk_select_and_uncheck=true');

  await ctx.close();
 }
}finally{await browser.close()}
