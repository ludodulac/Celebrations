// M012-D: Chromium -> actual bundled staging Worker -> local workerd D1 + R2.
// Browser route is a network adapter only; no fabricated API responses, no deployment.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Miniflare} from 'miniflare';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {flags,schemaFiles,schema,ORIGIN,request,login,PARTICIPANT,seedParticipant} from '../tests/fixtures/m012a-editor-session-http.mjs';
import {EDITOR_SNAPSHOT_KEY} from '../migration/cloudflare/app/ports/editor-snapshot-contract.mjs';
const demo=process.argv.includes('--demo');
const temp=await mkdtemp(join(tmpdir(),'celebrations-m012d-'));
let mf,browser;
try{
 const outfile=join(temp,'staging.mjs');
 await build({entryPoints:['migration/cloudflare/staging-worker.mjs'],bundle:true,platform:'node',format:'esm',target:'es2022',outfile,external:['node:*']});
 mf=new Miniflare({modules:true,modulesRoot:temp,scriptPath:outfile,compatibilityDate:'2026-08-06',
  compatibilityFlags:['nodejs_compat'],bindings:flags,
  d1Databases:{DB:'11111111-1111-4111-8111-111111111111'},d1Persist:false,
  r2Buckets:{EDITOR_BUCKET:'isolated-editor',MEDIA_BUCKET:'isolated-media'},r2Persist:false,port:0});
 const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('EDITOR_BUCKET');
 for(const file of [...schemaFiles,'d1-migrations/20261111_012c_private_release_fences.sql']){
  let sql='';
  for(const line of schema(file).split('\n')){
   if(!line.trim()||line.trimStart().startsWith('--'))continue;
   sql+=(sql?'\n':'')+line;
   if(!line.trimEnd().endsWith(';'))continue;
   if(/^CREATE TRIGGER/i.test(sql)&&!/\bEND;\s*$/i.test(sql))continue;
   await db.prepare(sql).run();sql='';
  }
  assert.equal(sql,'','unfinished SQL statement: '+file);
 }
 await db.prepare('INSERT INTO celebrations_celebrations(id,archangel,year,status) VALUES(?,?,?,?)').bind(41,'Gabriel','2026','published').run();
 await seedParticipant(db);
 const personId='person:550e8400-e29b-41d4-a716-446655440000';
 await db.prepare('INSERT INTO celebrations_directory_people(id,email_normalized,display_name) VALUES(?,?,?)').bind(personId,'camille@example.test','Camille Démo').run();
 await db.prepare('INSERT INTO celebrations_directory_person_celebrations(person_id,celebration_id) VALUES(?,?)').bind(personId,41).run();
 await bucket.put(EDITOR_SNAPSHOT_KEY,JSON.stringify({version:1,drafts:{'41':{pages:[]}},shared:{pages:[],homeId:'',celebrationVisibility:{'41':'published'}},plans:[],mediaCatalogue:[]}));
 const dispatch=req=>mf.dispatchFetch(req.url,{method:req.method,headers:[...req.headers],...(req.method==='POST'?{body:req.body,duplex:'half'}:{})});
 const admin=await login(dispatch);
 const api='/api/admin/private-editor',directory='/api/admin/member-directory';
 const get=token=>dispatch(request(api+'?celebration=41',{method:'GET',token}));
 const command=(body,token=admin.token,origin=ORIGIN)=>dispatch(request(api,{body:{celebration:'41',...body},token,origin}));
 assert.equal((await get(undefined)).status,401);
 assert.equal((await get(PARTICIPANT)).status,401);
 assert.equal((await command({action:'save',expectedRevision:1,spaces:[]},admin.token,'https://other.test')).status,403);
 for(const host of ['ronde-des-archanges-universelle.eu','www.ronde-des-archanges-universelle.eu','celebrations-visual-candidate.rondes.workers.dev']){
  assert.equal((await dispatch(request(api+'?celebration=41',{method:'GET',token:admin.token,host}))).status,404);
 }
 browser=await chromium.launch({headless:!demo});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));if(!demo)page.on('dialog',d=>d.accept());
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!==ORIGIN)return route.abort();
  const headers=await req.allHeaders();
  const res=await mf.dispatchFetch(url.href,{method:req.method(),headers,...(req.method()==='POST'?{body:req.postDataBuffer()}: {})});
  await route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});
 });
 const tab=key=>page.locator('[data-tab="'+key+'"]');
 const button=name=>page.getByRole('button',{name,exact:true});
 async function connect(){
  await tab('members-spaces').click();
  await page.getByLabel('Mot de passe administrateur D1').fill('synthetic-only M012-A password');
  await button('Se connecter à D1').click();
  await page.getByText('Session D1 confirmée.',{exact:true}).waitFor();
  await page.getByText('Page 1 · 1 personnes affichées').waitFor();
 }
 await page.goto(ORIGIN+'/__editor/demo-preparation?celebration=41');
 if(demo){
  console.log('DÉMO ISOLÉE – données fictives uniquement. Onglet Membres et espaces. Mot de passe : synthetic-only M012-A password. Fermer la fenêtre pour arrêter.');
  await new Promise(resolve=>page.once('close',resolve));
 }else{
 await connect();
 await page.getByRole('searchbox',{name:'Rechercher une personne'}).fill('Camille');
 await button('Rechercher').click();
 await page.getByText('Résultats de la recherche actualisés.').waitFor();
 await button('Espaces des célébrations').click();
 await page.getByText(/Espaces chargés depuis R2/).waitFor();
 await page.getByPlaceholder('Nom de l’espace').fill('Salle Démo');
 await button('Créer dans le brouillon').click();
 await page.getByPlaceholder('Titre de la nouvelle page').fill('Accueil Démo');
 await button('Préparer une page').click();
 await button('Enregistrer les espaces').click();
 await page.getByText(/Brouillon enregistré, identifiants serveur/).waitFor();
 const first=await (await get(admin.token)).json();
 const space=first.record.spaces[0],sid=space.id,pid=space.pages[0].id;
 assert.match(sid,/^space:/);assert.match(pid,/^page:/);
 assert.equal(first.spaceReleases.length,0);
 const conflict=await command({action:'save',expectedRevision:1,spaces:[]});
 assert.equal(conflict.status,409);
 await page.reload();await connect();await button('Espaces des célébrations').click();
 await page.getByRole('heading',{name:'Salle Démo',exact:true}).waitFor();
 assert.equal(await page.locator('code').filter({hasText:sid}).count(),1);
 const visibility=button('Publier la célébration (visibilité)');
 if(await visibility.isEnabled()){await visibility.click();await page.getByText(/Commande confirmée/).waitFor();}
 await button('Publier cet espace').click();await page.getByText(/Commande confirmée/).waitFor();
 await button('Publier cette page').click();await page.getByText(/Commande confirmée/).waitFor();
 const released=await (await get(admin.token)).json();
 assert.equal(released.privateReleaseReady,true);
 assert.equal(released.pageReleases[0].pageId,pid);
 const detail=await (await dispatch(request(directory+'?action=person_detail&personId='+encodeURIComponent(personId),{method:'GET',token:admin.token}))).json();
 const grant=await dispatch(request(directory,{token:admin.token,body:{action:'enroll_space',personId,spaceId:sid,expectedRevision:detail.data.person.revision}}));
 assert.equal(grant.status,200,await grant.text());
 assert.equal((await db.prepare('SELECT space_id FROM celebrations_directory_private_space_enrollments WHERE person_id=?').bind(personId).first()).space_id,sid);
 await button('Dépublier cet espace').click();await page.getByText(/Commande confirmée/).waitFor();
 const revoked=await (await get(admin.token)).json();assert.equal(revoked.spaceReleases.length,0);assert.equal(revoked.pageReleases.length,0);
 for(const width of [390,320]){
  await page.setViewportSize({width,height:900});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)<=1);
 }
 for(const key of ['pages','footer','celebrations','media','guide']){
  await tab(key).click();assert.equal(await tab(key).evaluate(el=>el.classList.contains('active')),true);
 }
 assert.deepEqual(errors,[]);
 console.log('M012D_REAL_CHROMIUM_WORKER_D1_R2_PASS');
 }
}finally{await browser?.close();await mf?.dispose();await rm(temp,{recursive:true,force:true})}
