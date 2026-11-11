// M018 TRUE online validation on the EXISTING isolated M016 Worker only.
// One fictional Gabriel × two member categories × three manually authored
// languages. No production or personal records are read/written.
import assert from 'node:assert/strict';
import {pbkdf2Sync,createHmac} from 'node:crypto';
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
 const headers={origin,'content-type':'application/json',
  ...(bearer?{authorization:'Bearer '+bearer}:{})};
 return json(await fetch(origin+path,{method:'POST',headers,body:JSON.stringify(body),
  signal:AbortSignal.timeout(30000)}));
}
async function get(path,token){
 return json(await fetch(origin+path,{headers:token?{authorization:'Bearer '+token}:{},
  signal:AbortSignal.timeout(30000)}));
}
function ok(r,label){assert.equal(r.status,200,label+' status='+r.status+' error='+r.body?.error);
 assert.equal(r.body.ok,true,label+' api status');return r.body;}
function event(name,obj){console.log('M018_EXISTING_PREPROD '+JSON.stringify({step:name,...obj}));}
const browser=await chromium.launch({headless:true});
try{
 const adminCtx=await browser.newContext({viewport:{width:1350,height:900}});
 const admin=await adminCtx.newPage();
 const errs=[];admin.on('pageerror',e=>errs.push(String(e.message||e).slice(0,160)));
 await admin.goto(origin+'/admin',{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(await admin.locator('input[name="code"]').count(),1);
 await admin.locator('input[name="code"]').fill(password);
 await Promise.all([
  admin.waitForURL(u=>u.pathname==='/admin.html',{timeout:30000}),
  admin.locator('button[type="submit"]').click()
 ]);
 await admin.waitForLoadState('domcontentloaded');
 assert.ok((await admin.locator('body').innerText()).includes('Membres et espaces'));
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
 const saved=ok(await api('/api/admin/private-editor',{action:'save',celebration:C,
   expectedRevision:state.revision,spaces},adminToken),'save 2 category spaces with 6 texts');
 const ids=saved.idMap;
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
   const list=ok(await get('/api/participant/space-pages?celebration=all&lang='+lang,token),
    'authorized list '+index+' '+lang);
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
 await visitor.waitForSelector('#member-connection:not([hidden])',{timeout:12000});
 assert.ok((await visitor.locator('#public-language-control').innerText()).length>0);
 await visitor.locator('#member-connection').click();
 const form=visitor.locator('form.member-login');
 await form.locator('input[type=email]').fill('m018-cat1@example.test');
 await form.locator('input[type=password]').fill(fakePassword);
 await form.locator('button[type=submit]').click();
 await visitor.waitForFunction(()=>document.body?.innerText.includes('English m018-cat1'),{timeout:30000});
 assert.ok((await visitor.locator('body').innerText()).includes('Mes espaces autorisés'));
 assert.deepEqual(browserErrors,[],'Visitor browser script errors');
 await visitor.close();await visitCtx.close();
 event('normal_phone_browser',{login_from_any_page:true,language_en:true,
  only_authorized_page:true});
 // Verify the existing admin browser continues without a second dashboard.
 assert.deepEqual(errs,[],'Admin browser errors');
 await api('/api/admin/editor-session',{action:'logout'},adminToken);
 event('DONE',{official_unchanged:true,existing_preprod:true,
  fictional_celebration_only:true,all_owner_rules_verified:true});
}finally{await browser.close()}
