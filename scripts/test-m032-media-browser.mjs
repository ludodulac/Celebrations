// M037 — browser-level clean media cards, exact rendered editor + local mock.
// Does not use an owner PIN or send a request to the live production services.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {handlePreparationDemo,STAGES} from '../migration/cloudflare/editor-demo-preparation-page.mjs';

const ORIGIN='https://ronde-des-archanges-universelle.eu';
const SRC='/media/new/12345678-1234-4234-8234-123456789abc.jpg';
const ID='image|'+SRC;
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
 throw Error('Unexpected mock D1 query: '+sql);
 }}}}}}};
const response=await handlePreparationDemo(new Request(ORIGIN+'/admin?celebration=101'),env);
assert.equal(response.status,200);
const adminHtml=await response.text();
const browser=await chromium.launch({headless:true});
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({
   viewport:mobile?{width:390,height:844}:{width:1366,height:810},
   hasTouch:mobile,isMobile:mobile,
   permissions:['clipboard-read','clipboard-write']
  });
  const page=await context.newPage(),errors=[];
  let revision=14,publicLink=false,writeCount=0,deleted=false,deleteCount=0;
  page.on('pageerror',e=>errors.push(String(e.message)));
  await page.route(ORIGIN+'/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname;
   const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
   if(path==='/admin')return route.fulfill({status:200,contentType:'text/html',body:adminHtml});
   if(path==='/api/site-identity')return json({ok:true,revision:1,memberAccessUiEnabled:false});
   if(path==='/api/editor-open-draft'){
    return json({ok:true,revision,record:{pages:[]},shared:{pages:[],homeId:'neutral-accueil-general'},
     plans:[],localization:null,publishedCelebrationVisibility:{'101':'published'}});
   }
   if(path==='/api/editor-media'&&req.method()==='GET'){
    return json({ok:true,items:deleted?[]:[{id:ID,type:'image',src:SRC,
     name:'Illustration inutilisée',source:'uploaded',general:false,publicLink,
     canDelete:!publicLink,uses:[]}]});
   }
   if(path==='/api/editor-media'&&req.method()==='POST'&&url.searchParams.get('action')==='delete'){
    assert.equal(req.postDataJSON().id,ID);
    assert.equal(publicLink,false,'A public-linked image must not be deleted');
    deleted=true;deleteCount++;revision++;
    return json({ok:true,revision});
   }
   if(path==='/api/editor-media'&&req.method()==='POST'&&url.searchParams.get('action')==='public-link'){
    writeCount++;
    const data=req.postDataJSON();
    assert.equal(data.id,ID);
    assert.equal(data.expectedRevision,revision);
    publicLink=data.publicLink;
    revision++;
    return json({ok:true,revision,publicLink,item:{id:ID,type:'image',src:SRC,
     name:'Illustration inutilisée',source:'uploaded',general:false,publicLink,
     canDelete:false,uses:[]}});
   }
   if(path===SRC)return route.fulfill({status:200,contentType:'image/jpeg',
    headers:{'content-disposition':'inline'},body:Buffer.from([255,216,255,217])});
   return route.fulfill({status:404,contentType:'application/json',body:'{"ok":false,"error":"mock disabled"}'});
  });
  await page.goto(ORIGIN+'/admin?celebration=101',{waitUntil:'domcontentloaded'});
  await page.locator('.m031-workbar').waitFor();
  await page.locator('[data-tab="media"]').click();
  const card=page.locator('.global-media-card').filter({hasText:'Illustration inutilisée'});
  await card.waitFor({state:'visible'});
  const imageLink=card.locator('.media-picture-link');
  assert.equal(await imageLink.getAttribute('href'),SRC);
  assert.equal(await imageLink.getAttribute('target'),'_blank');
  assert.equal(await card.locator('.media-unused-ribbon').count(),0);
  assert.equal(await card.getByText('N’apparaît nulle part').count(),1);
  assert.equal(await card.getByRole('button',{name:'🌍 Rendre le lien public'}).count(),0);
  assert.equal(await card.getByRole('button',{name:'🔗 Copier l’URL'}).count(),0);
  assert.equal(await card.getByRole('button',{name:'Supprimer',exact:true}).count(),1);
  await card.getByRole('button',{name:'Supprimer',exact:true}).click();
  await page.locator('.admin-dialog').waitFor({state:'visible'});
  assert.ok((await page.locator('.admin-dialog').innerText()).includes('Êtes-vous sûr de vouloir supprimer'));
  assert.equal(deleteCount,0,'Delete must wait for user confirmation');
  await page.locator('.admin-dialog button.primary').click();
  await page.waitForFunction(()=>document.querySelectorAll('.global-media-card').length===0);
  assert.equal(deleteCount,1);
  assert.equal(deleted,true);
  assert.equal(writeCount,0,'Rendering the library must not change sharing permissions');
  assert.deepEqual(errors,[],errors.join('; '));
  await context.close();
 }
 console.log('M037_BROWSER_SMOKE_PASS mobile_and_desktop=true clickable_image=true clean_card=true confirmed_delete=true no_share_change=true');
}finally{await browser.close()}
