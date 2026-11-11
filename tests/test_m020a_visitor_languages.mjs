import test from 'node:test';
import assert from 'node:assert/strict';
import {Script,runInNewContext} from 'node:vm';
import {createPreparedLanguageRegistry} from '../migration/cloudflare/app/domain/editor-localization.mjs';
import {projectPublishedLanguage} from '../migration/cloudflare/app/application/public-language-release.mjs';
import {publicSnapshot} from '../migration/cloudflare/editor-publication-api.mjs';
import {VISITOR_UI,visitorText} from '../migration/cloudflare/app/domain/visitor-ui-translations.mjs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
const url='https://example.test/?celebration=101&lang=';
const page={id:'neutral-accueil-general',name:'Mon titre français',group:'page',visibility:'published',blocks:[
 {id:1,kind:'heading',text:'Mon titre français'},
 {id:2,kind:'image',src:'/media/photo.jpg',text:'Photo originale'},
 {id:3,kind:'audio',src:'/media/histoire.mp3',text:'Histoire française'}]};
function state(){return {shared:{pages:[page]},drafts:{'101':{pages:[]}},published:{
 shared:{pages:[structuredClone(page)]},drafts:{'101':{pages:[]}},plans:[],
 translationReleases:{},celebrationVisibility:{'101':'published'}}};}
const project=(s,lang)=>projectPublishedLanguage(publicSnapshot(s,'101'),s.published,url+lang);
const release=(id,languageId,content)=>({pageId:id,publication:'published',variants:{[languageId]:content}});
test('M020-A: eight prepared languages, saved catalogues enriched without mutation or activation',()=>{
 const old={version:1,defaultLanguageId:'fr',languages:[{id:'fr',name:'Français',active:true}]};
 const before=JSON.stringify(old),registry=createPreparedLanguageRegistry(old);
 assert.deepEqual(registry.languages.map(l=>l.id),['fr','en','es','de','pt','it','ar','zh-Hans']);
 assert.ok(registry.languages.every(l=>l.active));
 assert.equal(JSON.stringify(old),before);
 assert.doesNotThrow(()=>new Script(DEMO_CLIENT));
 assert.match(DEMO_CLIENT,/createPreparedLanguageRegistry\(saved.registry\)/);
});
test('M020-A: catalogue and drafts never advertise languages; valid accessible releases do',()=>{
 const s=state();s.localization={pages:{[page.id]:{en:{name:'SECRET DRAFT',blocks:[{kind:'text',text:'secret'}]}}}};
 assert.deepEqual(project(s,'fr').publicLanguage.options,[]);
 s.published.translationReleases[page.id]=release(page.id,'en',{name:'English',blocks:[{kind:'text',text:'Published English'}]});
 assert.deepEqual(project(s,'en').publicLanguage.options.map(l=>l.id),['fr','en']);
 assert.equal(project(s,'en').shared.pages[0].name,'English');
 s.published.translationReleases[page.id].publication='draft';
 assert.deepEqual(project(s,'en').publicLanguage.options,[]);
 assert.doesNotMatch(JSON.stringify(project(s,'en')),/SECRET DRAFT|Published English/);
});
test('M020-A: private, hidden and malformed variants cannot make a language available',()=>{
 for(const patch of [{visibility:'hidden'},{visibility:'draft'},{accessPolicy:{mode:'SELECTED_TYPES',typeIds:['member-type:secret']}}]){
  const s=state();Object.assign(s.published.shared.pages[0],patch);
  s.published.translationReleases[page.id]=release(page.id,'ar',{name:'Secret Arabic',blocks:[{kind:'text',text:'SECRET'}]});
  assert.deepEqual(project(s,'ar').publicLanguage.options,[]);
  assert.doesNotMatch(JSON.stringify(project(s,'ar')),/Secret Arabic|SECRET/);
 }
 const s=state();s.published.translationReleases[page.id]=release(page.id,'en',{name:'Bad',blocks:[{kind:'text',text:'BAD'}],accessPolicy:{mode:'PUBLIC'}});
 assert.deepEqual(project(s,'en').publicLanguage.options,[]);
 assert.equal(project(s,'en').shared.pages[0].languageId,'fr');
});
test('M020-A: all missing translations retain original French title, images and audio',()=>{
 const s=state();const before=JSON.stringify(s);
 for(const lang of ['en','es','de','pt','it','ar','zh-Hans']){
  const result=project(s,lang),rendered=result.shared.pages[0];
  assert.equal(result.publicLanguage.selectedLanguageId,lang);
  assert.equal(rendered.languageId,'fr');assert.equal(rendered.usedFallback,true);
  assert.deepEqual(rendered.blocks,page.blocks);assert.equal(rendered.name,page.name);
 }
 assert.equal(JSON.stringify(s),before);
});
test('M020-A: translation dictionaries have identical keys and no empty messages',()=>{
 const keys=Object.keys(VISITOR_UI.fr);
 assert.equal(Object.keys(VISITOR_UI).length,8);
 for(const [lang,strings] of Object.entries(VISITOR_UI)){
  assert.deepEqual(Object.keys(strings),keys);
  assert.ok(Object.values(strings).every(s=>typeof s==='string'&&s.trim()));
  assert.ok(visitorText(lang,'missing'));
 }
 assert.equal(visitorText('en','missing'),'This page is not yet available in English. Showing the French version.');
 assert.doesNotThrow(()=>new Script(TRIAL_SITE_CLIENT));
});
test('M020-A: actual visitor notice goes below the title, Arabic notice is RTL, French content stays LTR',()=>{
 const source=TRIAL_SITE_CLIENT.slice(TRIAL_SITE_CLIENT.indexOf('function translationNotice('),TRIAL_SITE_CLIENT.indexOf('function renderLanguagePicker('));
 const heading={after(note){this.next=note}};
 const parent={querySelector(){return heading}};
 runInNewContext(source+';translationNotice(page,parent)',{
  uiLanguage:'ar',page:{languageId:'fr'},parent,
  t:key=>visitorText('ar',key),make:(tag,className,text)=>({tag,className,text})
 });
 assert.equal(parent.lang,'fr');assert.equal(parent.dir,'ltr');
 assert.equal(heading.next.lang,'ar');assert.equal(heading.next.dir,'rtl');
 assert.equal(heading.next.text,visitorText('ar','missing'));
 const translated={querySelector(){throw Error('No missing notice for real Arabic translation')}};
 runInNewContext(source+';translationNotice(page,parent)',{uiLanguage:'ar',page:{languageId:'ar'},parent:translated});
 assert.equal(translated.dir,'rtl');
});
