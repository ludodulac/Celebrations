// M027 — test the REAL editor and published site in isolated M016 only.
// Creates one disposable PDF, switches Public -> Private -> Public, and restores
// the navigation setting in finally. Never connects to official writes.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const HOST='https://celebrations-m016-admin-preprod.rondes.workers.dev';
assert.equal(process.env.M027_M016_ONLY,'YES');
assert.ok((process.env.M017_ADMIN_PASSWORD||'').length>=16);
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1280,height:850}});
const anon=await browser.newContext({viewport:{width:390,height:850}});
const page=await ctx.newPage();
let original=null,pdf=null;
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
async function call(path,method='GET',data=null){
 const response=await ctx.request.fetch(HOST+path,{
  method,headers:method==='POST'?{origin:HOST,'content-type':'application/json'}:{},
  ...(data?{data:JSON.stringify(data)}:{}),failOnStatusCode:false,timeout:30000
 });
 const body=await response.json().catch(()=>({}));
 if(response.status()!==200||body.ok!==true)
  throw Error(path+' HTTP '+response.status()+' '+JSON.stringify(body));
 return body;
}
async function saveNavigation(navigation){
 const pref=await call('/api/site-identity');
 return call('/api/site-identity','POST',{expectedRevision:pref.revision,navigation});
}
try{
 await page.goto(HOST+'/admin',{waitUntil:'domcontentloaded'});
 await page.locator('input[name="code"]').fill(process.env.M017_ADMIN_PASSWORD);
 await Promise.all([page.waitForURL(u=>u.pathname==='/admin.html',{timeout:30000}),
  page.locator('button[type="submit"]').click()]);
 original=(await call('/api/site-identity')).navigation;
 await page.goto(HOST+'/__editor/demo-preparation?celebration=90000002',{waitUntil:'domcontentloaded'});
 await page.locator('[data-tab="settings"]').click();
 const heading=page.getByRole('heading',{name:'Titre dans la barre du menu'});
 await heading.waitFor();
 await page.getByRole('textbox',{name:'Titre dans la barre du menu'}).fill('Ronde des Archanges Universelle');
 await page.getByRole('combobox',{name:'Position du titre'}).selectOption('right');
 await page.getByRole('button',{name:'Enregistrer le titre'}).click();
 await page.getByText('✓ Titre enregistré sur toutes les pages du site.').waitFor();
 await page.goto(HOST+'/__editor/voir-le-site?celebration=90000002',{waitUntil:'domcontentloaded'});
 const title=page.locator('.site-menu-bar .site-nav-title');
 assert.equal(await title.innerText(),'Ronde des Archanges Universelle');
 assert.equal(await title.getAttribute('data-align'),'right');
 assert.equal(await page.locator('.site-menu-bar').count(),1,'Not a second menu bar');
 assert.equal(await title.isVisible(),true);
 assert.ok((await title.boundingBox()).y<(await page.locator('.site-paper').boundingBox()).y);
 // A second navigation shows the SAME title, without a new header.
 await page.goto(HOST+'/__editor/voir-le-site?celebration=90000002&page=mercredi',{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('.site-menu-bar .site-nav-title').innerText(),
  'Ronde des Archanges Universelle');
 const mobile=await anon.newPage();
 await mobile.goto(HOST+'/__editor/voir-le-site?celebration=90000002',{waitUntil:'domcontentloaded'});
 assert.equal(await mobile.locator('.site-menu-bar .site-nav-title').isVisible(),false,
  'Desktop title must not crush the mobile navigation');
 await page.goto(HOST+'/__editor/demo-preparation?celebration=90000002',{waitUntil:'domcontentloaded'});
 await page.locator('[data-tab="media"]').click();
 await page.locator('[data-file-category="autres"]').click();
 const name='M027-PDF-PUBLIC-TEST-'+Date.now()+'.pdf';
 await page.locator('#asset-file-picker').setInputFiles({
  name,mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n')
 });
 const card=page.locator('.global-media-card').filter({hasText:name});
 await card.waitFor({timeout:30000});
 const box=card.getByRole('checkbox',{name:'Privé : '+name});
 await box.waitFor();
 assert.equal(await box.isChecked(),false,'Default must be public');
 const media=await call('/api/editor-media');
 pdf=media.items.find(x=>x.name===name&&x.type==='pdf'&&x.source==='uploaded');
 assert.ok(pdf?.src,'Disposable PDF must have a same-origin URL');
 assert.equal((await anon.request.get(HOST+pdf.src,{failOnStatusCode:false})).status(),200,
  'Default PUBLIC PDF must open without credentials even when no page references it');
 await box.check();
 await page.getByText('✓ PDF privé : lien inaccessible aux visiteurs.').waitFor();
 assert.equal((await anon.request.get(HOST+pdf.src,{failOnStatusCode:false})).status(),404,
  'Private PDF must not open anonymously even with its exact URL');
 await box.uncheck();
 await page.getByText('✓ PDF public : lien partageable sans connexion.').waitFor();
 assert.equal((await anon.request.get(HOST+pdf.src,{failOnStatusCode:false})).status(),200,
  'Unchecking restores stable previously shared URL');
 assert.deepEqual(errors,[]);
 console.log('M027_M016_BROWSER_PASS desktop_title=true mobile_title_hidden=true position=right pages=2 public_default=true pdf_toggle_private_404=true public_again_200=true stable_url=true');
}finally{
 if(pdf){
  const response=await ctx.request.post(HOST+'/api/editor-media?action=delete',{
   data:JSON.stringify({id:pdf.id}),
   headers:{origin:HOST,'content-type':'application/json'},failOnStatusCode:false
  });
  assert.equal(response.status(),200,'Clean up isolated M016 test PDF');
  console.log('M027_M016_PDF_CLEANUP_PASS');
 }
 if(original){
  const restored=await saveNavigation(original);
  assert.equal(restored.navigation.title,original.title);
  console.log('M027_M016_NAV_RESTORED_PASS');
 }
 await ctx.close();await anon.close();await browser.close();
}
