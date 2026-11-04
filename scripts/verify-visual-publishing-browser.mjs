// Read-only browser launch test. Does not submit forms, edit drafts, or write content.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin=process.env.VISUAL_ORIGIN||'https://celebrations-visual-candidate.rondes.workers.dev';
const isOfficial=new URL(origin).hostname.endsWith('ronde-des-archanges-universelle.eu');
const path='/media/media/1791723108110/file-1791723109615-1000040461.jpg';
// Give a freshly deployed Cloudflare workers.dev route time to propagate.
let response;
for(let attempt=0;attempt<12;attempt++){
 response=await fetch(origin+'/api/editor-open-draft?celebration=101',{cache:'no-store'});
 if(response.status===200)break;
 await new Promise(resolve=>setTimeout(resolve,2000));
}
assert.equal(response.status,200,'Shared editor server must be reachable after deployment');
const saved=await response.json();
assert.ok(saved.revision>=1,'Expected a real saved snapshot');
assert.ok(saved.record?.pages?.length>=8,'User celebration pages must be saved');
assert.ok(saved.shared?.pages?.length>=2,'User general pages must be saved');
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:820},isMobile:width===390,hasTouch:width===390,serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(22000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const mutations=[];await page.route('**/*',async route=>{
   if(!['GET','HEAD'].includes(route.request().method())){
    mutations.push(route.request().method());
    return route.fulfill({status:405,contentType:'application/json',body:'{"error":"readonly-test"}'});
   }
   return route.continue();
  });
  let res=await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:40000});
  assert.equal(res.status(),200,'Home must resolve');
  await page.locator('#general-navigation').waitFor();
  await page.locator('#stage-main').waitFor();
  await page.waitForFunction(()=>document.querySelector('#stage-main')?.textContent?.trim().length>5,null,{timeout:22000});
  const home=await page.locator('#stage-main').innerText();
  assert.ok(home.length>5,'Home content should be visible');
  // A real saved homepage paragraph, not a local placeholder, must be visible.
  const homeData=saved.shared.pages.find(p=>p.id===saved.shared.homeId)||saved.shared.pages[0];
  const allBlocks=(blocks)=>blocks.flatMap(b=>b.kind==='section'?[...allBlocks(b.columns?.[0]||[]),...allBlocks(b.columns?.[1]||[])]:[b]);
  const phrases=allBlocks(homeData.blocks||[]).filter(b=>['heading','text','event'].includes(b.kind))
   .map(b=>String(b.text||'').replace(/\s+/g,' ').trim()).filter(x=>x.length>=18);
  if(phrases.length){
   const compact=home.replace(/\s+/g,' ').trim();
   assert.ok(phrases.some(p=>compact.includes(p.slice(0,25))),
    'Homepage must contain content from the real saved server snapshot');
  }
  assert.equal(await page.locator('a#back-admin').getAttribute('href'),'/__editor/demo-preparation?celebration=101');
  assert.equal(await page.locator('.site-menu-bar').count(),1,'Expected current visual site');
  assert.equal(await page.title(),isOfficial?'Célébrations des Archanges':'Site d’essai — Célébrations');
  res=await page.goto(origin+'/mercredi/',{waitUntil:'domcontentloaded'});
  assert.equal(res.status(),200,'Old Wednesday route must work');
  await page.waitForFunction(()=>document.querySelector('#stage-main')?.textContent?.trim().length>5,null,{timeout:22000});
  assert.equal(await page.locator('.site-menu-bar').count(),1,'Wednesday still uses new visual site');
  res=await page.goto(origin+'/admin.html',{waitUntil:'domcontentloaded'});
  assert.equal(res.status(),200,'Public admin is accessible');
  await page.locator('#workspace').waitFor({timeout:20000});
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Version commune chargée'),null,{timeout:18000});
  await page.locator('[data-tab="pages"]').click();
  await page.waitForFunction(()=>document.querySelector('#workspace')?.textContent?.includes('Accueil'),null,{timeout:15000});
  assert.equal(await page.locator('#server-login-link').count(),0,'No admin password prompt');
  const picture=await page.request.head(origin+path);
  assert.equal(picture.status(),200,'Original image URL unchanged');
  const letter=await page.request.head(origin+'/?lettre=not-a-real-invitation');
  assert.equal(letter.status(),404,'Private invitation allowlist intact');
  assert.equal(errors.length,0,'No JS page errors');
  assert.equal(mutations.length,0,'Browser test performed no writes');
  console.log('CELEBRATIONS_VISUAL_LAUNCH_BROWSER_PASS '+JSON.stringify({host:new URL(origin).hostname,width,
   savedRevision:saved.revision,celebrationPages:saved.record.pages.length,
   generalPages:saved.shared.pages.length,newHome:true,newDay:true,openAdmin:true,oldMedia200:true,oldPdfACL:true}));
  await context.close();
 }
}finally{await browser.close()}
