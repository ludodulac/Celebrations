// M018 TRUE online validation on the EXISTING isolated M016 Worker only.
// One fictional Gabriel × two member categories × three manually authored
// languages. No production or personal records are read/written.
import assert from 'node:assert/strict';
import {pbkdf2Sync,createHmac} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
const origin='https://celebrations-m016-admin-preprod.rondes.workers.dev';
const password=process.env.M017_ADMIN_PASSWORD;
assert.ok(password?.length>=16);
assert.equal(process.env.M018_ISOLATED_ONLY,'YES');
const C='90000002',fakePassword='fictional-M018-password-never-for-live-users';
const frCat=['Français catégorie 1 M018 FICTIF','Français catégorie 2 M018 FICTIF'];
const enCat=['English category 1 M018 FICTIONAL','English category 2 M018 FICTIONAL'];
const esCat=['Español categoría 1 M018 FICTICIO','Español categoría 2 M018 FICTICIO'];
const json=async(r)=>({status:r.status,body:await r.json().catch(()=>({}))});
async function api(path,body,bearer){
 const headers={origin,connection:'close','content-type':'application/json',
  ...(bearer?{authorization:'Bearer '+bearer}:{})};
 return json(await fetch(origin+path,{method:'POST',headers,body:JSON.stringify(body),
  signal:AbortSignal.timeout(30000)}));
}
async function get(path,token){
 return json(await fetch(origin+path,{headers:{connection:'close',...(token?{authorization:'Bearer '+token}:{})},
  signal:AbortSignal.timeout(30000)}));
}
function ok(r,label){assert.equal(r.status,200,label+' status='+r.status+' error='+r.body?.error);
 assert.equal(r.body.ok,true,label+' api status');return r.body;}
function event(name,obj){console.log('M018_EXISTING_PREPROD '+JSON.stringify({step:name,...obj}));}
const browser=await chromium.launch({headless:true,...(process.env.M019_CHROME_CHANNEL?{channel:process.env.M019_CHROME_CHANNEL}:{})});
try{
 const adminCtx=await browser.newContext({viewport:{width:1350,height:900}});
 const admin=await adminCtx.newPage();
 admin.setDefaultTimeout(20000);
 const errs=[];admin.on('pageerror',e=>{errs.push(String(e.message||e).slice(0,160));console.log('M019_ADMIN_SCRIPT_ERROR '+String(e.message||e).slice(0,300))});
 await admin.goto(origin+'/admin',{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(await admin.locator('input[name="code"]').count(),1);
 await admin.locator('input[name="code"]').fill(password);
 await Promise.all([
  admin.waitForURL(u=>u.pathname==='/admin.html',{timeout:30000}),
  admin.locator('button[type="submit"]').click()
 ]);
 await admin.waitForLoadState('domcontentloaded');
 assert.ok((await admin.locator('body').innerText()).includes('Membres'));
 const pre=await admin.evaluate(async C=>{
  const r=await fetch('/api/editor-open-draft?celebration='+C,{cache:'no-store'});
  return {status:r.status,body:await r.json()};
 },C);
 ok(pre,'admin read preprod state');
 const existing=pre.body.localization?.registry??{
  version:1,defaultLanguageId:'fr',languages:[{id:'fr',name:'Français',flag:'🇫🇷',active:true}]
 };
 const byId=new Map(existing.languages.map(x=>[x.id,x]));
 for(const [id,name] of [['en','English'],['es','Español']]){
  if(!byId.has(id))byId.set(id,{id,name,flag:'',active:true});
  else byId.set(id,{...byId.get(id),active:true});
 }
 const registry={...existing,languages:[...byId.values()]};
 const draft=pre.body.record??{pages:[],celebrationDates:{},celebrationTimes:{}};
 const loc={registry,pages:pre.body.localization?.pages??{}};
 const save=await admin.evaluate(async({C,pre,draft,loc})=>{
  const r=await fetch('/api/editor-open-draft',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({
    celebration:C,expectedRevision:pre.revision,plans:pre.plans??[],shared:pre.shared,
    record:draft,localization:loc
   })});
  return {status:r.status,body:await r.json()};
 },{C,pre:pre.body,draft,loc});
 ok(save,'set 3 manual languages in existing editor registry');
 event('manual_languages',{chosen:['fr','en','es'],no_translation_service:true});
 const challenge=ok(await api('/api/admin/editor-session',{action:'challenge'}),'admin D1 challenge');
 const verifier=pbkdf2Sync(password,challenge.salt,180000,32,'sha256').toString('hex');
 const signed=createHmac('sha256',verifier)
   .update('celebrations-admin-login-v1:'+origin+':'+challenge.challenge).digest('hex');
 const login=ok(await api('/api/admin/editor-session',{
  action:'login',challenge:challenge.challenge,response:signed
 }),'admin D1 login');
 const adminToken=login.token;assert.match(adminToken,/^[a-f0-9]{64}$/);
 const directory=ok(await get('/api/admin/member-directory?action=snapshot',adminToken),'admin directory');
 for(const id of ['member-type:m018-cat1','member-type:m018-cat2'])
  assert.ok(directory.data.types.some(x=>x.id===id));
 let state=ok(await get('/api/admin/private-editor?celebration='+C,adminToken),'private editor current');
 assert.ok(state.languageRegistry.languages.some(x=>x.id==='en'&&x.active));
 assert.ok(state.languageRegistry.languages.some(x=>x.id==='es'&&x.active));
 // One Gabriel entry in D1, two category spaces, six distinct manual texts.
 const spaces=[];
 for(let i=0;i<2;i++){
  const key='m018-cat'+(i+1);
  spaces.push({
   id:'draft-space:'+key,celebrationId:C,name:'Catégorie '+(i+1)+' — fictive',
   visibility:'PRIVATE',accessScope:'CELEBRATION',
   accessPolicy:{mode:'SELECTED_TYPES',typeIds:['member-type:'+key]},
   pages:[{
    id:'draft-page:'+key,celebrationId:C,spaceId:'draft-space:'+key,
    name:'Page '+key,accessPolicy:{mode:'PUBLIC'},
    blocks:[{kind:'text',text:frCat[i]}],
    translations:{
     en:{name:'English '+key,blocks:[{kind:'text',text:enCat[i]}]},
     es:{name:'Español '+key,blocks:[{kind:'text',text:esCat[i]}]}
    }
   }]
  });
 }
 // On a rerun, update the exact fictional canonical records rather than
 // allocating duplicate spaces or touching unrelated preproduction content.
 const reuse={};
 for(let i=0;i<spaces.length;i++){
  const prior=state.record.spaces?.find(x=>x.name===spaces[i].name);
  if(prior){
   reuse['draft-space:m018-cat'+(i+1)]=prior.id;
   reuse['draft-page:m018-cat'+(i+1)]=prior.pages[0]?.id;
   spaces[i]={...spaces[i],id:prior.id,
    pages:[{...spaces[i].pages[0],id:prior.pages[0].id,spaceId:prior.id}]};
  }
 }
 const saved=ok(await api('/api/admin/private-editor',{action:'save',celebration:C,
   expectedRevision:state.revision,spaces},adminToken),'save 2 category spaces with 6 texts');
 const ids={...saved.idMap,...reuse};
 assert.ok(ids['draft-space:m018-cat1']&&ids['draft-space:m018-cat2']);
 state=saved;
 for(const [action,fields] of [
  ['celebration-visibility',{visibility:'published'}],
  ['celebration-access',{accessPolicy:{mode:'ALL_PRIVATE_TYPES'}}],
  ['publish',{kind:'space',id:ids['draft-space:m018-cat1']}],
  ['publish',{kind:'space',id:ids['draft-space:m018-cat2']}],
  ['publish',{kind:'page',id:ids['draft-page:m018-cat1'],spaceId:ids['draft-space:m018-cat1']}],
  ['publish',{kind:'page',id:ids['draft-page:m018-cat2'],spaceId:ids['draft-space:m018-cat2']}]
 ]){
  const r=await api('/api/admin/private-editor',{
   action,celebration:C,expectedRevision:state.revision,...fields
  },adminToken);
  state=ok(r,'private '+action+(fields.kind||''));
 }
 assert.equal(state.privateReleaseReady,true,'canonical D1 release confirmation');
 event('one_celebration_two_categories_three_languages',{Gabriel:1,categories:2,
  language_variants:6,server_release:true});
 // The same fictional Gabriel must NEVER leak into anonymous listings/media.
 const publicState=ok(await get('/api/editor-publication?celebration='+C),'public projection');
 assert.equal(publicState.celebrationVisible,false);
 assert.ok(!JSON.stringify(publicState).includes(enCat[0]));
 assert.ok(!JSON.stringify(publicState).includes(frCat[1]));
 const publicVisit=await fetch(origin+'/?celebration='+C,{signal:AbortSignal.timeout(25000)});
 assert.equal(publicVisit.status,404,'Entire restricted celebration is private');
 const publicMichael=await fetch(origin+'/',{signal:AbortSignal.timeout(25000)});
 assert.equal(publicMichael.status,200);
 event('michael_public_gabriel_private',{visitor_home:200,Gabriel_anonymous:404});
 const members=[];
 for(let i=1;i<=3;i++){
  const email='m018-cat'+i+'@example.test';
  const begin=ok(await api('/api/auth',{action:'participant_begin',email}),'member begin '+i);
  const proof=pbkdf2Sync(fakePassword,begin.salt,180000,32,'sha256').toString('hex');
  const auth=ok(await api('/api/auth',{
   action:'participant_login_derived',email,password_proof:proof
  }),'member login '+i);
  members.push(auth.token);
 }
 const allPageIds=[ids['draft-page:m018-cat1'],ids['draft-page:m018-cat2']];
 for(const [index,token] of members.entries()){
  for(const [lang,expected] of [['fr',frCat],['en',enCat],['es',esCat]]){
   const listing=await get('/api/participant/space-pages?celebration=all&lang='+lang,token);
   assert.equal(listing.status,200,'authorized list '+index+' '+lang);
   assert.ok(Array.isArray(listing.body.pages),'private page list response');
   const list=listing.body;
   assert.equal(list.pages.length,index===2?0:1,'No other category or unenrolled pages');
   if(index===2)continue;
   assert.equal(list.pages[0].id,allPageIds[index]);
   assert.equal(list.pages[0].languageId,lang);
   const single=await get('/api/participant/space-page?pageId='+allPageIds[index]+'&lang='+lang,token);
   assert.equal(single.status,200,'member page '+index+' '+lang);
   assert.equal(single.body.blocks[0].text,expected[index]);
  }
  if(index<2){
   const deny=await get('/api/participant/space-page?pageId='+allPageIds[1-index]+'&lang=fr',token);
   assert.equal(deny.status,404,'Wrong category direct URL denial');
  }
 }
 assert.equal((await get('/api/participant/space-page?pageId='+allPageIds[0]+'&lang=fr')).status,404);
 event('authorized_member_views',{one_category_only:true,
  unenrolled_denied:true,wrong_category_denied:true,language_correct:true});
 const visitCtx=await browser.newContext({viewport:{width:390,height:850}});
 const visitor=await visitCtx.newPage();
 const browserErrors=[];visitor.on('pageerror',e=>browserErrors.push(String(e.message||e).slice(0,140)));
 const first=await visitor.goto(origin+'/?celebration=90000001&lang=en',{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(first.status(),200);
 // PRIVÉ + VISIBLE: title only in the anonymous menu, with no selectable link
 // and with zero private text/media. The canonical private route remains 404.
 await visitor.goto(origin+'/?celebration=90000001&page=celebrations&lang=en',
  {waitUntil:'domcontentloaded',timeout:30000});
 const visiblePrivate=visitor.locator('.celebration-choice').filter({hasText:'Gabriel 2026'});
 await visiblePrivate.waitFor({timeout:15000});
 assert.equal(await visiblePrivate.evaluate(el=>el.tagName),'DIV');
 assert.match(await visiblePrivate.innerText(),/Privée/);
 assert.equal(await visiblePrivate.locator('a[href]').count(),0);
 assert.ok(!(await visitor.locator('body').innerText()).includes(frCat[0]));
 await visitor.goto(origin+'/?celebration=90000001&lang=en',
  {waitUntil:'domcontentloaded',timeout:30000});
 await visitor.waitForSelector('#member-connection:not([hidden])',{timeout:12000});
 assert.ok((await visitor.locator('#public-language-control').innerText()).length>0);
 await visitor.locator('#member-connection').click();
 const form=visitor.locator('form.member-login');
 await form.locator('input[type=email]').fill('m018-cat1@example.test');
 await form.locator('input[type=password]').fill(fakePassword);
 await form.locator('button[type=submit]').click();
 // M018-B: the previous 30-second Chromium wait timed out because the public
 // Michaël celebration ID was incorrectly used to filter authorized Gabriel pages.
 const groups=visitor.locator('.member-celebration-group');
 await groups.getByRole('button',{name:'Catégorie 1 — fictive · English m018-cat1'}).waitFor({timeout:15000});
 assert.equal(await groups.count(),1,'One Gabriel menu group, not six celebrations');
 assert.match(await groups.first().getByRole('heading').innerText(),/Gabriel/);
 assert.equal(await groups.getByRole('button',{name:/m018-cat2/}).count(),0,
  'The other category must not appear in the participant menu');
 assert.ok((await visitor.locator('body').innerText()).includes('Mes espaces autorisés'));
 assert.deepEqual(browserErrors,[],'Visitor browser script errors');
 await visitor.close();await visitCtx.close();
 event('normal_phone_browser',{login_from_any_page:true,language_en:true,
  only_authorized_page:true});
 // Revoke a FICTIONAL enrollment through the real guarded D1 admin API.
 // The previous bearer token must lose both list and page access immediately.
 const person='person:77777777-7777-4777-8777-000000000001';
 const detailUrl='/api/admin/member-directory?action=person_detail&personId='+encodeURIComponent(person);
 const beforeRevoke=ok(await get(detailUrl,adminToken),'fictional person detail').data;
 assert.ok(beforeRevoke.celebrations.some(x=>String(x.celebrationId)===C));
 ok(await api('/api/admin/member-directory',{
  action:'remove_celebration',personId:person,celebrationId:C,
  expectedRevision:beforeRevoke.person.revision
 },adminToken),'revoke fictional celebration enrollment');
 assert.equal((await get('/api/participant/space-page?pageId='+allPageIds[0]+'&lang=fr',
  members[0])).status,404,'revocation denies published page');
 const revoked=await get('/api/participant/space-pages?celebration=all&lang=fr',members[0]);
 assert.equal(revoked.status,200);
 assert.deepEqual(revoked.body.pages,[],'revocation removes private menu');
 const afterRevoke=ok(await get(detailUrl,adminToken),'fictional person after revoke').data;
 ok(await api('/api/admin/member-directory',{
  action:'add_celebration',personId:person,celebrationId:C,
  expectedRevision:afterRevoke.person.revision
 },adminToken),'restore fictional enrollment only');
 assert.equal((await get('/api/participant/space-page?pageId='+allPageIds[0]+'&lang=fr',
  members[0])).status,200,'restored fictional grant');
 event('revocation',{user:'fictional-only',immediate_deny:true,restored_fixture:true});
 // M019: one real phone journey through the existing admin UI.
 await mkdir('docs/m019-smartphone',{recursive:true});
 await admin.setViewportSize({width:390,height:844});
 const nativeDialogs=[];admin.on('dialog',d=>{nativeDialogs.push(d.message());void d.dismiss()});
 await admin.goto(origin+'/admin.html?celebration='+C,{waitUntil:'domcontentloaded'});
 await admin.locator('[data-tab="languages-categories"]').click();
 await admin.getByRole('button',{name:'Catégories',exact:true}).click();
 const previousTypes=ok(await get('/api/admin/member-directory?action=snapshot&limit=1',adminToken),'read fictional category fixtures').data.types;
 for(const t of previousTypes.filter(t=>!t.disabled&&(t.name.startsWith('M019 Essai ')||t.name==='Équipe Gabriel — essai')))
  ok(await api('/api/admin/member-directory',{action:'disable_type',typeId:t.id,expectedRevision:t.revision,disabled:true},adminToken),'retain old fictional category as inactive history');
 const category='Équipe Gabriel — essai',email='m019-'+Date.now()+'@example.test';
 await admin.getByLabel('Nouvelle catégorie',{exact:true}).fill(category);
 await admin.locator('.m019-categories form').getByRole('button',{name:'Ajouter',exact:true}).click();
 await admin.locator('.m019-categories .card:visible strong').filter({hasText:category}).waitFor();
 await admin.screenshot({path:'docs/m019-smartphone/02-categories.png',fullPage:true});
 await admin.getByRole('button',{name:'Langues',exact:true}).click();
 await admin.locator('.m018-language-panel').waitFor();
 await admin.screenshot({path:'docs/m019-smartphone/03-langues.png',fullPage:true});
 await admin.locator('[data-tab="members-spaces"]').click();
 const createForm=admin.locator('.m019-member-form');
 await createForm.getByLabel('Prénom',{exact:true}).fill('Alice');
 await createForm.getByLabel('Nom',{exact:true}).fill('M019 Fictive');
 await createForm.getByLabel('E-mail',{exact:true}).fill(email);
 await createForm.getByLabel('Catégorie',{exact:true}).selectOption({label:category});
 await createForm.getByLabel('Célébration',{exact:true}).selectOption(C);
 await createForm.getByRole('button',{name:'Enregistrer',exact:true}).click();
 try{await admin.getByText('Membre enregistré et inscrit.',{exact:true}).waitFor()}catch(e){console.log('M019_MEMBER_STATUS '+await admin.locator('.member-directory-009b > p').innerText());throw e}
 await admin.locator('.m019-member-list strong').filter({hasText:'Alice M019 Fictive'}).waitFor();
 await admin.screenshot({path:'docs/m019-smartphone/01-membres.png',fullPage:true});
 await admin.locator('.m019-member-list').getByRole('button',{name:'Modifier',exact:true}).click();
 const modal=admin.locator('dialog[open]');
 await modal.getByLabel('Nom',{exact:true}).fill('M019 Modifiée');
 await modal.getByRole('button',{name:'Enregistrer',exact:true}).click();
 await admin.locator('.m019-assignments').waitFor();
 await admin.locator('.m019-member-list strong').filter({hasText:'Alice M019 Modifiée'}).waitFor();
 await admin.locator('.m019-assignments').getByRole('button',{name:'Retirer l’inscription',exact:true}).click();
 await modal.getByRole('button',{name:'Retirer',exact:true}).click();
 await admin.getByText('Aucun membre inscrit',{exact:true}).waitFor();
 const newPerson=ok(await get('/api/admin/member-directory?action=snapshot&search='+encodeURIComponent(email),adminToken),'read member created by phone').data.members[0];
 const finalDetail=ok(await get('/api/admin/member-directory?action=person_detail&personId='+encodeURIComponent(newPerson.id),adminToken),'read revoked phone member').data;
 assert.equal(finalDetail.celebrations.length,0);assert.equal(finalDetail.person.familyName,'M019 Modifiée');
 await admin.locator('[data-tab="celebrations"]').click();
 await admin.getByRole('button',{name:'Versions par catégorie',exact:true}).click();
 await admin.getByRole('button',{name:'＋ Ajouter une version',exact:true}).waitFor();
 await admin.locator('#member-spaces-workspace').getByRole('button',{name:'Dupliquer en brouillon',exact:true}).click();
 await modal.getByLabel('Titre de la page',{exact:true}).fill('Copie M019 retrouvable');
 await modal.getByLabel('Catégorie',{exact:true}).selectOption({label:category});
 await modal.getByLabel('Langue',{exact:true}).selectOption('en');
 await modal.getByRole('button',{name:'Créer le brouillon',exact:true}).click();
 await admin.getByRole('button',{name:'Enregistrer',exact:true}).waitFor();
 await admin.getByRole('button',{name:'← Célébrations',exact:true}).click();
 await admin.locator('[data-tab="celebrations"]').click();
 await admin.getByRole('button',{name:'Versions par catégorie',exact:true}).click();
 await admin.getByRole('button',{name:/Copie M019 retrouvable — English.*Brouillon/}).waitFor();
 await admin.screenshot({path:'docs/m019-smartphone/04-celebrations.png',fullPage:true});
 // A complete celebration copy is a real selectable canonical draft, not a local plan.
 await admin.locator('[data-tab="celebrations"]').click();
 await admin.getByRole('button',{name:'Dupliquer la célébration',exact:true}).click();
 await modal.getByLabel('Date du mercredi :',{exact:true}).fill('2026-10-07');
 await modal.getByLabel('Titre',{exact:true}).fill('Gabriel octobre — copie de démonstration');
 await Promise.all([
  admin.waitForURL(u=>/^\d+$/.test(u.searchParams.get('celebration')||'')&&u.searchParams.get('celebration')!==C,{timeout:30000}),
  modal.getByRole('button',{name:'Créer le brouillon',exact:true}).click()
 ]);
 const copiedId=new URL(admin.url()).searchParams.get('celebration');
 const copied=ok(await get('/api/admin/private-editor?celebration='+copiedId,adminToken),'real canonical copy');
 assert.equal(copied.celebrationVisibility,'draft');assert.equal(copied.record.celebrationDates.wednesday,'2026-10-07');
 assert.ok(copied.record.spaces.every(s=>!s.accessPolicy.typeIds));
 await admin.locator('[data-tab="members-spaces"]').click();
 await admin.locator('.m019-member-form').getByLabel('Célébration',{exact:true}).selectOption(copiedId);
 assert.equal((await fetch(origin+'/?celebration='+copiedId)).status,404,'new celebration remains a draft');
 event('M019_CANONICAL_COPY_PASS',{date:'2026-10-07',selectable_for_members:true,copied_rights:0});
 assert.deepEqual(nativeDialogs,[],'No browser alert/prompt/confirm in phone flows');
 assert.equal(await admin.locator('[data-tab="participants"]').count(),0);
 assert.deepEqual(errs,[],'No admin JS errors');
 event('M019_PHONE_PASS',{created:true,filtered:true,modified:true,revoked:true,duplicate_found:true,captures:4});
 // Verify the existing admin browser continues without a second dashboard.
 assert.deepEqual(errs,[],'Admin browser errors');
 await api('/api/admin/editor-session',{action:'logout'},adminToken);
 event('DONE',{official_unchanged:true,existing_preprod:true,
  fictional_celebration_only:true,targeted_M019_journeys_verified:true});
}finally{await browser.close()}
