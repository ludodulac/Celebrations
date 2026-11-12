// M026: reproduce the owner's failure through the REAL editor file picker.
// Isolated M016 only. Nothing sent to the production domain or media bucket.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdtemp,open,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const HOST='https://celebrations-m016-admin-preprod.rondes.workers.dev';
const BYTES=90_000_000,NAME='M026-verification-90mo.mp3';
assert.equal(process.env.M026_M016_ONLY,'YES');
assert.ok((process.env.M017_ADMIN_PASSWORD||'').length>=16);
const dir=await mkdtemp(join(tmpdir(),'m026-mp3-'));
const filepath=join(dir,NAME);
const file=await open(filepath,'w');
await file.truncate(BYTES);await file.close();
const browser=await chromium.launch({headless:true});
let context,uploaded=null;
try{
 context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[],activity={starts:0,parts:0,legacy:0};
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',req=>{
  if(req.method()!=='POST')return;
  const url=new URL(req.url());
  if(url.pathname!=='/api/editor-media')return;
  const action=url.searchParams.get('action');
  if(action==='mpu-start')activity.starts++;
  if(action==='mpu-part')activity.parts++;
  if(action==='upload')activity.legacy++;
 });
 const login=await page.goto(HOST+'/admin',{waitUntil:'domcontentloaded'});
 assert.equal(login.status(),200);
 await page.locator('input[name="code"]').fill(process.env.M017_ADMIN_PASSWORD);
 await Promise.all([
  page.waitForURL(url=>url.pathname==='/admin.html',{timeout:30000}),
  page.locator('button[type="submit"]').click()
 ]);
 await page.goto(HOST+'/__editor/demo-preparation?celebration=90000002',{waitUntil:'domcontentloaded'});
 await page.locator('[data-tab="media"]').click();
 await page.locator('[data-file-category="audios"]').click();
 await page.getByText(/200 Mo sans compression/).waitFor({timeout:15000});
 await page.locator('#asset-file-picker').setInputFiles(filepath);
 await page.locator('#media-upload-feedback').filter({hasText:'✓ MP3 importé : '+NAME})
  .waitFor({timeout:180000});
 assert.equal(activity.legacy,0,'The 90 Mo file must NEVER use the old 26 Mo HTTP request');
 assert.equal(activity.starts,1,'Exactly one R2 multipart session starts');
 assert.equal(activity.parts,9,'90 Mo => 9 chunks of 10 Mo, not a single oversized request');
 assert.deepEqual(errors,[],'No browser JavaScript errors');
 const response=await context.request.get(HOST+'/api/editor-media',{failOnStatusCode:false});
 assert.equal(response.status(),200);
 const body=await response.json();
 const found=(body.items||[]).filter(x=>x.name===NAME&&
  x.src?.startsWith('/media/new/')&&x.type==='audio');
 assert.equal(found.length,1,'The uploaded file must appear once in the real server media library');
 uploaded=found[0];
 const preview=await context.request.get(HOST+uploaded.src,{
  headers:{range:'bytes=0-15'},failOnStatusCode:false
 });
 assert.equal(preview.status(),206,'Existing public audio range gateway still works');
 assert.equal((await preview.body()).length,16);
 console.log('M026_REAL_BROWSER_90MO_MP3_SUCCESS '+JSON.stringify({
  size:BYTES,parts:activity.parts,legacyRequests:activity.legacy,
  visibleInLibrary:true,rangeWorks:true,preprodOnly:true
 }));
}finally{
 if(context){
  if(uploaded){
   const deleted=await context.request.post(HOST+'/api/editor-media?action=delete',{
    data:JSON.stringify({id:uploaded.id}),
    headers:{origin:HOST,'content-type':'application/json'},
    failOnStatusCode:false
   });
   const result=await deleted.json().catch(()=>({}));
   assert.equal(deleted.status(),200,'Disposable test MP3 must be cleaned up');
   assert.equal(result.ok,true,'Delete response should confirm cleanup');
   console.log('M026_M016_90MO_CLEANUP_PASS');
  }else if(context){
   // A failed browser upload can still leave a multipart in R2. Abort the
   // partially uploaded session using the browser's own resume metadata.
   const page=context.pages()[0];
   if(page){
    const sessions=await page.evaluate(()=>Object.keys(localStorage)
     .filter(k=>k.startsWith('celebrations-mp3-resume-v1:'))
     .map(k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}}).filter(Boolean))
     .catch(()=>[]);
    for(const session of sessions){
     if(session.id&&session.uploadId){
      await context.request.post(HOST+'/api/editor-media?action=mpu-abort',{
       data:JSON.stringify({id:session.id,uploadId:session.uploadId}),
       headers:{origin:HOST,'content-type':'application/json'},
       failOnStatusCode:false
      }).catch(()=>{});
     }
    }
   }
  }
  await context.close();
 }
 await browser.close();
 await rm(dir,{recursive:true,force:true});
}
