// E2A: real Chromium on a fully fictitious in-memory page. Never connects to
// Cloudflare or writes to any celebration's historical content.
import assert from 'node:assert/strict';
import http from 'node:http';
import {chromium} from 'playwright';
import {E1_CLIENT} from '../migration/cloudflare/editor-e1-client.mjs';
const escaped=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let saved='',version=1,requests=0;
const html=()=>`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>
<div class="e1-toolbar">
<button id="e1-pages">Pages</button><button id="e1-edit" disabled>Modifier cette page</button>
<button id="e1-save" disabled>Enregistrer</button>
<button id="e2a-add" hidden>+ Ajouter un bloc</button>
<button id="e1-cancel" disabled>Annuler</button>
<button id="e1-history">Versions</button>
<p id="e1-status"></p></div>
<div id="e2a-choice" hidden><button id="e2a-paragraph">Paragraphe</button></div>
<div id="e1-page-menu" hidden></div>
<div id="e1-picture" hidden><select id="e1-image-choices"><option value="">Conserver</option></select></div>
<div id="e1-history-panel" hidden><select id="e1-versions"></select><button id="e1-restore">Restaurer</button></div>
<div id="e1-button-box" hidden><input id="e1-button-text"><input id="e1-button-url"><button id="e1-button-apply">Valider</button><button id="e1-button-cancel">Annuler</button></div>
<section class="d-content"><div class="d-home-banner">Bandeau fictif</div>
<section class="d-welcome"><h1>Accueil fictif</h1><p>Bienvenue</p><img src="" alt="">
<div class="d-welcome-actions"><a href="/__editor/preview?key=celebration%3A101">Accéder aux célébrations</a></div></section>
<div class="d-block" data-kind="static_html_snapshot" data-editor-block="historical-fake"></div>
${saved?'<div class="d-block" data-kind="text" data-editor-block="new-fake"><p>'+escaped(saved)+'</p></div>':''}
</section><script src="/client.js"></script></body></html>`;
const data=()=>({ok:true,key:'home',version,published:false,editable:[{
 id:'historical-fake',kind:'static_html_snapshot',values:{
 heading:'Accueil fictif',subtitle:'Bienvenue',banner:'Bandeau fictif',
 button_label:'Accéder aux célébrations',button_href:'/__editor/preview?key=celebration%3A101',hero_image_id:''
 }
}]});
const srv=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');
 res.setHeader('content-type',u.pathname==='/client.js'?'application/javascript':u.pathname==='/api/editor-e1'?'application/json':'text/html');
 if(u.pathname==='/client.js'){res.end(E1_CLIENT);return}
 if(u.pathname==='/api/editor-e1'&&req.method==='GET'){
  res.end(JSON.stringify(u.searchParams.get('action')==='images'?{ok:true,images:[]}:data()));return;
 }
 if(u.pathname==='/api/editor-e1'&&req.method==='POST'){
  let raw='';req.on('data',b=>raw+=b);req.on('end',()=>{
   const body=JSON.parse(raw);assert.equal(body.key,'home');
   assert.equal(body.action,'save');assert.equal(body.expected_version,version);
   assert.deepEqual(body.changes,[]);
   assert.equal(typeof body.paragraph_text,'string');
   saved=body.paragraph_text;version++;requests++;
   res.end(JSON.stringify({ok:true,version,published:false}));
  });return;
 }
 if(u.pathname==='/__editor/edit'){res.end(html());return}
 res.statusCode=404;res.end('not found');
});
srv.listen(0,'127.0.0.1');await new Promise(r=>srv.once('listening',r));
const addr=srv.address(),base='http://127.0.0.1:'+addr.port;
const browser=await chromium.launch({headless:true});
try{
 for(const viewport of [{width:1366,height:768},{width:390,height:844}]){
  const context=await browser.newContext({viewport});
  await context.addInitScript(()=>localStorage.setItem('celebrations-admin-token','fictional-token'));
  const page=await context.newPage();
  await page.goto(base+'/__editor/edit?key=home');
  await page.locator('#e1-edit:enabled').waitFor();
  await page.locator('#e1-edit').click();
  await page.locator('#e2a-add').click();
  assert.equal(await page.locator('#e2a-paragraph').isVisible(),true);
  await page.locator('#e2a-paragraph').click();
  await page.locator('.e2a-new p').fill('À annuler');
  await page.locator('#e1-cancel').click();
  assert.equal(await page.locator('.e2a-new').count(),0,'Cancel must remove unsaved paragraph');
  assert.equal(requests,viewport.width===1366?0:1,'Cancel must never call server');
  await page.locator('#e1-edit').click();
  await page.locator('#e2a-add').click();await page.locator('#e2a-paragraph').click();
  const expected='Paragraphe fictif '+viewport.width;
  await page.locator('.e2a-new p').fill(expected);
  await page.locator('#e1-save').click();
  await page.waitForFunction(txt=>document.querySelector('.d-block[data-kind="text"] p')?.textContent===txt,expected,{timeout:15000});
  await page.reload();
  assert.equal(await page.locator('.d-block[data-kind="text"] p').textContent(),expected,'Reload must retain paragraph');
  assert.equal(requests,viewport.width===1366?1:2);
  console.log('MISSION_E2A_FICTIVE_CHROMIUM_PASS viewport='+viewport.width+' cancel=true save=true reload=true');
  await context.close();
 }
}finally{await browser.close();await new Promise(r=>srv.close(r))}
