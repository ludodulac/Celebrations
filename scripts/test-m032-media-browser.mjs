// M032 — browser-level media sharing smoke, exact rendered editor + local mock.
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
  let revision=14,publicLink=false,writeCount=0;
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
    return json({ok:true,items:[{id:ID,type:'image',src:SRC,
     name:'Illustration inutilisée',source:'uploaded',general:false,publicLink,
     canDelete:!publicLink,uses:[]}]});
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
  const link=card.locator('.media-open-direct');
  assert.equal(await link.getAttribute('href'),SRC);
  assert.equal(await link.getAttribute('target'),'_blank');
  assert.equal(await card.getByText('Fichier conservé. Partage public direct non activé.').count(),1);
  await card.getByRole('button',{name:'🌍 Rendre le lien public'}).click();
  await page.locator('.admin-dialog').waitFor({state:'visible'});
  assert.ok((await page.locator('.admin-dialog').innerText()).includes('même si la célébration est masquée'));
  await page.locator('.admin-dialog button.primary').click();
  await page.waitForFunction(()=>document.querySelector('.media-direct-public-status')?.textContent.includes('Lien public autonome'));
  assert.equal(publicLink,true);
  assert.equal(writeCount,1);
  const updated=page.locator('.global-media-card').filter({hasText:'Illustration inutilisée'});
  assert.equal(await updated.getByRole('button',{name:'🔗 Copier l’URL'}).count(),1);
  assert.equal(await updated.getByRole('button',{name:'Supprimer si inutilisé'}).count(),0,
   'A public link must not be offered for deletion even if no pages reference it');
  assert.ok(await updated.getByRole('button',{name:'🔗 Copier l’URL'}).isVisible());
  await updated.getByRole('button',{name:'🔗 Copier l’URL'}).click();
  const copied=await page.evaluate(async()=>navigator.clipboard.readText());
  assert.equal(copied,ORIGIN+SRC);
  await updated.getByRole('button',{name:'🔒 Désactiver le lien public'}).click();
  await page.locator('.admin-dialog button.primary').click();
  await page.waitForFunction(()=>document.querySelector('.media-direct-private-status')?.textContent.includes('Partage public direct non activé'));
  assert.equal(publicLink,false);
  assert.equal(writeCount,2);
  assert.deepEqual(errors,[],errors.join('; '));
  await context.close();
 }
 console.log('M032_BROWSER_SMOKE_PASS mobile_and_desktop=true direct_url=true explicit_consent=true public_toggle=true copy_url=true revoke=true');
}finally{await browser.close()}
