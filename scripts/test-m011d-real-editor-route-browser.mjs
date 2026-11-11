// M011-D: Chromium against HTML produced by the REAL current visual editor.
// Local HTTP only, no remote host and no D1/R2 writes. The missing M011-C tab
// is a confirmed blocker, not a mock that passes as a working integration.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {handlePreparationDemo} from '../migration/cloudflare/editor-demo-preparation-page.mjs';
const DB={
 prepare(sql){return {bind(){return {async all(){
  return {results:sql.includes('FROM celebrations_celebrations')?
    [{id:41,archangel:'Gabriel',year:'2026',status:'published'}]:[]};
 }}}}}
};
const r=await handlePreparationDemo(
 new Request('https://www.ronde-des-archanges-universelle.eu/__editor/demo-preparation'),
 {DB}
);
assert.equal(r.status,200);
const html=await r.text();
assert.match(html,/data-tab="celebrations"/);
assert.doesNotMatch(html,/admin-member-spaces-bridge\.js|data-admin="members-spaces"/);
const server=createServer((req,res)=>{
 if(req.url==='/'||req.url?.startsWith('/?')){
  res.writeHead(200,{'content-type':'text/html; charset=utf-8'}).end(html);
 }else res.writeHead(404).end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true});
 for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:850},
   isMobile:width<500,hasTouch:width<500});
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='127.0.0.1')return route.continue();
   return route.abort('blockedbyclient');
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('[data-tab="celebrations"]').count(),1);
  assert.equal(await page.locator('[data-admin="members-spaces"]').count(),0);
  assert.equal(await page.locator('#workspace').count(),1);
  console.log('M011D_REAL_EDITOR_CHROMIUM_'+width+
    '_PRESENT_NO_MEMBER_TAB_BLOCKING');
  await page.close();
 }
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
