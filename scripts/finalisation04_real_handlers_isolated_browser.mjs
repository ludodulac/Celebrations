// FINALISATION 4/5: the REAL editor renderer and REAL server draft/publication
// handlers, exercised by desktop + mobile Chromium against a synthetic in-RAM
// D1/R2 and a locally signed synthetic official-site cookie.
// Absolutely no request, no SQL, no write is forwarded to the real website.
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {chromium} from 'playwright';
import {handlePreparationDemo,STAGES} from '../migration/cloudflare/editor-demo-preparation-page.mjs';
import {handleServerDraft} from '../migration/cloudflare/editor-server-draft-api.mjs';
import {handleEditorPublication,initialPublication} from '../migration/cloudflare/editor-publication-api.mjs';
const ORIGIN='https://www.ronde-des-archanges-universelle.eu';
const PASSWORD_HASH='b'.repeat(64); // dummy generated for M4, never a real credential.
const contentSeed=STAGES.map((s,i)=>({id:1000+i,celebration_id:101,
 label:s.label,step_key:s.slug+'-101',body_text:'Démonstration M4 '+s.label,
 start_date:'2026-10-01',end_date:null}));
const dbRows={
 celebrations:[{id:101,archangel:'Michaël',year:'2026',status:'active'}],
 steps:contentSeed,events:[],stepContents:[],eventContents:[],links:[]
};
const sqlQueries=[];
const DB={prepare(sql){
 sqlQueries.push(sql);
 assert.match(sql,/^SELECT\s/,'M4: never run real or mutating D1 SQL');
 return {bind(){return this},async all(){
  if(sql.includes('FROM celebrations_celebrations'))return{results:dbRows.celebrations};
  if(sql.includes('FROM celebrations_steps'))return{results:dbRows.steps};
  if(sql.includes('FROM celebrations_events'))return{results:dbRows.events};
  if(sql.includes('FROM celebrations_links'))return{results:dbRows.links};
  return{results:[]};
 }};
}};
const render=await handlePreparationDemo(new Request(ORIGIN+'/__editor/demo-preparation?celebration=101'),{DB});
assert.equal(render.status,200,'Authentic editor could not render in synthetic DB');
const html=await render.text();
const m=html.match(/window\.__PREPARATION_SEED__=([\s\S]*?);<\/script>/);
assert.ok(m,'Editor seed is required');
const seed=JSON.parse(m[1]);
const basicRecord={pages:seed.pages.filter(p=>p.group==='celebration'),
 celebrationDates:{},celebrationTimes:{}};
assert.equal(basicRecord.pages.length,8);
const initialGlobalPage={id:'neutral-accueil-general',group:'page',name:'Accueil',
 visibility:'published',blocks:[
  {id:'test-title',kind:'heading',text:'Accueil de test M4'},
  {id:'test-text',kind:'text',text:'Version ancienne et publique'}
 ]};
const PRIVATE_PAGE_ID='neutral-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const privatePage={id:PRIVATE_PAGE_ID,group:'page',name:'Page privée M4',
 visibility:'draft',blocks:[{id:'hidden-private',kind:'text',text:'Texte privé M4 à ne pas montrer avant publication'}]};
const initialShared={pages:[initialGlobalPage,privatePage],homeId:'neutral-accueil-general'};
let snapshot={version:1,drafts:{'101':basicRecord},plans:[],shared:initialShared};
snapshot.published=initialPublication(snapshot);
let etag=1;
let readOps=0,putOps=0,failNext=false;
const bkt={
 async get(key){
  assert.equal(key,'editor-trials/server-drafts-v1.json');
  readOps++;
  return {etag:String(etag),body:true,text:async()=>JSON.stringify(snapshot)};
 },
 async put(key,body,{onlyIf}={}){
  assert.equal(key,'editor-trials/server-drafts-v1.json');
  if(failNext){failNext=false;return null}
  if(onlyIf?.etagMatches!==String(etag))return null;
  snapshot=JSON.parse(body);etag++;putOps++;
  return {etag:String(etag)};
 }
};
const env={DB,EDITOR_BUCKET:bkt,MEDIA_BUCKET:bkt,ADMIN_PASSWORD_HASH:PASSWORD_HASH};
async function syntheticCookie(){
 const payload=String(Date.now())+'.'+'a'.repeat(32);
 const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(PASSWORD_HASH),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode('site-editor-v1:'+payload));
 return 'celebrations_editor_access='+payload+'.'+Buffer.from(sig).toString('hex');
}
const AUTH=await syntheticCookie();
const securityAnonymous=await handleServerDraft(
 new Request(ORIGIN+'/api/editor-open-draft?celebration=101'),env);
assert.equal(securityAnonymous.status,401,'A missing cookie must never grant draft access');
const fetched=await handleServerDraft(new Request(ORIGIN+'/api/editor-open-draft?celebration=101',
 {headers:{cookie:AUTH}}),env);
assert.equal(fetched.status,200,'Synthetic signed cookie must pass real authentication');
const origPub=await handleEditorPublication(new Request(ORIGIN+'/api/editor-publication?celebration=101'),env);
assert.equal(origPub.status,200);
assert.equal((await origPub.json()).shared.pages[0].blocks[1].text,'Version ancienne et publique');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMbYAAAAASUVORK5CYII=','base64');
const fakeMedia=[
 {id:'image|/media/m4-illustration.png',type:'image',src:'/media/m4-illustration.png',name:'Illustration fictive',general:true,uses:[]},
 {id:'pdf|/media/m4-programme.pdf',type:'pdf',src:'/media/m4-programme.pdf',name:'Programme fictif',general:true,uses:[]},
 {id:'video|/media/m4-film.mp4',type:'video',src:'/media/m4-film.mp4',name:'Vidéo fictive',general:true,uses:[]}
];
let external=0,blocked=0,serverPost=0,serverGet=0;
function json(x,status=200){return{status,contentType:'application/json',body:JSON.stringify(x)}}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const failures=[];
try{
 let savedSentinel='',initialBlockId='';
 for(const [label,width,mobile] of [['desktop',1280,false],['mobile',390,true]]){
  const context=await browser.newContext({viewport:{width,height:840},
   isMobile:mobile,hasTouch:mobile,serviceWorkers:'block',
   locale:'fr-FR',reducedMotion:'reduce'});
  await context.addCookies([{name:'celebrations_editor_access',value:AUTH.split('=')[1],
    domain:'.ronde-des-archanges-universelle.eu',path:'/',httpOnly:true,secure:true,sameSite:'Lax'}]);
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.name+':'+e.message.slice(0,240)));
  page.setDefaultTimeout(17000);
  await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url()),method=req.method();
   if(url.origin!==ORIGIN){external++;return route.abort('blockedbyclient')}
   if(url.pathname==='/__editor/demo-preparation'&&method==='GET')
    return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html});
   if(url.pathname==='/api/editor-open-draft'){
    const body=req.postData()||'';
    const serverReq=new Request(req.url(),{method,
     headers:{cookie:AUTH,origin:ORIGIN,...(method==='POST'?{'content-type':'application/json'}:{})},
     ...(method==='POST'?{body}:{})});
    if(method==='POST')serverPost++;else serverGet++;
    const res=await handleServerDraft(serverReq,env);
    return route.fulfill({status:res.status,contentType:'application/json',body:await res.text()});
   }
   if(url.pathname==='/api/editor-publication'){
    if(method!=='GET'){blocked++;return route.fulfill(json({ok:false,error:'M4 blocked publish'},405))}
    const res=await handleEditorPublication(new Request(req.url(),{method:'GET'}),env);
    return route.fulfill({status:res.status,contentType:'application/json',body:await res.text()});
   }
   if(url.pathname==='/api/editor-media'&&method==='GET')return route.fulfill(json({ok:true,items:fakeMedia,media:fakeMedia}));
   if(url.pathname.startsWith('/media/'))return route.fulfill({status:200,contentType:'image/png',body:png});
   if(method!=='GET'&&method!=='HEAD'){blocked++;return route.fulfill(json({ok:false,error:'M4 blocked external mutation'},405))}
   return route.fulfill({status:404,body:'M4 fixture route not found'});
  });
  try{
   const res=await page.goto(ORIGIN+'/__editor/demo-preparation?celebration=101',
    {waitUntil:'domcontentloaded',timeout:30000});
   assert.equal(res.status(),200);
   await page.locator('button[data-tab="pages"]').click();
   await page.locator('.canvas .block[data-kind="text"]').first().waitFor();
   const editable=page.locator('.canvas .block[data-kind="text"] .ed[contenteditable="true"]').first();
   const id=await editable.evaluate(el=>el.closest('.block')?.dataset.id);
   assert.ok(id,'Editor block ID missing');
   if(label==='desktop'){
    initialBlockId=id;
    savedSentinel='Recette intégrée M4 — sauvegarde et deuxième appareil';
    await editable.fill(savedSentinel);
    await page.locator('#save-btn').click();
    await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('revérifié après enregistrement'),null,{timeout:25000});
    assert.ok(snapshot.shared.pages.some(p=>JSON.stringify(p.blocks).includes(savedSentinel)),
      'The REAL R2-backed handler failed to save text');
    assert.ok(serverPost>=1,'Actual editor did not issue a save request');
    await page.evaluate(()=>{
      localStorage.removeItem('celebrations-demo-preparation-101');
      localStorage.removeItem('celebrations-demo-shared-pages-v1');
    });
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('button[data-tab="pages"]').click();
    await page.locator('.canvas .block[data-id="'+initialBlockId+'"] .ed').waitFor();
    assert.equal(await page.locator('.canvas .block[data-id="'+initialBlockId+'"] .ed').innerText(),
      savedSentinel,'Reload did not use actual persisted mock R2 data');
    // Stale edits must be rejected by the real API without replacing server data.
    const staleBody={celebration:'101',expectedRevision:1,record:basicRecord,
      plans:[],shared:initialShared};
    const denied=await handleServerDraft(new Request(ORIGIN+'/api/editor-open-draft',{
      method:'POST',headers:{cookie:AUTH,origin:ORIGIN,'content-type':'application/json'},
      body:JSON.stringify(staleBody)
    }),env);
    assert.equal(denied.status,409,'Revision conflict did not protect the editor');
   }else{
    const visible=await editable.innerText();
    assert.equal(visible,savedSentinel,'Second browser cannot see persisted first-browser edit');
    await page.locator('[data-tab="media"]').click();
    await page.locator('.file-category-tabs').waitFor({state:'attached'});
    assert.ok((await page.locator('.file-category-tabs button').count())>=3);
   }
   assert.deepEqual(errors,[],label+' editor JavaScript errors');
   const widthInfo=await page.evaluate(()=>({viewport:innerWidth,
     document:document.documentElement.scrollWidth}));
   assert.ok(widthInfo.document<=widthInfo.viewport+1,label+' overflow');
   console.log('M04_REAL_HANDLERS_SYNTHETIC_BROWSER_PASS '+JSON.stringify({
      viewport:label,width,saveOrSync:label==='desktop'?'save-reload-conflict':'cross-device-and-media',
      revisions:snapshot.version,sqlQueries:sqlQueries.length,errors:0,
      environment:'synthetic-r2-d1',liveRemoteWrites:0}));
  }finally{await page.close();await context.close()}
 }
 // The REAL publication GET handler must return only the PUBLIC snapshot.
 const currentPublic=await handleEditorPublication(new Request(
   ORIGIN+'/api/editor-publication?celebration=101'),env);
 const published=await currentPublic.json();
 assert.equal(published.shared.pages[0].blocks[1].text,savedSentinel,
   'Enregistrer on an ALREADY published page must update the live copy as designed');
 assert.ok(!JSON.stringify(published.shared.pages).includes('Texte privé M4'),
   'An unapproved DRAFT page may never appear publicly');
 // Explicitly publishing a previously private page must be authorized.
 const action=await handleEditorPublication(new Request(ORIGIN+'/api/editor-publication',{
   method:'POST',headers:{cookie:AUTH,origin:ORIGIN,'content-type':'application/json'},
   body:JSON.stringify({celebration:'101',expectedRevision:snapshot.version,
     kind:'page',pageId:PRIVATE_PAGE_ID,visibility:'published'})
 }),env);
 assert.equal(action.status,200,'Real authenticated publication handler rejected synthetic page');
 const nowPublished=await handleEditorPublication(new Request(
   ORIGIN+'/api/editor-publication?celebration=101'),env);
 const publicData=await nowPublished.json();
 assert.ok(JSON.stringify(publicData.shared.pages).includes('Texte privé M4'),
   'Explicitly approved private page did not reach REAL public API handler');
 console.log('M04_PUBLICATION_PRIVATE_DRAFT_GATE_PASS '+JSON.stringify({
  existingPublishedPageUpdatedOnSave:true,unpublishedDraftHiddenUntilApproval:true,
  afterExplicitPublicationVisible:true,
  conflictsRefused:true,backendWritesOnlyInMemory:putOps,backendReadsOnlyInMemory:readOps,
  serverPosts:serverPost,serverGets:serverGet,blockedUnexpectedMutations:blocked,
  externalRequests:external,liveD1Writes:0,liveR2Writes:0}));
 assert.equal(external,0,'Fixture attempted external browser network access');
}finally{await browser.close()}
