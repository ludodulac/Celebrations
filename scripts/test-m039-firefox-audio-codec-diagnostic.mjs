// M039 — diagnostic différentiel: MP3 connu sain vs deux MP3 officiels sur Firefox.
import {chromium,firefox} from 'playwright';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const ORIGIN='https://ronde-des-archanges-universelle.eu';
execFileSync('ffmpeg',['-nostdin','-loglevel','error','-f','lavfi','-i','sine=frequency=440:duration=4','-ar','44100','-ac','1','-c:a','libmp3lame','-b:a','128k','-y','/tmp/m039-known-good.mp3']);
const known=readFileSync('/tmp/m039-known-good.mp3');
console.log('MP3_CALIBRATION_CREATED '+known.length+' bytes, '+execFileSync('ffmpeg',['-version'],{encoding:'utf8'}).split('\n')[0]);
const references=[
 {name:'known-good synthetic MP3',url:ORIGIN+'/m039-known-good.mp3'},
 {name:'Allume ta bougie',url:ORIGIN+'/media/media/1789374573022/file-1789374573727-33.-Allume-ta-bougie.mp3'},
 {name:'Conférence Les 7 flammes',url:ORIGIN+'/media/media/1789374359623/file-1789374361142-26.-2008-09-18-les-7-flammes-de-larchange-michael.mp3'}
];
for(const [name,engine] of [['Chromium',chromium],['Firefox',firefox]]){
 const browser=await engine.launch({headless:true});
 try {
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('console',x=>{if(x.type()==='error')console.log(name+' CONSOLE '+x.text().slice(0,400))});
  page.on('response',r=>{if(r.url().includes('m039-known-good')||r.url().includes('Allume-ta-bougie')||r.url().includes('les-7-flammes'))console.log(name+' HTTP '+r.status()+' '+r.url().slice(-85)+' content-type='+r.headers()['content-type']+' range='+r.headers()['content-range'])});
  await page.route(ORIGIN+'/m039-known-good.mp3',route=>route.fulfill({status:200,contentType:'audio/mpeg',headers:{'accept-ranges':'bytes','cache-control':'no-store'},body:known}));
  await page.goto(ORIGIN+'/?celebration=101&page=mediatheque',{waitUntil:'domcontentloaded'});
  const probe=await page.evaluate(()=>({ua:navigator.userAgent,mp3:document.createElement('audio').canPlayType('audio/mpeg'),ogg:document.createElement('audio').canPlayType('audio/ogg; codecs=vorbis'),wav:document.createElement('audio').canPlayType('audio/wav')}));
  console.log(name+' CAN_PLAY '+JSON.stringify(probe));
  for(const item of references){
   let result=await page.evaluate(async url=>{
    const a=document.createElement('audio');a.src=url;a.controls=true;document.body.append(a);const events=[];
    for(const ev of ['error','loadstart','loadedmetadata','canplay','playing','waiting','stalled','suspend','progress','timeupdate','ended'])a.addEventListener(ev,()=>events.push([ev,Math.round(a.currentTime*100)/100,a.error?.code||0]));
    let resolved=false,playError=null;
    try{await Promise.race([a.play(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('play promise timeout')),8000))]);resolved=true}catch(e){playError=String(e)}
    const start=Date.now();
    while(Date.now()-start<3500&&!a.error&&a.currentTime<1)await new Promise(r=>setTimeout(r,100));
    const value={playResolved:resolved,playError,t:a.currentTime,duration:a.duration,error:a.error?.code||null,errorMessage:a.error?.message||null,ready:a.readyState,network:a.networkState,events};
    a.pause();a.remove();return value;
   },item.url);
   console.log(name+' CHECK '+item.name+' '+JSON.stringify(result));
  }
  await context.close();
 }finally{await browser.close()}
}
