import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base='https://celebrations-exit-staging.rondes.workers.dev';
const browser=await chromium.launch();
try{
 for(const width of [390,1280]){
  const ctx=await browser.newContext({viewport:{width,height:850},isMobile:width===390,hasTouch:width===390});
  const page=await ctx.newPage();page.setDefaultTimeout(25000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/__editor/demo-preparation?celebration=101',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('.celebration-select').count(),1);
  assert.ok(await page.locator('#workspace .list .item').count()>=8);
  await page.getByLabel('Mercredi de la célébration').fill('2026-11-04');
  await page.locator('#workspace .list .item').filter({hasText:'Mercredi'}).click();
  await page.getByLabel('Heure du mercredi').fill('09:30');
  assert.equal((await page.locator('[data-role="celebration-date"]').innerText()).trim(),'4 novembre 2026 · 09:30');
  await page.locator('#workspace .list .item').filter({hasText:'Jeudi'}).click();
  await page.getByLabel('Heure du jeudi').fill('11:15');
  const [trial]=await Promise.all([page.waitForEvent('popup'),page.locator('#view-site-btn').click()]);
  assert.equal((await trial.locator('[data-role="celebration-date"]').innerText()).trim(),'5 novembre 2026 · 11:15');
  assert.equal(await trial.locator('.celebration-shortcut').count(),2,'Only Programme and Médiathèque shortcuts');
  assert.deepEqual(await trial.locator('.celebration-shortcut').allTextContents(),['Programme','Médiathèque']);
  assert.ok(await trial.locator('.celebration-shortcuts').evaluate(async el=>{
   const nav=document.querySelector('#stage-navigation');return nav?.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING
  }),'Small shortcuts must come AFTER day tabs');
  await trial.locator('.celebration-shortcut').filter({hasText:'Médiathèque'}).click();
  assert.equal(await trial.locator('.media-tabs button').count(),4);
  assert.equal(await trial.locator('.media-inline-player audio:visible').count(),0,'Audio players remain closed until clicked');
  const first=trial.locator('.media-item-link[href]').first();
  await first.waitFor();
  assert.ok(await first.getAttribute('href'),'Each media title must be a usable link');
  const firstMedia=trial.locator('.media-card').first();
  assert.equal(await firstMedia.evaluate(el=>el.querySelector('.media-item-link')?.nextElementSibling?.classList.contains('media-location')),true,'Page/day appears discreetly AFTER the media title');
  await trial.getByRole('button',{name:'Vidéo',exact:true}).click();
  const playable=trial.locator('.media-card:has(.media-inline-player)').first();
  if(await playable.count()){
   await playable.locator('.media-item-link').click();
   assert.equal(await playable.locator('.media-inline-player').isVisible(),true,'Video opens from its title');
   const close=playable.getByRole('button',{name:'Fermer la vidéo'});
   await playable.hover();
   await close.click();
   assert.equal(await playable.locator('.media-inline-player').isVisible(),false,'Video can be closed with the X');
  }
  await trial.getByRole('button',{name:'Images',exact:true}).click();
  const images=trial.locator('.media-image-grid .media-image-link');
  assert.ok(await images.count()>0);
  assert.equal(await images.first().getAttribute('target'),'_blank');
  const columns=await trial.locator('.media-image-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  assert.equal(columns,width===390?2:4);
  await trial.locator('#menu-toggle').click();
  await trial.getByRole('button',{name:'⌂ Accueil'}).click();
  assert.equal(await trial.locator('.celebration-shortcuts').isVisible(),false);
  await trial.close();
  await page.locator('#workspace .list .item').filter({hasText:'Préparation'}).first().click();
  await page.getByLabel('Date de préparation 1',{exact:true}).fill('2026-10-21');
  await page.getByRole('button',{name:'＋ Date'}).click();
  await page.getByLabel('Date de préparation 2',{exact:true}).fill('2026-10-28');
  assert.equal((await page.locator('[data-role="celebration-date"]').innerText()).trim(),'21 octobre 2026 · 28 octobre 2026');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#workspace .list .item').filter({hasText:'Préparation'}).first().click();
  assert.equal(await page.getByLabel('Date de préparation 2',{exact:true}).inputValue(),'2026-10-28');
  await page.locator('.new-celebration summary').click();
  await page.getByLabel('Date du mercredi').fill('2026-11-04');
  await page.getByRole('button',{name:'Créer Gabriel'}).click();
  await page.waitForURL('**/demo-preparation?celebration=plan-gabriel-2026-11-04&tab=celebrations');
  assert.equal(await page.locator('.celebration-select').inputValue(),'plan-gabriel-2026-11-04');
  assert.equal(await page.getByLabel('Titre de la célébration').inputValue(),'Gabriel 2026-2027');
  await page.getByLabel('Titre de la célébration').fill('Gabriel — Retraite de novembre');
  await page.getByLabel('Titre de la célébration').blur();
  assert.equal(await page.locator('.celebration-select option:checked').innerText(),'Gabriel — Retraite de novembre');
  assert.ok(await page.locator('#workspace .list .item').count()>=8);
  await page.locator('#workspace .list .item').filter({hasText:'Dimanche'}).click();
  assert.equal((await page.locator('[data-role="celebration-date"]').innerText()).trim(),'8 novembre 2026');
  await page.getByLabel('Mercredi de la célébration').fill('2026-12-30');
  assert.equal((await page.locator('[data-role="celebration-date"]').innerText()).trim(),'3 janvier 2027');
  await page.locator('[data-tab="pages"]').click();
  assert.equal(await page.locator('#workspace .list .item').count(),1);
  await page.locator('[data-tab="celebrations"]').click();
  assert.ok(await page.locator('#workspace .list .item').count()>=8);
  assert.equal(await page.locator('.celebration-select').inputValue(),'plan-gabriel-2026-11-04');
  assert.equal(await page.getByLabel('Titre de la célébration').inputValue(),'Gabriel — Retraite de novembre','Custom title survives page/tab changes');
  const samplePlans=[
   ['Raphaël','2027','2027-04-07'],
   ['Ouriel','2028','2028-07-05'],
   ['Michaël','2027','2027-09-01'],
   ['Gabriel','2027','2027-12-01'],
   ['Raphaël','2028','2028-04-05'],
   ['Ouriel','2028','2028-07-12'],
   ['Michaël','2028','2028-09-06'],
   ['Gabriel','2028','2028-12-06']
  ];
  await page.evaluate(samples=>{
   const slug=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
   const entries=samples.map(([archangel,year,date])=>({id:'plan-'+slug(archangel)+'-'+date,archangel,year,date,kind:'planned'}));
   localStorage.setItem('celebrations-demo-planned-v1',JSON.stringify(entries));
  },samplePlans);
  await page.reload({waitUntil:'domcontentloaded'});
  const names=await page.locator('.celebration-select option').allTextContents();
  for(const expected of ['Raphaël 2027','Ouriel 2027','Michaël 2027','Gabriel 2027-2028','Raphaël 2028','Ouriel 2028','Michaël 2028','Gabriel 2028-2029']){
   assert.ok(names.includes(expected),'Missing correct archangel cycle: '+expected+' in '+JSON.stringify(names));
  }
  // Correct an older Ouriel 2028 draft title without inventing the Wednesday date.
  await page.locator('.celebration-select').selectOption('plan-ouriel-2028-07-05');
  await page.waitForURL('**/demo-preparation?celebration=plan-ouriel-2028-07-05&tab=celebrations');
  assert.equal(await page.getByLabel('Titre de la célébration').inputValue(),'Ouriel 2027');
  assert.ok(await page.locator('.celebration-date-warning').count()>0,'A mismatched 2028 Wednesday must remain visible for correction');
  await page.getByLabel('Mercredi de la célébration').fill('2027-07-07');
  await page.getByLabel('Titre de la célébration').fill('Ouriel 2027 — Célébration universelle');
  await page.getByLabel('Titre de la célébration').blur();
  const [catalogue]=await Promise.all([page.waitForEvent('popup'),page.locator('#view-site-btn').click()]);
  await catalogue.locator('#menu-toggle').click();
  await catalogue.getByRole('button',{name:'Célébrations',exact:true}).click();
  assert.ok((await catalogue.locator('.celebration-choices').innerText()).includes('Ouriel 2027 — Célébration universelle'),'Custom celebration title must reach the visitor catalogue');
  await catalogue.close();
  assert.deepEqual(errors,[]);
  console.log('SITE_CYCLE_PASS mobile='+(width===390)+' date_hour=true prepared_dates=true next_gabriel=true separate_pages=true media_links=true image_grid=true');
  await ctx.close();
 }
}finally{await browser.close()}
