// M039 — Production read-only E2E: real Michaël media-gallery links and controls.
// All downloads are GET/HEAD. No member sign-in, no administration, no writes.
import { chromium, firefox, webkit } from 'playwright';
import {appendFileSync} from 'node:fs';

const ORIGIN='https://ronde-des-archanges-universelle.eu';
const PROFILES=[
  {name:'Chrome ordinateur',engine:chromium,mobile:false,all:true},
  {name:'Chrome Android simulé',engine:chromium,mobile:true,all:true},
  {name:'Firefox ordinateur',engine:firefox,mobile:false,all:false},
  {name:'Safari ordinateur (WebKit)',engine:webkit,mobile:false,all:false},
  {name:'Safari iPhone simulé (WebKit)',engine:webkit,mobile:true,all:false}
];
const out=[],failures=[];
const log=(status,where,what)=>{const line=status+' | '+where+' | '+what;console.log(line);out.push(line);if(status==='FAIL')failures.push(line);};
const pause=(ms)=>new Promise(res=>setTimeout(res,ms));
const playing=async(audio,timeout=12000)=>{
  const initial=await audio.evaluate(a=>a.currentTime);
  try{
    await audio.evaluate(async a=>{
      if(a.paused)await a.play();
    });
  }catch(e){return {ok:false,error:'play() rejected: '+String(e).slice(0,220)}}
  const t=Date.now();
  while(Date.now()-t<timeout){
    const state=await audio.evaluate(a=>({t:a.currentTime,d:a.duration,paused:a.paused,
      error:a.error?.code||0,ready:a.readyState,network:a.networkState}));
    if(state.error)return {ok:false,error:'media error '+JSON.stringify(state)};
    if(!state.paused&&state.t>initial+.3)return {ok:true,state};
    await pause(180);
  }
  return {ok:false,error:'Timeout '+JSON.stringify(await audio.evaluate(a=>({t:a.currentTime,paused:a.paused,ready:a.readyState,error:a.error?.code||null})))};
};
const samples=new Set([0,1,5,11,22,30,37]);
for(const profile of PROFILES){
 let browser;
 try{
  browser=await profile.engine.launch({headless:true});
  const context=await browser.newContext({
    viewport:profile.mobile?{width:390,height:844}:{width:1360,height:850},
    hasTouch:profile.mobile,isMobile:profile.mobile,
    serviceWorkers:'block',
    ...(profile.name.includes('Android')?{userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'}:{}),
    ...(profile.name.includes('iPhone')?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'}:{})
  });
  const page=await context.newPage(),pageErrors=[],failedMedia=[];
  page.on('pageerror',e=>pageErrors.push(String(e.message||e)));
  page.on('response',r=>{
    if(r.url().startsWith(ORIGIN+'/media/')&&r.status()>=400)failedMedia.push(r.status()+' '+r.url().slice(-110))
  });
  const url=ORIGIN+'/?celebration=101&page=mediatheque';
  const rsp=await page.goto(url,{waitUntil:'domcontentloaded',timeout:40000});
  if(!rsp||rsp.status()!==200)throw new Error('Public gallery HTTP '+rsp?.status());
  await page.locator('.media-tabs .media-tab').first().waitFor({timeout:25000});
  log('PASS',profile.name,'Page médiathèque ouverte (HTTP 200) et onglets visibles');
  const audiosTab=page.locator('.media-tabs .media-tab').filter({hasText:/Audios|Audio/i}).first();
  if(!await audiosTab.count())throw new Error('No audio tab; found '+JSON.stringify(await page.locator('.media-tab').allInnerTexts()));
  await audiosTab.click();
  await page.locator('.media-filters').waitFor({timeout:10000});
  const cards=page.locator('#stage-main .media-card:has(audio.media-player)');
  const count=await cards.count();
  const names=await cards.locator('a.media-item-link').allInnerTexts();
  const seed=await page.evaluate(()=>({library:window.__TRIAL_SITE_SEED__?.library?.length,
    pages:window.__TRIAL_SITE_SEED__?.pages?.length,visible:window.__PUBLIC_CELEBRATION_VISIBLE__,
    publicMedia:window.__PUBLIC_MEDIA__?.length}));
  log(count===38?'PASS':'FAIL',profile.name,'Médiathèque: '+count+' lecteurs audio visibles, 38 attendus; seed='+JSON.stringify(seed));
  if(count===0)throw new Error('Aucun lecteur audio rendu. Extrait '+(await page.locator('#stage-main').innerText()).slice(0,400));
  const badLink=await cards.evaluateAll(nodes=>nodes.map((n,i)=>{
    const a=n.querySelector('a.media-item-link'),audio=n.querySelector('audio.media-player'),direct=n.querySelector('a.media-audio-direct');
    return {i,missing:!a?.href||!audio||audio.src!==a?.href||direct?.href!==a?.href||direct?.target!=='_blank'||!n.querySelector('.media-audio-error')};
  }).filter(x=>x.missing));
  if(badLink.length)log('FAIL',profile.name,'Liens lecteur/direct incohérents '+JSON.stringify(badLink));
  else log('PASS',profile.name,'Tous les liens lecteurs/directs correspondent à leur MP3');
  if(await page.locator('#stage-main .media-empty').count())log('FAIL',profile.name,'Un message Aucun contenu reste affiché malgré les MP3');
  const toTry=profile.all?[...Array(count).keys()]:[...samples].filter(i=>i<count);
  let passes=0;
  for(const index of toTry){
    const card=cards.nth(index);
    const title=(names[index]||'audio '+index).replaceAll(/\s+/g,' ').slice(0,90);
    try{
      const link=card.locator('a.media-item-link');
      await link.scrollIntoViewIfNeeded();
      await link.click({timeout:10000});
      const panel=card.locator('.media-inline-player');
      if(!await panel.isVisible())throw new Error('Player panel did not open');
      const player=panel.locator('audio.media-player');
      if(!await player.isVisible())throw new Error('Native audio element not visible');
      const outcome=await playing(player);
      if(!outcome.ok)throw new Error(outcome.error);
      if(index===0){
        const direct=panel.locator('a.media-audio-direct');
        if(!await direct.isVisible())throw new Error('Lien direct caché');
        const before=await player.evaluate(a=>({time:a.currentTime,duration:a.duration}));
        const buttons=panel.locator('button.media-small-button');
        if(await buttons.count()!==2)throw new Error('Boutons +10/-10 manquants');
        await buttons.nth(1).click();
        await pause(400);
        const afterPlus=await player.evaluate(a=>({time:a.currentTime,duration:a.duration}));
        if(afterPlus.time<before.time+8&&before.duration>15)throw new Error('+10 s ne fonctionne pas '+JSON.stringify({before,afterPlus}));
        await buttons.nth(0).click();
        await pause(400);
        const checkbox=panel.locator('input[type="checkbox"]');
        if(!await checkbox.count())throw new Error('Boucle manquante');
        await checkbox.check();
        if(!await player.evaluate(a=>a.loop))throw new Error('Boucle ne fonctionne pas');
        await checkbox.uncheck();
        log('PASS',profile.name,'Commandes +10/-10, boucle, lien MP3 direct');
      }
      passes++;
      // Stop audio before moving to another card; otherwise dozens play concurrently.
      await player.evaluate(a=>{a.pause();a.removeAttribute('src');a.load()}).catch(()=>{});
      await link.click({timeout:10000});
      if(await panel.isVisible())throw new Error('Le clic de fermeture ne replie pas le lecteur');
    }catch(e){log('FAIL',profile.name,'Lecture '+index+' '+title+' : '+String(e?.message||e).slice(0,360));
      await card.locator('audio').evaluate(a=>a.pause()).catch(()=>{});}
  }
  log(passes===toTry.length?'PASS':'FAIL',profile.name,passes+'/'+toTry.length+' lecteurs démarrent depuis le clic sur leur titre (navigateur '+profile.engine.name()+')');
  // Filter check must be real UI, not a direct GET of media file.
  const filters=page.locator('#stage-main .media-filters .media-filter');
  if(await filters.count()===3){
    await filters.nth(1).click();
    const chants=await cards.count();
    await filters.nth(2).click();
    const spoken=await cards.count();
    await filters.nth(0).click();
    const restored=await cards.count();
    if(chants>0&&spoken>0&&restored===count)log('PASS',profile.name,'Filtres Chants/Audios parlés/Tous '+JSON.stringify({chants,spoken,total:restored}));
    else log('FAIL',profile.name,'Filtres incohérents '+JSON.stringify({chants,spoken,restored,count}));
  }else log('FAIL',profile.name,'Filtres audio absents');
  // Navigation menu, category switching, refresh and back to media.
  const docTab=page.locator('.media-tab').filter({hasText:/Document/i}).first();
  if(await docTab.count()){
    await docTab.click();
    await audiosTab.click();
    if(await cards.count()===count)log('PASS',profile.name,'Navigation Documents → Audios conserve tous les fichiers');
    else log('FAIL',profile.name,'Navigation entre onglets fait disparaître les MP3');
  }
  await page.reload({waitUntil:'domcontentloaded',timeout:40000});
  await page.locator('.media-tab').first().waitFor({timeout:15000});
  await page.locator('.media-tab').filter({hasText:/Audios|Audio/i}).first().click();
  const reloadCount=await cards.count();
  log(reloadCount===count?'PASS':'FAIL',profile.name,'Rechargement complet : '+reloadCount+' MP3 affichés');
  const menu=page.locator('#menu-toggle');
  if(await menu.count()){
    await menu.click({timeout:10000});
    const stage=await page.locator('#stage-navigation').allInnerTexts();
    log('INFO',profile.name,'Menu célébration : '+stage.join(' / ').slice(0,300));
    await page.keyboard.press('Escape');
  }
  if(pageErrors.length)log('FAIL',profile.name,'Erreurs JavaScript '+pageErrors.slice(0,8).join(' ; '));
  else log('PASS',profile.name,'Aucune erreur JavaScript de page');
  if(failedMedia.length)log('FAIL',profile.name,'MP3 HTTP refusés '+failedMedia.slice(0,6).join(' ; '));
  else log('PASS',profile.name,'Aucun MP3 refusé par le serveur pendant la lecture');
  await context.close();
 }catch(e){log('FAIL',profile.name,'Test de profil interrompu : '+String(e?.stack||e).slice(0,500))}
 finally{if(browser)await browser.close().catch(()=>{})}
}
const pass=out.filter(x=>x.startsWith('PASS')).length;
const summary='M039_PRODUCTION_AUDIO_UI pass='+pass+' fail='+failures.length+' checks='+out.length;
console.log(summary);
if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,['## M039 — tests réels du lecteur sur Célébrations','',summary,'',...out.map(x=>'- '+x),''].join('\n'));
if(failures.length)process.exitCode=1;
