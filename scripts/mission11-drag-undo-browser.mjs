// M11: real Chromium pointer interactions against a synthetic celebration.
// All requests are blocked or served locally; no live D1, R2 or publication.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {handlePreparationDemo,STAGES} from '../migration/cloudflare/editor-demo-preparation-page.mjs';

const HOST='https://celebrations-exit-staging.rondes.workers.dev';
const steps=STAGES.map((s,i)=>({id:200+i,celebration_id:101,label:s.label,
 step_key:s.slug+'-101',start_date:'2026-10-07',
 body_text:'Exemple fictif '+s.label}));
const env={DB:{prepare(sql){assert.ok(sql.trim().startsWith('SELECT '));
 return {bind(){return {async all(){
  if(sql.includes('FROM celebrations_celebrations'))
   return {results:[{id:101,archangel:'Michaël',year:'2026',status:'active'}]};
  if(sql.includes('FROM celebrations_steps'))return {results:steps};
  return {results:[]};
 }}}};
}}};
const rendered=await handlePreparationDemo(
 new Request(HOST+'/__editor/demo-preparation?celebration=101'),env);
assert.equal(rendered.status,200);
let html=await rendered.text();
const match=html.match(/window\.__PREPARATION_SEED__=([\s\S]*?);<\/script>/);
assert.ok(match);
const seed=JSON.parse(match[1]),wed=seed.pages.find(p=>p.id==='mercredi-101');
assert.ok(wed);
wed.blocks=[
 {id:410,kind:'heading',text:'Titre pour déplacement',align:'left'},
 {id:411,kind:'text',text:'Texte de destination',align:'left'},
 {id:412,kind:'section',layout:'columns',columns:[
  [{id:413,kind:'image',src:'/media/faux-visuel.png',text:'Image fictive',widthPct:48}],
  [{id:414,kind:'video',href:'/media/fausse-video.mp4',text:'Vidéo fictive',cover:'/media/faux-visuel.png'}]],
  style:{border:'none',color:'#d7dde5',shadow:false,width:1}}
];
html=html.replace(match[0],
 'window.__PREPARATION_SEED__='+JSON.stringify(seed).replace(/</g,'\\u003c')+';<\/script>');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let requests=0,errors=[];
const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMbYAAAAASUVORK5CYII=','base64');
const context=await browser.newContext({viewport:{width:1280,height:900},
 serviceWorkers:'block',reducedMotion:'reduce',locale:'fr-FR'});
try{
 const page=await context.newPage();
 page.setDefaultTimeout(10000);
 page.on('pageerror',err=>errors.push(String(err.message||err)));
 await page.route('**/*',route=>{
  const r=route.request(),url=new URL(r.url()),method=r.method();
  if(url.origin!==HOST){requests++;return route.abort('blockedbyclient')}
  if(url.pathname==='/__editor/demo-preparation'&&method==='GET')
   return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html});
  if(url.pathname==='/api/editor-open-draft'&&method==='GET')
   return route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({ok:true,revision:0,record:null,plans:[],
     shared:{pages:[],homeId:''},mediaCatalogue:[]})});
  if(url.pathname==='/api/editor-media'&&method==='GET')
   return route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({ok:true,items:[],media:[]})});
  if(url.pathname.startsWith('/media/'))
   return route.fulfill({status:200,contentType:'image/png',body:tinyPng});
  if(method!=='GET'){requests++;return route.fulfill({status:405,body:'Blocked by M11'})}
  return route.fulfill({status:404,body:'Fixture only'});
 });
 const response=await page.goto(HOST+'/__editor/demo-preparation?celebration=101',
  {waitUntil:'domcontentloaded'});
 assert.equal(response.status(),200);
 await page.locator('.list .item').filter({hasText:'Mercredi'}).first().click();
 await page.locator('.canvas>.block[data-id="410"]').waitFor();
 const rootIds=()=>page.locator('.canvas>.block[data-id]').evaluateAll(
  nodes=>nodes.map(node=>node.dataset.id));
 assert.deepEqual(await rootIds(),['410','411']);
 assert.equal(await page.locator('.canvas .content-section').count(),1);
 const move=async(sourceSelector,destSelector)=>{
  const from=page.locator(sourceSelector),dest=page.locator(destSelector);
  await from.scrollIntoViewIfNeeded();
  const a=await from.boundingBox();assert.ok(a,'Drag handle present');
  const b=await dest.boundingBox();assert.ok(b,'Destination present');
  const start={x:a.x+a.width/2,y:a.y+a.height/2};
  const finish={x:b.x+b.width/2,y:b.y+b.height/2};
  await page.mouse.move(start.x,start.y);
  await page.mouse.down();
  await page.mouse.move(start.x+9,start.y+8,{steps:3});
  await page.mouse.move(finish.x,finish.y,{steps:16});
  await page.mouse.up();
 };
 // Pointer-down on an UNSELECTED title must not reorder the page.
 await move('.canvas>.block[data-id="410"] .ed',
  '.canvas>.block[data-id="411"]');
 assert.deepEqual(await rootIds(),['410','411']);
 assert.equal(await page.locator('.canvas .content-section').count(),1);
 // An explicit handle is deliberate, even if the source is not selected.
 await move('.canvas>.block[data-id="410"] .editor-move-handle',
  '.canvas>.block[data-id="411"]');
 const grouped=await page.locator('.canvas .content-section').evaluateAll(
  sections=>sections.map(section=>[...section.querySelectorAll('.block[data-id]')]
   .map(block=>block.dataset.id)));
 assert.ok(grouped.some(ids=>ids.join(',')==='410,411'),
  'Handle can group original title with target without cloning');
 assert.equal(await page.locator('#undo-btn').isDisabled(),false);
 await page.locator('#undo-btn').click();
 assert.deepEqual(await rootIds(),['410','411'],'Undo restores original root blocks');
 assert.equal(await page.locator('.canvas .content-section').count(),1);
 // Drag original image across both columns, then undo again.
 await move('.content-section[data-section-id="412"] .block[data-id="413"] .editor-move-handle',
  '.content-section[data-section-id="412"] .block[data-id="414"]');
 const right=page.locator('.content-section[data-section-id="412"] .section-column[data-column-index="1"]');
 const rightIds=()=>right.locator('.block[data-id]').evaluateAll(
  nodes=>nodes.map(x=>x.dataset.id));
 assert.deepEqual((await rightIds()).sort(),['413','414']);
 await page.locator('#undo-btn').click();
 assert.deepEqual(await rightIds(),['414'],'Undo returns image to left column');
 assert.equal(await page.locator('.content-section[data-section-id="412"] .section-column[data-column-index="0"] .block[data-id="413"]').count(),1);
 assert.equal(requests,0,'Drag and Undo never make production or save requests');
 assert.deepEqual(errors,[],'No JavaScript error in the real browser');
 console.log('M11_DRAG_UNDO_BROWSER_PASS '+JSON.stringify({
  grouped:true,columnMove:true,undoGroup:true,undoColumn:true,
  unselectedDoesNotDrag:true,requests,jsErrors:errors.length}));
}finally{await context.close();await browser.close()}
