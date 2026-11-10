import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {createLanguageRegistry,addLanguage,setLanguageActive,setDefaultLanguage}
 from '../migration/cloudflare/app/domain/editor-localization.mjs';
import {publicSnapshot,handleEditorPublication,readEditorState}
 from '../migration/cloudflare/editor-publication-api.mjs';
import {projectPublishedLanguage,publishLanguageCommand}
 from '../migration/cloudflare/app/application/public-language-release.mjs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {handleTrialSite} from '../migration/cloudflare/editor-trial-site-page.mjs';

const origin='https://www.ronde-des-archanges-universelle.eu';
const footerId='neutral-'+'a'.repeat(36);
const page=(id,name,group='page',extra={})=>({id,name,group,visibility:'published',
 blocks:[{id:1,kind:'text',text:'FR '+name}],...extra});
const registry=()=>setLanguageActive(addLanguage(createLanguageRegistry(),
 {id:'en',name:'English',flag:'🇬🇧'}),'en',true);
const state=()=>{
 const shared={homeId:'neutral-accueil-general',pages:[
  page('neutral-accueil-general','Accueil'),
  page(footerId,'Mentions légales','page',{placement:'footer'})]};
 const drafts={'101':{pages:[page('mercredi-101','Mercredi','celebration')],
  celebrationDates:{},celebrationTimes:{}}};
 const translations={
  'neutral-accueil-general':{en:{name:'Home',blocks:[{id:1,kind:'text',text:'Hello public'}]}},
  [footerId]:{en:{name:'Legal notice',blocks:[{id:1,kind:'text',text:'English legal'}]}},
  'mercredi-101':{en:{name:'Wednesday',blocks:[{id:1,kind:'text',text:'Wednesday event'}]}}
 };
 return {version:1,shared,drafts,plans:[],
  published:{shared:structuredClone(shared),drafts:structuredClone(drafts),plans:[],
   celebrationVisibility:{}},
  localization:{registry:registry(),pages:translations},
  mediaCatalogue:[]};
};
const projected=(s,lang='en')=>projectPublishedLanguage(publicSnapshot(s,'101'),
 s.published,origin+'/__editor/voir-le-site?celebration=101&page=mercredi&lang='+lang+'#top');

test('M008-A: French public site is byte-stable when no release exists',()=>{
 const s=state(),before=JSON.stringify(s);
 const p=projected(s,'en');
 assert.deepEqual(p.shared.pages.map(x=>x.name),['Accueil','Mentions légales']);
 assert.equal(p.record.pages[0].name,'Mercredi');
 assert.deepEqual(p.publicLanguage.options.map(x=>x.id),['fr']);
 assert.equal(p.publicLanguage.selectedLanguageId,'fr');
 assert.equal(JSON.stringify(p).includes('Hello public'),false);
 assert.equal(JSON.stringify(s),before,'public projection must not modify R2 state');
});

test('M008-A: explicit registry + three independent releases render pages, footer and celebration',()=>{
 const s=state();
 publishLanguageCommand(s,s.published,{kind:'language-registry'});
 for(const pageId of ['neutral-accueil-general',footerId,'mercredi-101'])
  publishLanguageCommand(s,s.published,{kind:'translation',celebration:'101',
   pageId,languageId:'en',visibility:'published'});
 const p=projected(s);
 assert.deepEqual(p.shared.pages.map(x=>x.name),['Home','Legal notice']);
 assert.equal(p.record.pages[0].name,'Wednesday');
 assert.equal(p.shared.pages[0].blocks[0].text,'Hello public');
 assert.deepEqual(p.shared.pages.map(x=>x.id),s.shared.pages.map(x=>x.id));
 assert.equal(p.shared.pages[1].placement,'footer');
 assert.equal(p.record.pages[0].id,'mercredi-101');
 assert.deepEqual(p.publicLanguage.options.map(x=>x.name),['Français','English']);
 assert.deepEqual(p.publicLanguage.options.map(x=>x.flag),['🇫🇷','🇬🇧']);
 assert.equal(p.publicLanguage.options.find(x=>x.selected).id,'en');
 assert.ok(p.publicLanguage.options[0].href.includes('page=mercredi&lang=fr#top'));
});

test('M008-A: saving a changed draft does not alter released content',()=>{
 const s=state();publishLanguageCommand(s,s.published,{kind:'language-registry'});
 publishLanguageCommand(s,s.published,{kind:'translation',celebration:'101',
  pageId:'mercredi-101',languageId:'en',visibility:'published'});
 s.localization.pages['mercredi-101'].en.blocks[0].text='UNPUBLISHED SECRET';
 const p=projected(s);
 assert.equal(p.record.pages[0].blocks[0].text,'Wednesday event');
 assert.equal(JSON.stringify(p).includes('UNPUBLISHED SECRET'),false);
});

test('M008-A: invalid or unpublished releases cannot inject metadata, hidden pages stay hidden',()=>{
 const s=state();publishLanguageCommand(s,s.published,{kind:'language-registry'});
 s.localization.pages['mercredi-101'].en={name:'Danger',blocks:[],accessPolicy:{mode:'PUBLIC'}};
 assert.throws(()=>publishLanguageCommand(s,s.published,{kind:'translation',
  celebration:'101',pageId:'mercredi-101',languageId:'en',visibility:'published'}));
 s.published.shared.pages.push(page('neutral-private','SECRET','page',
  {accessPolicy:{mode:'SELECTED_TYPES',typeIds:['member-type:staff']}}));
 s.published.drafts['101'].pages.push(page('jeudi-101','SECRET DAY','celebration',
  {visibility:'draft'}));
 const p=projected(s);
 assert.equal(JSON.stringify(p).includes('SECRET DAY'),false);
 assert.equal(JSON.stringify(p).includes('SECRET'),false);
 assert.equal(p.record.pages[0].name,'Mercredi');
});

test('M008-A: missing translation falls back to French; disabled source fails closed',()=>{
 const s=state();publishLanguageCommand(s,s.published,{kind:'language-registry'});
 assert.equal(projected(s).shared.pages[0].name,'Accueil');
 let modified=setDefaultLanguage(registry(),'en');
 modified=setLanguageActive(modified,'fr',false);
 s.published.languageRegistry=modified;
 const p=projected(s);
 assert.deepEqual(p.shared.pages,[]);
 assert.deepEqual(p.record.pages,[]);
});

test('M008-A: withdrawing one variant leaves other releases and private drafts untouched',()=>{
 const s=state();publishLanguageCommand(s,s.published,{kind:'language-registry'});
 for(const id of ['neutral-accueil-general',footerId])
  publishLanguageCommand(s,s.published,{kind:'translation',celebration:'101',
   pageId:id,languageId:'en',visibility:'published'});
 publishLanguageCommand(s,s.published,{kind:'translation',celebration:'101',
  pageId:'neutral-accueil-general',languageId:'en',visibility:'draft'});
 assert.deepEqual(projected(s).shared.pages.map(x=>x.name),['Accueil','Legal notice']);
 assert.equal(s.localization.pages['neutral-accueil-general'].en.name,'Home');
});

test('M008-A: public component compiles and preserves navigation without private browser state',()=>{
 assert.doesNotThrow(()=>new Script(TRIAL_SITE_CLIENT));
 assert.doesNotThrow(()=>new Script(DEMO_CLIENT));
 assert.match(TRIAL_SITE_CLIENT,/renderPublicLanguageSelector/);
 assert.match(TRIAL_SITE_CLIENT,/renderLanguagePicker/);
 assert.match(TRIAL_SITE_CLIENT,/history.replaceState/);
 assert.match(TRIAL_SITE_CLIENT,/next.searchParams.set\('page',slug\)/);
 assert.match(TRIAL_SITE_CLIENT,/next.searchParams.set\('celebration',celebration\)/);
 assert.equal(TRIAL_SITE_CLIENT.includes('localStorage.getItem('),false);
});

class Bucket{
 constructor(value){this.value=JSON.stringify(value);this.rev=1;}
 async get(){return {etag:String(this.rev),body:true,text:async()=>this.value};}
 async put(_key,value,{onlyIf}={}){
  if(String(this.rev)!==onlyIf.etagMatches)return null;
  this.value=value;this.rev++;return {etag:String(this.rev)};
 }
}
const secret='a'.repeat(64);
async function cookie(){
 const payload=String(Date.now())+'.'+'b'.repeat(32);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),
  {name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=await crypto.subtle.sign('HMAC',key,
  new TextEncoder().encode('site-editor-v1:'+payload));
 return 'celebrations_editor_access='+payload+'.'+Buffer.from(sig).toString('hex');
}
const req=(args,auth)=>new Request(origin+'/api/editor-publication',{method:'POST',
 headers:{origin,'content-type':'application/json',...(auth?{cookie:auth}:{})},
 body:JSON.stringify(args)});

test('M008-A HTTP: anonymous writes forbidden, explicit POST publishes and GET returns no drafts',async()=>{
 const bucket=new Bucket(state()),env={EDITOR_BUCKET:bucket,ADMIN_PASSWORD_HASH:secret};
 const base={celebration:'101',expectedRevision:1};
 const command={...base,kind:'language-registry'};
 assert.equal((await handleEditorPublication(req(command,''),env)).status,401);
 const auth=await cookie();
 assert.equal((await handleEditorPublication(req(command,auth),env)).status,200);
 const translation={...base,expectedRevision:2,kind:'translation',pageId:'mercredi-101',
  languageId:'en',visibility:'published'};
 assert.equal((await handleEditorPublication(req(translation,auth),env)).status,200);
 const result=await handleEditorPublication(new Request(
  origin+'/api/editor-publication?celebration=101&lang=en'),env);
 assert.equal(result.status,200);
 const payload=await result.json();
 assert.equal(payload.record.pages[0].name,'Wednesday');
 assert.equal(payload.publicLanguage.selectedLanguageId,'en');
 assert.equal(JSON.stringify(payload).includes('localization'),false);
 assert.equal(JSON.stringify(payload).includes('translationReleases'),false);
 assert.equal(JSON.stringify(payload).includes('French private'),false);
 assert.equal((await readEditorState(bucket)).state.version,3);
 assert.equal((await handleEditorPublication(req(translation,auth),env)).status,409);
});
