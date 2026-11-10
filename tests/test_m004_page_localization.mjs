import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {
 createLanguageRegistry,addLanguage,setPageTranslation,resolvePageTranslation,
 editorLocalizationInlineSource
} from '../migration/cloudflare/app/domain/editor-localization.mjs';
import {createEditorSyncPolicy} from '../migration/cloudflare/app/application/editor-sync-policy.mjs';
import {handleServerDraft} from '../migration/cloudflare/editor-server-draft-api.mjs';
import {publicSnapshot} from '../migration/cloudflare/editor-publication-api.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';

const origin='https://celebrations-exit-staging.rondes.workers.dev';
const token='a'.repeat(64);
const footerId='neutral-'+'b'.repeat(36);
const frenchHome=()=>({id:'neutral-accueil-general',group:'page',name:'Accueil',
  visibility:'published',blocks:[{id:1,kind:'text',text:'Bonjour'},
    {id:2,kind:'button',text:'Livret',href:'/letter/ancien.pdf'}],
  accessPolicy:{mode:'PUBLIC'},position:3});
const frenchFooter=()=>({id:footerId,group:'page',placement:'footer',name:'Mentions légales',
  visibility:'published',blocks:[{id:1,kind:'text',text:'Texte légal français'}],
  permissionRule:{members:['staff']}});
const registry=()=>addLanguage(createLanguageRegistry(),
  {id:'en',name:'English',flag:'🇬🇧'}); // Inactive: editing must remain possible.
const localization=()=>({registry:registry(),pages:{
  'neutral-accueil-general':{en:{name:'Home',blocks:[
    {id:1,kind:'text',text:'Hello — private translation'},
    {id:2,kind:'button',text:'Booklet',href:'/letter/en/booklet.pdf'}]}},
  [footerId]:{en:{name:'Legal notice',blocks:[
    {id:1,kind:'image',src:'/media/new/en-legal.jpg'},
    {id:2,kind:'text',text:'English legal notice'}]}}
}});
const body=()=>({celebration:'101',expectedRevision:0,
 record:{pages:[{id:'mercredi-101',group:'celebration',name:'Mercredi',
   blocks:[{id:1,kind:'text',text:'Programme'}]}]},
 plans:[],shared:{pages:[frenchHome(),frenchFooter()],homeId:'neutral-accueil-general'},
 localization:localization()});
const req=(method,path,data)=>new Request(origin+path,{
 method,headers:{authorization:'Bearer '+token,...(data?{'content-type':'application/json'}:{})},
 ...(data?{body:JSON.stringify(data)}:{})
});
function fakeBucket(){
 let stored=null,revision=0;
 return {snapshot:()=>stored?JSON.parse(stored):null,
  async get(){return stored===null?null:{etag:String(revision),body:true,text:async()=>stored}},
  async put(_key,value,{onlyIf}){
   if(stored===null&&onlyIf?.etagDoesNotMatch!=='*')return null;
   if(stored!==null&&onlyIf?.etagMatches!==String(revision))return null;
   stored=value;revision++;return {etag:String(revision)};
  }
 };
}
const env=bucket=>({DB:{prepare:()=>({bind:()=>({first:async()=>({
 email:'test@localhost',expires_at:'2099-01-01T00:00:00.000Z'})})})},MEDIA_BUCKET:bucket});

test('M004: same stable page ID, menu position, footer placement and access metadata',()=>{
 const root=frenchFooter(),original=JSON.stringify(root);
 const translated=setPageTranslation(root,registry(),'en',
  {name:'Legal notice',blocks:[{kind:'button',href:'/letter/en.pdf'}]});
 assert.equal(root.translations,undefined);
 assert.equal(JSON.stringify(root),original);
 assert.equal(translated.id,root.id);
 assert.equal(translated.placement,'footer');
 assert.equal(translated.permissionRule.members[0],'staff');
 assert.equal(translated.visibility,'published');
 assert.equal(translated.translations.en.blocks[0].href,'/letter/en.pdf');
 assert.equal(translated.name,'Mentions légales');
 assert.equal(translated.blocks[0].text,'Texte légal français');
});
test('M004: separate translations never mutate old French image and PDF links',()=>{
 const fr=frenchHome(),english=setPageTranslation(fr,registry(),'en',
  localization().pages[fr.id].en);
 english.translations.en.blocks[1].href='/letter/en/updated.pdf';
 assert.equal(fr.blocks[1].href,'/letter/ancien.pdf');
 assert.equal(english.blocks[1].href,'/letter/ancien.pdf');
 assert.equal(english.translations.en.blocks[1].href,'/letter/en/updated.pdf');
 // Inactive languages are explicitly editable but not silently public.
 assert.equal(resolvePageTranslation(english,registry(),'en').languageId,'fr');
});
test('M004: existing M003 functions are embedded into the existing inline editor',()=>{
 const source=editorLocalizationInlineSource();
 assert.match(source,/function setPageTranslation/);
 assert.match(source,/function createLanguageRegistry/);
 assert.match(DEMO_CLIENT,/Langue à modifier/);
 assert.match(DEMO_CLIENT,/LOCALIZATION_KEY/);
 assert.match(DEMO_CLIENT,/commitLocalizedView/);
 assert.match(DEMO_CLIENT,/saveLocalizationLocal/);
 assert.match(DEMO_CLIENT,/group==='footer'/);
 assert.doesNotThrow(()=>new Script(DEMO_CLIENT));
});
test('M004: client conflict and readback checks include localization, old M10 callers survive',()=>{
 const policy=createEditorSyncPolicy(),local=localization(),modified=structuredClone(local);
 modified.pages[footerId].en.name='Changed';
 const old={record:{pages:[]},shared:{pages:[]},plans:[],localization:local};
 assert.equal(policy.unchangedRemote(old,old.record,old.shared,old.plans,local),true);
 assert.equal(policy.unchangedRemote({...old,localization:modified},
  old.record,old.shared,old.plans,local),false);
 assert.equal(policy.unchangedRemote({...old,localization:modified},
  old.record,old.shared,old.plans),true);
 assert.equal(policy.readbackConfirmed({revision:3,record:{pages:[]},
  shared:{pages:[]},localization:modified},3,null,{pages:[]},{pages:[]},local),false);
 assert.equal(policy.readbackConfirmed({revision:3,record:{pages:[]},
  shared:{pages:[]},localization:local},3,null,{pages:[]},{pages:[]},local),true);
});
test('M004: private API persists and reads both variants, public snapshot remains French-only',async()=>{
 const bucket=fakeBucket(),first=body(),response=await handleServerDraft(req('POST','/api/editor-server-draft',first),env(bucket));
 assert.equal(response.status,200,await response.text());
 const stored=bucket.snapshot();
 assert.deepEqual(stored.shared.pages,first.shared.pages);
 assert.equal(stored.localization.pages[footerId].en.name,'Legal notice');
 assert.equal(stored.localization.pages['neutral-accueil-general'].en.blocks[1].href,'/letter/en/booklet.pdf');
 const publicView=publicSnapshot(stored,'101');
 assert.equal(publicView.shared.pages.find(p=>p.id===footerId).placement,'footer');
 assert.equal(publicView.shared.pages[0].name,'Accueil');
 assert.equal(JSON.stringify(publicView).includes('private translation'),false);
 assert.equal(JSON.stringify(publicView).includes('English legal notice'),false);
 assert.equal(JSON.stringify(publicView).includes('/letter/en/booklet.pdf'),false);
 const get=await handleServerDraft(req('GET','/api/editor-server-draft?celebration=101'),env(bucket));
 assert.equal(get.status,200);
 const saved=await get.json();
 assert.deepEqual(saved.localization,first.localization);
 assert.equal(saved.shared.pages[0].blocks[1].href,'/letter/ancien.pdf');
});
test('M004: updating English keeps French unchanged, stale revision returns 409',async()=>{
 const bucket=fakeBucket(),first=body();
 assert.equal((await handleServerDraft(req('POST','/api/editor-server-draft',first),env(bucket))).status,200);
 const updated=structuredClone(first);updated.expectedRevision=1;
 updated.localization.pages[footerId].en.blocks[1].text='Updated English';
 assert.equal((await handleServerDraft(req('POST','/api/editor-server-draft',updated),env(bucket))).status,200);
 const state=bucket.snapshot();
 assert.equal(state.shared.pages[1].blocks[0].text,'Texte légal français');
 assert.equal(state.localization.pages[footerId].en.blocks[1].text,'Updated English');
 assert.equal((await handleServerDraft(req('POST','/api/editor-server-draft',updated),env(bucket))).status,409);
 assert.equal(bucket.snapshot().version,2);
});
test('M004: forged rights or page identity inside translation is rejected before storage',async()=>{
 const bucket=fakeBucket();
 for(const forbidden of ['visibility','id','permissionRule','placement']){
  const request=body();
  request.localization.pages[footerId].en[forbidden]=forbidden==='id'?'forged':'published';
  const response=await handleServerDraft(req('POST','/api/editor-server-draft',request),env(bucket));
  assert.equal(response.status,400,forbidden);
  assert.equal(bucket.snapshot(),null);
 }
});
test('M004: deletion cannot persist orphaned translations',async()=>{
 const bucket=fakeBucket(),request=body();
 request.shared.pages.pop();
 const response=await handleServerDraft(req('POST','/api/editor-server-draft',request),env(bucket));
 assert.equal(response.status,400);
 assert.equal(bucket.snapshot(),null);
});
