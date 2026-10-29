// Mission D3: identify failing image using actual browser, ACL and R2 HEAD; also inspect five representative screens: functional + visual parity inspection: screenshots retained in runner RAM only.
// Public GitHub artifacts MUST NOT expose private drafts or committee content.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const ORIGIN='https://celebrations-exit-staging.rondes.workers.dev';
const auth=process.env.EDITOR_D_PREVIEW_TOKEN;
const cloudflare=process.env.CLOUDFLARE_API_TOKEN;
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
const d1='0f761662-241f-42cc-ac94-5c68b4aa7797';
assert.ok(auth&&auth.length>=48,'Preview test secret missing');
assert.match(account||'',/^[a-f0-9]{32}$/i);

async function sql(query){
 assert.match(query.trim(),/^SELECT\s/i);
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database/'+d1+'/query',{
  method:'POST',headers:{Authorization:'Bearer '+cloudflare,'Content-Type':'application/json'},body:JSON.stringify({sql:query})});
 assert.equal(r.status,200,'Staging D1 inspection unavailable');
 const data=await r.json();assert.equal(data.success,true);
 return data.result?.[0]?.results||[];
}
const references=await sql('SELECT source_key FROM editor_c_imports ORDER BY source_key');
assert.equal(references.length,47,'Mission C 47 pages must remain present');
const list=references.map(x=>x.source_key);
const celebration=await sql("SELECT id,archangel FROM celebrations_celebrations WHERE status='active' ORDER BY id LIMIT 1");
assert.ok(celebration.length,'No active celebration available');
const id=celebration[0].id;
const browser=await chromium.launch({headless:true});
let viewed=0,shots=0,differences=[],missing=0;const visibleIssues=[];let clickNavPass=0;
function visualDiff(buffer1,buffer2){
 const a=PNG.sync.read(buffer1),b=PNG.sync.read(buffer2);
 const width=Math.min(a.width,b.width),height=Math.min(a.height,b.height);
 let delta=0,over=0;
 for(let y=0;y<height;y+=3)for(let x=0;x<width;x+=3){
  const i=(y*a.width+x)*4,j=(y*b.width+x)*4;
  const v=(Math.abs(a.data[i]-b.data[j])+Math.abs(a.data[i+1]-b.data[j+1])+Math.abs(a.data[i+2]-b.data[j+2]))/3;
  delta+=v;over++;
 }
 return{old_px:a.width+'x'+a.height,new_px:b.width+'x'+b.height,
  avg_rgb_delta:Number((delta/Math.max(over,1)).toFixed(1))};
}
try{
 const plain=await browser.newContext();
 const denied=await plain.request.get(ORIGIN+'/__editor/preview?key=home');
 assert.equal(denied.status(),401,'Nonadmin preview exposed');
 const forbiddenWrite=await plain.request.post(ORIGIN+'/api/editor-b',{
  data:{action:'publish',page_id:'00000000-0000-4000-8000-000000000000',expected_version:1}});
 assert.equal(forbiddenWrite.status(),401,'Unauthenticated publication permitted');
 const root=await plain.request.get(ORIGIN+'/admin.html?staging=1');
 assert.equal(root.status(),200,'Old staging administration broken');
 for(const key of list){
  const r=await plain.request.get(ORIGIN+'/__editor/preview?key='+encodeURIComponent(key),{
   headers:{'x-editor-d-preview-token':auth}});
  if(r.status()!==200){missing++;continue}
  const html=await r.text();
  assert.match(html,/PRÉVISUALISATION ADMINISTRATEUR/,'Missing draft watermark');
  assert.match(r.headers()['content-security-policy']||'',/script-src 'none'/,'CSP script execution not blocked');
  viewed++;
 }
 assert.equal(missing,0,'Unrenderable historic converted pages');
 const cases=[
  ['home','index.html?staging=1'],
  ['celebration:'+id,'index.html?staging=1#celebration-'+id],
  ['celebration:'+id+':step:Mercredi','mercredi/?staging=1'],
  ['bibliotheque','bibliotheque/?staging=1'],
  ['catalogue-part:0','bibliotheque/?staging=1'],
  ['legal:mentions-legales','mentions-legales.html?staging=1']
 ];
 for(const profile of [
  {name:'desktop',viewport:{width:1366,height:768},isMobile:false},
  {name:'mobile',viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1}
 ]){
  const base=await browser.newContext({viewport:profile.viewport,isMobile:profile.isMobile});
  const preview=await browser.newContext({viewport:profile.viewport,isMobile:profile.isMobile,
    extraHTTPHeaders:{'x-editor-d-preview-token':auth}});
  for(const [key,oldPath] of cases){
   const baselinePage=await base.newPage(),newPage=await preview.newPage();
   const old=await baselinePage.goto(ORIGIN+'/'+oldPath,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>null);
   await baselinePage.waitForTimeout(900);
   const newer=await newPage.goto(ORIGIN+'/__editor/preview?key='+encodeURIComponent(key),{waitUntil:'domcontentloaded',timeout:30000});
   assert.equal(newer.status(),200,key+' preview did not load');
   assert.ok(await newPage.locator('main h1').count()>0,'Missing main title: '+key);
   // Visual inspection signals beyond RGB: clipping, image visibility and layout.
   await newPage.waitForTimeout(350);
   // Diagnose images only after trying to load lazily-rendered elements.
   if(key==='celebration:'+id+':step:Mercredi'){
    const images=newPage.locator('main img');
    for(let idx=0;idx<await images.count();idx++){
     const img=images.nth(idx);
     await img.scrollIntoViewIfNeeded().catch(()=>{});
     await img.evaluate(e=>e.decode?.().catch(()=>{})).catch(()=>{});
    }
    await newPage.waitForTimeout(400);
    const broken=await newPage.locator('main img').evaluateAll(nodes=>nodes.filter(i=>i.complete&&i.naturalWidth===0).map(i=>({
     src:i.getAttribute('src'),alt:i.getAttribute('alt')||'',kind:i.closest('.d-block')?.getAttribute('data-kind')||''
    })));
    for(const one of broken){
     let status=0,reason='not-a-preview-media-route',publicName='(hidden)';
     const u=new URL(one.src,ORIGIN);
     const test=await preview.request.get(u.toString()).catch(()=>null);
     if(test)status=test.status();
     if(u.pathname==='/__editor/media'&&u.searchParams.has('id')){
      const q=u.searchParams.get('id');
      const diag=new URL(u);diag.searchParams.set('diagnose','1');
      const resp=await preview.request.get(diag.toString());
      reason=resp.ok()?JSON.stringify(await resp.json()):'diagnostic_status_'+resp.status();
      // Report public names only. Never print private/unlisted filenames in public CI logs.
      const publicRows=await sql("SELECT id,name,storage_path,source_type,content_type,audience FROM celebrations_contents WHERE id='"+String(q).replaceAll("'","''")+"'");
      const c=publicRows[0];
      if(c?.audience==='all')publicName=JSON.stringify({name:c.name,path:c.storage_path,type:c.content_type,source:c.source_type});
     }
     console.log('MISSION_D3_MISSING_IMAGE '+JSON.stringify({device:profile.name,src:one.src,alt:one.alt,kind:one.kind,load_status:status,reason,public_metadata:publicName}));
    }
   }
   const visual=await newPage.evaluate(()=>({
    width:window.innerWidth,document_width:document.documentElement.scrollWidth,
    headings:[...document.querySelectorAll('main h1')].length,
    usable_links:[...document.querySelectorAll('main a[href]')].filter(a=>a.getBoundingClientRect().width>0).length,
    images:document.querySelectorAll('main img').length,
    broken_images:[...document.querySelectorAll('main img')].filter(i=>i.complete&&i.naturalWidth===0).length,
    blocks:document.querySelectorAll('.d-block').length
   }));
   if(visual.document_width>visual.width+3||visual.broken_images)
    visibleIssues.push({device:profile.name,scene:key,horizontal_overflow:visual.document_width-visual.width,broken_images:visual.broken_images});
   if(key==='celebration:'+id){
    const nav=newPage.locator('nav a[href*="key=programme"]:visible').first();
    await nav.click();assert.ok(newPage.url().includes('key=programme'),'Preview navigation does not work');
    clickNavPass++;
    await newPage.goBack({waitUntil:'domcontentloaded'});
   }
      const newImg=await newPage.screenshot({fullPage:false});
   shots++;
   if(old?.ok()){
    const oldImg=await baselinePage.screenshot({fullPage:false});
    shots++;
    const metric=visualDiff(oldImg,newImg);
    differences.push({device:profile.name,scene:key,old_status:old.status(),...metric,...visual});
   }else differences.push({device:profile.name,scene:key,old_status:old?.status()||'unavailable',comparable:false,...visual});
   await baselinePage.close();await newPage.close();
  }
  // Seven canonical stages in new renderer, including Prepa and After.
  for(const name of ['Préparation','Mercredi','Jeudi','Vendredi','Samedi','Dimanche','Après célébration']){
   const p=await preview.newPage();
   const r=await p.goto(ORIGIN+'/__editor/preview?key='+encodeURIComponent('celebration:'+id+':step:'+name));
   assert.equal(r.status(),200,'Stage cannot render: '+name);
   assert.ok(await p.locator('.d-day').count()>0,'Missing date/day block: '+name);
   const img=await p.screenshot({fullPage:false});
   assert.ok(img.length>1000,'Stage screenshot missing: '+name);
   shots++;await p.close();
  }
  await base.close();await preview.close();
 }
 console.log('MISSION_D_BROWSER_PASS displayed_pages='+viewed+' of_47 screenshots_in_memory='+shots+' desktop_mobile=true seven_stages=true admin_original_200=true anonymous_401=true');
 console.log('MISSION_D_VISUAL_DIFFERENCES '+JSON.stringify(differences));
 // Pixel differences document the visual gaps honestly; they are NOT a "pixel-identical" verdict.
 console.log('MISSION_D3_VISUAL_ISSUES '+JSON.stringify(visibleIssues));
 console.log('MISSION_D3_NAVIGATION browser_click_pass='+clickNavPass+' of_2');
 assert.equal(clickNavPass,2,'Navigation links not functional in real browser');
 // A real PDF/document media probe through the new authenticated ID route.
 const items=await sql("SELECT id FROM celebrations_contents WHERE content_type='PDF' AND source_type='file' AND storage_path NOT LIKE 'committee/%' ORDER BY id LIMIT 1");
 if(items.length){
  const res=await plain.request.get(ORIGIN+'/__editor/media?id='+encodeURIComponent(items[0].id),{headers:{'x-editor-d-preview-token':auth}});
  console.log('MISSION_D3_DOCUMENT_PROBE sample_count=1 status='+res.status()+' mime='+(res.headers()['content-type']||'unknown').split(';')[0]);
 }
 const unprivileged=await plain.request.get(ORIGIN+'/__editor/media?id=not-a-real-content');
 assert.equal(unprivileged.status(),401,'Anonymous media gateway access permitted');

 console.log('MISSION_D3_VISUAL_PARITY automated_visual_inspection=true pixel_identical=false manual_screenshot_review_not_claimed=true');
}finally{await browser.close()}

// 34 private screenshots and all visible differences remain local to the job; none are uploaded.
