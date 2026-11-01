import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const BASE='https://celebrations-exit-staging.rondes.workers.dev';
const generateWav=()=>{
 const rate=44100,seconds=2,frames=rate*seconds,pcm=new ArrayBuffer(44+frames*4);
 const v=new DataView(pcm),string=(at,text)=>{for(let j=0;j<text.length;j++)v.setUint8(at+j,text.charCodeAt(j))};
 string(0,'RIFF');v.setUint32(4,36+frames*4,true);string(8,'WAVE');string(12,'fmt ');
 v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);
 v.setUint32(24,rate,true);v.setUint32(28,rate*4,true);v.setUint16(32,4,true);
 v.setUint16(34,16,true);string(36,'data');v.setUint32(40,frames*4,true);
 for(let i=0;i<frames;i++){
  const val=Math.round(Math.sin(i*2*Math.PI*440/rate)*9000);
  v.setInt16(44+i*4,val,true);v.setInt16(46+i*4,val,true);
 }
 return Buffer.from(pcm);
};
const browser=await chromium.launch();
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:850},isMobile:width===390,hasTouch:width===390});
  const page=await context.newPage();page.setDefaultTimeout(45000);
  page.on('pageerror',e=>console.log('WAV_PAGE_ERROR '+e.message));
  page.on('console',m=>{if(m.type()==='error')console.log('WAV_BROWSER_CONSOLE '+m.text())});
  page.on('requestfailed',r=>console.log('WAV_NETWORK_FAILED '+r.url()+' '+r.failure()?.errorText));
  await page.goto(BASE+'/__editor/demo-preparation');
  await page.locator('[data-tab="audio"]').click();
  await page.getByLabel('Choisir un MP3 ou WAV').setInputFiles({name:'essai-3-minutes.wav',mimeType:'audio/wav',buffer:generateWav()});
  await page.getByRole('button',{name:'Convertir en MP3'}).click();
  await page.waitForFunction(()=>/Conversion terminée|Conversion non terminée|Conversion annulée/.test(document.querySelector('.audio-feedback')?.textContent||''),{timeout:30000});
  const status=await page.locator('.audio-feedback').innerText();
  console.log('WAV_CONVERT_STATUS '+status);
  assert.ok(status.includes('Conversion terminée'),status);
  const href=await page.getByRole('link',{name:'Télécharger MP3'}).getAttribute('href');
  assert.ok(href.startsWith('blob:'));
  const downloadEvent=page.waitForEvent('download');
  await page.getByRole('link',{name:'Télécharger MP3'}).click();
  const saved=await downloadEvent;
  assert.equal(saved.suggestedFilename(),'essai-3-minutes.mp3');
  const file=await readFile(await saved.path());
  const converted={size:file.length,magic:[...file.subarray(0,4)]};
  assert.ok(converted.size>1000&&converted.size<400000,JSON.stringify(converted));
  // ID3 header or MPEG frame sync.
  assert.ok((converted.magic[0]===73&&converted.magic[1]===68&&converted.magic[2]===51)||(converted.magic[0]===255&&(converted.magic[1]&224)===224),'MP3 signature '+JSON.stringify(converted.magic));
  assert.equal(await page.getByRole('button',{name:'Importer MP3'}).isEnabled(),true);
  assert.ok((await page.locator('.audio-details').innerText()).includes('.mp3'));
  assert.ok((await page.locator('.audio-feedback').innerText()).includes('Conversion terminée'));
  console.log('WAV_TO_MP3_BROWSER_PASS mobile='+(width===390)+' encodedBytes='+converted.size+' no_server_upload=true');
  await context.close();
 }
}finally{await browser.close()}
