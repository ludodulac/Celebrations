import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base='https://celebrations-exit-staging.rondes.workers.dev';
const browser=await chromium.launch();
try {
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:850},
   isMobile:width===390,hasTouch:width===390});
  await context.addInitScript(()=>{
   const key='celebrations-demo-preparation-101';
   if(!localStorage.getItem(key)){
    localStorage.setItem(key,JSON.stringify({pages:[{id:'mercredi-101',group:'celebration',name:'Mercredi',
     blocks:[{id:1,kind:'text',text:'ANCIEN BROUILLON DE CET APPAREIL'}]}],_serverPending:true}));
    localStorage.setItem('celebrations-demo-shared-pages-v1',
     JSON.stringify({pages:[{id:'neutral-accueil-general',group:'page',name:'Accueil général',
      blocks:[{id:1,kind:'text',text:'VIEUX ACCUEIL LOCAL'}]}],homeId:'neutral-accueil-general'}));
   }
  });
  const page=await context.newPage();page.setDefaultTimeout(13000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const remote={pages:[{id:'mercredi-101',group:'celebration',name:'Mercredi',
     blocks:[{id:'server-block',kind:'text',text:'CONTENU COMMUN SUR LE SERVEUR'}]}],
    celebrationDates:{},celebrationTimes:{}};
  const shared={pages:[{id:'neutral-accueil-general',group:'page',name:'Accueil général',
    blocks:[{id:'server-global',kind:'text',text:'ACCUEIL COMMUN SUR LE SERVEUR'}]}],
   homeId:'neutral-accueil-general'};
  await page.route('**/api/editor-open-draft**',async route=>{
   if(route.request().method()==='POST')throw Error('Test must never save a real server draft');
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
     ok:true,revision:12,record:remote,shared,plans:[],updatedAt:'2026-11-04T00:00:00Z'})});
  });
  const r=await page.goto(base+'/__editor/demo-preparation?celebration=101',{waitUntil:'domcontentloaded'});
  assert.equal(r.status(),200);
  await page.locator('[data-tab="celebrations"]').click();
  await page.getByRole('button',{name:/Mercredi/}).first().click();
  const text=await page.locator('.canvas').innerText();
  assert.ok(text.includes('CONTENU COMMUN SUR LE SERVEUR'));
  assert.ok(!text.includes('ANCIEN BROUILLON DE CET APPAREIL'));
  await page.locator('[data-tab="pages"]').click();
  const pageText=await page.locator('.canvas').innerText();
  assert.ok(pageText.includes('ACCUEIL COMMUN SUR LE SERVEUR'));
  assert.ok(!pageText.includes('VIEUX ACCUEIL LOCAL'));
  const saved=await page.evaluate(()=>({
    current:JSON.parse(localStorage.getItem('celebrations-demo-preparation-101')),
    shared:JSON.parse(localStorage.getItem('celebrations-demo-shared-pages-v1')),
    backup:JSON.parse(localStorage.getItem('celebrations-last-browser-draft-before-sync-v1'))
  }));
  assert.equal(saved.current._serverRevision,12);
  assert.ok(saved.backup.record.pages[0].blocks[0].text.includes('ANCIEN'));
  assert.ok(saved.shared.pages[0].blocks[0].text.includes('ACCUEIL COMMUN'));
  assert.deepEqual(errors,[]);
  console.log('CROSS_DEVICE_SERVER_AUTHORITATIVE_PASS '+JSON.stringify({width,
   remoteWins:true,oldLocalBackedUp:true,globalAndCelebrationSynced:true}));
  await context.close();
 }
} finally {await browser.close()}
