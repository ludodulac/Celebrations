// M4: current real official site and the published Cloudflare candidate.
// VISITOR READ ONLY; no login, no forms, no private response body, no mutations.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const hosts=[
 {label:'candidate',origin:'https://celebrations-visual-candidate.rondes.workers.dev',privateStatus:404},
 {label:'official',origin:'https://ronde-des-archanges-universelle.eu',privateStatus:401},
 {label:'official-www',origin:'https://www.ronde-des-archanges-universelle.eu',privateStatus:401}
];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let total=0;
try{
 for(const target of hosts){
  const {origin,label,privateStatus}=target;
  // A published GET is public data. Do not fetch anonymous private drafts.
  const meta=await fetch(origin+'/api/editor-publication?celebration=101',{
   method:'GET',cache:'no-store',signal:AbortSignal.timeout(20000)});
  assert.equal(meta.status,200,label+' public manifest unavailable');
  const pub=await meta.json();
  assert.ok(pub.revision>=1,label+' must have real content revision');
  assert.ok(pub.record?.pages?.length>=8,label+' must have 8 real celebration pages');
  assert.ok(pub.shared?.pages?.length>=1,label+' must have published home');
  const privateRes=await fetch(origin+'/api/editor-open-draft?celebration=101',{
   method:'GET',cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(20000)});
  assert.equal(privateRes.status,privateStatus,label+' private API accessible');
  await privateRes.body?.cancel().catch(()=>{});
  console.log('M04_LIVE_PUBLIC_API_PASS '+JSON.stringify({
   host:label,revision:pub.revision,celebrationPages:pub.record.pages.length,
   sharedPages:pub.shared.pages.length,privateGetStatus:privateRes.status,
   privateContentRead:false
  }));
  for(const [width,mobile] of [[1280,false],[390,true]]){
   const ctx=await browser.newContext({viewport:{width,height:840},isMobile:mobile,
    hasTouch:mobile,serviceWorkers:'block',locale:'fr-FR'});
   const page=await ctx.newPage();page.setDefaultTimeout(20000);
   const errors=[],externalWrites=[],server5xx=[];
   page.on('pageerror',e=>{
     const msg=String(e.message||'');
     const match=msg.match(/^([A-Za-z_$][\\w$]*) is not defined$/);
     errors.push(match?'ReferenceError:undefined-identifier='+match[1]:
       String(e.name||'Error')+':'+msg.slice(0,120).replace(/[^\\w .,:!()-]/g,'?'));
   });
   page.on('response',r=>{
    if(r.status()>=500&&r.url().startsWith(origin))server5xx.push(r.status());
   });
   await page.route('**/*',route=>{
    if(!['GET','HEAD'].includes(route.request().method())){
     externalWrites.push(route.request().method());
     return route.fulfill({status:405,contentType:'text/plain',body:'Read-only M4'});
    }
    return route.continue();
   });
   try{
    const res=await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:45000});
    assert.equal(res.status(),200,label+' home unavailable '+width);
    await page.locator('#stage-main').waitFor({state:'attached'});
    // Metadata-only diagnostics: no rendered text, cookie or private data logged.
    await page.waitForTimeout(1200);
    const diag=await page.evaluate(()=>({
      ready:document.readyState,
      seedPresent:!!window.__TRIAL_SITE_SEED__,
      publicSnapshotPresent:!!window.__PUBLIC_SITE_SNAPSHOT__,
      stageTextLength:document.querySelector('#stage-main')?.textContent?.length||0,
      stageChildren:document.querySelector('#stage-main')?.children.length||0,
      navChildren:document.querySelector('#general-navigation')?.children.length||0,
      loadedScripts:document.querySelectorAll('script').length
    }));
    console.log('M04_LIVE_STAGE_DIAGNOSTIC '+JSON.stringify({
      host:label,viewport:width,...diag,jsErrorKinds:errors
    }));
    await page.waitForFunction(()=>document.querySelector('#stage-main')?.textContent?.trim().length>5);
    const nav=page.locator('#menu-toggle');
    await nav.waitFor({state:'visible'});
    await nav.click();
    const menu=page.locator('#general-navigation');
    await menu.waitFor({state:'visible'});
    const names=(await menu.locator('button.general-tab').allTextContents())
      .map(t=>t.replace(/^[⌂✧▧]\s*/,'').trim());
    assert.deepEqual(names.slice(0,3),['Accueil','Célébrations','Médiathèque générale'],
      label+' public visitor menu order changed');
    const box=await menu.boundingBox();
    assert.ok(box&&box.width<=290&&box.x>=-1&&box.x+box.width<=width+1,
      label+' visitor dropdown exceeds viewport');
    await page.keyboard.press('Escape');
    assert.equal(await menu.isVisible(),false,label+' menu failed to close');
    // The real public site must permit direct navigation to the celebration.
    const listing=await page.goto(origin+'/?page=celebrations',
      {waitUntil:'domcontentloaded',timeout:40000});
    assert.equal(listing.status(),200,label+' celebrations unavailable');
    await page.locator('.celebration-choice').first().waitFor({state:'visible'});
    const celebrationCount=await page.locator('.celebration-choice').count();
    assert.ok(celebrationCount>=4,label+' missing public archangel celebrations');
    const wed=await page.goto(origin+'/mercredi/',
      {waitUntil:'domcontentloaded',timeout:40000});
    assert.equal(wed.status(),200,label+' Wednesday route unavailable');
    await page.locator('#stage-main').waitFor({state:'attached'});
    assert.deepEqual(errors,[],label+' browser JS exception');
    assert.deepEqual(server5xx,[],label+' Cloudflare 5xx');
    assert.deepEqual(externalWrites,[],label+' attempted POST even though test blocked it');
    const geom=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(geom.doc<=geom.viewport+2,label+' unexpected horizontal overflow');
    console.log('M04_LIVE_VISITOR_CHROMIUM_PASS '+JSON.stringify({
     host:label,viewport:width,mainPage:200,celebrations:celebrationCount,
     directWednesday:200,menuOrder:true,menuDropdownFits:true,
     javascriptErrors:0,serverFailures:0,remoteWrites:0,scrollOverflow:false
    }));
    total++;
   }finally{await page.close();await ctx.close()}
  }
 }
 console.log('M04_LIVE_SITE_READONLY_COMPLETE '+JSON.stringify({
  contexts:total,hosts:hosts.length,officialWorkersWrites:0,
  d1Writes:0,r2Writes:0,dnsChanges:0,adminAccessClaims:false
 }));
}finally{await browser.close()}
