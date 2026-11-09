// M17: measured first-editor-render parity against immutable M16 checkout.
// Both handlers render synthetic D1-only data, and Chromium blocks ALL network
// requests except in-memory fixture responses. Never Cloudflare or real users.
// Timings are indicative CI measurements, not real production Web Vitals.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {handlePreparationDemo as candidate,STAGES} from '../migration/cloudflare/editor-demo-preparation-page.mjs';
import {handlePreparationDemo as previous} from '../_m17_baseline/migration/cloudflare/editor-demo-preparation-page.mjs';
const HOST='https://celebrations-exit-staging.rondes.workers.dev';
const steps=STAGES.map((x,i)=>({id:200+i,celebration_id:101,
 label:x.label,step_key:x.slug+'-101',start_date:'2026-10-07',end_date:null,
 body_text:i===2?'Texte fictif du mercredi':'Contenu synthétique '+x.label}));
const synthetic={
 celebrations:[{id:101,archangel:'Michaël',year:'2026',status:'active'}],
 steps,events:[],eventContents:[],stepContents:[],links:[]
};
function env(){
 const stats={read:0,write:0};
 const db={prepare(sql){
  assert.ok(sql.trim().startsWith('SELECT '),'No D1 write can occur');
  return {bind(){return {async all(){
   stats.read++;
   if(sql.includes('FROM celebrations_celebrations'))return {results:synthetic.celebrations};
   if(sql.includes('FROM celebrations_steps'))return {results:synthetic.steps};
   if(sql.includes('FROM celebrations_events WHERE'))return {results:synthetic.events};
   if(sql.includes('FROM celebrations_event_contents'))return {results:synthetic.eventContents};
   if(sql.includes('FROM celebrations_step_contents'))return {results:synthetic.stepContents};
   if(sql.includes('FROM celebrations_links'))return {results:synthetic.links};
   if(sql.includes("FROM celebrations_contents WHERE audience='all'"))return {results:[]};
   throw Error('Unexpected SQL '+sql);
  }}}};
 }};
 return {DB:db,stats};
}
const URL=HOST+'/__editor/demo-preparation?celebration=101';
async function build(fn){
 const e=env();
 const t0=performance.now();
 const result=await fn(new Request(URL),e);
 assert.equal(result.status,200);
 const html=await result.text();
 return {html,generateMs:performance.now()-t0,queries:e.stats.read};
}
const old=await build(previous),now=await build(candidate);
const fix=html=>html.replace(/nonce="[0-9a-f]{32}"/g,'nonce="CSP"');
assert.equal(fix(old.html),fix(now.html),
 'The full admin HTML and JS/CSS must be identical to M16 excluding random CSP nonce');
assert.equal(old.queries,now.queries,'No increase in synthetic D1 query count');
const bytes=Buffer.byteLength(now.html);
const digest=createHash('sha256').update(fix(now.html)).digest('hex');
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const summary=[];
const median=values=>{const s=[...values].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]};
try{
 for(const [form,width,height,mobile] of [
  ['ordinateur',1280,840,false],['telephone',390,844,true]
 ]){
  const options={viewport:{width,height},isMobile:mobile,hasTouch:mobile,
   serviceWorkers:'block',reducedMotion:'reduce',locale:'fr-FR'};
  const metrics={};
  for(const [version,html] of [['M16',old.html],['M17',now.html]]){
   const durations=[],sizes=[];let outside=0,jsErrors=0,writes=0;
   for(let n=0;n<5;n++){
    const ctx=await browser.newContext(options);
    const page=await ctx.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror',()=>{jsErrors++});
    await page.route('**/*',route=>{
     const req=route.request(),loc=new URL(req.url()),verb=req.method();
     if(loc.origin!==HOST){outside++;return route.abort('blockedbyclient')}
     if(loc.pathname==='/__editor/demo-preparation'&&verb==='GET')
      return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html});
     if(loc.pathname==='/api/editor-open-draft'&&verb==='GET')
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
       ok:true,revision:0,record:null,plans:[],shared:{pages:[],homeId:''},
       mediaCatalogue:[]})});
     if(loc.pathname==='/api/editor-media'&&verb==='GET')
      return route.fulfill({status:200,contentType:'application/json',
       body:JSON.stringify({ok:true,items:[],media:[]})});
     if(verb!=='GET'&&verb!=='HEAD'){writes++;
      return route.fulfill({status:405,body:'M17: mutation blocked'})}
     return route.fulfill({status:404,body:'Local fixture only'});
    });
    await page.goto(URL,{waitUntil:'domcontentloaded'});
    await page.locator('.canvas>.block').first().waitFor({state:'visible'});
    const value=await page.evaluate(()=>({
     ms:performance.now(),blocks:document.querySelectorAll('.canvas>.block').length,
     stages:document.querySelectorAll('.stage-editor .list .item').length,
     overflow:document.documentElement.scrollWidth>innerWidth+1
    }));
    assert.ok(value.blocks>0);
    assert.ok(value.stages>=7);
    assert.equal(value.overflow,false);
    durations.push(value.ms);
    sizes.push({blocks:value.blocks,stages:value.stages});
    await ctx.close();
   }
   assert.equal(jsErrors,0);
   assert.equal(writes,0);
   assert.equal(outside,0);
   assert.ok(sizes.every(x=>x.blocks===sizes[0].blocks&&x.stages===sizes[0].stages));
   metrics[version]={medianFirstRenderMs:+median(durations).toFixed(2),
    minMs:+Math.min(...durations).toFixed(2),
    maxMs:+Math.max(...durations).toFixed(2),...sizes[0]};
  }
  assert.equal(metrics.M16.blocks,metrics.M17.blocks);
  assert.equal(metrics.M16.stages,metrics.M17.stages);
  summary.push({form,width,height,...metrics});
  console.log('M17_EDITOR_FIRST_RENDER_COMPARE '+JSON.stringify({
   form,width,height,old:metrics.M16,new:metrics.M17,
   htmlBytes:bytes,queries:now.queries,sameHtml:true,mutationRequests:0,
   productionRequests:0,jsErrors:0}));
 }
}finally{await browser.close()}
console.log('M17_EDITOR_HTML_PARITY '+JSON.stringify({
 baselineSha:'bff3f17f010e8cf217ea76dcc856804bdf8ceab6',
 htmlBytes:bytes,normalizedSha256:digest,sqlReadCount:old.queries,
 desktopAndMobileMeasured:summary.length,synthetic:true}));
