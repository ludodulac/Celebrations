import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  INITIAL_LANGUAGE_ID, LOCALIZABLE_FIELDS, createLanguageRegistry, addLanguage,
  renameLanguage, setLanguageFlag, setLanguageActive, setDefaultLanguage,
  selectLanguage, setPageTranslation, resolvePageTranslation,
  setCelebrationSpaceTranslation, resolveCelebrationSpaceTranslation, projectPageMenu
} from '../migration/cloudflare/app/domain/editor-localization.mjs';

const base = () => createLanguageRegistry();
const fullRegistry = () => setLanguageActive(addLanguage(base(),
  {id:'en',name:'English',flag:'🇬🇧'}), 'en', true);
const oldPage = () => ({id:'preparation-101', group:'celebration', name:'Préparation',
  visibility:'published', blocks:[{id:7,kind:'text',rich:'Bonjour'},
    {id:8,kind:'button',text:'Livret',href:'/media/existing.pdf'}],
  audience:'restricted',permissionRule:{members:['team']}, unknown:{legacy:true}});

test('M003: initial registry has active French, a default and portable flag', () => {
  const r=base();
  assert.equal(INITIAL_LANGUAGE_ID,'fr');
  assert.deepEqual(r,{version:1,defaultLanguageId:'fr',languages:[
    {id:'fr',name:'Français',flag:'🇫🇷',active:true}]});
});
test('M003: adding a language is immutable and defaults to disabled', () => {
  const start=base();
  const next=addLanguage(start,{id:'pt-BR',name:'Português',flag:'🇧🇷'});
  assert.equal(start.languages.length,1);
  assert.deepEqual(next.languages[1],{id:'pt-BR',name:'Português',flag:'🇧🇷',active:false});
  assert.throws(()=>addLanguage(next,{id:'pt-BR',name:'Doublon'}),/déjà présente/);
});
test('M003: rename and flag change never change stable ID', () => {
  const r=addLanguage(base(),{id:'en',name:'English',flag:'🇺🇸'});
  const renamed=renameLanguage(r,'en','Anglais');
  const flagged=setLanguageFlag(renamed,'en','flags/uk.svg');
  assert.equal(flagged.languages[1].id,'en');
  assert.equal(flagged.languages[1].name,'Anglais');
  assert.equal(flagged.languages[1].flag,'flags/uk.svg');
  assert.equal(r.languages[1].name,'English');
});
test('M003: activation, deactivation and default stay coherent',()=>{
  const r=fullRegistry();
  assert.equal(setLanguageActive(r,'en',false).languages[1].active,false);
  assert.equal(setDefaultLanguage(r,'en').defaultLanguageId,'en');
  assert.throws(()=>setLanguageActive(r,'fr',false),/par défaut/);
  assert.throws(()=>setDefaultLanguage(setLanguageActive(r,'en',false),'en'),/active/);
  const changed=setDefaultLanguage(r,'en');
  assert.equal(setLanguageActive(changed,'fr',false).languages[0].active,false);
  assert.throws(()=>setLanguageActive(changed,'en',false),/par défaut/);
});
test('M003: selects active language, otherwise fallback to default',()=>{
  const r=fullRegistry();
  assert.deepEqual(selectLanguage(r,'en'),{requestedLanguageId:'en',languageId:'en',usedFallback:false});
  assert.equal(selectLanguage(r,'es').languageId,'fr');
  assert.equal(selectLanguage(setLanguageActive(r,'en',false),'en').languageId,'fr');
});
test('M003: invalid registries and unknown language IDs are rejected',()=>{
  const r=base();
  assert.throws(()=>addLanguage(r,{id:'EN not valid',name:'bad'}),/invalide/);
  assert.throws(()=>renameLanguage(r,'en','Unknown'),/inconnue/);
  assert.throws(()=>renameLanguage(r,'fr',''),/non vide/);
  assert.throws(()=>createLanguageRegistry({...r,defaultLanguageId:'en'}),/active/);
  assert.throws(()=>createLanguageRegistry({...r,languages:[...r.languages,...r.languages]}),/dupliquée/);
});
test('M003: legacy pages stay in French and are never mutated on read',()=>{
  const page=oldPage(), before=JSON.stringify(page);
  const resolved=resolvePageTranslation(page,fullRegistry(),'en');
  assert.equal(resolved.id,page.id);
  assert.equal(resolved.languageId,'fr');
  assert.equal(resolved.usedFallback,true);
  assert.equal(resolved.content.name,page.name);
  assert.deepEqual(resolved.content.blocks,page.blocks);
  assert.equal(JSON.stringify(page),before);
  assert.notStrictEqual(resolved.content.blocks,page.blocks);
});
test('M003: page translation owns all text blocks and media, same page ID',()=>{
  const r=fullRegistry(), old=oldPage();
  const translated=setPageTranslation(old,r,'en',{name:'Preparation',blocks:[
    {id:7,kind:'text',rich:'Hello'},
    {id:8,kind:'button',text:'Booklet',href:'/media/existing.pdf'}
  ],documents:[{name:'Guide',url:'/letter/guide.pdf'}],media:[{src:'/media/new/image.jpg'}]});
  assert.equal(old.translations,undefined);
  assert.equal(translated.id,'preparation-101');
  assert.equal(translated.visibility,'published');
  assert.deepEqual(translated.permissionRule,{members:['team']});
  const picked=resolvePageTranslation(translated,r,'en');
  assert.equal(picked.id,old.id);
  assert.equal(picked.languageId,'en');
  assert.equal(picked.usedFallback,false);
  assert.equal(picked.content.blocks[0].rich,'Hello');
  assert.equal(picked.content.documents[0].url,'/letter/guide.pdf');
  assert.equal(picked.content.media[0].src,'/media/new/image.jpg');
  assert.equal(resolvePageTranslation(translated,r,'fr').content.blocks[0].rich,'Bonjour');
});
test('M003: changing one translated block never edits the historical data',()=>{
  const page=oldPage(), r=fullRegistry();
  const content={name:'Preparation',blocks:[{id:4,text:'Before'}]};
  const translated=setPageTranslation(page,r,'en',content);
  content.blocks[0].text='After';
  assert.equal(translated.translations.en.blocks[0].text,'Before');
  const resolved=resolvePageTranslation(translated,r,'en');
  resolved.content.blocks[0].text='Later';
  assert.equal(translated.translations.en.blocks[0].text,'Before');
});
test('M003: missing translation falls back to configured default, not another language',()=>{
  const r=setDefaultLanguage(fullRegistry(),'en');
  const page=setPageTranslation(oldPage(),r,'en',{name:'Preparation',blocks:[{text:'Default English'}]});
  assert.equal(resolvePageTranslation(page,r,'es').languageId,'en');
  assert.equal(resolvePageTranslation(page,r,'es').content.blocks[0].text,'Default English');
});
test('M003: legacy French root is last resort while active if new default lacks translation',()=>{
  const r=setDefaultLanguage(fullRegistry(),'en');
  const found=resolvePageTranslation(oldPage(),r,'es');
  assert.equal(found.languageId,'fr');
  assert.equal(found.usedFallback,true);
});
test('M003: if the original and requested variants are inactive and default missing, fail closed',()=>{
  const r=setLanguageActive(setDefaultLanguage(fullRegistry(),'en'),'fr',false);
  assert.equal(resolvePageTranslation(oldPage(),r,'es'),null);
});
test('M003: no copying permissions, identity or publication to a language variant',()=>{
  const r=fullRegistry(), page=oldPage();
  for(const field of ['id','key','group','visibility','audience','permissions','access','roles',
   'permissionRule','translations','sourceLanguageId','placement','slug']) {
    assert.ok(!LOCALIZABLE_FIELDS.includes(field));
    assert.throws(()=>setPageTranslation(page,r,'en',
      {name:'English',blocks:[],[field]:'forged'}),/éditoriaux/);
  }
  assert.throws(()=>setPageTranslation(page,r,'fr',{name:'Français',blocks:[]}),/original/);
  assert.throws(()=>setPageTranslation(page,r,'en',{name:'Incomplete'}),/nom et ses blocs/);
  assert.throws(()=>setPageTranslation(page,r,'en',{name:'Bad',blocks:'x'}),/blocs/);
});
test('M003: each celebration space can carry its own localized content independently',()=>{
  const space={id:'accueil-celebration-101',celebrationId:'101',group:'celebration',
    visibility:'hidden', accessPolicy:{minRole:'member'},
    name:'Bienvenue',blocks:[{kind:'image',src:'/media/new/archangel.jpg'}]};
  const r=fullRegistry();
  const en=setCelebrationSpaceTranslation(space,r,'en',{name:'Welcome',
    blocks:[{kind:'image',src:'/media/new/archangel.jpg'},
      {kind:'text',text:'Welcome'}],media:[{src:'/media/new/archangel.jpg'}]});
  assert.equal(en.id,space.id);
  assert.equal(en.accessPolicy.minRole,'member');
  assert.equal(resolveCelebrationSpaceTranslation(en,r,'en').content.blocks[1].text,'Welcome');
  assert.equal(resolveCelebrationSpaceTranslation(en,r,'fr').content.name,'Bienvenue');
});
test('M003: existing day-like celebration spaces with key remain compatible',()=>{
  const r=fullRegistry();
  const space={key:'day-2026-12-01',startDate:'2026-12-01',label:'Mardi',
    text:'Programme du jour',links:[{url:'/letter/old.pdf'}],contentIds:[1,2]};
  const translated=setCelebrationSpaceTranslation(space,r,'en',
    {label:'Tuesday',text:'Daily schedule',links:[{url:'/letter/old.pdf'}],contentIds:[1,2]});
  const found=resolveCelebrationSpaceTranslation(translated,r,'en');
  assert.equal(found.id,space.key);
  assert.equal(found.content.text,'Daily schedule');
  assert.equal(translated.startDate,space.startDate);
  assert.deepEqual(translated.links,space.links);
});
test('M003: one menu entry per permanent ID, not one per language',()=>{
  const r=fullRegistry(), page=oldPage();
  const translated=setPageTranslation(page,r,'en',{name:'Preparation',blocks:[]});
  const second={id:'mercredi-101',group:'celebration',name:'Mercredi',blocks:[]};
  const result=projectPageMenu([translated,second,translated],r,'en');
  assert.deepEqual(result.map(x=>x.pageId),['preparation-101','mercredi-101']);
  assert.deepEqual(result.map(x=>x.name),['Preparation','Mercredi']);
  assert.equal(result[1].languageId,'fr');
  assert.equal(result[0].group,'celebration');
});
test('M003: stable identity after JSON export/import of registry and pages',()=>{
  const reg=setDefaultLanguage(fullRegistry(),'en');
  const first=setPageTranslation(oldPage(),reg,'en',{name:'Preparation',blocks:[{kind:'button',href:'/media/old.pdf'}]});
  const exported=JSON.stringify({reg,pages:[first]});
  const imported=JSON.parse(exported);
  const revived=createLanguageRegistry(imported.reg);
  assert.equal(revived.defaultLanguageId,'en');
  assert.deepEqual(revived.languages.map(x=>x.id),['fr','en']);
  assert.equal(imported.pages[0].id,'preparation-101');
  assert.equal(imported.pages[0].translations.en.blocks[0].href,'/media/old.pdf');
  assert.deepEqual(resolvePageTranslation(imported.pages[0],revived,'en').content,
    resolvePageTranslation(first,reg,'en').content);
});
test('M003: language choice cannot grant or deny access or change visibility',()=>{
  const r=fullRegistry(), page=oldPage();
  const translated=setPageTranslation(page,r,'en',{name:'Preparation',blocks:[]});
  for(const language of ['fr','en','es']){
    const view=resolvePageTranslation(translated,r,language);
    assert.equal(view.id,translated.id);
    assert.equal(translated.audience,'restricted');
    assert.equal(translated.permissionRule.members[0],'team');
    assert.equal(translated.visibility,'published');
    assert.ok(!Object.keys(view).some(key=>/permission|access|role|audience|visibility/i.test(key)));
  }
});
test('M003: domain model remains side-effect free, no server/auth/browser integrations',()=>{
  const src=readFileSync(new URL('../migration/cloudflare/app/domain/editor-localization.mjs',import.meta.url),'utf8');
  for(const forbidden of ['fetch(', 'localStorage', 'indexedDB', 'document.', 'window.',
    'D1Database','R2Bucket','cloudflare:', 'serverPublish(', 'serverSave('])
    assert.ok(!src.includes(forbidden),`Unwanted integration: ${forbidden}`);
});
