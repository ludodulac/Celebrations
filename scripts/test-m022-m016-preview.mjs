// M022 browser proof on the existing PRIVATE isolated M016 Worker only.
// Never runs on an official host or creates test members.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const HOST='https://celebrations-m016-admin-preprod.rondes.workers.dev';
const CID='90000002',FOLDER='docs/m022-mobile';
assert.equal(process.env.M022_M016_ONLY,'YES');
assert.ok((process.env.M017_ADMIN_PASSWORD||'').length>=16);
mkdirSync(FOLDER,{recursive:true});
const browser=await chromium.launch({headless:true});
let page,initial=null;
async function mode(){
 const r=await page.request.get(HOST+'/api/site-identity',{failOnStatusCode:false});
 assert.equal(r.status(),200);
 const o=await r.json();assert.equal(o.ok,true);return o;
}
async function selectMode(value){
 const current=await mode();
 if(current.memberAccessUiEnabled===value)return;
 const r=await page.request.post(HOST+'/api/site-identity',{
  headers:{origin:HOST,'content-type':'application/json'},
  data:{expectedRevision:current.revision,memberAccessUiEnabled:value},failOnStatusCode:false
 });
 assert.equal(r.status(),200);
 assert.equal((await mode()).memberAccessUiEnabled,value);
}
async function editor(){
 const r=await page.goto(HOST+'/__editor/demo-preparation?celebration='+CID,
  {waitUntil:'domcontentloaded',timeout:40000});
 assert.equal(r.status(),200);
 await page.locator('[data-tab="celebrations"]').waitFor();
 await page.locator('[data-tab="celebrations"]').click();
 await page.locator('.m020-settings').waitFor();
 await page.waitForTimeout(500);
}
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const gate=await page.goto(HOST+'/admin',{waitUntil:'domcontentloaded'});
 assert.equal(gate.status(),200);
 await page.locator('input[name="code"]').fill(process.env.M017_ADMIN_PASSWORD);
 await Promise.all([
  page.waitForURL(u=>u.pathname==='/admin.html',{timeout:30000}),
  page.locator('button[type="submit"]').click()
 ]);
 initial=await mode();
 await selectMode(false);
 // A newly deployed Worker can take several seconds to reach the M016 edge.
 for(let n=0;n<18;n++){
  await editor();
  if(await page.locator('.m020-settings .m022-save').count()===1)break;
  const diag=await page.evaluate(()=>({
   settings:document.querySelectorAll('.m020-settings').length,
   save:document.querySelectorAll('.m022-save').length,
   editor:document.querySelectorAll('.stage-editor').length,
   celebrations:document.querySelectorAll('[data-tab="celebrations"]').length,
   activeTab:document.querySelector('[data-tab="celebrations"]')?.getAttribute('aria-current'),
   alert:document.querySelector('#status')?.textContent?.slice(0,120)||'',
   path:location.pathname
  }));
  console.log('M022_M016_PROPAGATION_RETRY '+n+' '+JSON.stringify(diag));
  await page.waitForTimeout(1300);
 }
 assert.equal(await page.locator('.m020-settings button:has-text("Dupliquer")').count(),0,
  'A celebration page must not offer a redundant duplicate');
 assert.equal(await page.locator('.m020-settings .m022-save').count(),1,
  'The same content save is reachable from page settings');
 assert.equal(await page.locator('#save-btn').count(),1);
 assert.equal(await page.getByRole('button',{name:'Enregistrer l’accès'}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Appliquer',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Mettre à jour le site',exact:true}).count(),0);
 const allRows=page.locator('.general-page-row');
 for(let n=0;n<await allRows.count();n++){
  const row=allRows.nth(n);
  for(let k=0;k<await row.locator('details.page-options').count();k++)
   assert.ok(await row.locator('details.page-options .page-options-menu button').count()>0,
    'No empty ⋯ menus, including historic Préparation');
 }
 const status=page.locator('.celebration-publication-controls .publication-status-controls select').first();
 await status.waitFor();
 const previous=await status.inputValue();
 assert.ok(['published','hidden','draft'].includes(previous));
 const next=previous==='hidden'?'draft':'hidden';
 await status.selectOption(next);
 if(next==='hidden')await page.getByRole('dialog').getByRole('button',{name:/Confirmer|Valider|OK/i}).click();
 await page.waitForFunction(expected=>document.querySelector('.celebration-publication-controls .publication-status-controls select')?.value===expected,next);
 await page.waitForTimeout(700);
 assert.equal(await page.locator('.celebration-publication-controls .publication-status-controls select').inputValue(),next);
 await page.locator('.celebration-publication-controls .publication-status-controls select').selectOption(previous);
 if(previous==='hidden')await page.getByRole('dialog').getByRole('button',{name:/Confirmer|Valider|OK/i}).click();
 await page.waitForTimeout(800);
 assert.equal(await page.locator('.celebration-publication-controls .publication-status-controls select').inputValue(),previous,
  'Restore the isolated celebration visibility exactly');
 await page.screenshot({path:FOLDER+'/01-simplifie.png',fullPage:true});
 await selectMode(true);
 await editor();
 assert.equal(await page.locator('.m020-access').count()>0,true,
  'Full access controls retain server ACL');
 assert.equal(await page.locator('.m020-access button:has-text("Enregistrer l’accès")').count(),0);
 const duplicate=page.locator('.celebration-publication-controls').getByRole('button',{name:'Dupliquer'});
 assert.equal(await duplicate.count(),1);
 await duplicate.click();
 const dlg=page.getByRole('dialog');
 await dlg.waitFor();
 assert.ok((await dlg.getByRole('heading').innerText()).includes('Nouvelle version'));
 await dlg.getByRole('combobox',{name:'Catégorie'}).waitFor();
 await dlg.getByRole('combobox',{name:'Langue'}).waitFor();
 assert.equal(await dlg.getByText('Que souhaitez-vous dupliquer ?').count(),0);
 await page.screenshot({path:FOLDER+'/02-duplication-categorie-langue.png',fullPage:true});
 await dlg.getByRole('button',{name:'Annuler'}).click();
 assert.equal(await page.locator('dialog.admin-dialog').count(),0);
 await page.screenshot({path:FOLDER+'/03-complet.png',fullPage:true});
 assert.deepEqual(errors,[],'No uncaught JS errors on the smartphone');
 console.log('M022_REAL_M016_MOBILE_PASS modes=both save_button_shared=true no_duplicate_page=true no_empty_menus=true visibility_auto_saved=true category_language_dialog=true');
}finally{
 if(page&&initial){try{await selectMode(initial.memberAccessUiEnabled);console.log('M022_M016_OWNER_MODE_RESTORED');}
  catch(e){console.error('M022_M016_MODE_RESTORE_FAILED',e)}}
 await browser.close();
}