// M015: TWO genuine Chromium journeys, actual Worker, local D1 and R2.
// Every browser request is intercepted by Miniflare; no internet, secrets or deployment.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createHash,pbkdf2Sync} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createInterface} from 'node:readline';
import {Miniflare} from 'miniflare';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {flags,schemaFiles,schema,ORIGIN,request,login,seedParticipant} from '../tests/fixtures/m012a-editor-session-http.mjs';
import {EDITOR_SNAPSHOT_KEY} from '../migration/cloudflare/app/ports/editor-snapshot-contract.mjs';

const DEMO=process.argv.includes('--demo');
// CI-only headed smoke check. The public --demo mode never closes itself.
const DEMO_SMOKE=DEMO&&process.env.CELEBRATIONS_M015_DEMO_SMOKE==='1';
const temp=await mkdtemp(join(tmpdir(),'celebrations-m015-'));
let mf,browser;
try{
 const outfile=join(temp,'staging.mjs');
 await build({entryPoints:['migration/cloudflare/staging-worker.mjs'],bundle:true,platform:'node',format:'esm',target:'es2022',outfile,external:['node:*']});
 mf=new Miniflare({modules:true,modulesRoot:temp,scriptPath:outfile,compatibilityDate:'2026-08-06',
  compatibilityFlags:['nodejs_compat'],bindings:{...flags,MEMBER_PAGE_READ_API_ENABLED:'true'},
  d1Databases:{DB:'11111111-1111-4111-8111-111111111111'},d1Persist:false,
  r2Buckets:{EDITOR_BUCKET:'m015-canonical-local',MEDIA_BUCKET:'m015-media-local'},r2Persist:false,port:0});
 const db=await mf.getD1Database('DB'),bucket=await mf.getR2Bucket('EDITOR_BUCKET');
 for(const file of [...schemaFiles,'d1-migrations/20261111_012c_private_release_fences.sql','d1-migrations/20261111_020b_category_abbreviation.sql']){
  let statement='';
  for(const line of schema(file).split('\n')){
   if(!line.trim()||line.trimStart().startsWith('--'))continue;
   statement+=(statement?'\n':'')+line;
   if(!line.trimEnd().endsWith(';'))continue;
   if(/^CREATE TRIGGER/i.test(statement)&&!/\bEND;\s*$/i.test(statement))continue;
   await db.prepare(statement).run();statement='';
  }
  assert.equal(statement,'','unfinished schema: '+file);
 }
 await db.prepare('INSERT INTO celebrations_celebrations(id,archangel,year,status) VALUES(?,?,?,?)').bind(41,'Gabriel','2026','published').run();
 const personId='person:550e8400-e29b-41d4-a716-446655440000';
 await db.prepare('INSERT INTO celebrations_directory_people(id,email_normalized,display_name) VALUES(?,?,?)').bind(personId,'participant@example.test','Membre M015').run();
 await db.prepare('INSERT INTO celebrations_directory_person_celebrations(person_id,celebration_id) VALUES(?,?)').bind(personId,41).run();
 await seedParticipant(db);
 const salt='0123456789abcdef'.repeat(4),password='synthetic-only M015 participant password';
 const verifier=pbkdf2Sync(password,salt,180000,32,'sha256').toString('hex');
 const hash=createHash('sha256').update(verifier).digest('hex');
 await db.prepare('UPDATE celebrations_participants SET password_salt=?,password_hash=? WHERE email=?')
  .bind('client180:'+salt,hash,'participant@example.test').run();
 await bucket.put(EDITOR_SNAPSHOT_KEY,JSON.stringify({version:1,drafts:{'41':{pages:[]}},
  shared:{pages:[],homeId:'',celebrationVisibility:{'41':'published'}},plans:[],mediaCatalogue:[]}));
 const dispatch=req=>mf.dispatchFetch(req.url,{method:req.method,headers:[...req.headers],
  ...(req.method==='POST'?{body:req.body,duplex:'half'}:{})});
 const admin=await login(dispatch),api='/api/admin/private-editor';
 const get=()=>dispatch(request(api+'?celebration=41',{method:'GET',token:admin.token}));
 browser=await chromium.launch({headless:!DEMO,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--host-resolver-rules=MAP * ~NOTFOUND','--disable-background-networking']});
 const errors=[];
 async function localBrowser(width){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!==ORIGIN)return route.abort();
   const response=await mf.dispatchFetch(url.href,{method:req.method(),headers:await req.allHeaders(),
    ...(req.method()==='POST'?{body:req.postDataBuffer()}:{})});
   await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  const page=await context.newPage();page.setDefaultTimeout(25000);
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('dialog',dialog=>dialog.accept());
  return {context,page};
 }


 const {page,context}=await localBrowser(390);
 await page.goto(ORIGIN+'/__editor/demo-preparation?celebration=41');
 await page.locator('[data-tab="languages-categories"]').click();
 await page.getByRole('button',{name:'Catégories',exact:true}).click();
 await page.getByLabel('Code administrateur',{exact:false}).fill('synthetic-only M012-A password');
 await page.getByRole('button',{name:'Se connecter',exact:true}).click();
 await page.getByLabel('Nom de la catégorie',{exact:true}).fill('Porteurs d’ange');
 assert.equal(await page.getByLabel('Sigle administratif',{exact:true}).inputValue(),'PDA');
 await page.getByRole('button',{name:'Ajouter',exact:true}).click();
 await page.getByText('Porteurs d’ange — PDA',{exact:true}).waitFor();
 await page.locator('[data-tab="celebrations"]').click();
 const settings=page.locator('.m020-settings');
 await settings.waitFor();
 assert.equal(await settings.getByRole('group',{name:'Catégories',exact:true}).isVisible(),false);
 await settings.getByLabel('Accès de la page',{exact:true}).selectOption('PRIVATE');
 await settings.getByRole('group',{name:'Catégories',exact:true}).waitFor();
 assert.equal(await settings.getByText('Porteurs d’ange',{exact:true}).count(),1);
 await settings.getByLabel('Accès de la page',{exact:true}).selectOption('PUBLIC');
 await page.locator('.celebration-publication-controls').getByRole('button',{name:'Dupliquer',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Continuer',exact:true}).click();
 await page.getByRole('dialog').getByLabel('Catégorie',{exact:true}).waitFor();
 await page.getByRole('dialog').getByLabel('Catégorie',{exact:true}).selectOption({label:'Porteurs d’ange'});
 await page.getByRole('dialog').getByRole('button',{name:'Créer le brouillon',exact:true}).click();
 await page.getByRole('button',{name:'← Célébrations',exact:true}).waitFor();
 assert.equal(await page.getByLabel('Visibilité de la page',{exact:true}).inputValue(),'draft');
 await page.getByRole('button',{name:'← Célébrations',exact:true}).click();
 await page.getByRole('button',{name:'Versions par catégorie',exact:true}).click();
 await page.getByLabel('Rechercher une version',{exact:true}).fill('PDA');
 await page.getByRole('button',{name:/PDA — Français/}).waitFor();
 const row=page.locator('.member-spaces-version').first();
 await row.getByRole('button',{name:'Publier',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Publier',exact:true}).click();
 await row.getByRole('button',{name:'Dépublier',exact:true}).waitFor();
 await row.getByRole('button',{name:'Dépublier',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Dépublier',exact:true}).click();
 await row.getByRole('button',{name:'Publier',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'no smartphone overflow');
 await page.screenshot({path:process.env.M020B_SCREENSHOT||'/tmp/m020b-smartphone.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('M020-B Chromium 390px PASS: category acronym, settings, duplication, search/open version, publish/unpublish; real local Worker/D1/R2');
 await context.close();
}finally{await browser?.close();await mf?.dispose();await rm(temp,{recursive:true,force:true})}
