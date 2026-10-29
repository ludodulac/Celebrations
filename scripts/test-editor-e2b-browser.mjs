// E2B - browser test on fictional local data only. No production or staging writes.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {E1_CLIENT} from '../migration/cloudflare/editor-e1-client.mjs';
const pageSource=readFileSync(new URL('../migration/cloudflare/editor-e1-page.mjs',import.meta.url),'utf8');
const css=pageSource.match(/const css=\x60([\s\S]*?)\x60;/)?.[1];
assert.ok(css,'Missing actual editor stylesheet');
const renderer=readFileSync(new URL('../migration/cloudflare/editor-d-preview.mjs',import.meta.url),'utf8');
assert.match(renderer,/d\.e1\?\.text\?\?d\.text/,'Persisted text overlay must be rendered');
const initial={heading:'Titre historique fictif',subtitle:'Description historique',banner:'Bannière fictive',button_label:'Accéder',button_href:'/__editor/preview?key=home',hero_image_id:''};
let data=structuredClone(initial),paragraphs=[],version=1,saves=0;
const htmlEscape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function pageHtml(){
 const blocks=paragraphs.map(p=>'<div class="d-block" data-kind="text" data-editor-block="'+p.id+'"><p>'+htmlEscape(p.e1?.text??p.text)+'</p></div>').join('');
 return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+
 '*{box-sizing:border-box}body{font:16px Arial;line-height:1.5;margin:0}.d-content{display:grid;gap:18px;margin:24px 12px}'+css+'</style></head><body class="d-home">'+
 '<div class="e1-toolbar"><button id="e1-pages">Pages</button><button id="e1-edit" disabled>Modifier cette page</button><button id="e1-save" disabled>Enregistrer</button><button id="e2a-add" hidden>+ Ajouter un bloc</button><button id="e1-cancel" disabled>Annuler</button><button id="e1-history">Versions</button><p id="e1-status">Chargement</p></div>'+
 '<div id="e2a-choice" hidden><button id="e2a-paragraph">Paragraphe</button></div><div id="e1-page-menu" hidden></div>'+
 '<div id="e1-picture" hidden><select id="e1-image-choices"><option value="">Image existante</option></select></div>'+
 '<div id="e1-history-panel" hidden><select id="e1-versions"></select><button id="e1-restore">Restaurer</button></div>'+
 '<div id="e1-button-box" hidden><input id="e1-button-text"><input id="e1-button-url"><button id="e1-button-apply">Valider</button><button id="e1-button-cancel">Annuler</button></div>'+
 '<section class="d-content"><div class="d-home-banner">'+htmlEscape(data.banner)+'</div><section class="d-welcome"><h1>'+htmlEscape(data.heading)+'</h1><p>'+htmlEscape(data.subtitle)+'</p><img alt="fictif"><div class="d-welcome-actions"><a href="'+htmlEscape(data.button_href)+'">'+htmlEscape(data.button_label)+'</a></div></section>'+blocks+'</section>'+
 '<script defer src="/__editor/e1-client.js"></script></body></html>';
}
function answer(res,content,status=200,type='application/json'){
 res.writeHead(status,{'content-type':type,'cache-control':'no-store'});
 res.end(type==='application/json'?JSON.stringify(content):content);
}
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/__editor/edit')return answer(res,pageHtml(),200,'text/html');
 if(u.pathname==='/__editor/e1-client.js')return answer(res,E1_CLIENT,200,'application/javascript');
 if(u.pathname==='/api/editor-e1'&&req.method==='GET'){
  if(u.searchParams.get('action')==='images')return answer(res,{ok:true,images:[]});
  return answer(res,{ok:true,key:'home',version,editable:[
   {id:'legacy-home',kind:'static_html_snapshot',values:structuredClone(data)},
   ...paragraphs.map(p=>({id:p.id,kind:'text',values:{text:p.e1?.text??p.text}}))]});
 }
 if(u.pathname==='/api/editor-e1'&&req.method==='POST'){
  let raw='';for await(const chunk of req)raw+=chunk;
  const p=JSON.parse(raw);
  if(p.action!=='save'||p.key!=='home'||p.expected_version!==version)return answer(res,{error:'Conflit'},409);
  for(const change of p.changes||[]){
   if(change.id==='legacy-home')Object.assign(data,change.values);
   else{const paragraph=paragraphs.find(x=>x.id===change.id);if(!paragraph)return answer(res,{error:'Bloc inconnu'},400);paragraph.e1={text:change.values.text};}
  }
  if(p.paragraph_text)paragraphs.push({id:'fictive-'+(paragraphs.length+1),text:p.paragraph_text});
  version++;saves++;return answer(res,{ok:true,version,published:false});
 }
 return answer(res,'Not Found',404,'text/plain');
});
server.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true});
try{
 for(const device of [{name:'desktop',width:1366,height:768,mobile:false},{name:'phone',width:390,height:844,mobile:true}]){
  data=structuredClone(initial);paragraphs=[];version=1;saves=0;
  const context=await browser.newContext({viewport:{width:device.width,height:device.height},isMobile:device.mobile,hasTouch:device.mobile});
  await context.addInitScript(()=>localStorage.setItem('celebrations-admin-token','fake-token'));
  const page=await context.newPage();
  await page.goto(origin+'/__editor/edit?key=home');
  await page.locator('#e1-edit:not([disabled])').waitFor();
  await page.locator('#e1-edit').click();
  await page.locator('#e2a-add').click();
  await page.locator('#e2a-paragraph').click();
  const fresh=page.locator('.d-content > .e2a-new > p');
  await fresh.fill('Paragraphe fictif '+device.name);
  async function natural(wrapper){
   const s=await wrapper.evaluate(el=>{
    const e=getComputedStyle(el),p=getComputedStyle(el.querySelector('p'));
    return {border:e.borderTopWidth,background:e.backgroundColor,shadow:e.boxShadow,padding:e.paddingTop,margin:e.marginTop,paragraphMargin:p.marginTop,overflow:document.documentElement.scrollWidth>innerWidth+2};
   });
   assert.equal(s.border,'0px');assert.ok(s.background==='rgba(0, 0, 0, 0)'||s.background==='transparent');
   assert.equal(s.shadow,'none');assert.equal(s.padding,'0px');assert.equal(s.margin,'0px');assert.equal(s.paragraphMargin,'0px');
   assert.equal(s.overflow,false,'No horizontal overflow');
  }
  await natural(page.locator('.e2a-new'));
  await page.locator('#e1-save').click();
  const saved=page.locator('.d-block[data-kind="text"] > p');
  await saved.waitFor();
  assert.equal(await saved.innerText(),'Paragraphe fictif '+device.name);
  await natural(page.locator('.d-block[data-kind="text"]'));
  assert.equal(await saved.getAttribute('contenteditable'),null,'No edit outline outside editing');
  await page.locator('#e1-edit:not([disabled])').waitFor();
  await page.locator('#e1-edit').click();
  assert.equal(await saved.getAttribute('contenteditable'),'true','Re-loaded paragraph must be editable');
  if(device.mobile)await saved.tap();else await saved.click();
  await saved.fill('Paragraphe corrigé '+device.name);
  await page.locator('#e1-save').click();
  await page.locator('#e1-edit:not([disabled])').waitFor();
  assert.equal(await page.locator('.d-block[data-kind="text"] > p').innerText(),'Paragraphe corrigé '+device.name);
  await natural(page.locator('.d-block[data-kind="text"]'));
  assert.equal(saves,2,'Add and subsequent edit must be saved');
  assert.deepEqual(data,initial,'Historical content must not be changed');
  console.log('MISSION_E2B_CHROMIUM_PASS '+device.name+' add_save_reload_edit_save=true unboxed=true original_intact=true');
  await context.close();
 }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
