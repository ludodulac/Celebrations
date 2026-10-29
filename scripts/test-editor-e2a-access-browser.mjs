// E2A-ACCESS: Chromium on a wholly fictitious in-memory login and editor.
// No Cloudflare connection, no real login secrets, no historical content writes.
import assert from 'node:assert/strict';
import http from 'node:http';
import {chromium} from 'playwright';
import {handleEditorRecovery} from '../migration/cloudflare/editor-e2a-access-recovery.mjs';
import {handleEditorD4Access} from '../migration/cloudflare/editor-d4-access.mjs';

const HOST='https://celebrations-exit-staging.rondes.workers.dev';
let exchange=0,logins=0;
const reply=(res,body,status=200,headers={})=>{res.writeHead(status,headers);res.end(body)};
const sendResponse=async(res,response)=>{
 res.writeHead(response.status,Object.fromEntries(response.headers));
 res.end(await response.text());
};
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/__editor/edit'){
  const key=url.searchParams.get('key')||'home';
  const approved=['home','celebration:101:step:Mercredi'].includes(key);
  if(!approved)return reply(res,'Unknown editor',404);
  if((req.headers.cookie||'').includes('preview=1')){
   return reply(res,'<!doctype html><html><body><h1 id="editor-ready">Éditeur fictif : '+key+'</h1></body></html>',200,{'content-type':'text/html'});
  }
  return sendResponse(res,handleEditorRecovery(new Request(HOST+'/__editor/edit?key='+encodeURIComponent(key)),key));
 }
 if(url.pathname==='/__editor/access'){
  return sendResponse(res,await handleEditorD4Access(new Request(HOST+'/__editor/access'+url.search)));
 }
 if(url.pathname==='/__editor/session'){
  exchange++;
  const auth=req.headers.authorization;
  if(auth==='Bearer fictive-active'||auth==='Bearer fictive-after-login'){
   return reply(res,'OK',200,{'set-cookie':'preview=1; Path=/__editor; SameSite=Strict; HttpOnly','content-type':'text/plain'});
  }
  return reply(res,'Unauthorized',401);
 }
 if(url.pathname==='/__editor/access/session'){
  let raw='';for await(const part of req)raw+=part;
  const code=JSON.parse(raw).code;
  if(code==='code-fictif-e2a'){logins++;return reply(res,JSON.stringify({ok:true,token:'fictive-after-login'}),200,{'content-type':'application/json'})}
  return reply(res,JSON.stringify({ok:false,error:'Code invalide'}),401,{'content-type':'application/json'});
 }
 return reply(res,'Not found',404);
});
server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
try{
 for(const device of [
  {name:'desktop',viewport:{width:1366,height:768}},
  {name:'phone',viewport:{width:390,height:844},isMobile:true}
 ]){
  const key=device.name==='phone'?'celebration:101:step:Mercredi':'home';
  const path='/__editor/edit?key='+encodeURIComponent(key);
  // Existing administrator session: auto-reestablish private preview cookie.
  let context=await browser.newContext({viewport:device.viewport,isMobile:device.isMobile});
  await context.addInitScript(()=>localStorage.setItem('celebrations-admin-token','fictive-active'));
  let page=await context.newPage();
  await page.goto(origin+path,{waitUntil:'domcontentloaded'});
  await page.locator('#editor-ready').waitFor({timeout:9000});
  assert.ok(page.url().includes(path),'Should return to exactly the requested editor');
  assert.equal(logins,0,'Automatic recovery must not need the personal code');
  const exchanged=exchange;
  assert.ok(exchanged>=1,'Missing preview session exchange');
  await context.close();

  // Expired administrator session: useful button, personal code, then return.
  context=await browser.newContext({viewport:device.viewport,isMobile:device.isMobile});
  await context.addInitScript(()=>localStorage.setItem('celebrations-admin-token','expired-fictive-token'));
  page=await context.newPage();
  const response=await page.goto(origin+path,{waitUntil:'domcontentloaded'});
  assert.equal(response.status(),401,'No draft should be returned without preview cookie');
  await page.locator('#reconnect:not([hidden])').waitFor({timeout:9000});
  assert.match(await page.locator('body').innerText(),/Se reconnecter/);
  await page.locator('#reconnect').click();
  await page.waitForURL(/\/__editor\/access\?return=/);
  assert.equal(new URL(page.url()).searchParams.get('return'),key);
  await page.locator('input#code').fill('code-fictif-e2a');
  await page.locator('button#connect').click();
  await page.locator('#editor-ready').waitFor({timeout:9000});
  assert.equal(new URL(page.url()).searchParams.get('key'),key);
  assert.ok(logins>=1,'Personal login not used when admin session expired');
  console.log('MISSION_E2A_ACCESS_CHROMIUM_PASS device='+device.name+' auto_recovery=true reconnect=true return_to_editor=true');
  await context.close();
 }
 // No local token: the prompt remains usable without unauthorized page content.
 const context=await browser.newContext();
 const page=await context.newPage();
 await page.goto(origin+'/__editor/edit?key=home',{waitUntil:'domcontentloaded'});
 await page.locator('#reconnect:not([hidden])').waitFor({timeout:9000});
 assert.equal(await page.locator('#editor-ready').count(),0);
 // Untrusted return URLs cannot change the allowed return target.
 await page.goto(origin+'/__editor/access?return=https%3A%2F%2Fevil.example',{waitUntil:'domcontentloaded'});
 await page.locator('input#code').fill('code-fictif-e2a');
 await page.locator('button#connect').click();
 await page.locator('#links:not([hidden])').waitFor({timeout:9000});
 assert.match(page.url(),/\/__editor\/access\?/);
 await context.close();
 console.log('MISSION_E2A_ACCESS_SECURITY_PASS missing_token_reconnect=true arbitrary_return_blocked=true fake_data_only=true');
}finally{await browser.close();await new Promise(r=>server.close(r))}
