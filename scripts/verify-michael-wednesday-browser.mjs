import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const origin='https://ronde-des-archanges-universelle.eu';
const browser=await chromium.launch({args:['--no-sandbox']});
try{
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:850},
   isMobile:width===390,hasTouch:width===390,serviceWorkers:'block'});
  const page=await context.newPage();
  page.setDefaultTimeout(22000);
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const response=await page.goto(origin+'/__editor/voir-le-site?celebration=101&page=mercredi',
   {waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(response.status(),200,'Visitor Wednesday route must return HTTP 200');
  await page.locator('.trial-content-section').first().waitFor();
  await page.waitForFunction(
    ()=>document.querySelectorAll('.trial-content-section').length===21,
    null,{timeout:22000});
  const result=await page.evaluate(()=>{
   const cards=[...document.querySelectorAll('.trial-content-section')];
   const res=cards.filter(n=>n.dataset.presentation==='resource');
   const audio=[...document.querySelectorAll('.trial-audio-player')];
   const images=[...document.querySelectorAll('.trial-figure img')];
   const videos=[...document.querySelectorAll('.trial-video-trigger')];
   const conference=cards.find(s=>s.querySelector('.trial-heading')?.textContent?.includes('19:30'));
   const confButtons=conference?[...conference.querySelectorAll('a.trial-button')].map(x=>x.textContent):[];
   const first=res[0],grid=first.querySelector('.trial-content-columns');
   return {
    sections:cards.length,
    resource:res.length,
    documentRows:document.querySelectorAll('.trial-document-item').length,
    audios:audio.length,
    images:images.length,
    videoPlayers:videos.length,
    columns:getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
    imageWidth:res[0].querySelector('img')?.getBoundingClientRect().width||0,
    alternativeConferenceLinks:confButtons,
    horizontalOverflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,
    firstResourceAlign:getComputedStyle(first.querySelector('.trial-content-column:last-child')).alignSelf
   };
  });
  assert.equal(result.sections,21,'No extra/missing sections');
  assert.equal(result.resource,10);
  assert.equal(result.documentRows,1);
  assert.equal(result.audios,4,'All MP3 controls should remain');
  assert.equal(result.images,10,'All ten original illustrations should remain');
  assert.equal(result.videoPlayers,3,'Three embedded YouTube thumbnails should remain');
  assert.equal(result.columns,width===1280?2:1);
  assert.ok(result.imageWidth>0&&result.imageWidth<=205,'Illustrations must stay compact');
  assert.equal(result.horizontalOverflow,false,'No horizontal overflow on phone');
  assert.equal(result.alternativeConferenceLinks.length,2,'Both alternative SoundCloud links must remain');
  assert.equal(result.firstResourceAlign,width===1280?'center':'start',
   'Vertical centering works on desktop and resets on phone');
  assert.deepEqual(errors,[],'No JavaScript error');
  console.log('MICHAEL_WEDNESDAY_BROWSER_PASS '+JSON.stringify({width,...result}));
  await context.close();
 }
}finally{await browser.close()}
