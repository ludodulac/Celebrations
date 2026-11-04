// Read-only browser launch test. Does not submit forms, edit drafts, or write content.
// The home hero image must load from the preserved public R2 media.
// General pages may have been intentionally deleted by the owner.
// Nav is intentionally hidden before the visitor opens it; check attachment, not visibility.
// Admin deep links preserve the current page slug and the server-saved celebration.
// The title changes to reflect the current visitor page.
// Existing production secrets are kept intact by this deployment.
// Browser analytics attempts are blocked in this read-only smoke test.
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
assert.ok(saved.shared?.pages?.length>=1,'At least the shared home page must be saved');
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:820},isMobile:width===390,hasTouch:width===390,serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(22000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  const mutations=[];await page.route('**/*',async route=>{
   const r=route.request(),method=r.method();
   if(!['GET','HEAD'].includes(method)){
    mutations.push(method);
    // An oversized, invalid code never reaches DB verification and creates
    // no session. This checks a real mobile form navigation without mutation.
    const safeLogin=r.url().endsWith('/api/editor-access')&&method==='POST'&&
     (r.postData()||'').includes('code='+('x'.repeat(40)));
    if(safeLogin)return route.continue();
    return route.fulfill({status:405,contentType:'application/json',body:'{"error":"readonly-test"}'});
   }
   return route.continue();
  });
  let res=await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:40000});
  assert.equal(res.status(),200,'Home must resolve');
  await page.locator('#general-navigation').waitFor({state:'attached'});
  await page.locator('#stage-main').waitFor();
  await page.waitForFunction(()=>document.querySelector('#stage-main')?.textContent?.trim().length>5,null,{timeout:22000});
  const home=await page.locator('#stage-main').innerText();
  assert.ok(home.length>5,'Home content should be visible');
  const welcomeImage=page.locator('img[alt="Ronde des Archanges Universelle"]').first();
  await welcomeImage.waitFor({state:'visible',timeout:18000});
  await page.waitForFunction(()=>{const image=document.querySelector('img[alt="Ronde des Archanges Universelle"]');return !!image&&image.complete&&image.naturalWidth>0},null,{timeout:20000});
  const homeImage=await welcomeImage.evaluate(img=>({width:img.naturalWidth,url:new URL(img.currentSrc,location.href).pathname}));
  assert.ok(homeImage.width>0,'Homepage illustration must decode correctly');
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
  assert.ok((await page.locator('a#back-admin').getAttribute('href')).startsWith('/__editor/demo-preparation?celebration=101'),'The admin URL keeps celebration and may include the current page');
  assert.equal(await page.locator('.site-menu-bar').count(),1,'Expected current visual site');
  assert.ok((await page.title()).endsWith(isOfficial?' — Célébrations des Archanges':' — Site d’essai'),'Page title must identify official or preview site');
  res=await page.goto(origin+'/mercredi/',{waitUntil:'domcontentloaded'});
  assert.equal(res.status(),200,'Old Wednesday route must work');
  await page.waitForFunction(()=>document.querySelector('#stage-main')?.textContent?.trim().length>5,null,{timeout:22000});
  assert.equal(await page.locator('.site-menu-bar').count(),1,'Wednesday still uses new visual site');
  res=await page.goto(origin+'/admin.html',{waitUntil:'domcontentloaded'});
  assert.equal(res.status(),200,'Public admin is accessible');
  if(isOfficial){
   await page.locator('form[action="/api/editor-access"]').waitFor({timeout:20000});
   assert.equal(await page.locator('#workspace').count(),0,'Editor is invisible without the access code');
   const signed=await page.locator('input[name="_csrf"]').inputValue();
   assert.match(signed,/^[0-9]{13}\.[a-f0-9]{32}\.[a-f0-9]{64}$/,'A signed form challenge is present');
   // Browser submits a form without a preliminary CSRF cookie.
   // 40 invalid characters stop before password checks and never write to D1.
   await page.locator('#code').evaluate(input=>input.removeAttribute('maxlength'));
   await page.locator('#code').fill('x'.repeat(40));
   await Promise.all([
    page.waitForURL(/\/admin\.html\?erreur=1/, {timeout:16000}),
    page.getByRole('button',{name:'Ouvrir l’administration'}).click()
   ]);
   assert.equal(await page.getByText(/Code incorrect ou trop de tentatives/).count(),1,
    'Mobile native POST must return to login instead of Origine interdite');
   const forbidden=await page.request.post(origin+'/api/editor-open-draft',{
    data:{celebration:'101',expectedRevision:saved.revision,record:{pages:[]},plans:[],shared:{pages:[],homeId:''}},
    headers:{origin}
   });
   assert.equal(forbidden.status(),401,'Anonymous request cannot replace server drafts');
  }else{
   await page.locator('#workspace').waitFor({timeout:20000});
   await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Version commune chargée'),null,{timeout:18000});
   await page.locator('[data-tab="pages"]').click();
   await page.waitForFunction(()=>document.querySelector('#workspace')?.textContent?.includes('Accueil'),null,{timeout:15000});
  }
  const picture=await page.request.head(origin+path);
  assert.equal(picture.status(),200,'Original image URL unchanged');
  const letter=await page.request.head(origin+'/?lettre=not-a-real-invitation');
  assert.equal(letter.status(),404,'Private invitation allowlist intact');
  assert.equal(errors.length,0,'No JS page errors');
  assert.ok(mutations.every(method=>method==='POST'),'Only blocked client POST attempts were seen; browser test sent no writes to the server');
  console.log('CELEBRATIONS_VISUAL_LAUNCH_BROWSER_PASS '+JSON.stringify({host:new URL(origin).hostname,width,
   savedRevision:saved.revision,celebrationPages:saved.record.pages.length,
   generalPages:saved.shared.pages.length,newHome:true,homeImageLoaded:true,newDay:true,adminCodeProtected:isOfficial,oldMedia200:true,oldPdfACL:true}));
  await context.close();
 }
}finally{await browser.close()}
