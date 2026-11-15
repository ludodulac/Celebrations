// M041 — verification of deployed public media, read only. No administrator changes.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const ORIGIN='https://ronde-des-archanges-universelle.eu';
const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 for(const profile of [{name:'ordinateur',viewport:{width:1280,height:800},isMobile:false,hasTouch:false},
  {name:'Android simulé',viewport:{width:390,height:844},isMobile:true,hasTouch:true}]){
  const ctx=await browser.newContext({...profile,serviceWorkers:'block'});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(ORIGIN+'/?celebration=101&page=mediatheque',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('.media-tabs .media-tab').filter({hasText:/Audios/i}).first().click();
  const cards=page.locator('#stage-main .media-card:has(audio.media-player)');
  assert.equal(await cards.count(),38,'All 38 MP3 remain available');
  const headings=await page.locator('#stage-main .audio-group-heading').allInnerTexts();
  for(const group of ['Invocations','Chants','Méditations','Enseignements','Guidances'])
   assert.ok(headings.includes(group),'Missing category: '+group+' / '+JSON.stringify(headings));
  const dayNames=await page.locator('.audio-date-heading').allInnerTexts();
  assert.ok(dayNames.some(s=>s.includes('17 septembre 2026')),'Invocation date headings absent');
  const first=cards.first();await first.locator('.media-item-link').click();
  const player=first.locator('audio.media-player');
  assert.ok(await first.locator('.media-seek-always').isVisible(),'Gallery +/-10 controls not visible');
  const buttons=first.locator('.media-seek-always button');
  assert.equal(await buttons.count(),2);
  assert.equal(await buttons.nth(0).getAttribute('aria-label'),'Reculer de 10 secondes');
  assert.equal(await buttons.nth(1).getAttribute('aria-label'),'Avancer de 10 secondes');
  await player.evaluate(a=>new Promise((resolve,reject)=>{
    if(a.readyState>=1)return resolve();
    a.addEventListener('loadedmetadata',resolve,{once:true});a.addEventListener('error',()=>reject(Error('Audio error')),{once:true});
    setTimeout(()=>reject(Error('Audio metadata timeout')),15000);
  }));
  await player.evaluate(a=>{a.pause();a.currentTime=20});
  await page.waitForTimeout(150);
  await buttons.nth(0).click();
  let back=await player.evaluate(a=>a.currentTime);
  assert.ok(back>=7&&back<=14,'Back 10 sec changed to '+back);
  await buttons.nth(1).click();
  let front=await player.evaluate(a=>a.currentTime);
  assert.ok(front>=17&&front<=26,'Forward 10 sec changed to '+front);
  await page.locator('.media-filter').filter({hasText:/Invocations/i}).first().click();
  assert.equal(await page.locator('#stage-main .media-card:has(audio.media-player)').count(),9);
  await page.locator('.media-filter').filter({hasText:/Tous/i}).first().click();
  assert.equal(await cards.count(),38);
  await page.goto(ORIGIN+'/?celebration=101&page=dimanche',{waitUntil:'domcontentloaded',timeout:45000});
  await page.locator('#stage-main').waitFor();
  const embedded=page.locator('#stage-main audio.trial-audio-player');
  const total=await embedded.count();
  if(total){
    const firstOnPage=embedded.first();
    const parent=firstOnPage.locator('xpath=..');
    assert.ok(await parent.locator('.media-seek-always').isVisible(),'Day-page +/-10 controls are absent');
    assert.equal(await parent.locator('.media-seek-always button').count(),2);
    console.log('M041_EMBEDDED_SEEK_PASS '+profile.name+' '+total+' embedded audio players');
  }else console.log('M041_EMBEDDED_SEEK_NO_NATIVE_AUDIO '+profile.name+' (old event media render via links)');
  assert.deepEqual(errors,[]);
  await ctx.close();
  console.log('M041_VISITOR_AUDIO_PASS '+profile.name+' 38 MP3, categories/date, +/-10 and filtering');
 }
}finally{await browser.close()}
