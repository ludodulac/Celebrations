// M031/4 — locally mocked, read-only Chromium smoke. NO real production PIN,
// D1 mutations or public draft access. Uses the exact production HTML/CSS/JS.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {handlePreparationDemo,STAGES} from '../migration/cloudflare/editor-demo-preparation-page.mjs';
import {M031_VISITOR_NAV_STYLE} from '../migration/cloudflare/editor-trial-site-page.mjs';
const HOST='https://ronde-des-archanges-universelle.eu';
const rows={
 celebrations:[{id:101,archangel:'Michaël',year:'2026',status:'active'}],
 steps:STAGES.map((x,i)=>({id:i+1,celebration_id:101,label:x.label,step_key:x.slug+'-101',
  sort_order:i,body_text:''}))
};
const env={DB:{prepare(sql){return {bind(...params){return {async all(){
  if(sql.includes('FROM celebrations_celebrations'))return {results:rows.celebrations};
  if(sql.includes('FROM celebrations_steps'))return {results:rows.steps};
  if(sql.includes('FROM celebrations_contents')||sql.includes('FROM celebrations_events')||
   sql.includes('FROM celebrations_event_contents')||sql.includes('FROM celebrations_step_contents')||
   sql.includes('FROM celebrations_links'))return {results:[]};
  throw Error('Unexpected read-only query: '+sql);
 }}}}}}};
const response=await handlePreparationDemo(new Request(HOST+'/__editor/demo-preparation?celebration=101'),env);
assert.equal(response.status,200);
const adminHtml=await response.text();
assert.ok(adminHtml.includes('m031-admin-home-link'));
const browser=await chromium.launch({headless:true});
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({
   viewport:mobile?{width:390,height:844}:{width:1400,height:840},
   isMobile:mobile,hasTouch:mobile
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e?.message||e)));
  await page.route(HOST+'/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/__editor/demo-preparation'||path==='/admin')
    return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:adminHtml});
   if(path==='/api/site-identity')
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,revision:1,memberAccessUiEnabled:false})});
   return route.fulfill({status:404,contentType:'application/json',body:'{"ok":false,"error":"disabled test mock"}'});
  });
  await page.goto(HOST+'/__editor/demo-preparation?celebration=101',{waitUntil:'domcontentloaded'});
  await page.locator('.m031-workbar').waitFor();
  assert.equal(await page.locator('.m031-workbar #save-btn').count(),1);
  assert.equal(await page.locator('.m031-workbar #preview-btn').count(),1);
  assert.equal(await page.locator('#view-site-btn').count(),1);
  assert.equal(await page.locator('.m031-admin-home-link').count(),1);
  assert.equal(await page.locator('#workspace .m030-planned-cycles').count(),1);
  assert.equal(await page.locator('.m031-rail-pages').count(),1);
  if(mobile){
   assert.equal(await page.locator('#workspace .layout > aside.m031-rail-pages').count(),1);
  }else{
   assert.equal(await page.locator('.rail > aside.m031-rail-pages').count(),1);
   const width=await page.locator('#workspace .layout').evaluate(el=>el.getBoundingClientRect().width);
   assert.ok(width>=850,'Desktop canvas must receive freed width, got '+width);
  }
  await page.locator('.m031-settings-details > summary').click();
  assert.ok(await page.locator('.m031-settings-fields .celebration-publication-controls').isVisible());
  assert.ok(await page.locator('.m031-settings-fields .editor-language-row.m020-settings').isVisible());
  await page.locator('.m031-settings-details > summary').click();
  if(!mobile){
   const first=page.locator('.m031-rail-pages .page-options > summary').first();
   await first.hover();
   await page.locator('.m031-page-flyout:popover-open').first().waitFor();
  }
  await page.getByRole('button',{name:'▤ Pages',exact:true}).click();
  assert.equal(await page.locator('.m031-workbar #save-btn').count(),1,
   'The real Save button must survive a render/navigation change');
  assert.ok((await page.locator('#workspace .m031-rail-pages').count())+
   (await page.locator('.rail > .m031-rail-pages').count())===1);
  assert.deepEqual(errors,[],'Browser errors in admin script: '+errors.join('; '));
  await context.close();
 }
 const page=await browser.newPage({viewport:{width:1400,height:800}});
 await page.setContent('<style>'+M031_VISITOR_NAV_STYLE+'</style><nav class="steps" id="stage-navigation">'+
  ['Accueil de la célébration','Préparation','Mercredi','Jeudi','Vendredi','Samedi','Dimanche','Après célébration'].map(t=>'<button class="stage-tab">'+t+'</button>').join('')+'</nav>');
 const boxes=await page.locator('#stage-navigation .stage-tab').evaluateAll(nodes=>nodes.map(n=>({
  x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y,
  whiteSpace:getComputedStyle(n).whiteSpace
 })));
 assert.equal(new Set(boxes.map(x=>Math.round(x.y))).size,1,'Eight day tabs should occupy one desktop row');
 assert.ok(boxes.every(b=>b.whiteSpace==='nowrap'));
 await page.close();
 console.log('M031_M4_BROWSER_SMOKE_PASS admin_desktop_mobile=true settings=true rail=true popover=true visitor_one_row=true');
}finally{await browser.close()}
