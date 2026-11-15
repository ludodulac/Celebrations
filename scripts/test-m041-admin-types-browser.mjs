// M041 — read/write through local mocked APIs only; real website is never mutated.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {handlePreparationDemo,STAGES} from '../migration/cloudflare/editor-demo-preparation-page.mjs';
const ORIGIN='https://ronde-des-archanges-universelle.eu';
const AUDIO='/media/new/12345678-1234-4234-8234-123456789abc.mp3';
const UPLOAD='/media/new/12345678-1234-4234-8234-123456789abd.mp3';
const rows={
 celebrations:[{id:101,archangel:'Michaël',year:'2026',status:'active'}],
 steps:STAGES.map((x,i)=>({id:i+1,celebration_id:101,label:x.label,
  step_key:x.slug+'-101',body_text:''}))
};
const env={DB:{prepare(sql){return {bind(){return {async all(){
 if(sql.includes('FROM celebrations_celebrations'))return {results:rows.celebrations};
 if(sql.includes('FROM celebrations_steps'))return {results:rows.steps};
 if(sql.includes('FROM celebrations_contents')||sql.includes('FROM celebrations_events')||
 sql.includes('FROM celebrations_event_contents')||sql.includes('FROM celebrations_step_contents')||
 sql.includes('FROM celebrations_links'))return {results:[]};
 throw Error('Unexpected fake D1 query: '+sql);
 }}}}}}};
const response=await handlePreparationDemo(new Request(ORIGIN+'/admin?celebration=101'),env);
assert.equal(response.status,200);const html=await response.text();
const browser=await chromium.launch({headless:true});
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1366,height:810},
   hasTouch:mobile,isMobile:mobile});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e.message)));
  let revision=21,uploadCount=0,selectedCount=0,created=0;
  let audioTypes=['Invocations','Chants','Méditations','Enseignements','Guidances','Autres'];
  let items=[{id:'audio|'+AUDIO,type:'audio',src:AUDIO,name:'Chant — Eloha Michaël',
   source:'uploaded',general:false,canDelete:false,uses:[],audioType:'Chants'}];
  const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  await page.route(ORIGIN+'/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname;
   if(path==='/admin')return route.fulfill({status:200,contentType:'text/html',body:html});
   if(path==='/api/site-identity')return json(route,{ok:true,revision:1,memberAccessUiEnabled:false});
   if(path==='/api/editor-open-draft'){
    return json(route,{ok:true,revision,record:{pages:[]},shared:{pages:[],homeId:'neutral-accueil-general'},
     plans:[],localization:null,publishedCelebrationVisibility:{'101':'published'}});
   }
   if(path==='/api/editor-media'&&req.method()==='GET')return json(route,{ok:true,items,revision,audioTypes});
   if(path==='/api/editor-media'&&req.method()==='POST'){
    const action=url.searchParams.get('action');
    if(action==='audio-type-create'){
     const data=req.postDataJSON();
     assert.equal(data.expectedRevision,revision);assert.equal(data.name,'Contes');
     created++;revision++;audioTypes.push(data.name);
     return json(route,{ok:true,revision,audioType:data.name,audioTypes});
    }
    if(action==='set-audio-type'){
     const data=req.postDataJSON();assert.equal(data.expectedRevision,revision);
     const existing=items.find(x=>x.id===data.id);
     assert.ok(existing,'Audio must already be in media catalogue');
     assert.ok(audioTypes.includes(data.audioType));
     existing.audioType=data.audioType;selectedCount++;revision++;
     return json(route,{ok:true,revision,item:existing,audioType:data.audioType,audioTypes});
    }
    if(action==='upload'){
     uploadCount++;revision++;
     const item={id:'audio|'+UPLOAD,type:'audio',src:UPLOAD,name:'Nouvelle histoire.mp3',
      source:'uploaded',general:false,canDelete:false,uses:[]};
     items.push(item);
     return json(route,{ok:true,revision,item});
    }
   }
   if(path===AUDIO||path===UPLOAD)return route.fulfill({status:200,contentType:'audio/mpeg',body:Buffer.from([0,0,0])});
   return json(route,{ok:false,error:'Disabled fake route'},404);
  });
  await page.goto(ORIGIN+'/admin?celebration=101',{waitUntil:'domcontentloaded'});
  await page.locator('.m031-workbar').waitFor();
  await page.locator('[data-tab="media"]').click();
  await page.locator('[data-file-category="audios"]').click();
  const picker=page.getByLabel('Type de MP3 à importer');
  await picker.waitFor();
  assert.ok((await picker.locator('option').allTextContents()).includes('Invocations'));
  assert.ok((await picker.locator('option').allTextContents()).includes('Guidances'));
  assert.equal(await picker.inputValue(),'Autres');
  const card=page.locator('.global-media-card').filter({hasText:'Eloha Michaël'});
  const selector=card.getByLabel('Type de l’audio Chant — Eloha Michaël');
  await selector.waitFor();
  assert.equal(await selector.inputValue(),'Chants');
  await page.getByRole('button',{name:'＋ Créer un type'}).click();
  const dialog=page.locator('.admin-dialog');await dialog.waitFor({state:'visible'});
  await dialog.locator('input').first().fill('Contes');
  await dialog.locator('button.primary').click();
  await page.waitForFunction(()=>document.querySelector('[aria-label="Type de MP3 à importer"]')?.value==='Contes');
  assert.equal(created,1,'New type persisted server side');
  await card.getByLabel('Type de l’audio Chant — Eloha Michaël').selectOption('Invocations');
  await page.waitForFunction(()=>document.querySelector('.global-media-card .audio-type-select')?.value==='Invocations');
  assert.equal(items[0].audioType,'Invocations');
  await picker.selectOption('Contes');
  await page.locator('#asset-file-picker').setInputFiles({name:'Nouvelle histoire.mp3',mimeType:'audio/mpeg',buffer:Buffer.from('fake-mp3')});
  await page.waitForFunction(()=>document.querySelectorAll('.global-media-card').length>=2);
  assert.equal(uploadCount,1);assert.equal(items[1].audioType,'Contes');
  assert.equal(selectedCount,2);
  assert.deepEqual(errors,[]);
  console.log('M041_ADMIN_AUDIO_TYPES_PASS mobile='+mobile+' created_new=true retag_existing=true upload_classified=true');
  await context.close();
 }
}finally{await browser.close()}
