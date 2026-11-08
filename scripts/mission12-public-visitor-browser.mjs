// M12: real visitor HTML/JS and synthetic server-only published documents.
// Private editor localStorage is deliberately seeded to prove non-interference.
// No network request reaches Cloudflare, D1 or R2.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {handleTrialSite} from '../migration/cloudflare/editor-trial-site-page.mjs';

const HOST='https://celebrations-exit-staging.rondes.workers.dev';
const DIRTY='BROUILLON LOCAL CONFIDENTIEL - NE PAS AFFICHER';
const PUBLIC='Texte publié et vérifié sur le serveur';
const hidden='Cette page reste masquée au visiteur';
const steps=['accueil-celebration','preparation','mercredi','jeudi','vendredi','samedi','dimanche','apres-celebration'];
const data={
 celebrations:[{id:101,archangel:'Michaël',year:'2026',status:'active'}],
 steps:steps.map((step,i)=>({
  id:300+i,celebration_id:101,step_key:step+'-101',
  label:step==='apres-celebration'?'Après célébration':step[0].toUpperCase()+step.slice(1),
  body_text:'Référence publique historique '+step,
  start_date:'2026-10-07',end_date:null
 })),
 events:[],eventContents:[],stepContents:[],links:[]
};
const env={DB:{prepare(sql){
 assert.ok(sql.trim().startsWith('SELECT '));
 return {bind(){return {async all(){
  if(sql.includes('FROM celebrations_celebrations'))return {results:data.celebrations};
  if(sql.includes('FROM celebrations_steps'))return {results:data.steps};
  if(sql.includes('FROM celebrations_events WHERE'))return {results:data.events};
  if(sql.includes('FROM celebrations_event_contents'))return {results:data.eventContents};
  if(sql.includes('FROM celebrations_step_contents'))return {results:data.stepContents};
  if(sql.includes('FROM celebrations_links'))return {results:data.links};
  if(sql.includes("FROM celebrations_contents WHERE audience='all'"))return {results:[]};
  throw Error('Unknown SQL '+sql);
 }}}};
}}};
const rendered=await handleTrialSite(new Request(
 HOST+'/__editor/voir-le-site?celebration=101&page=mercredi'),env);
assert.equal(rendered.status,200);
const html=await rendered.text();
const published={
 ok:true,revision:17,
 record:{pages:[
  {id:'mercredi-101',group:'celebration',name:'Mercredi',visibility:'published',
   blocks:[
    {id:'heading',kind:'heading',text:'Bienvenue',rich:'<strong>Publié</strong>',align:'left'},
    {id:'paragraph',kind:'text',text:PUBLIC,align:'left'},
    {id:'zone',kind:'section',layout:'columns',presentation:'resource',
     columnAlignments:['top','center'],columnButtonLayouts:['stack','row'],
     style:{border:'round',width:2,color:'#aaccee',shadow:true},
     columns:[
      [{id:'image',kind:'image',src:'/media/photo-publique.jpg',text:'Photo publiée',
       widthPct:55,align:'center'}],
      [{id:'doc',kind:'button',href:'/media/programme-publie.pdf',
       text:'Ouvrir le PDF',displayAsButton:true}]
     ]},
    {id:'video',kind:'video',text:'Vidéo publiée',href:'https://youtu.be/dQw4w9WgXcQ',
     cover:'/media/affiche-publique.jpg'},
    {id:'divider',kind:'divider',color:'#345678',thickness:3,widthPct:60},
    {id:'secret-heading',kind:'heading',text:hidden,hideOnSite:true}
   ]},
  {id:'jeudi-101',group:'celebration',visibility:'hidden',name:'Jeudi',
   blocks:[{id:'secret',kind:'text',text:hidden}]}
 ],celebrationDates:{wednesday:'2026-10-07'},celebrationTimes:{mercredi:'18:00'}},
 shared:{homeId:'neutral-accueil-general',pages:[
  {id:'neutral-accueil-general',name:'Accueil',group:'page',visibility:'published',
   blocks:[{id:'home-title',kind:'heading',text:'Bienvenue sur le site'}]},
  {id:'neutral-123e4567-e89b-12d3-a456-426614174000',
   group:'page',visibility:'draft',name:'Page secrète',
   blocks:[{id:'secret-text',kind:'text',text:'Ressource privée'}]}
 ]},plans:[],celebrationVisible:true,celebrationVisibility:{'101':'published'},
 media:[{id:'published',type:'image',name:'Photo publiée',
  src:'/media/photo-publique.jpg',uses:[{pageName:'Mercredi'}]}]
};
const EMPTY_STORAGE={
 page:'celebrations-demo-preparation-101',
 shared:'celebrations-demo-shared-pages-v1',
 plans:'celebrations-demo-planned-v1'
};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const mini=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMbYAAAAASUVORK5CYII=','base64');
let checked=0,failures=0;
try{
 for(const [label,width,height,mobile] of [['ordinateur',1280,880,false],['telephone',390,844,true]]){
  const ctx=await browser.newContext({viewport:{width,height},isMobile:mobile,
   hasTouch:mobile,serviceWorkers:'block',locale:'fr-FR'});
  const tab=await ctx.newPage();
  tab.setDefaultTimeout(10000);
  let badRequests=0,fail=false;const jsErrors=[];
  tab.on('pageerror',e=>jsErrors.push(String(e.message||e)));
  await tab.addInitScript(({KEYS,DIRTY})=>{
   const record={pages:[{id:'mercredi-101',group:'celebration',
    name:'Mercredi',visibility:'published',
    blocks:[{id:'unpublished',kind:'text',text:DIRTY}]}]};
   localStorage.setItem(KEYS.page,JSON.stringify(record));
   localStorage.setItem(KEYS.shared,JSON.stringify({pages:[
    {id:'neutral-accueil-general',group:'page',
     blocks:[{kind:'text',text:DIRTY}]}]}));
   localStorage.setItem(KEYS.plans,JSON.stringify([{id:'plan-michael-2030-11-06',
    visibility:'draft',title:DIRTY}]));
  },{KEYS:EMPTY_STORAGE,DIRTY});
  await tab.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url()),verb=request.method();
   if(u.origin!==HOST){badRequests++;return route.abort('blockedbyclient')}
   if(u.pathname==='/__editor/voir-le-site'&&verb==='GET')
    return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html});
   if(u.pathname==='/api/editor-publication'&&verb==='GET')
    return route.fulfill({status:fail?503:200,contentType:'application/json',
     body:fail?'{"ok":false}':JSON.stringify(published)});
   if(u.pathname.startsWith('/media/'))
    return route.fulfill({status:200,contentType:'image/png',body:mini});
   if(verb!=='GET'&&verb!=='HEAD'){badRequests++;return route.fulfill({status:405,body:'blocked'})}
   return route.fulfill({status:404,body:'Fixture only'});
  });
  try{
   const r=await tab.goto(HOST+'/__editor/voir-le-site?celebration=101&page=mercredi',{waitUntil:'domcontentloaded'});
   assert.equal(r.status(),200);
   await tab.getByText(PUBLIC,{exact:true}).waitFor();
   const view=await tab.evaluate(({KEYS,DIRTY})=>({
    pageText:document.querySelector('#stage-main')?.textContent||'',
    local:localStorage.getItem(KEYS.page),
    shared:localStorage.getItem(KEYS.shared),
    plans:localStorage.getItem(KEYS.plans),
    overflow:document.documentElement.scrollWidth>innerWidth+1,
    activePage:location.search,
    publishedIds:window.__PUBLIC_PAGE_IDS__,
    headings:[...document.querySelectorAll('#stage-main h1,#stage-main h2')].map(x=>x.textContent)
   }),{KEYS:EMPTY_STORAGE,DIRTY});
   assert.ok(view.pageText.includes(PUBLIC));
   assert.ok(!view.pageText.includes(DIRTY));
   assert.ok(!view.pageText.includes(hidden));
   assert.ok(view.local.includes(DIRTY),'Visitor did not overwrite the private draft');
   assert.ok(view.shared.includes(DIRTY),'Visitor did not overwrite the shared editor draft');
   assert.ok(view.plans.includes(DIRTY),'Visitor did not overwrite planned drafts');
   assert.equal(view.publishedIds.includes('jeudi-101'),false);
   assert.equal(view.publishedIds.includes('neutral-123e4567-e89b-12d3-a456-426614174000'),false);
   assert.equal(view.overflow,false,'Responsive site has no horizontal overflow');
   const section=tab.locator('.trial-content-section[data-layout="columns"]');
   assert.equal(await section.count(),1);
   assert.equal(await section.locator('.trial-content-column').count(),2);
   const fig=section.locator('figure.trial-figure');
   assert.equal(await fig.count(),1);
   assert.equal(await fig.evaluate(el=>el.style.width),'55%');
   assert.equal(await section.locator('a[href="/media/programme-publie.pdf"]').count(),1);
   const v=tab.locator('.trial-video');
   assert.equal(await v.getByText('Vidéo publiée',{exact:true}).count(),1);
   assert.equal(await v.locator('.trial-video-title').count(),1);
   assert.equal(await v.locator('.trial-video-trigger').count(),1);
   assert.equal(await v.locator('.trial-video-trigger .trial-video-title').count(),0);
   assert.equal(await tab.locator('hr.trial-custom-divider').count(),1);
   assert.equal(await tab.locator('hr.trial-custom-divider').evaluate(el=>el.style.backgroundColor),
    'rgb(52, 86, 120)');
   assert.equal(await tab.locator('#stage-main strong').filter({hasText:'Publié'}).count(),1);
   assert.equal(await tab.locator('#stage-main script').count(),0);
   // The public gallery shows only files from the public server payload.
   await tab.goto(HOST+'/__editor/voir-le-site?celebration=101&page=mediatheque-generale');
   await tab.getByText('Médiathèque générale',{exact:true}).waitFor();
   assert.ok((await tab.locator('#stage-main').innerText()).includes('Photo publiée'));
   assert.ok(!(await tab.locator('#stage-main').innerText()).includes('Ressource privée'));
   // Server outage: fail closed, never fall back to this device's admin drafts.
   fail=true;
   await tab.goto(HOST+'/__editor/voir-le-site?celebration=101&page=mercredi');
   await tab.getByText('Cette page n’est pas publiée.').waitFor();
   assert.ok(!(await tab.locator('#stage-main').innerText()).includes(DIRTY));
   assert.ok(!(await tab.locator('#stage-main').innerText()).includes(PUBLIC));
   assert.equal((await tab.evaluate(key=>localStorage.getItem(key),EMPTY_STORAGE.page)).includes(DIRTY),true);
   assert.equal(badRequests,0);
   assert.deepEqual(jsErrors,[]);
   checked++;
   console.log('M12_PUBLIC_VISITOR_BROWSER_PASS '+JSON.stringify({
    label,width,columns:2,photoPct:55,pdf:true,video:true,
    hiddenPagesProtected:true,localDraftUnchanged:true,failedServerClosed:true,
    writes:badRequests,jsErrors:jsErrors.length}));
  }catch(e){
   failures++;
   console.error('M12_PUBLIC_VISITOR_BROWSER_FAIL '+label+' '+String(e.stack||e));
  }finally{await tab.close();await ctx.close()}
 }
}finally{await browser.close()}
if(failures||checked!==2)process.exitCode=1;
