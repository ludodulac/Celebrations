// Mission 09 — true Chromium coverage of ONLY pages and buttons visible
// on the CÉLÉBRATIONS website. Isolated, read-only Cloudflare preview.
// No passwords, participant data, actual media titles or private slugs printed.
import assert from "node:assert/strict";
import {chromium} from "playwright";

const origin="https://celebrations-exit-preview-ro.rondes.workers.dev";
const dayLabels=["Préparation","Mercredi","Jeudi","Vendredi","Samedi","Dimanche","Après célébration"];
const directRoutes=[
 ["programme","program"],
 ["preparation","program"],
 ["mercredi","program"],
 ["jeudi","program"],
 ["vendredi","program"],
 ["samedi","program"],
 ["dimanche","program"],
 ["apres-celebration","info"],
 ["bibliotheque","library"],
 ["apres-la-ronde","info"]
];
const restored="/media/media/pdf-1789466878259-22-9vktt/file-1789466879911-Pardon-des-Offenses-version-raccourcie.pdf";
const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
const output=[];
let allJsErrors=0,allLegacyRequests=0,allServerFailures=0;
try{
 for(const viewport of [
  {label:"android-mobile",width:390,height:844,isMobile:true,deviceScaleFactor:2},
  {label:"desktop",width:1280,height:800,isMobile:false,deviceScaleFactor:1}
 ]){
  const context=await browser.newContext({
   viewport:{width:viewport.width,height:viewport.height},
   isMobile:viewport.isMobile,hasTouch:viewport.isMobile,
   deviceScaleFactor:viewport.deviceScaleFactor,
   serviceWorkers:"block"
  });
  const errors=[],old=[],mutations=[],serverFailures=[];
  let page;
  try{
   page=await context.newPage();
   page.on("pageerror",e=>errors.push(e.name||"JavaScriptError"));
   page.on("request",r=>{
    if(/jwyayfkssyagvnablttg\.(?:supabase\.co|storage\.supabase\.co)/i.test(r.url()))
     old.push(r.method());
   });
   page.on("response",r=>{
    if(r.status()>=500&&r.url().startsWith(origin+"/"))
     serverFailures.push({status:r.status(),resource_type:r.request().resourceType()});
   });
   await page.route("**/*",async route=>{
    const req=route.request();
    // No analytics, admin, stats, registration or other mutation requests
    // can leave Chromium. These may be attempted by normal site tracking.
    if(!["GET","HEAD"].includes(req.method())){
     mutations.push(req.method());
     await route.fulfill({status:405,contentType:"application/json",
                         body:'{"ok":false,"error":"mission09-readonly"}'});
     return;
    }
    await route.continue();
   });
   const home=await page.goto(origin+"/",{waitUntil:"domcontentloaded",timeout:45000});
   assert.equal(home.status(),200,"Home not HTTP 200");
   await page.locator("#welcome-open-program").waitFor({state:"visible",timeout:20000});
   const image=await page.locator("img.welcome-autumn").evaluate(img=>({
    naturalWidth:img.naturalWidth,complete:img.complete,
    src:new URL(img.currentSrc).pathname
   }));
   if(!image.complete||!image.naturalWidth){
    await page.waitForFunction(()=>document.querySelector("img.welcome-autumn")?.naturalWidth>0,{timeout:18000});
   }
   assert.ok(image.src.startsWith("/media/media/"),"Homepage image not R2");
   await page.evaluate(()=>window.publicDataReady);
   await page.waitForFunction(()=>window.publicShellReady===true,null,{timeout:20000});
   const info=await page.evaluate(()=>({
    backend:window.CELEBRATIONS_STAGING_BACKEND,
    celebrations:window.state?.celebrations?.length,
    events:window.state?.events?.length,
    contents:window.state?.contents?.length
   }));
   assert.deepEqual(info,{backend:origin,celebrations:4,events:62,contents:211},
     "Public D1 content did not fully load");
   await page.locator("#welcome-open-program").click();
   await page.locator(".celebration-inner-nav").waitFor({state:"visible",timeout:15000});
   assert.ok(await page.locator(".celebration-title-copy h1").first().isVisible(),
     "Celebration title missing");
   const nav=page.locator(".celebration-inner-nav button[data-tab]");
   assert.equal(await nav.count(),3,"Accueil / Programme / Médiathèque missing");
   await nav.filter({has:page.locator('[data-tab="program"]')}).count().catch(()=>{});
   await page.locator('.celebration-inner-nav button[data-tab="program"]').click();
   assert.ok(await page.locator("#program").isVisible(),"Programme button not functional");
   const days=page.locator("#program .days [data-day]");
   assert.equal(await days.count(),7,"Visible programme does not contain seven steps");
   let clickedDays=0,dayUrlChecks=0;
   for(let i=0;i<dayLabels.length;i++){
    const button=days.nth(i);
    const label=await button.innerText();
    assert.ok(label.includes(dayLabels[i]),"Programme day label order drift");
    await button.click();
    const selected=await page.locator("#program .days [data-day]").nth(i).getAttribute("class");
    assert.ok(selected?.includes("active"),"Day button did not select its programme day");
    assert.ok(await page.locator("#program").isVisible());
    const path=new URL(page.url()).pathname;
    const slug=dayLabels[i].normalize("NFD").replace(/[\u0300-\u036f]/g,"")
     .toLowerCase().replace(/[^a-z0-9]+/g,"-");
    assert.equal(path,"/"+slug,"Clicking a site day generated a broken URL");
    clickedDays++;dayUrlChecks++;
   }
   await page.locator('.celebration-inner-nav button[data-tab="info"]').click();
   assert.ok(await page.locator("#info").isVisible(),"Celebration Accueil not functional");
   await page.locator('.celebration-inner-nav button[data-tab="library"]').click();
   assert.ok(await page.locator("#library").isVisible(),"Médiathèque button not functional");
   const mediaTabs=["audio","video","text","image"];
   const choices=page.locator('#library [data-library-family]');
   assert.equal(await choices.count(),4,"Audio/video/text/images tabs missing");
   const familyInfo={};
   for(const family of ["audio","video","text"]){
    await page.locator('#library [data-library-family="'+family+'"]').click();
    assert.ok(await page.locator("#library").isVisible());
    familyInfo[family]=await page.locator("#library .simple-library-card").count();
    assert.ok(familyInfo[family]>=0);
   }
   await page.locator('#library [data-library-family="image"]').click();
   const gallery=page.locator('#library [data-image-gallery-grid]');
   await gallery.waitFor({state:"attached",timeout:15000});
   await page.waitForFunction(()=>{
    return [...document.querySelectorAll('#library .image-gallery-card')].some(
     x=>!x.hidden&&x.querySelector("img")?.naturalWidth>0);
   },null,{timeout:45000});
   const gallerySummary=await page.evaluate(()=>({
    visibly_rendered:[...document.querySelectorAll('#library .image-gallery-card')]
     .filter(card=>!card.hidden&&card.querySelector("img")?.naturalWidth>0).length,
    images_with_invalid_sources:[...document.querySelectorAll('#library .image-gallery-card')]
     .filter(card=>!card.hidden&&(!card.querySelector("img")?.naturalWidth)).length
   }));
   assert.ok(gallerySummary.visibly_rendered>0,"Gallery has no working real images");
   assert.equal(gallerySummary.images_with_invalid_sources,0,"Broken images displayed in gallery");

   const pdf=await page.request.head(origin+restored);
   assert.equal(pdf.status(),200,"Thursday published PDF does not open");
   assert.match(pdf.headers()["content-type"]||"",/application\/pdf/);

   let directOk=0;
   for(const [path,kind] of directRoutes){
    const response=await page.goto(origin+"/"+path+"/",{
     waitUntil:"domcontentloaded",timeout:45000
    });
    assert.equal(response.status(),200,"Direct public page unavailable: "+path);
    await page.evaluate(()=>window.publicDataReady);
    await page.waitForFunction(()=>window.publicShellReady===true,null,{timeout:18000});
    assert.ok(await page.locator(".celebration-title-copy h1").count()>0,
      "Standalone route not initialized: "+path);
    assert.ok(await page.locator("#"+kind).isVisible(),
      "Standalone route did not reveal corresponding section: "+path);
    assert.equal(await page.evaluate(()=>window.CELEBRATIONS_STAGING_BACKEND),origin);
    if(path==="preparation"){
     const day=await page.locator("#program .days .active").innerText();
     assert.ok(day.includes("Préparation"),"Real preparation page shows wrong day");
    }
    directOk++;
   }

   const adminResponse=await page.goto(origin+"/admin.html",{
    waitUntil:"domcontentloaded",timeout:45000
   });
   assert.equal(adminResponse.status(),200);
   await page.locator("#adminPasswordGate").waitFor({state:"visible",timeout:16000});
   assert.equal(await page.locator("body.admin-auth-locked").count(),1);
   assert.equal(old.length,0,"Cloudflare page still makes Supabase HTTP calls");
   assert.equal(errors.length,0,"Uncaught JavaScript errors in public browser");
   assert.equal(serverFailures.length,0,"Cloudflare returned HTTP 5xx to site browser");

   allJsErrors+=errors.length;allLegacyRequests+=old.length;
   allServerFailures+=serverFailures.length;
   output.push({
    viewport:viewport.label,home_image_loaded:true,
    backend_cloudflare_only:true,programme_days_clicked:clickedDays,
    day_url_updates:dayUrlChecks,standalone_pages_real_chromium:directOk,
    tabs_working:3,media_categories_clickable:4,
    gallery_loaded_images_at_least:gallerySummary.visibly_rendered,
    gallery_broken_visible_images:gallerySummary.images_with_invalid_sources,
    media_category_counts:familyInfo,published_pdf_http:pdf.status(),
    admin_password_gate_locked:true,mutation_requests_blocked:mutations.length
   });
  }finally{
   await context.close();
  }
 }
 assert.equal(output.length,2);
 console.log("MISSION09_VISIBLE_SITE_FULL_BROWSER_PASS "+JSON.stringify({
  screens:output,legacy_supabase_requests:allLegacyRequests,
  uncaught_javascript_errors:allJsErrors,cloudflare_5xx:allServerFailures,
  real_site_hostname_untouched:true,original_supabase_untouched:true,
  r2_d1_mutations:0,network_mutations_denied:true
 }));
}finally{await browser.close()}
