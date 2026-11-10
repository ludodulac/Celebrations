import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 createLanguageRegistry,addLanguage,setLanguageActive,setDefaultLanguage
} from '../migration/cloudflare/app/domain/editor-localization.mjs';
import {
 LANGUAGE_QUERY_PARAMETER,languageFromUrl,withLanguageInInternalLink,
 activePublicLanguages,preparePublicLanguageNavigation
} from '../migration/cloudflare/app/domain/public-language-navigation.mjs';

const SITE='https://www.ronde-des-archanges-universelle.eu';
const registry=()=>setLanguageActive(
 addLanguage(createLanguageRegistry(),{id:'en',name:'English',flag:'🇬🇧'}),'en',true);
const home=()=>({id:'neutral-accueil-general',name:'Accueil',group:'page',
 visibility:'published',blocks:[{kind:'text',text:'Bonjour'}],position:0,
 accessPolicy:{mode:'PUBLIC'}});
const foo=()=>({...home(),id:'neutral-footer',name:'Mentions légales',
 placement:'footer'});
const day=()=>({id:'mercredi-101',group:'celebration',name:'Mercredi',
 visibility:'published',blocks:[{kind:'button',href:'/letter/original.pdf'}]});
const snapshot=()=>({ok:true,celebrationVisible:true,shared:{pages:[home(),foo()]},
 record:{pages:[day()]},localization:{pages:{
 'neutral-accueil-general':{en:{name:'SECRET DRAFT',blocks:[{text:'NEVER PUBLIC'}]}}
 }}});
const release=(id,name,blocks=[])=>({publication:'published',pageId:id,
 variants:{en:{name,blocks}}});
const hrefForPage=page=>({
 'neutral-accueil-general':'/','neutral-footer':'/mentions-legales',
 'mercredi-101':'/mercredi'
})[page.id];
const project=(extra={})=>preparePublicLanguageNavigation({
 snapshot:snapshot(),registry:registry(),
 currentUrl:SITE+'/mercredi?x=1&lang=en#programme',
 hrefForPage,...extra
});

test('M006: active names and flags only; selector URL preserves query and anchor',()=>{
 const r=setLanguageActive(registry(),'en',false);
 const opts=activePublicLanguages(r,'en',SITE+'/mercredi?src=1#jour');
 assert.deepEqual(opts.map(x=>x.id),['fr']);
 assert.equal(opts[0].flag,'🇫🇷');
 assert.equal(opts[0].selected,true);
 assert.equal(opts[0].href,'/mercredi?src=1&lang=fr#jour');
 assert.equal(LANGUAGE_QUERY_PARAMETER,'lang');
 assert.equal(languageFromUrl(SITE+'/mercredi?lang=en'),'en');
});
test('M006: switching language changes query, never path or external/media links',()=>{
 const current=SITE+'/programme?src=mail#top';
 assert.equal(withLanguageInInternalLink('/mercredi?src=mail#part','en',current),
  '/mercredi?src=mail&lang=en#part');
 assert.equal(withLanguageInInternalLink('/mercredi?lang=fr&x=1','en',current),
  '/mercredi?lang=en&x=1');
 for(const link of ['https://example.org/path?x=1','/letter/doc.pdf',
  '/media/new/fichier.jpg','/api/editor-publication','/__editor/demo-preparation',
  '/admin','mailto:personne@example.org','javascript:alert(1)'])
  assert.equal(withLanguageInInternalLink(link,'en',current),link);
});
test('M006: public menu preserves canonical IDs, routes, order, footer and publication',()=>{
 const result=project();
 assert.deepEqual(result.menu.map(p=>p.pageId),[
  'neutral-accueil-general','neutral-footer','mercredi-101']);
 assert.deepEqual(result.menu.map(p=>p.href),[
  '/?lang=en','/mentions-legales?lang=en','/mercredi?lang=en']);
 assert.equal(result.menu[1].placement,'footer');
 assert.equal(result.menu[0].languageId,'fr');
 assert.equal(result.menu[0].usedFallback,true);
 assert.equal(result.options.find(p=>p.id==='en').selected,true);
 assert.equal(result.menu[2].content.blocks[0].href,'/letter/original.pdf');
});
test('M006 security: private editor localization and page.translations are NEVER public',()=>{
 const s=snapshot();
 s.shared.pages[0].translations={en:{name:'PRIVATE ATTACHMENT',blocks:[
  {kind:'button',href:'/media/new/secret.pdf'}]}};
 const result=project({snapshot:s});
 const serialized=JSON.stringify(result);
 assert.ok(!serialized.includes('NEVER PUBLIC'));
 assert.ok(!serialized.includes('SECRET DRAFT'));
 assert.ok(!serialized.includes('PRIVATE ATTACHMENT'));
 assert.ok(!serialized.includes('secret.pdf'));
 assert.equal(result.menu[0].name,'Accueil');
});
test('M006: only explicitly released translations can be displayed',()=>{
 const result=project({publishedPageReleases:{
  'neutral-accueil-general':release('neutral-accueil-general','Home',[
   {kind:'text',text:'Hello'}]),
  'neutral-footer':release('neutral-footer','Legal notice',[]),
  'mercredi-101':release('mercredi-101','Wednesday',[])
 }});
 assert.deepEqual(result.menu.map(p=>p.name),['Home','Legal notice','Wednesday']);
 assert.equal(result.menu[0].content.blocks[0].text,'Hello');
 assert.equal(result.menu[0].languageId,'en');
 assert.equal(result.menu[0].usedFallback,false);
 assert.equal(result.menu[0].pageId,'neutral-accueil-general');
});
test('M006 security: untranslated, unapproved and forged translations fall back',()=>{
 const variants={
  'neutral-accueil-general':{publication:'draft',pageId:'neutral-accueil-general',
   variants:{en:{name:'HIDDEN',blocks:[]}}},
  'neutral-footer':release('wrong-id','BAD',[]),
  'mercredi-101':release('mercredi-101','INVALID',[])
 };
 variants['mercredi-101'].variants.en.id='forged-identity';
 const result=project({publishedPageReleases:variants});
 assert.deepEqual(result.menu.map(p=>p.name),['Accueil','Mentions légales','Mercredi']);
 assert.equal(JSON.stringify(result).includes('HIDDEN'),false);
});
test('M006 security: unpublished pages, unauthorized policies and invisible celebrations disappear',()=>{
 const s=snapshot();
 s.shared.pages.push({...home(),id:'draft',visibility:'draft'},
  {...home(),id:'hidden',visibility:'hidden'},
  {...home(),id:'restricted',accessPolicy:{mode:'SELECTED_TYPES',
    typeIds:['member-type:team']}});
 s.record.pages.push({...day(),id:'dimanche-101',visibility:'hidden'});
 const anonymous=project({snapshot:s,publishedPageReleases:{
  restricted:release('restricted','Secret',[])
 }});
 assert.equal(anonymous.menu.some(p=>p.pageId==='restricted'),false);
 assert.equal(anonymous.menu.some(p=>p.pageId==='draft'),false);
 assert.equal(anonymous.menu.some(p=>p.pageId==='hidden'),false);
 const invisible=project({snapshot:{...s,celebrationVisible:false}});
 assert.equal(invisible.menu.some(p=>p.pageId==='mercredi-101'),false);
});
test('M006 security: canonical M002 authorization can approve member pages but not browser claims',()=>{
 const s=snapshot();
 s.shared.pages.push({...home(),id:'restricted',accessPolicy:{mode:'SELECTED_TYPES',
   typeIds:['member-type:team']}});
 const context={principal:{id:'member1',authenticated:true},
  types:[{id:'member-type:team'}],
  memberships:[{memberId:'member1',typeId:'member-type:team'}]};
 const yes=project({snapshot:s,context});
 assert.equal(yes.menu.some(p=>p.pageId==='restricted'),true);
 const no=project({snapshot:s,context:{...context,principal:{id:'member1',
  authenticated:false}}});
 assert.equal(no.menu.some(p=>p.pageId==='restricted'),false);
});
test('M006 security: private space page cannot be made public by selecting a language',()=>{
 const s=snapshot();
 s.shared.pages.push({...home(),id:'space-page',spaceId:'private-space',
  celebrationId:'101'});
 const result=project({snapshot:s});
 assert.equal(result.menu.some(p=>p.pageId==='space-page'),false);
});
test('M006: disabled and unknown languages always fall back to active default',()=>{
 const reg=setLanguageActive(registry(),'en',false);
 const result=project({registry:reg});
 assert.equal(result.selectedLanguageId,'fr');
 assert.deepEqual(result.options.map(p=>p.id),['fr']);
 assert.equal(result.menu[0].name,'Accueil');
 assert.equal(result.menu[0].href,'/?lang=fr');
 const unknown=project({requestedLanguageId:'xx'});
 assert.equal(unknown.selectedLanguageId,'fr');
});
test('M006: missing translation uses configured default, then active original',()=>{
 const reg=setDefaultLanguage(registry(),'en');
 const found=project({registry:reg,requestedLanguageId:'xx',
  publishedPageReleases:{'neutral-accueil-general':
   release('neutral-accueil-general','Home',[])}});
 assert.equal(found.selectedLanguageId,'en');
 assert.equal(found.menu[0].name,'Home');
 assert.equal(found.menu[1].name,'Mentions légales');
 const noFrench=setLanguageActive(reg,'fr',false);
 const only=project({registry:noFrench,requestedLanguageId:'en'});
 assert.equal(only.menu.length,0); // no published active translation, fail closed
});
test('M006: malformed public response fails closed; no invented page links',()=>{
 assert.equal(project({snapshot:{ok:false,shared:{pages:[home()]}}}),null);
 assert.equal(project({snapshot:{ok:true,shared:{pages:null}}}),null);
 const result=project({hrefForPage:()=>undefined});
 assert.equal(result.menu[0].href,null);
 const bad=project({hrefForPage:()=> 'javascript:alert(1)'});
 assert.equal(bad.menu[0].href,null);
});
test('M006: no mutation of public snapshots, releases, registry and canonical URLs',()=>{
 const s=snapshot(),r=registry(),p={
  'neutral-accueil-general':release('neutral-accueil-general','Home',[])};
 const original=JSON.stringify({s,r,p});
 const result=project({snapshot:s,registry:r,publishedPageReleases:p});
 result.menu[0].content.name='Changed';
 assert.equal(JSON.stringify({s,r,p}),original);
});
test('M006: isolated modules never fetch editor drafts, perform writes or alter workers',()=>{
 const files=[
  '../migration/cloudflare/app/domain/public-language-navigation.mjs',
  '../migration/cloudflare/app/application/public-language-selector.mjs'];
 for(const file of files){
  const source=readFileSync(new URL(file,import.meta.url),'utf8');
  for(const denied of ['localStorage','fetch(','.put(','.post(','innerHTML',
   'window.','EDITOR_BUCKET','MEDIA_BUCKET','serverPublish('])
   assert.ok(!source.includes(denied),file+': '+denied);
 }
});
