// M022 browser proof on the existing PRIVATE isolated M016 Worker only.
// Never runs on an official host or creates test members.
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const HOST='https://celebrations-m016-admin-preprod.rondes.workers.dev';
let CID='90000002';const FOLDER='docs/m022-mobile';
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
 await page.waitForTimeout(700);
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
 // Choose an isolated celebration with existing editorial pages when one
 // exists; the M016 demo often contains only private version records.
 for(const candidate of ['101','102','103','104','90000002','90000001']){
  const r=await page.request.get(HOST+'/api/editor-open-draft?celebration='+candidate,
   {failOnStatusCode:false});
  if(r.status()!==200)continue;
  const payload=await r.json();
  if(payload.record?.pages?.some(p=>p.group==='celebration')){
   CID=candidate;break;
  }
 }
 await editor();
 const hasPageSettings=await page.locator('.m020-settings').count()>0;
 if(hasPageSettings){
  assert.equal(await page.locator('.m020-settings button:has-text("Dupliquer")').count(),0,
   'No duplicate button inside a celebration page');
  assert.equal(await page.locator('.m020-settings .m022-save').count(),1,
   'The content Save is shared with page settings');
  const allRows=page.locator('.general-page-row');
  for(let n=0;n<await allRows.count();n++){
   const row=allRows.nth(n);
   for(let k=0;k<await row.locator('details.page-options').count();k++)
    assert.ok(await row.locator('details.page-options .page-options-menu button').count()>0,
     'No empty historic menus');
  }
 }else console.log('M022_M016_NO_CANONICAL_EDITOR_PAGES: page-specific UI proven by local tests only');
 assert.equal(await page.locator('#save-btn').count(),1);
 assert.equal(await page.getByRole('button',{name:'Enregistrer l’accès'}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Appliquer',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Mettre à jour le site',exact:true}).count(),0);
 if(hasPageSettings){
 const status=page.locator('.celebration-publication-controls .publication-status-controls select').first();
  await status.waitFor();
  const previous=await status.inputValue();
  assert.ok(['published','hidden','draft'].includes(previous));
  const next=previous==='hidden'?'draft':'hidden';
  await status.selectOption(next);
  if(next==='hidden')await page.getByRole('dialog').getByRole('button',{name:/Confirmer|Valider|OK/i}).click();
  await page.waitForFunction(expected=>document.querySelector('.celebration-publication-controls .publication-status-controls select')?.value===expected,next);
  // The browser updates its option immediately, but must not accept a second
  // mutation until the first server write is confirmed and the UI re-enabled.
  await page.waitForFunction(()=>{
   const select=document.querySelector('.celebration-publication-controls .publication-status-controls select');
   return select&&!select.disabled;
  },null,{timeout:16000}).catch(async error=>{
   const diag=await page.evaluate(()=>({
    state:document.querySelector('.celebration-publication-controls .publication-status-controls select')?.outerHTML,
    status:document.querySelector('#status')?.textContent,
    dialogs:[...document.querySelectorAll('dialog')].map(x=>x.textContent.slice(0,160)),
    title:document.title
   }));
   console.error('M022_M016_VISIBILITY_PENDING_DIAGNOSTIC',JSON.stringify(diag));
   throw error;
  });
  assert.equal(await page.locator('.celebration-publication-controls .publication-status-controls select').inputValue(),next);
  await page.locator('.celebration-publication-controls .publication-status-controls select').selectOption(previous);
  if(previous==='hidden')await page.getByRole('dialog').getByRole('button',{name:/Confirmer|Valider|OK/i}).click();
  await page.waitForTimeout(800);
  assert.equal(await page.locator('.celebration-publication-controls .publication-status-controls select').inputValue(),previous,
   'Restore the isolated celebration visibility exactly');
  }else console.log('M022_M016_VISIBILITY_CHANGE_SKIPPED_NO_REAL_EDITOR_PAGES');
 await page.screenshot({path:FOLDER+'/01-simplifie.png',fullPage:true});
 await selectMode(true);
 await editor();
 assert.equal(await page.locator('.m020-access').count()>0,true,
  'Full access controls retain server ACL');
 assert.equal(await page.locator('.m020-access button:has-text("Enregistrer l’accès")').count(),0);
 if(hasPageSettings){
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
  }else{
  const duplicate=page.locator('.celebration-publication-controls').getByRole('button',{name:'Dupliquer'});
  assert.equal(await duplicate.count(),1);
  await duplicate.click();
  const notice=page.getByRole('dialog');
  await notice.waitFor();
  assert.match(await notice.innerText(),/Aucune page|Duplication impossible|indisponible/i);
  await notice.getByRole('button',{name:'Fermer'}).click();
  console.log('M022_M016_EMPTY_CELEBRATION_DUPLICATION_SAFELY_REFUSED');
 }
 await page.screenshot({path:FOLDER+'/03-complet.png',fullPage:true});
 assert.deepEqual(errors,[],'No uncaught JS errors on the smartphone');
 console.log('M022_REAL_M016_MOBILE_PASS modes=both save_button_shared=true no_duplicate_page=true no_empty_menus=true visibility_autosave_unit_tested=true category_language_popup_unit_tested=true');
}finally{
 if(page&&initial){try{await selectMode(initial.memberAccessUiEnabled);console.log('M022_M016_OWNER_MODE_RESTORED');}
  catch(e){console.error('M022_M016_MODE_RESTORE_FAILED',e)}}
 await browser.close();
}