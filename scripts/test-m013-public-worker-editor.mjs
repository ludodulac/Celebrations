// M013 — production entrypoint, actual local D1/R2; no network or remote credentials.
// Official hostname is ONLY a virtual HTTP origin intercepted by a fresh Chromium
// context. The browser resolver also denies all real DNS; Miniflare owns every response.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Miniflare} from 'miniflare';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {schemaFiles,schema,flags,signedEditorCookie} from '../tests/fixtures/m012a-editor-session-http.mjs';
const ORIGIN='https://ronde-des-archanges-universelle.eu';
const demo=process.argv.includes('--demo');
const temp=await mkdtemp(join(tmpdir(),'celebrations-m013-'));
let mf,browser;
try{
 const outfile=join(temp,'worker.mjs');
 await build({entryPoints:['migration/cloudflare/production-worker.mjs'],bundle:true,platform:'node',format:'esm',target:'es2022',outfile,external:['node:*']});
 mf=new Miniflare({modules:true,modulesRoot:temp,scriptPath:outfile,compatibilityDate:'2026-08-06',
  compatibilityFlags:['nodejs_compat'],bindings:{ADMIN_PASSWORD_HASH:flags.ADMIN_PASSWORD_HASH,ADMIN_PASSWORD_SALT:flags.ADMIN_PASSWORD_SALT},
  d1Databases:{DB:'11111111-1111-4111-8111-111111111111'},d1Persist:false,
  r2Buckets:{EDITOR_BUCKET:'m013-editor-local',MEDIA_BUCKET:'m013-media-local'},r2Persist:false,port:0});
 const db=await mf.getD1Database('DB');
 for(const file of [...schemaFiles,'d1-migrations/20261111_012c_private_release_fences.sql']){
  let sql='';
  for(const line of schema(file).split('\n')){
   if(!line.trim()||line.trimStart().startsWith('--'))continue;
   sql+=(sql?'\n':'')+line;
   if(!line.trimEnd().endsWith(';'))continue;
   if(/^CREATE TRIGGER/i.test(sql)&&!/\bEND;\s*$/i.test(sql))continue;
   await db.prepare(sql).run();sql='';
  }
  assert.equal(sql,'','unfinished schema: '+file);
 }
 await db.prepare('INSERT INTO celebrations_celebrations(id,archangel,year,status) VALUES(?,?,?,?)').bind(41,'Gabriel','2026','published').run();
 const cookie=signedEditorCookie(),cookieValue=cookie.split('=')[1];
 const local=(path,{method='GET',body,admin=false,origin=ORIGIN,headers={}}={})=>mf.dispatchFetch(ORIGIN+path,{method,headers:{...(admin?{cookie}:{}),...(method==='POST'?{origin}:{}),...headers},...(body===undefined?{}:{body})});
 const draftPath='/api/editor-open-draft?celebration=';
 assert.equal((await local(draftPath+'41')).status,401);
 assert.equal((await local('/api/editor-publication',{method:'POST',admin:true,origin:'https://other.test',body:'{}',headers:{'content-type':'application/json'}})).status,403);
 assert.equal((await local('/api/admin/private-editor?celebration=41',{admin:true})).status,404);
 browser=await chromium.launch({headless:!demo,args:['--host-resolver-rules=MAP * ~NOTFOUND','--disable-background-networking']});
 async function context(admin,width){
  const ctx=await browser.newContext({viewport:{width,height:850},serviceWorkers:'block'});
  // Includes popups and new tabs. No request can continue to the internet.
  await ctx.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!==ORIGIN)return route.abort();
   const headers=await req.allHeaders();
   const result=await mf.dispatchFetch(url.href,{method:req.method(),headers,...(req.method()==='POST'?{body:req.postDataBuffer()}: {})});
   await route.fulfill({status:result.status,headers:Object.fromEntries(result.headers),body:Buffer.from(await result.arrayBuffer())});
  });
  if(admin)await ctx.addCookies([{name:'celebrations_editor_access',value:cookieValue,url:ORIGIN,httpOnly:true,secure:true,sameSite:'Lax'}]);
  return ctx;
 }
 const ctx=await context(true,1440),page=await ctx.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 page.setDefaultTimeout(20000);
 const tab=key=>page.locator('[data-tab="'+key+'"]');
 const button=name=>page.getByRole('button',{name,exact:true});
 const status=page.locator('#status');
 const saved=()=>page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('contenu revérifié après enregistrement'));
 await page.goto(ORIGIN+'/__editor/demo-preparation?celebration=41&tab=celebrations');
 await page.locator('.new-celebration summary').waitFor();
 if(demo){
  console.log('DÉMONSTRATION LOCALE UNIQUEMENT – aucun accès réseau. Adresse virtuelle, données fictives, cookie synthétique. Fermez Chromium pour arrêter.');
  await new Promise(resolve=>page.once('close',resolve));
 }else{
  await page.locator('.new-celebration summary').click();
  await page.getByLabel('Date du mercredi').fill('2027-04-07');
  await page.getByRole('button',{name:/^Créer /}).click();
  await page.waitForURL(/celebration=plan-/);
  const cid=new URL(page.url()).searchParams.get('celebration');
  assert.match(cid,/^plan-/);
  await page.getByLabel('Titre de la célébration').fill('Célébration M013 fictive');
  await page.getByLabel('Titre de la célébration').blur();
  await page.locator('#workspace .list .item').filter({hasText:'Mercredi'}).click();
  await page.getByLabel('Heure du mercredi').fill('09:30');
  await page.locator('#save-btn').click();await saved();
  const draft=await (await local(draftPath+cid,{admin:true})).json();
  assert.ok(draft.plans.some(p=>p.id===cid&&p.title==='Célébration M013 fictive'));
  assert.equal(draft.record.celebrationTimes.mercredi,'09:30');
  assert.equal((await (await local('/api/editor-publication?celebration='+cid)).json()).celebrationVisible,false);
  await tab('pages').click();
  page.once('dialog',d=>d.accept('Page M013 privée au brouillon'));
  await button('＋ Page').first().click();await saved();
  const row=page.locator('.general-page-row').filter({hasText:'Page M013 privée au brouillon'});
  await row.waitFor();
  const firstDraft=await (await local(draftPath+cid,{admin:true})).json();
  const newPage=firstDraft.shared.pages.find(p=>p.name==='Page M013 privée au brouillon');
  assert.ok(newPage);
  assert.ok(!(await (await local('/api/editor-publication?celebration='+cid)).json()).shared.pages.some(p=>p.id===newPage.id));
  await page.locator('#preview-btn').click();
  assert.ok(await page.locator('.canvas').isVisible());
  await page.locator('#preview-btn').click();
  await row.locator('.page-options summary').click();await row.getByRole('button',{name:'Publier',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Publié'));
  assert.ok((await (await local('/api/editor-publication?celebration='+cid)).json()).shared.pages.some(p=>p.id===newPage.id));
  await tab('celebrations').click();
  await page.locator('.celebration-publication-controls').getByRole('button',{name:'Publier',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Publié'));
  assert.equal((await (await local('/api/editor-publication?celebration='+cid)).json()).celebrationVisible,true);
  await tab('media').click();
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRKsAAAAASUVORK5CYII=','base64');
  await page.locator('#asset-file-picker').setInputFiles([
   {name:'m013.png',mimeType:'image/png',buffer:png},
   {name:'m013.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%%EOF\n')},
   {name:'m013.txt',mimeType:'text/plain',buffer:Buffer.from('Document fictif')},
   {name:'m013.mp3',mimeType:'audio/mpeg',buffer:Buffer.from('ID3\x04\x00\x00\x00\x00\x00\x00')},
  ]);
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('4 fichier(s) conservé(s) sur le serveur'));
  const media=await (await local('/api/editor-media',{admin:true})).json();
  for(const type of ['image','pdf','file','audio']){
   const item=media.items.find(x=>x.type===type&&x.name.startsWith('m013.'));
   assert.ok(item,type+' upload');
   assert.equal((await local(item.src)).status,404,'unpublished '+type);
   const authorised=await local(item.src,{admin:true});assert.equal(authorised.status,200);
   if(type==='file')assert.equal(authorised.headers.get('content-disposition'),'attachment');
  }
  await page.locator('[data-file-category="autres"]').click();
  await page.locator('.global-media-card').filter({hasText:'m013.txt'}).waitFor();
  const videoAnswers=['https://www.youtube.com/watch?v=abcdefghijk','1','Vidéo M013'];
  const answer=d=>void d.accept(videoAnswers.shift()||'');
  page.on('dialog',answer);
  await button('＋ Référencer un média externe').click();
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Lien conservé'));
  page.off('dialog',answer);
  assert.ok((await (await local('/api/editor-media',{admin:true})).json()).items.some(x=>x.name==='Vidéo M013'));
  // Publish one uploaded document via the existing explicit general-media command.
  const doc=media.items.find(x=>x.name==='m013.txt');
  const latest=await (await local(draftPath+cid,{admin:true})).json();
  const release=await local('/api/editor-publication',{method:'POST',admin:true,headers:{'content-type':'application/json'},body:JSON.stringify({kind:'media',celebration:cid,expectedRevision:latest.revision,mediaId:doc.id,general:true})});
  assert.equal(release.status,200,await release.text());
  const publicDoc=await local(doc.src);assert.equal(publicDoc.status,200);assert.equal(publicDoc.headers.get('content-disposition'),'attachment');
  assert.equal(await publicDoc.text(),'Document fictif');
  // Fresh anonymous mobile context, real visitor route, never admin/localStorage.
  const visitor=await context(false,390),vp=await visitor.newPage();
  vp.on('pageerror',e=>errors.push(String(e)));
  await vp.goto(ORIGIN+'/__editor/voir-le-site?celebration='+cid);
  await vp.locator('#menu-toggle').waitFor();
  await vp.locator('#menu-toggle').click();
  assert.ok(await vp.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth<=1));
  assert.match(await vp.locator('body').innerText(),/Page M013 privée au brouillon/);
  await visitor.close();
  await page.reload();await page.locator('#status').waitFor();
  assert.equal((await (await local(draftPath+cid,{admin:true})).json()).record.celebrationTimes.mercredi,'09:30');
  assert.deepEqual(errors,[]);
  console.log('M013_PUBLIC_REAL_WORKER_D1_R2_PASS');
 }
}finally{await browser?.close();await mf?.dispose();await rm(temp,{recursive:true,force:true})}
