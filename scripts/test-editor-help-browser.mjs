import assert from 'node:assert/strict';
import {chromium} from 'playwright';

// Staging fixture only. No user draft or production content is modified.
const base=process.env.EDITOR_BASE||'https://celebrations-exit-staging.rondes.workers.dev';
const browser=await chromium.launch();
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({
   viewport:{width,height:850},hasTouch:width===390,isMobile:width===390});
  const page=await context.newPage();page.setDefaultTimeout(17000);
  const errors=[],writes=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/api/editor-open-draft**',async route=>{
   if(route.request().method()!=='GET')writes.push(route.request().method());
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(
    {ok:true,record:null,revision:0,shared:{pages:[],homeId:''},plans:[]})});
  });
  const response=await page.goto(base+'/__editor/demo-preparation?celebration=101',
   {waitUntil:'domcontentloaded'});
  assert.equal(response.status(),200);
  const guideTab=page.locator('button[data-tab="guide"]');
  await guideTab.waitFor();
  assert.equal(await guideTab.isVisible(),true,'Help tab must be available on phone and desktop');
  if(width===390){
   const bounds=await page.locator('.rail nav').evaluate(nav=>{
    const a=nav.getBoundingClientRect(),b=nav.querySelector('[data-tab="guide"]').getBoundingClientRect();
    return {nav:a.width,guide:b.width,guideLeft:b.left,guideRight:b.right,navLeft:a.left,navRight:a.right};
   });
   assert.ok(bounds.guideLeft>=bounds.navLeft-1&&bounds.guideRight<=bounds.navRight+1,
    'Mobile guide tab is visible without horizontal scrolling');
  }
  await guideTab.click();
  await page.locator('.editor-guide').waitFor();
  assert.equal(await guideTab.evaluate(el=>el.classList.contains('active')),true);
  assert.equal(await page.locator('.editor-guide h1').textContent(),'Mode d’emploi du site');
  const allTopics=page.locator('.guide-topic');
  assert.ok(await allTopics.count()>=30,'Comprehensive guide documents at least 30 features');
  for(const group of ['Premiers pas','Pages et célébrations','Construire les blocs',
   'Textes, images et liens','Fichiers et audio','Vérification et sécurité']){
   assert.equal(await page.locator('.guide-group h2').filter({hasText:group}).count(),1);
  }
  const categories=['+ bleu','+ vert','Importer de nouveaux fichiers','Réduire ou agrandir une image',
   'Enregistrer et retrouver les mêmes pages','Passer de deux colonnes'];
  const texts=await allTopics.allTextContents();
  for(const topic of categories)assert.ok(texts.some(t=>t.toLowerCase().includes(topic.toLowerCase())),
   'Guide contains: '+topic);
  assert.equal(await page.locator('.guide-topic[open]').count(),0,'All topics initially folded');
  await page.getByRole('button',{name:'Tout ouvrir'}).click();
  assert.equal(await page.locator('.guide-topic[open]').count(),await allTopics.count());
  await page.getByRole('button',{name:'Tout fermer'}).click();
  assert.equal(await page.locator('.guide-topic[open]').count(),0);
  const search=page.getByRole('searchbox',{name:'Rechercher dans le mode d’emploi'});
  await search.fill('colonne');
  assert.ok(await allTopics.count()>=2,'Find matching help topics');
  assert.ok(await allTopics.count()<30,'Search filters unrelated topics');
  assert.equal(await page.locator('.guide-topic[open]').count(),await allTopics.count(),'Matches open automatically');
  await search.fill('APERCU');
  assert.ok(await allTopics.count()>=1,'Search is accent-insensitive');
  await search.fill('sujet-introuvable-987654');
  assert.equal(await allTopics.count(),0);
  assert.equal(await page.locator('.guide-empty').isVisible(),true);
  await search.fill('');
  assert.ok(await allTopics.count()>=30,'Clearing search restores full guide');
  // The guide must not alter the selected page, saved data or source files.
  await page.locator('button[data-tab="pages"]').click();
  assert.ok(await page.locator('.canvas').count()>0,'Pages tab remains functional after help');
  await page.locator('button[data-tab="guide"]').click();
  assert.equal(await page.locator('.editor-guide').count(),1,'Help can be revisited');
  assert.deepEqual(writes,[],'Help never writes to the server');
  assert.deepEqual(errors,[],'No browser JS errors');
  console.log('EDITOR_HELP_GUIDE_PASS '+JSON.stringify({width,topics:await allTopics.count(),
   search:true,mobileVisible:true,noWrites:true}));
  await context.close();
 }
}finally{await browser.close()}
