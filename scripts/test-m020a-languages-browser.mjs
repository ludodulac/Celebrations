// M008-A: entirely intercepted browser checks. Never request the real domain,
// mutate any D1/R2 resource or deploy an app. Exercises production public HTML,
// actual public GET projection, M006 DOM selector, desktop and mobile navigation.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {handleTrialSite} from '../migration/cloudflare/editor-trial-site-page.mjs';
import {publicSnapshot} from '../migration/cloudflare/editor-publication-api.mjs';
import {projectPublishedLanguage,publishLanguageCommand}
 from '../migration/cloudflare/app/application/public-language-release.mjs';
import {createLanguageRegistry,addLanguage,setLanguageActive}
 from '../migration/cloudflare/app/domain/editor-localization.mjs';

const HOST='https://celebrations-exit-staging.rondes.workers.dev';
const legal='neutral-'+'a'.repeat(36);
const canonical=(id,name,group='page',extra={})=>({
 id,name,group,visibility:'published',blocks:[{kind:'text',id:1,text:'FR '+name}],...extra
});
const shared={homeId:'neutral-accueil-general',pages:[
 canonical('neutral-accueil-general','Accueil'),
 canonical(legal,'Mentions légales','page',{placement:'footer'})
]};
const drafts={'101':{pages:[canonical('mercredi-101','Mercredi','celebration')],
 celebrationDates:{},celebrationTimes:{}}};
const registry=setLanguageActive(addLanguage(createLanguageRegistry(),
 {id:'en',name:'English',flag:'🇬🇧'}),'en',true);
const state={version:1,shared,drafts,plans:[],
 localization:{registry,pages:{
  'neutral-accueil-general':{en:{name:'Home',blocks:[{id:1,kind:'text',text:'WELCOME ENGLISH'}]}},
  [legal]:{en:{name:'Legal notice',blocks:[{id:1,kind:'text',text:'FOOTER ENGLISH'}]}},
  'mercredi-101':{en:{name:'Wednesday',blocks:[{id:1,kind:'text',text:'DAY ENGLISH'},
   {id:2,kind:'button',text:'Internal programme',displayAsButton:true,href:'/programme'}]}}
 }},
 published:{shared:structuredClone(shared),drafts:structuredClone(drafts),plans:[],
 celebrationVisibility:{}},mediaCatalogue:[]};
publishLanguageCommand(state,state.published,{kind:'language-registry'});
for(const pageId of ['neutral-accueil-general',legal,'mercredi-101'])
 publishLanguageCommand(state,state.published,{kind:'translation',
  celebration:'101',pageId,languageId:'en',visibility:'published'});

const stages=['preparation','mercredi','jeudi','vendredi','samedi','dimanche','apres-celebration'];
const data={
 celebrations:[{id:101,archangel:'Michaël',year:2026}],
 steps:stages.map((slug,i)=>({id:i+1,celebration_id:101,step_key:slug+'-101',
  label:slug,start_date:null,end_date:null,body_text:'Texte public '+slug})),
 events:[],eventContents:[],stepContents:[],links:[]
};
const env={DB:{prepare(sql){return {bind(){return {async all(){
 if(sql.includes('FROM celebrations_celebrations'))return {results:data.celebrations};
 if(sql.includes("FROM celebrations_contents WHERE audience='all'"))return {results:[]};
 if(sql.includes('FROM celebrations_steps'))return {results:data.steps};
 if(sql.includes('FROM celebrations_events WHERE'))return {results:[]};
 if(sql.includes('FROM celebrations_event_contents'))return {results:[]};
 if(sql.includes('FROM celebrations_step_contents'))return {results:[]};
 if(sql.includes('FROM celebrations_links'))return {results:[]};
 throw Error('Unexpected DB query: '+sql);
 }}}}}}};
const htmlResponse=await handleTrialSite(new Request(HOST+
 '/__editor/voir-le-site?celebration=101&page=mercredi&lang=en'),env);
assert.equal(htmlResponse.status,200);
const html=await htmlResponse.text();
assert.ok(html.includes('id="public-language-control"'));

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
try{
 for(const profile of [
  {name:'desktop',viewport:{width:1280,height:800}},
  {name:'Android-size',viewport:{width:375,height:812},isMobile:true,hasTouch:true,deviceScaleFactor:2}
 ]){
  const context=await browser.newContext({...profile,locale:'fr-FR'});
  const page=await context.newPage();
  const failures=[];
  page.on('pageerror',error=>failures.push(error.message));
  // Intercept EVERY request so the public test cannot contact actual site.
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin!==HOST)return route.fulfill({status:404,body:''});
   if(url.pathname==='/api/editor-publication'){
    const payload=projectPublishedLanguage(publicSnapshot(state,'101'),state.published,url.href);
    return route.fulfill({status:200,contentType:'application/json',
      body:JSON.stringify(payload)});
   }
   if(url.pathname==='/__editor/voir-le-site')
    return route.fulfill({status:200,contentType:'text/html',body:html});
   return route.fulfill({status:404,body:''});
  });
  await page.goto(HOST+'/__editor/voir-le-site?celebration=101&page=mercredi&lang=en');
  await page.locator('.public-language-selector summary').waitFor({state:'visible'});
  const selected=page.locator('.public-language-selector summary');
  assert.match(await selected.innerText(),/English/,profile.name+' selector must show published language');
  assert.ok((await page.locator('#stage-main').innerText()).includes('DAY ENGLISH'),
   profile.name+' must render published EN day');
  assert.match(await page.locator('a.trial-button').first().getAttribute('href'),
   /\/programme\?lang=en(?:$|&)/,
   profile.name+' internal editorial links must preserve language');
  const bounds=await selected.boundingBox();
  assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=profile.viewport.width+2,
   profile.name+' selector outside the visible screen');
  assert.equal(await page.locator('.public-language-options li').count(),2);
  await selected.click();
  await page.locator('.public-language-options a[lang="fr"]').click();
  await page.waitForURL(url=>url.searchParams.get('lang')==='fr');
  assert.ok((await page.locator('#stage-main').innerText()).includes('FR Mercredi'),
   profile.name+' French page must remain unchanged');
  assert.equal(new URL(page.url()).searchParams.get('page'),'mercredi',
   profile.name+' language choice must preserve current canonical page');
  await page.locator('.public-language-selector summary').click();
  await page.locator('.public-language-options a[lang="en"]').click();
  await page.waitForURL(url=>url.searchParams.get('lang')==='en');
  await page.getByRole('button',{name:/Menu/}).click();
  await page.getByRole('button',{name:/Home/}).first().click();
  assert.equal(new URL(page.url()).searchParams.get('lang'),'en',
    profile.name+' language must survive site navigation');
  assert.ok((await page.locator('#stage-main').innerText()).includes('WELCOME ENGLISH'),
    profile.name+' translated home must render');
  assert.ok((await page.locator('#footer-pages').innerText()).includes('Legal notice'),
    profile.name+' published footer translation must be shown');
  // Explicit language requests keep the UI language while French editorial media remains intact.
  await page.goto(HOST+'/__editor/voir-le-site?celebration=101&page=mercredi&lang=ar');
  await page.locator('.translation-missing').waitFor();
  assert.equal(await page.locator('html').getAttribute('dir'),'rtl');
  assert.equal(await page.locator('#stage-main').getAttribute('dir'),'ltr');
  assert.equal(await page.locator('#stage-main').getAttribute('lang'),'fr');
  assert.equal(await page.locator('.translation-missing').getAttribute('dir'),'rtl');
  assert.match(await page.locator('#stage-main').innerText(),/FR Mercredi/);
  assert.match(await page.locator('.translation-missing').innerText(),/هذه الصفحة/);
  assert.equal(await page.locator('.translation-missing').evaluate(n=>/^H[12]$/.test(n.previousElementSibling?.tagName)),true);
  // Removing publication must hide the selector even though the catalogue and editor draft remain.
  const released=state.published.translationReleases;
  state.published.translationReleases={};
  await page.goto(HOST+'/__editor/voir-le-site?celebration=101&page=mercredi');
  await page.locator('#stage-main').getByText('FR Mercredi',{exact:true}).waitFor();
  assert.equal(await page.locator('.public-language-selector').count(),0);
  state.published.translationReleases=released;
  assert.deepEqual(failures,[],profile.name+' had browser script failures');
  await context.close();
  process.stdout.write('M020-A browser PASS: '+profile.name+' / language, navigation, footer, fallback, mobile bounds\\n');
 }
}finally{await browser.close()}
