import assert from "node:assert/strict";
import {chromium} from "playwright";
// Real mobile Chromium admin form, exact synthetic identifier and guaranteed cleanup.
const origin="https://celebrations-exit-staging.rondes.workers.dev";
const token=process.env.STAGING_TEMP_ADMIN_BEARER||"",id=process.env.STAGING_SYNTHETIC_CONTENT_ID||"";
assert.match(token,/^[0-9a-f]{64}$/);
assert.match(id,/^migration-check-[0-9a-f-]{36}$/);
assert.equal(process.env.STAGING_R2_BUCKET,"celebrations-exit-staging");
const name=id+"-browser-pdf",body=Buffer.from("%PDF-1.4\n%%EOF\n");
const request=async(path,action,table,params={})=>{
 const r=await fetch(origin+path,{method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({action,...(table?{table}:{}),...params}),signal:AbortSignal.timeout(20000)});
 return {status:r.status,...await r.json()};
};
let key=null,contentId=null,browser=null;
try{
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:"block"});
 await ctx.addInitScript(t=>localStorage.setItem("celebrations-admin-token",t),token);
 const page=await ctx.newPage();
 const errors=[];
 page.on("pageerror",e=>errors.push(String(e.message)));
 page.on("request",r=>{if(r.url().includes("/api/media-admin?action=upload&key=")){
   key=new URL(r.url()).searchParams.get("key");
 }});
 await page.goto(origin+"/admin.html?staging=1",{waitUntil:"domcontentloaded",timeout:45000});
 await page.waitForFunction(()=>window.celebrationsCoreSyncStatus==="saved",{timeout:30000});
 await page.locator(".admin-nav [data-admin=media]").click();
 await page.locator("#mFile").setInputFiles({name:"verification-cf.pdf",mimeType:"application/pdf",buffer:body});
 await page.locator("#mTitle").fill(name);
 await page.locator("#mGroup").selectOption("angel");
 await page.locator("#saveMedia").click();
 const end=Date.now()+45000;
 while(Date.now()<end){
  const out=await request("/api/admin","list","celebrations_contents");
  if(out.status===200){
   const c=out.items?.find(c=>c.name===name);
   if(c?.storage_path){contentId=c.id;key=c.storage_path;break}
  }
  await new Promise(r=>setTimeout(r,1000));
 }
 assert.ok(contentId&&key,"Browser form did not persist a PDF plus R2 storage reference in D1");
 assert.deepEqual(errors,[],"Admin page JavaScript failed");
 const response=await fetch(origin+"/media/"+key,{headers:{authorization:"Bearer "+token},signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,200,"Admin cannot open uploaded R2 document");
 assert.deepEqual(Buffer.from(await response.arrayBuffer()),body);
 const denied=await fetch(origin+"/media/"+key,{signal:AbortSignal.timeout(20000)});
 assert.equal(denied.status,404,"Private document leaked publicly");
 console.log("STAGING_BROWSER_FILE_UPLOAD real_mobile_form=true pdf_saved_in_D1=true private_R2_preview=true anonymous_denied=true");
}finally{
 if(contentId){
  const d=await request("/api/safe-save","delete_content",null,{content_id:contentId});
  assert.equal(d.status,200,"Synthetic browser content cleanup failed");
 }
 if(key){
  const u=await fetch(origin+"/api/media-admin?action=delete&key="+encodeURIComponent(key),{method:"POST",headers:{authorization:"Bearer "+token},signal:AbortSignal.timeout(25000)});
  assert.equal(u.status,200,"Synthetic browser uploaded R2 byte cleanup failed");
 }
 if(browser)await browser.close();
 console.log("STAGING_BROWSER_FILE_CLEANUP content="+Boolean(contentId)+" uploaded="+Boolean(key));
}
