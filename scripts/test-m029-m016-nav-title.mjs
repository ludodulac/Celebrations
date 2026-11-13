// M029 isolated real browser test: ONLY preproduction M016, never official writes.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const HOST='https://celebrations-m016-admin-preprod.rondes.workers.dev';
assert.equal(process.env.M029_M016_ONLY,'YES');
assert.ok((process.env.M017_ADMIN_PASSWORD||'').length>=16);
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1280,height:850}});
const mobileCtx=await browser.newContext({viewport:{width:390,height:850},isMobile:true,hasTouch:true});
const page=await ctx.newPage();
let initial=null;
const errors=[],navRequests=[],navResponses=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('request',request=>{
 if(request.url().endsWith('/api/site-identity')&&request.method()==='POST'){
  const body=request.postDataJSON();
  navRequests.push({navigation:body.navigation,memberAccessUiEnabled:body.memberAccessUiEnabled});
 }
});
page.on('response',async response=>{
 if(response.url().endsWith('/api/site-identity')&&response.request().method()==='POST'){
  try{const body=await response.json();navResponses.push({status:response.status(),navigation:body.navigation,revision:body.revision})}
  catch{}
 }
});
const folder='docs/m029-screens';mkdirSync(folder,{recursive:true});
async function call(url,method='GET',data){
 const r=await ctx.request.fetch(HOST+url,{method,
  headers:method==='POST'?{origin:HOST,'content-type':'application/json'}:{},
  ...(data?{data:JSON.stringify(data)}:{}),failOnStatusCode:false,timeout:30000});
 const json=await r.json().catch(()=>({}));
 if(r.status()!==200||!json.ok)throw Error(url+' '+r.status()+' '+JSON.stringify(json));
 return json;
}
async function save(navigation){
 const current=await call('/api/site-identity');
 return call('/api/site-identity','POST',{expectedRevision:current.revision,navigation});
}
try{
 let r=await page.goto(HOST+'/admin',{waitUntil:'domcontentloaded'});
 assert.equal(r.status(),200);
 await page.locator('input[name="code"]').fill(process.env.M017_ADMIN_PASSWORD);
 await Promise.all([
  page.waitForURL(u=>u.pathname==='/admin.html',{timeout:30000}),
  page.locator('button[type="submit"]').click()
 ]);
 initial=(await call('/api/site-identity')).navigation;
 r=await page.goto(HOST+'/__editor/demo-preparation?celebration=90000002',{waitUntil:'domcontentloaded'});
 assert.equal(r.status(),200);
 await page.locator('[data-tab="settings"]').click();
 const input=page.getByRole('textbox',{name:'Titre dans la barre du menu'});
 await input.waitFor();
 await input.fill('Ronde des Archanges');
 await page.getByRole('combobox',{name:'Position du titre'}).selectOption('right');
 assert.equal(await input.inputValue(),'Ronde des Archanges','Form must contain the requested title before saving');
 await page.screenshot({path:folder+'/01-parametres-titre-ordinateur.png',fullPage:true});
 await page.getByRole('button',{name:'Enregistrer le titre'}).click();
 // The editor may rerender the Settings tab after its server hydration.
 // Confirm the real write by API rather than relying on a transient notice.
 // Browser receives the write response first; check the same value via an
 // independent GET, allowing safe R2 propagation across Cloudflare isolates.
 let actual=null;
 for(let attempt=0;attempt<12;attempt++){
  actual=await call('/api/site-identity');
  if(actual.navigation?.title==='Ronde des Archanges'&&
     actual.navigation?.position==='right')break;
  await page.waitForTimeout(550);
 }
 if(actual.navigation?.title!=='Ronde des Archanges'||actual.navigation?.position!=='right'){
  const feedback=await page.locator('.m027-navigation-settings [role="status"]').allTextContents();
  throw Error('M029 nav title not saved: '+JSON.stringify({navigation:actual.navigation,revision:actual.revision,
   feedback,navRequests,navResponses,
   formValue:await page.getByRole('textbox',{name:'Titre dans la barre du menu'}).inputValue(),
   url:page.url(),buttons:await page.getByRole('button',{name:'Enregistrer le titre'}).count(),
   errors}));
 }
 console.log('M029_M016_API_PERSISTENCE_PASS');
 // M016 has different test celebrations from the editor page selected above.
 // Find an actually published public celebration without adding any data.
 let preview=null;const attempts=[];
 for(const cid of ['101','102','103','104','105','106','90000001','90000002']){
  const url='/__editor/voir-le-site?celebration='+cid;
  const probe=await ctx.request.get(HOST+url,{failOnStatusCode:false});
  attempts.push({cid,status:probe.status()});
  if(probe.status()===200){preview=url;break}
 }
 if(!preview)throw Error('M016 has no readable visitor celebration: '+JSON.stringify(attempts));
 r=await page.goto(HOST+preview,{waitUntil:'domcontentloaded'});
 assert.equal(r.status(),200);
 const label=page.locator('.site-menu-bar .site-nav-title');
 assert.equal(await label.innerText(),'Ronde des Archanges');
 assert.equal(await label.getAttribute('data-align'),'right');
 assert.equal(await label.isVisible(),true);
 assert.equal(await page.locator('.site-menu-bar').count(),1);
 await page.screenshot({path:folder+'/02-titre-visible-menu-ordinateur.png',fullPage:true});
 // M016 is gated to approved testers. The independent mobile viewport
 // reuses the isolated test login; this is not a public-login or ACL bypass.
 // The official site still has its existing anonymous visitor rules.
 await mobileCtx.addCookies(await ctx.cookies(HOST));
 const mobile=await mobileCtx.newPage();
 r=await mobile.goto(HOST+preview,{waitUntil:'domcontentloaded'});
 assert.equal(r.status(),200);
 const hidden=mobile.locator('.site-menu-bar .site-nav-title');
 assert.equal(await hidden.count(),1);
 assert.equal(await hidden.isVisible(),false);
 await mobile.screenshot({path:folder+'/03-menu-smartphone-sans-titre.png',fullPage:true});
 assert.deepEqual(errors,[],'No browser script errors');
 console.log('M029_M016_BROWSER_PASS title_saved=true desktop_visible=true mobile_hidden=true existing_bar_only=true');
}finally{
 try{
  if(initial){
   const restored=await save(initial);
   assert.deepEqual(restored.navigation,initial);
   console.log('M029_M016_ORIGINAL_NAV_RESTORED');
  }
 }finally{
  await ctx.close();await mobileCtx.close();await browser.close();
 }
}
