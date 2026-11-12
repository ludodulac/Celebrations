// M025: REAL Cloudflare R2 multipart >50 Mo proof, confined to isolated M016.
// Logs in with the PREPROD secret; does not know/use the official PIN.
// Creates a disposable 55 Mo upload, verifies playback range, then deletes it.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const HOST='https://celebrations-m016-admin-preprod.rondes.workers.dev';
const BYTES=55_000_001,CHUNK=10_000_000;
assert.equal(process.env.M025_M016_ONLY,'YES');
assert.ok((process.env.M017_ADMIN_PASSWORD||'').length>=16);
const browser=await chromium.launch({headless:true});
let context,uploaded=null,session=null,parts=[];
try{
 context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 const login=await page.goto(HOST+'/admin',{waitUntil:'domcontentloaded'});
 assert.equal(login.status(),200);
 await page.locator('input[name="code"]').fill(process.env.M017_ADMIN_PASSWORD);
 await Promise.all([page.waitForURL(u=>u.pathname==='/admin.html',{timeout:30000}),
  page.locator('button[type="submit"]').click()]);
 await page.goto(HOST+'/__editor/demo-preparation?celebration=90000002',{waitUntil:'domcontentloaded'});
 await page.locator('[data-tab="media"]').click();
 await page.locator('[data-file-category="audios"]').click();
 await page.getByText(/200 Mo sans compression/).waitFor({timeout:12000});
 const prefix=HOST+'/api/editor-media?action=';
 async function api(action,body,headers){
  const binary=action==='mpu-part';
  const response=await context.request.post(prefix+action,{
   data:binary?body:JSON.stringify(body),
   headers:{origin:HOST,'content-type':binary?'application/octet-stream':'application/json',...headers},
   timeout:60_000,failOnStatusCode:false
  });
  const result=await response.json().catch(()=>({}));
  assert.equal(response.status(),200,action+': '+JSON.stringify(result));
  assert.equal(result.ok,true,action);
  return result;
 }
 session=await api('mpu-start',{name:'M025-test-55mo.mp3',size:BYTES,mime:'audio/mpeg'});
 assert.equal(session.parts,6);
 // Simulate a dropped mobile upload after the first R2 part.
 const initial=await api('mpu-part',Buffer.alloc(CHUNK,0x49),{
  'x-mp3-upload-id':session.id,
  'x-mp3-r2-upload-id':session.uploadId,
  'x-mp3-part-number':'1'
 });
 parts.push({partNumber:1,etag:initial.etag});
 const resumed=await api('mpu-status',{id:session.id,uploadId:session.uploadId});
 assert.equal(resumed.completed,false);
 assert.equal(resumed.id,session.id);
 for(let number=2;number<=session.parts;number++){
  const expected=Math.min(CHUNK,BYTES-(number-1)*CHUNK);
  const r=await api('mpu-part',Buffer.alloc(expected,0x49),{
   'x-mp3-upload-id':session.id,
   'x-mp3-r2-upload-id':session.uploadId,
   'x-mp3-part-number':String(number)
  });
  assert.match(r.etag,/^[a-f0-9]{32}$/i);
  parts.push({partNumber:number,etag:r.etag});
 }
 const result=await api('mpu-complete',{
  id:session.id,uploadId:session.uploadId,parts
 });
 assert.equal(result.completed,true);
 uploaded=result.item;
 assert.equal(uploaded.type,'audio');
 assert.equal(uploaded.name,'M025-test-55mo.mp3');
 assert.equal(uploaded.src,'/media/new/'+session.id+'.mp3');
 const completeAgain=await api('mpu-status',{id:session.id,uploadId:session.uploadId});
 assert.equal(completeAgain.completed,true);
 const sample=await context.request.get(HOST+uploaded.src,{
  headers:{range:'bytes=0-15'},failOnStatusCode:false
 });
 assert.equal(sample.status(),206,'The existing media gateway must support R2 byte ranges');
 const bytes=await sample.body();
 assert.equal(bytes.length,16);
 assert.ok([...bytes].every(x=>x===0x49),'Original bytes must not be compressed or transcoded');
 console.log('M025_M016_55MO_R2_MULTIPART_VERIFIED '+JSON.stringify({
  size:BYTES,parts:session.parts,pausedAndResumed:true,
  mediaAccessible:true,rangeWorks:true,originalBytesPreserved:true,
  cloudflareR2:true,officialDomainUntouched:true
 }));
}finally{
 if(context){
  const cleanupRequest=async(action,payload)=>{
   const response=await context.request.post(HOST+'/api/editor-media?action='+action,{
    data:JSON.stringify(payload),
    headers:{origin:HOST,'content-type':'application/json'},
    failOnStatusCode:false
   });
   return {status:response.status(),result:await response.json().catch(()=>({}))};
  };
  if(uploaded){
   const removed=await cleanupRequest('delete',{id:uploaded.id});
   assert.equal(removed.status,200,'Disposable 55 Mo file must be deleted from staging');
   console.log('M025_M016_55MO_CLEANUP_PASS');
  }else if(session){
   const aborted=await cleanupRequest('mpu-abort',{id:session.id,uploadId:session.uploadId});
   console.log('M025_M016_ABORT_INCOMPLETE '+aborted.status);
  }
  await context.close();
 }
 await browser.close();
}
