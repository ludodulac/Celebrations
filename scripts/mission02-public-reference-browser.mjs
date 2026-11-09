// MISSION 02 — public reference ONLY. Every request is GET or HEAD.
// No login, no form submit, no saving, no media upload, no user cookies.
// This records the deployed visitor UI at fixed desktop and phone sizes.
// Screenshots live in short-retention CI artifacts, not in the repository.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';

const ORIGIN=process.env.M02_OFFICIAL_ORIGIN||'https://ronde-des-archanges-universelle.eu';
assert.ok(/^https:\/\/(?:www\.)?ronde-des-archanges-universelle\.eu$/.test(ORIGIN),
 'Mission 02 public snapshots are restricted to the existing official domain');
const OUT=process.env.M02_OUTPUT_DIR||'artifacts/mission02/public';
await mkdir(OUT,{recursive:true});
const layouts=[
 {name:'ordinateur',width:1280,height:840,mobile:false},
 {name:'telephone',width:390,height:844,mobile:true}
];
const paths=[
 ['accueil','/'],
 ['celebrations','/?page=celebrations'],
 ['mediatheque-generale','/?page=mediatheque-generale'],
 ['preparation','/preparation/'],
 ['mercredi','/mercredi/'],
 ['jeudi','/jeudi/'],
 ['vendredi','/vendredi/'],
 ['samedi','/samedi/'],
 ['dimanche','/dimanche/'],
 ['apres-celebration','/apres-celebration/']
];
const report={
 mission:'02',kind:'visiteur-public',capturedAt:new Date().toISOString(),
 origin:ORIGIN,releaseSource:'fix/celebrations-inline-validation-20261105',
 screens:[],failures:[],mutationsIntercepted:0,
 constraints:'GET et HEAD uniquement, aucun accès administrateur, données publiques uniquement.'
};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(const cfg of layouts){
  const ctx=await browser.newContext({
   viewport:{width:cfg.width,height:cfg.height},
   isMobile:cfg.mobile,hasTouch:cfg.mobile,serviceWorkers:'block',
   reducedMotion:'reduce',locale:'fr-FR',colorScheme:'light',
   javaScriptEnabled:true
  });
  for(const [name,path] of paths){
   const page=await ctx.newPage();
   page.setDefaultTimeout(12000);
   const errors=[];
   page.on('pageerror',e=>errors.push(String(e.message||e).slice(0,250)));
   // Block every network mutation, including analytics beacons and any
   // accidental submission. Also block cross-origin navigations.
   await page.route('**/*',async route=>{
    const req=route.request(),verb=req.method().toUpperCase();
    if(verb!=='GET'&&verb!=='HEAD'){
     report.mutationsIntercepted++;
     return route.fulfill({status:405,contentType:'application/json',
      body:JSON.stringify({error:'audit-readonly'})});
    }
    if(req.isNavigationRequest()){
     const host=new URL(req.url()).hostname;
     if(!['ronde-des-archanges-universelle.eu',
       'www.ronde-des-archanges-universelle.eu'].includes(host))
      return route.abort('blockedbyclient');
    }
    return route.continue();
   });
   try{
    const response=await page.goto(ORIGIN+path,{waitUntil:'domcontentloaded',timeout:35000});
    assert.equal(response?.status(),200,'HTTP 200 sur '+name+' '+cfg.name);
    await page.locator('#stage-main').waitFor({state:'attached',timeout:18000});
    await page.waitForTimeout(850);
    const metrics=await page.evaluate(()=>{
     const qs=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
     const paper=qs('#site-paper'),rect=paper?.getBoundingClientRect();
     const menu=qs('#menu-toggle'),tabs=qs('#stage-navigation');
     const grid=qs('.celebration-choices');
     return {
      title:document.title,
      route:location.pathname+location.search,
      menuAvailable:!!menu,
      navPresent:!!qs('#general-navigation'),
      stageTabs:qa('#stage-navigation .stage-tab').map(x=>x.textContent.trim()),
      stageNavVisible:!!tabs&&!tabs.hidden&&getComputedStyle(tabs).display!=='none',
      mainTextChars:qs('#stage-main')?.innerText?.length??0,
      images:qa('#stage-main img').length,
      videos:qa('#stage-main video, #stage-main iframe').length,
      audios:qa('#stage-main audio').length,
      links:qa('#stage-main a').length,
      choices:qa('.celebration-choice').length,
      choiceColumns:grid?getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length:0,
      frame:{width:rect?Math.round(rect.width):0,left:rect?Math.round(rect.left):0},
      bodyBackground:getComputedStyle(document.body).backgroundColor,
      horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1
     };
    });
    assert.equal(metrics.menuAvailable,true,'Menu hamburger disponible');
    assert.equal(metrics.horizontalOverflow,false,'Pas de débordement horizontal');
    assert.ok(metrics.mainTextChars>0,'Page publique non vide');
    if(name==='accueil'){
     await page.locator('#menu-toggle').click();
     const order=await page.locator('#general-navigation .general-tab').allTextContents();
     metrics.menuOrder=order.map(x=>x.replace(/^[⌂✧▧]\s*/, '').trim());
     assert.deepEqual(metrics.menuOrder.slice(0,3),
      ['Accueil','Célébrations','Médiathèque générale']);
     await page.screenshot({path:join(OUT, cfg.name+'-menu.png'),animations:'disabled'});
     await page.keyboard.press('Escape');
    }
    if(name==='celebrations'&&metrics.choiceColumns)
     assert.equal(metrics.choiceColumns,cfg.mobile?2:4,
      'Grille de célébrations : 4 colonnes ordinateur, 2 téléphone');
    await page.screenshot({
     path:join(OUT,cfg.name+'-'+name+'.png'),animations:'disabled',
     fullPage:false
    });
    report.screens.push({size:cfg.name,name,path,status:'PASS',...metrics,
     jsErrors:errors,screenshot:cfg.name+'-'+name+'.png'});
    console.log('M02_PUBLIC_SNAPSHOT_PASS '+cfg.name+' '+name+' '+JSON.stringify({
     route:metrics.route,cols:metrics.choiceColumns,images:metrics.images,
     stageTabs:metrics.stageTabs.length,textChars:metrics.mainTextChars}));
   }catch(err){
    report.failures.push({screen:cfg.name,page:name,message:String(err.message||err).slice(0,800)});
    report.screens.push({size:cfg.name,name,path,status:'ECHEC',jsErrors:errors});
    console.error('M02_PUBLIC_SNAPSHOT_FAIL '+cfg.name+' '+name+' '+String(err.message||err));
   }finally{
    await page.close();
   }
  }
  // Administrator login is observed without ever entering a password.
  const login=await ctx.newPage();
  await login.route('**/*',route=>{
   if(!['GET','HEAD'].includes(route.request().method()))return route.abort('blockedbyclient');
   return route.continue();
  });
  try{
   const resp=await login.goto(ORIGIN+'/admin.html',{waitUntil:'domcontentloaded',timeout:35000});
   const form=login.locator('form[action="/api/editor-access"]');
   await form.waitFor({state:'attached',timeout:15000});
   assert.equal(resp?.status(),200);
   assert.equal(await login.locator('#workspace').count(),0,
    'Sans code, le contenu d’administration est caché');
   await login.screenshot({path:join(OUT,cfg.name+'-acces-admin.png'),animations:'disabled'});
   report.screens.push({size:cfg.name,name:'acces-admin',
    path:'/admin.html',status:'PASS',authRequired:true,
    screenshot:cfg.name+'-acces-admin.png'});
   console.log('M02_ADMIN_ACCESS_READONLY_PASS '+cfg.name);
  }catch(err){
   report.failures.push({screen:cfg.name,page:'acces-admin',message:String(err.message||err).slice(0,800)});
   report.screens.push({size:cfg.name,name:'acces-admin',status:'ECHEC'});
  }finally{await login.close();}
  await ctx.close();
 }
}finally{await browser.close();}
await writeFile(join(OUT,'reference-public.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log('M02_PUBLIC_REFERENCE_RESULT '+JSON.stringify({
 screens:report.screens.length,ok:report.screens.filter(s=>s.status==='PASS').length,
 failures:report.failures.length,mutationsIntercepted:report.mutationsIntercepted,
 artifactsDirectory:OUT
}));
if(report.failures.length)process.exitCode=1;
