// M033 — exact visitor and admin HTML in Chromium, mock READ-ONLY site.
// Never touch the official PIN, database, Cloudflare storage or media.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {handleTrialSite} from '../migration/cloudflare/editor-trial-site-page.mjs';
import {handlePreparationDemo,STAGES} from '../migration/cloudflare/editor-demo-preparation-page.mjs';
const HOST='https://ronde-des-archanges-universelle.eu';
const HOME='neutral-accueil-general';
const NEXT='neutral-123e4567-e89b-42d3-a456-426614174000';
const SECRET='neutral-123e4567-e89b-42d3-a456-426614174001';
const IMAGE='/media/m033-home-existing-photo.jpg';
const publicShared={
 homeId:HOME,pages:[
  {id:HOME,name:'Accueil',group:'page',visibility:'published',blocks:[
   {id:'welcome',kind:'heading',text:'Bienvenue',align:'center'},
   {id:'cover',kind:'image',src:IMAGE,text:'Illustration actuelle',widthPct:70},
   {id:'other',kind:'text',text:'Texte existant conservé'}]},
  {id:NEXT,name:'Notre démarche',group:'page',visibility:'published',
   blocks:[{id:'next-text',kind:'text',text:'Notre première vraie page'}]},
  {id:SECRET,name:'Confidentiel',group:'page',visibility:'draft',
   blocks:[{id:'private',kind:'text',text:'Ne jamais montrer'}]}
 ]};
const snapshot={
 ok:true,revision:71,
 shared:publicShared,record:{pages:STAGES.map((stage,i)=>({
  id:stage.slug+'-101',name:stage.label,group:'celebration',
  blocks:[{id:'text'+i,kind:'text',text:'Célébration publique'}]}))},
 plans:[],celebrationVisible:true,celebrationVisibility:{'101':'published'},media:[]
};
const rows={celebrations:[{id:101,archangel:'Michaël',year:'2026',status:'active'}],
 steps:STAGES.map((p,i)=>({id:i+1,step_key:p.slug+'-101',
  label:p.label,sort_order:i,celebration_id:101,body_text:''}))};
const cloudflareSnapshot={
 version:71,shared:publicShared,drafts:{'101':{pages:[]}},plans:[],
 mediaCatalogue:[],published:{
  celebrationVisibility:{'101':'published'},
  shared:publicShared,drafts:{'101':{pages:[]}},plans:[]
 }
};
const env={EDITOR_BUCKET:{async get(key){
 if(key==='editor-trials/server-drafts-v1.json')
  return {etag:'1',text:async()=>JSON.stringify(cloudflareSnapshot)};
 return null;
}},DB:{prepare(sql){return {bind(){return {async all(){
 if(sql.includes('FROM celebrations_celebrations'))return {results:rows.celebrations};
 if(sql.includes('FROM celebrations_steps'))return {results:rows.steps};
 if(/FROM celebrations_(?:events|event_contents|step_contents|links|contents)/.test(sql))
  return {results:[]};
 throw Error('Unrecognized read-only SQL: '+sql);
 }}}}}}};
const [visitor,admin]=await Promise.all([
 handleTrialSite(new Request(HOST+'/'),env),
 handlePreparationDemo(new Request(HOST+'/admin?celebration=101'),env)
]);
assert.equal(visitor.status,200);
assert.equal(admin.status,200);
const visitorHtml=await visitor.text(),adminHtml=await admin.text();
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMbYAAAAASUVORK5CYII=','base64');
const browser=await chromium.launch({headless:true});
try{
 for(const [name,w,h,mobile] of [['ordinateur',1400,850,false],['telephone',390,844,true]]){
  const context=await browser.newContext({viewport:{width:w,height:h},
   isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
  const page=await context.newPage();const errors=[];let writes=0;
  page.on('pageerror',e=>errors.push(String(e.message||e)));
  await page.route(HOST+'/**',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(request.method()!=='GET'&&request.method()!=='HEAD'){
    writes++;return route.fulfill({status:405,body:'No writes in M033 smoke'});
   }
   if(url.pathname==='/media/m033-home-existing-photo.jpg')
    return route.fulfill({status:200,contentType:'image/png',body:PNG});
   if(url.pathname==='/api/editor-publication')return route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(snapshot)});
   if(url.pathname==='/api/site-identity')return route.fulfill({
    status:200,contentType:'application/json',body:'{"ok":true,"revision":1,"memberAccessUiEnabled":false}'});
   if(url.pathname==='/api/editor-open-draft')return route.fulfill({status:401,
    contentType:'application/json',body:'{"ok":false,"error":"auth needed"}'});
   if(url.pathname==='/admin'||url.pathname==='/__editor/demo-preparation')
    return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:adminHtml});
   if(url.pathname==='/'||url.pathname==='/__editor/voir-le-site')
    return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:visitorHtml});
   return route.fulfill({status:404,body:'Test route not found'});
  });
  await page.goto(HOST+'/',{waitUntil:'domcontentloaded'});
  const cover=page.locator('.m033-splash-enter .m033-splash-image');
  await cover.waitFor();
  assert.equal(await page.locator('body.is-splash-home').count(),1);
  assert.equal(await page.locator('.site-menu-bar').isVisible(),false);
  assert.equal(await page.locator('.m021-site-identity').isVisible().catch(()=>false),false);
  assert.equal(await page.locator('.footer').isVisible(),false);
  const box=await page.locator('.m033-splash-enter').boundingBox();
  assert.ok(box,'Full-screen cover must be present');
  assert.ok(Math.abs(box.x)<=1&&Math.abs(box.y)<=1,'No margin above/left: '+JSON.stringify(box));
  assert.ok(Math.abs(box.width-w)<=1,'Hero width must fill viewport '+w+': '+box.width);
  assert.ok(Math.abs(box.height-h)<=2,'Hero height must fill viewport '+h+': '+box.height);
  assert.equal(await cover.evaluate(el=>getComputedStyle(el).objectFit),'cover');
  assert.ok((await page.locator('.m033-home-after-hero').innerText()).includes('Bienvenue'));
  assert.equal(await page.locator('.m033-splash-enter').getAttribute('href'),
   '/?celebration=101&page='+NEXT);
  await page.locator('.m033-splash-enter').click();
  await page.getByText('Notre première vraie page').waitFor();
  assert.equal(await page.locator('body.is-splash-home').count(),0);
  assert.ok(await page.locator('.site-menu-bar').isVisible());
  assert.equal(await page.locator('.m033-splash-enter').count(),0);
  assert.equal(await page.locator('#general-navigation').getByText('Confidentiel').count(),0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  assert.equal(overflow,false,'No visitor horizontal overflow');
  // Editor list: every page has a SINGLE ellipsis holding the full action set.
  await page.goto(HOST+'/admin?celebration=101',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'▤ Pages',exact:true}).click();
  const homeRow=page.locator('.general-page-row').filter({has:page.locator('[data-page-id="'+HOME+'"]')});
  assert.equal(await homeRow.count(),1);
  assert.equal(await homeRow.locator(':scope > .page-options').count(),1);
  assert.equal(await homeRow.locator(':scope > .inline-page-state').count(),1);
  await homeRow.locator(':scope > .page-options > summary').click();
  const menu=homeRow.locator('.page-options-menu');
  assert.equal(await menu.locator('button').filter({hasText:'Modifier cette page'}).count(),1);
  assert.equal(await menu.locator('button').filter({hasText:'Monter'}).count(),1);
  assert.equal(await menu.locator('button').filter({hasText:'Descendre'}).count(),1);
  assert.equal(await menu.locator('select[aria-label^="Visibilité"]').count(),1);
  assert.deepEqual(errors,[],name+': '+errors.join('; '));
  assert.equal(writes,0);
  await context.close();
  console.log('M033_BROWSER_PASS device='+name+' image_fullscreen=true single_admin_menu=true first_published_page=true');
 }
}finally{await browser.close()}
