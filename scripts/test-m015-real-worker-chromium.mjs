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
 for(const file of [...schemaFiles,'d1-migrations/20261111_012c_private_release_fences.sql']){
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
 browser=await chromium.launch({headless:!DEMO,args:['--host-resolver-rules=MAP * ~NOTFOUND','--disable-background-networking']});
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

 // The interactive demo uses exactly the same Worker/D1/R2 and visual components
 // as the automated recipes. Only fixtures and terminal controls differ.
 async function runDemo(){
  const memberType='member-type:m015';
  const claim='claim:550e8400-e29b-41d4-a716-446655440099';
  await db.prepare('INSERT INTO celebrations_directory_member_types(id,name) VALUES(?,?)')
   .bind(memberType,'Membre fictif (démo)').run();
  await db.prepare("INSERT INTO celebrations_directory_identity_claims(claim_id,participant_email,person_id,status,reviewed_at,reviewed_by,verification_method) VALUES(?,?,?,'approved',?,'synthetic-reviewer','in_person')")
   .bind(claim,'participant@example.test',personId,new Date().toISOString()).run();
  await db.prepare('INSERT INTO celebrations_directory_identity_links(participant_email,person_id,approved_claim_id) VALUES(?,?,?)')
   .bind('participant@example.test',personId,claim).run();
  await db.prepare('INSERT INTO celebrations_directory_person_types(person_id,type_id) VALUES(?,?)')
   .bind(personId,memberType).run();

  // Two tabs of ONE real headed Chromium window, never a parallel visitor UI.
  const {context,page:editor}=await localBrowser(1330);
  const visitor=await context.newPage();
  visitor.setDefaultTimeout(25000);
  visitor.on('pageerror',error=>errors.push(String(error)));
  visitor.on('dialog',dialog=>dialog.accept());
  await editor.goto(ORIGIN+'/__editor/demo-preparation?celebration=41');
  await editor.locator('[data-tab="members-spaces"]').click();
  await editor.getByLabel('Mot de passe administrateur D1').fill('synthetic-only M012-A password');
  await editor.getByRole('button',{name:'Se connecter à D1',exact:true}).click();
  await editor.getByText('Session D1 confirmée.',{exact:true}).waitFor();
  await editor.getByRole('button',{name:'Espaces des célébrations'}).click();
  await editor.getByText(/Espaces chargés depuis R2/).waitFor();
  await visitor.goto(ORIGIN+'/__editor/voir-le-site?celebration=41&page=member-area');
  await visitor.getByLabel('Adresse e-mail membre').fill('participant@example.test');
  await visitor.getByLabel('Mot de passe membre').fill(password);
  await editor.bringToFront();

  const demoHelp=[
   '',
   '🌸 CÉLÉBRATIONS M015 — DÉMONSTRATION LOCALE INTERACTIVE',
   'Deux onglets Chromium ouverts : ADMINISTRATION et MES ESPACES.',
   'Aucun réseau externe, aucune donnée réelle, aucun déploiement.',
   '',
   '1. ADMINISTRATION : créer un espace PRIVÉ, puis une page.',
   '2. Pour la page : politique SELECTED_TYPES et type '+memberType+'.',
   '3. Préparer les droits, puis Enregistrer les espaces.',
   '4. Ouvrir l’édition de page : ajouter / modifier des blocs, Enregistrer dans R2.',
   '5. Publier la célébration (visibilité), publier l’espace, puis publier la page.',
   '6. Dans CE terminal, taper g puis Entrée : accorder l’accès au membre fictif.',
   '7. Onglet MES ESPACES : cliquer Se connecter (identifiants déjà saisis).',
   '8. Ouvrir la page. Terminal : r puis Entrée pour révoquer (contrôle serveur).',
   '',
   'Commandes terminal : g = autoriser ; r = révoquer ; h = aide ; q = quitter.',
   'Pour terminer : fermer Chromium, taper q ou Ctrl+C.',
   'Compte fictif : participant@example.test / '+password,
   'Le domaine .test ne s’ouvre que dans ce Chromium intercepté.',
   ''
  ].join('\n');
  console.log(demoHelp);

  async function refreshVisibleVisitor(){
   if(visitor.isClosed())return;
   const refresh=visitor.getByRole('button',{name:'Actualiser mes accès',exact:true});
   if(await refresh.isVisible().catch(()=>false)){
    await refresh.click();
    await visitor.getByText('Vérification des droits…').waitFor({state:'hidden'});
   }
  }
  async function changeGrant(grant){
   const result=await (await get()).json();
   if(!result.ok||!Array.isArray(result.record?.spaces))
    throw Error('Impossible de lire le brouillon R2 canonique');
   const spaces=result.record.spaces.filter(s=>s.visibility==='PRIVATE'&&s.pages?.length);
   if(grant){
    const chosen=spaces.at(-1);
    if(!chosen){console.log('Créez et enregistrez d’abord un espace privé avec une page.');return}
    if(!result.pageReleases?.some(p=>p.spaceId===chosen.id))
     console.log('⚠️ Publiez la page ET l’espace avant la consultation membre.');
    await db.prepare('INSERT OR IGNORE INTO celebrations_directory_private_space_enrollments(person_id,celebration_id,space_id) VALUES(?,?,?)')
     .bind(personId,41,chosen.id).run();
    console.log('✅ Accès fictif accordé dans D1 local : '+chosen.name);
   }else{
    const done=await db.prepare('DELETE FROM celebrations_directory_private_space_enrollments WHERE person_id=? AND celebration_id=?')
     .bind(personId,41).run();
    console.log('⛔ Accès révoqué dans D1 local ('+(done.meta?.changes??0)+' inscription(s)).');
   }
   // Existing visitor UI refreshes via the REAL guarded private list endpoint.
   await refreshVisibleVisitor();
  }
  // Keep the local Worker alive until the browser is closed or the terminal exits.
  let finish;
  const closed=new Promise(resolve=>{finish=resolve});
  const stop=reason=>finish(reason);
  const browserClosed=()=>stop('navigateur fermé');
  const interrupted=()=>stop('interruption clavier');
  browser.once('disconnected',browserClosed);
  process.once('SIGINT',interrupted);
  process.once('SIGTERM',interrupted);
  const terminal=createInterface({input:process.stdin,output:process.stdout,terminal:!!process.stdin.isTTY});
  terminal.on('SIGINT',interrupted);
  let commandBusy=false;
  terminal.on('line',line=>{
   const cmd=line.trim().toLowerCase();
   if(cmd==='q'){stop('arrêt demandé');return}
   if(cmd==='h'){console.log(demoHelp);return}
   if(cmd!=='g'&&cmd!=='r')return;
   if(commandBusy){console.log('Commande précédente encore en cours.');return}
   commandBusy=true;
   void changeGrant(cmd==='g').catch(e=>console.error('Commande refusée :',e.message))
    .finally(()=>{commandBusy=false});
  });
  try{
   if(DEMO_SMOKE){
    assert.equal(await editor.getByRole('button',{name:'Espaces des célébrations'}).isVisible(),true);
    assert.equal(await visitor.getByLabel('Adresse e-mail membre').isVisible(),true);
    await new Promise(resolve=>setTimeout(resolve,600));
    assert.equal(browser.isConnected(),true,'Chromium must stay open until user closes it');
    await browser.close();
    console.log('M015_DEMO_HEADED_INTERACTIVE_LIFECYCLE_PASS');
   }
   const reason=await closed;
   console.log('Démo terminée ('+reason+'). Nettoyage de D1/R2 locaux.');
  }finally{
   terminal.close();
   terminal.removeListener('SIGINT',interrupted);
   browser.removeListener('disconnected',browserClosed);
   process.removeListener('SIGINT',interrupted);
   process.removeListener('SIGTERM',interrupted);
   await context.close().catch(()=>{});
  }
 }

 if(DEMO){
  await runDemo();
 }else{
 const {context:adminContext,page}=await localBrowser(1440);
 const button=name=>page.getByRole('button',{name,exact:true});
 await page.goto(ORIGIN+'/__editor/demo-preparation?celebration=41');
 await page.locator('[data-tab="members-spaces"]').click();
 await page.getByLabel('Mot de passe administrateur D1').fill('synthetic-only M012-A password');
 await button('Se connecter à D1').click();
 await page.getByText('Session D1 confirmée.',{exact:true}).waitFor();
 await page.getByLabel('Identifiant permanent',{exact:true}).fill('member-type:m015');
 await page.getByLabel('Nom du type',{exact:true}).fill('Membre fictif');
 await button('Créer ce type').click();
 await page.getByText('Modification enregistrée et état D1 rechargé.').waitFor();
 await button('Espaces des célébrations').click();
 await page.getByText(/Espaces chargés depuis R2/).waitFor();
 await page.getByPlaceholder('Nom de l’espace').fill('Espace M015');
 await button('Créer dans le brouillon').click();
 await page.getByPlaceholder('Titre de la nouvelle page').fill('Page M015');
 await button('Préparer une page').click();
 await page.getByLabel('Politique de la page Page M015').selectOption('SELECTED_TYPES');
 await page.getByLabel('Types autorisés de la page').fill('member-type:m015');
 await button('Préparer les droits de la page').click();
 await button('Enregistrer les espaces').click();
 await page.getByText(/Brouillon enregistré, identifiants serveur/).waitFor();
 const initial=await (await get()).json(),space=initial.record.spaces[0],sid=space.id,pid=space.pages[0].id;
 assert.match(sid,/^space:/);assert.match(pid,/^page:/);
 // RECETTE A — actual existing visual block editor, no second persistence model.
 const open=button('Ouvrir l’édition de page');
 assert.equal(await open.isEnabled(),true,'the original disabled button must work');
 await open.click();await page.locator('.canvas').waitFor();
 await page.locator('.canvas .section-add-blue').first().click();
 await button('Bloc seul').click();
 await page.locator('.canvas .section-add-green').first().click();
 await button('Texte').click();
 await page.locator('.canvas .block[data-kind="text"] .ed[role="textbox"]').fill('Texte M015 durable');
 await button('Enregistrer dans R2').click();
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Page enregistrée dans R2 canonique'));
 const persisted=await (await get()).json();
 assert.match(JSON.stringify(persisted.record.spaces[0].pages[0].blocks),/Texte M015 durable/);
 await button('Recharger').click();
 await page.getByText('Texte M015 durable',{exact:true}).waitFor();
 await page.locator('#preview-btn').click();
 assert.ok(await page.locator('.canvas').isVisible(),'preview reuses canonical blocks');
 await page.locator('#preview-btn').click();
 await button('← Membres et espaces').click();
 const visibility=button('Publier la célébration (visibilité)');
 if(await visibility.isEnabled()){
  await visibility.click();await page.getByText(/Commande confirmée/).waitFor();
 }
 await button('Publier cet espace').click();await page.getByText(/Commande confirmée/).waitFor();
 const beforePagePublish=await (await get()).json();
 console.log('M015_DRAFT_BEFORE_PAGE_PUBLISH',JSON.stringify(beforePagePublish.record.spaces[0].pages[0].blocks));
 await button('Ouvrir l’édition de page').click();
 await button('Publier cette page').click();
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Page publiée explicitement'));
 const released=await (await get()).json();
 console.log('M015_DRAFT_AFTER_PAGE_PUBLISH',JSON.stringify(released.record.spaces[0].pages[0].blocks));
 assert.equal(released.pageReleases.some(p=>p.pageId===pid),true);
 assert.equal(released.spaceReleases.some(s=>s.spaceId===sid),true);
 assert.equal(released.privateReleaseReady,true);
 console.log('M015_RECIPE_A_CANONICAL_BLOCK_EDITOR_CHROMIUM_PASS');
 // Actual D1 identity approval and enrollment; no fabricated HTTP responses.
 const claim='claim:550e8400-e29b-41d4-a716-446655440099';
 await db.prepare("INSERT INTO celebrations_directory_identity_claims(claim_id,participant_email,person_id,status,reviewed_at,reviewed_by,verification_method) VALUES(?,?,?,'approved',?,'synthetic-reviewer','in_person')")
  .bind(claim,'participant@example.test',personId,new Date().toISOString()).run();
 await db.prepare('INSERT INTO celebrations_directory_identity_links(participant_email,person_id,approved_claim_id) VALUES(?,?,?)')
  .bind('participant@example.test',personId,claim).run();
 await db.prepare('INSERT INTO celebrations_directory_person_types(person_id,type_id) VALUES(?,?)').bind(personId,'member-type:m015').run();
 await db.prepare('INSERT INTO celebrations_directory_private_space_enrollments(person_id,celebration_id,space_id) VALUES(?,?,?)').bind(personId,41,sid).run();
 const directList=await dispatch(request('/api/participant/space-pages?celebration=41',{method:'GET',token:'a'.repeat(64)}));
 console.log('M015_DIRECT_MEMBER_LIST',directList.status,await directList.text());
 const directPage=await dispatch(request('/api/participant/space-page?pageId='+encodeURIComponent(pid),{method:'GET',token:'a'.repeat(64)}));
 console.log('M015_DIRECT_MEMBER_PAGE',directPage.status,(await directPage.text()).slice(0,900));
 // RECETTE B — existing visitor, historical participant auth, real private APIs.
 const {context:memberContext,page:member}=await localBrowser(390);
 const memberResponse=await member.goto(ORIGIN+'/__editor/voir-le-site?celebration=41&page=member-area');
 console.log('M015_DIAGNOSTIC_MEMBER_SITE',JSON.stringify({http:memberResponse?.status(),view:await member.evaluate(()=>({enabled:window.__MEMBER_SITE_ENABLED__,title:document.title,body:document.body.innerText.slice(0,500)})),errors}));
 await member.getByLabel('Adresse e-mail membre').fill('participant@example.test');
 await member.getByLabel('Mot de passe membre').fill(password);
 const memberResponses=[];member.on('response',r=>{if(r.url().includes('/api/auth')||r.url().includes('/api/participant/'))memberResponses.push({path:new URL(r.url()).pathname,status:r.status()})});
 await member.getByRole('button',{name:'Se connecter',exact:true}).click();
 await member.waitForTimeout(1000);
 console.log('M015_MEMBER_LOGIN_DIAGNOSTIC',JSON.stringify({body:(await member.locator('#stage-main').innerText()).slice(0,400),responses:memberResponses,errors}));
 const entry=member.getByRole('button',{name:'Espace M015 · Page M015',exact:true});
 await entry.waitFor();await entry.click();
 await member.waitForTimeout(500);
 console.log('M015_MEMBER_AFTER_OPEN',JSON.stringify({body:(await member.locator('#stage-main').innerText()).slice(0,700),responses:memberResponses,errors}));
 await member.getByText('Texte M015 durable',{exact:true}).waitFor();
 // A live D1 revocation MUST clear the rendered list and the displayed content.
 await db.prepare('DELETE FROM celebrations_directory_person_types WHERE person_id=? AND type_id=?').bind(personId,'member-type:m015').run();
 await member.getByRole('button',{name:'Actualiser mes accès'}).click();
 await member.getByText('Aucune page autorisée.').waitFor();
 assert.doesNotMatch(await member.locator('#stage-main').innerText(),/Page M015|Texte M015 durable|Espace M015/);
 const raw=await dispatch(request('/api/participant/space-page?pageId='+encodeURIComponent(pid),{method:'GET',token:'a'.repeat(64)}));
 assert.equal(raw.status,404);
 await member.getByRole('button',{name:'Se déconnecter'}).click();
 await member.getByLabel('Adresse e-mail membre').waitFor();
 assert.equal(await member.evaluate(()=>Object.keys(localStorage).some(key=>/memberToken|participant_token/i.test(key))),false);
 console.log('M015_RECIPE_B_MEMBER_GRANTS_REVOKED_CHROMIUM_PASS');
 assert.deepEqual(errors,[]);
 await memberContext.close();await adminContext.close();
 }
}finally{await browser?.close();await mf?.dispose();await rm(temp,{recursive:true,force:true})}
