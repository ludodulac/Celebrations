// M018: non-mutating checks against the REAL owner domain only. Never
// fabricate an administrator credential, create a celebration, or publish data.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const host='ronde-des-archanges-universelle.eu';
const root='https://'+host;
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1365,height:900}});
 const home=await page.goto(root+'/',{waitUntil:'domcontentloaded',timeout:35000});
 assert.equal(home?.status(),200,'Actual visitor homepage must load');
 const adminLink=page.locator('a[href$="/admin"],a[href$="/admin.html"],a[href*="/admin?"]').first();
 const linkCount=await adminLink.count();
 assert.ok(linkCount,'The actual public site must offer an Administration link');
 await adminLink.click();
 await page.waitForURL(url=>['/admin','/admin.html'].includes(url.pathname),{timeout:18000});
 assert.equal(new URL(page.url()).hostname,host,'Must stay on actual official domain');
 assert.ok(await page.locator('form[action="/api/editor-access"] input[name="code"]').count(),
  'Existing simple-code admin login must remain');
 const deniedDraft=await fetch(root+'/api/editor-open-draft?celebration=101',{
  signal:AbortSignal.timeout(18000)});
 assert.equal(deniedDraft.status,401,'Anonymous user cannot inspect editor drafts');
 const deniedMember=await fetch(root+'/api/admin/member-directory?action=snapshot',{
  signal:AbortSignal.timeout(18000)});
 assert.equal(deniedMember.status,401,'Anonymous user cannot inspect member directory');
 const deniedPin=await fetch(root+'/api/admin/editor-session',{
  method:'POST',headers:{'content-type':'application/json',origin:root,
   'x-celebrations-editor-bridge':'1'},
  body:JSON.stringify({action:'editor-pin-session'}),signal:AbortSignal.timeout(18000)});
 assert.equal(deniedPin.status,401,'No editor cookie means no D1 session');
 const invalidMedia=await fetch(root+'/media/new/not-a-real-upload-id',{
  signal:AbortSignal.timeout(18000)});
 assert.equal(invalidMedia.status,404,'No private media access via guessed URL');
 const www=await fetch('https://www.'+host+'/admin',{redirect:'follow',
  signal:AbortSignal.timeout(18000)});
 assert.equal(www.status,200,'Official www domain must stay accessible');
 assert.ok((await www.text()).includes('name="code"'),
  'Simple-code gate must also remain available from www');
 console.log('M018_REAL_OFFICIAL_SMOKE_OK '+JSON.stringify({
  domain:host,visitor:200,admin_link:true,
  simple_code_login:true,draft_denied:401,member_denied:401,pin_bridge_denied:401,
  private_media_denied:404,www_admin:200,production_writes:0
 }));
}finally{await browser.close()}
