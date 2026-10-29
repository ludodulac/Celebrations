// E1 full Chromium acceptance against TWO REAL imported staging pages.
// Uses an ephemeral CI-only admin session; saves drafts, restores original
// content after testing. Never touches celebrations_* historical source rows.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const BASE='https://celebrations-exit-staging.rondes.workers.dev';
const CODE=process.env.E1_QA_CODE;
assert.ok(typeof CODE==='string'&&CODE.length>=30);
const browser=await chromium.launch({headless:true});
const pilots=[
 {key:'home',selector:'.d-welcome h1',example:'Accueil pilote'},
 {key:'celebration:101:step:Mercredi',selector:'.d-event h3',example:'Rendez-vous pilote'}
];
let pass=0;
try{
 for(const device of [
  {name:'desktop',viewport:{width:1366,height:768},isMobile:false},
  {name:'mobile',viewport:{width:390,height:844},isMobile:true}
 ]){
  const context=await browser.newContext({viewport:device.viewport,isMobile:device.isMobile});
  const anon=await context.request.get(BASE+'/api/editor-e1?key=home');
  assert.equal(anon.status(),401);
  const oldAdmin=await context.request.get(BASE+'/admin.html?staging=1');
  assert.equal(oldAdmin.status(),200);
  const page=await context.newPage();
  await page.goto(BASE+'/__editor/access');
  for(let attempt=0;attempt<2;attempt++){
   await page.locator('input#code').fill(CODE);
   await page.locator('button#connect').click();
   await page.waitForTimeout(1100);
   if(await page.locator('#links:not([hidden])').isVisible())break;
   const status=(await page.locator('#status').innerText()).slice(0,100);
   console.log('MISSION_E1_QA_LOGIN_STATUS device='+device.name+' attempt='+(attempt+1)+' message='+status);
   if(attempt===0)await page.waitForTimeout(2300);
  }
  assert.equal(await page.locator('#links:not([hidden])').isVisible(),true,'Staging personal login refused ephemeral QA code');
  await page.goto(BASE+'/__editor/entry');
  await page.waitForURL(/\/__editor\/preview\?key=home/,{timeout:15000});
  const token=await page.evaluate(()=>localStorage.getItem('celebrations-admin-token'));
  assert.ok(token&&token.length>=64);
  const auth={authorization:'Bearer '+token};
  for(const task of pilots){
   const key=task.key;
   const api=(a='page')=>BASE+'/api/editor-e1?key='+encodeURIComponent(key)+'&action='+a;
   const initial=await context.request.get(api(),{headers:auth});
   assert.equal(initial.status(),200);
   const base=await initial.json();
   assert.ok(base.editable.length>=1,'Actual historical content not editable');
   assert.ok(base.version>=1);
   const beforeText=base.editable[0].values[key==='home'?'heading':'title'];
   const marker='E1QA-'+device.name+'-'+(key==='home'?'accueil':'mercredi');
   const target=BASE+'/__editor/edit?key='+encodeURIComponent(key);
   let restored=false;
   try{
    const edit=await page.goto(target,{waitUntil:'domcontentloaded'});
    assert.equal(edit.status(),200,'Edit page missing');
    await page.locator('#e1-edit:enabled').waitFor({timeout:15000});
    assert.ok(await page.locator('#e1-save').isDisabled(),'Save should be disabled initially');
    await page.locator('#e1-edit').click();
    assert.ok(await page.locator(task.selector).first().getAttribute('contenteditable')==='true');
    await page.locator(task.selector).first().fill(marker);
    await page.locator('#e1-save').click();
    await page.waitForFunction(sel=>document.querySelector(sel)?.textContent?.includes('E1QA-'),task.selector,{timeout:15000});
    const reload=await page.reload({waitUntil:'domcontentloaded'});
    assert.equal(reload.status(),200);
    assert.equal((await page.locator(task.selector).first().textContent()).trim(),marker,'Draft did not survive reload');
    const modified=await(await context.request.get(api(),{headers:auth})).json();
    assert.equal(modified.version,base.version+1);
    const row=modified.editable.find(x=>x.kind===base.editable[0].kind);
    assert.ok(row,'Source block identity lost');
    assert.equal(row.values[key==='home'?'heading':'title'],marker);
    // CAS: second editor has stale version and must receive 409.
    const stale=await context.request.post(BASE+'/api/editor-e1',{headers:auth,data:{
     action:'save',key,expected_version:base.version,changes:[{id:base.editable[0].id,values:{[key==='home'?'heading':'title']:'STALE-MUST-NOT-SAVE'}}]
    }});
    assert.equal(stale.status(),409);
    // Cancel before saving a second change.
    await page.locator('#e1-edit:enabled').waitFor();
    await page.locator('#e1-edit').click();
    await page.locator(task.selector).first().fill(marker+'-ABANDON');
    await page.locator('#e1-cancel').click();
    assert.equal((await page.locator(task.selector).first().textContent()).trim(),marker,'Cancel did not revert unsaved text');
    await page.reload({waitUntil:'domcontentloaded'});
    assert.equal((await page.locator(task.selector).first().textContent()).trim(),marker);
    // Version history: restore the exact source overlay state, not a synthetic page.
    await page.locator('#e1-history').click();
    await page.locator('#e1-versions').selectOption(String(base.version));
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#e1-restore').click();
    // Read-back the exact server revision independently of any navigation timing.
    await page.waitForTimeout(600);
    const restoredReply=await context.request.get(api(),{headers:auth});
    const after=await restoredReply.json();
    console.log('MISSION_E1_RESTORE_DIAG '+JSON.stringify({device:device.name,page:key==='home'?'home':'wednesday',
      current_version:after.version,expected_version:base.version+2,status:await page.locator('#e1-status').innerText().then(x=>x.slice(0,90)).catch(()=>null)}));
    assert.equal(after.version,base.version+2,'Restoration did not create a new draft revision');
    assert.equal(after.editable[0].values[key==='home'?'heading':'title'],beforeText,'Restored data differs from the original');
    await page.goto(target,{waitUntil:'domcontentloaded'});
    assert.equal((await page.locator(task.selector).first().textContent()).trim(),beforeText,'Restored draft is not visible in browser');
    restored=true;
    pass++;
    console.log('MISSION_E1_LIVE_PILOT_PASS device='+device.name+' page='+(key==='home'?'home':'wednesday')+
     ' edit=true reload=true cancel=true restore=true version_history=true stale_conflict_409=true');
   }finally{
    if(!restored){
     const last=await context.request.get(api(),{headers:auth});
     if(last.ok()){
      const state=await last.json();
      if(state.version!==base.version){
       const result=await context.request.post(BASE+'/api/editor-e1',{headers:auth,data:{
        action:'restore',key,expected_version:state.version,source_version:base.version
       }});
       assert.equal(result.status(),200,'Failed to restore original pilot after test error');
      }
     }
    }
   }
  }
  // Verify full imported set and no historical pages published. Query through
  // Cloudflare D1 read-only in the separate guarded CI job, not the browser.
  const token2=await page.evaluate(()=>localStorage.getItem('celebrations-admin-token'));
  await context.request.post(BASE+'/api/auth',{data:{action:'admin_logout',admin_token:token2}});
  const now=await context.request.get(BASE+'/api/editor-e1?key=home',{headers:{authorization:'Bearer '+token2}});
  assert.equal(now.status(),401,'Revoked admin session still allows editing');
  const denied=await context.request.get(BASE+'/__editor/edit?key=home');
  assert.equal(denied.status(),401,'Revoked session still allows draft page');
  await context.close();
 }
 console.log('MISSION_E1_BROWSER_PASS pilot_device_sessions='+pass+' of_4 unauthorized_denied=true admin_staging_200=true restored_originals=true');
}finally{await browser.close()}
