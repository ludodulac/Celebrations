import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPageModel} from '../migration/cloudflare/app/domain/editor-pages.mjs';
import {createEditorPageCommands} from '../migration/cloudflare/app/application/editor-page-commands.mjs';
import {inSavedContent,referencesMedia,canSafelyDeleteMedia,readLegacyMediaReferences} from
 '../migration/cloudflare/app/domain/editor-media-usage-safety.mjs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const code=read('migration/cloudflare/editor-demo-client-source.js');
const api=read('migration/cloudflare/editor-publication-api.mjs');
const SRC='/media/new/a99b88c77d.mp3';
const entry={id:'audio|'+SRC,src:SRC,source:'uploaded',type:'audio',general:false};

test('custom and duplicated page names are editable without changing URLs or publication/rights',()=>{
 const model=createPageModel(),commands=createEditorPageCommands({model}),db={pages:[
  model.createPage('page','Programme', 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','123'),
  model.createPage('page','Autre','bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb','123'),
  {id:'preparation-123',name:'Préparation',group:'celebration',blocks:[]}
 ]};
 const first=db.pages[0];const oldId=first.id;
 const previousPolicy={mode:'SELECTED_TYPES',typeIds:['porteurs']};
 first.visibility='draft';first.accessPolicy=previousPolicy;
 assert.deepEqual(commands.renameEditablePage(db,first,'Programme — 2026','123'),{ok:true,changed:true});
 assert.equal(first.name,'Programme — 2026');
 assert.equal(first.blocks[0].text,'Programme','A page name never rewrites authored heading blocks');
 assert.equal(first.id,oldId,'Public URL must not change');
 assert.equal(first.visibility,'draft');
 assert.deepEqual(first.accessPolicy,previousPolicy);
 assert.equal(db.pages[1].name,'Autre');
 assert.equal(commands.renameEditablePage(db,first,'Autre','123').ok,false,'Duplicate titles refused');
 assert.equal(commands.renameEditablePage(db,first,' ','123').ok,false,'Blank title refused');
 assert.equal(commands.renameEditablePage(db,db.pages[2],'Nouvelle préparation','123').ok,false,
  'Fixed historical stages cannot be broken by renaming');
});
test('the visible page menu label can be renamed from one ⋯ control without changing title blocks',()=>{
 assert.match(code,/Modifier le nom/);
 assert.match(code,/editorPageCommands\.renameMenuLabel\(db,p,label\)/);
 assert.match(code,/kind:'page-menu-label'/);
 assert.match(code,/row\.append\(b\('Enregistrer',saveCurrentContent,'sm m022-save'\)\)/);
 assert.doesNotMatch(code,/Renommer cette page/,'Old duplicate name field removed');
 assert.doesNotMatch(code,/Définir comme accueil/,'Home selector hidden as requested');
});
test('the MP3 block editor exposes a title and ONE picker without placeholder paragraphs',()=>{
 const audio=code.slice(code.indexOf("if(x.kind==='audio'){"),code.indexOf("if(x.kind==='video'){"));
 assert.match(audio,/Titre de l’audio/);
 assert.match(audio,/Choisir un MP3/);
 assert.match(audio,/audio\.controls=true/);
 assert.doesNotMatch(audio,/wrap\.append\(n\('strong'/);
 assert.doesNotMatch(audio,/Choisissez un MP3 dans la bibliothèque/);
});
test('site identity editing removed without removing the owner member-mode switch',()=>{
 const settings=code.slice(code.indexOf('function settings(){'),code.indexOf('function m018LanguagesCategories(){'));
 assert.match(settings,/Activer la gestion des membres et des accès privés/);
 assert.match(settings,/memberAccessUiEnabled:desired/);
 assert.doesNotMatch(settings,/Identité du site|Enregistrer l’identité|m021-identity-form|imageButtons/);
});
test('used by home, celebration draft, published old version, translated versions, categories or branding => PROTECTED',()=>{
 const patterns=[
  {shared:{pages:[{blocks:[{src:SRC}]}]}},
  {drafts:{a:{pages:[{blocks:[{src:SRC}]}]}}},
  {published:{shared:{pages:[{blocks:[{cover:SRC}]}]}}},
  {localization:{pages:{x:{en:{blocks:[{href:SRC}]}}}}},
  {drafts:{a:{spaces:[{pages:[{blocks:[{src:SRC}]}]}]}}},
  {siteIdentity:{imageSrc:SRC}},
  {published:{drafts:{a:{spaces:[{pages:[{blocks:[{cover:SRC}]}]}]}}}},
  {plans:[{description:'image '+SRC}]}
 ];
 for(const state of patterns){
  assert.equal(inSavedContent(state,SRC),true,'A saved use must be indexed');
  assert.equal(canSafelyDeleteMedia(entry,state,new Set()),false,'Used file must not be deletable');
 }
});
test('genuinely unused media is deletable only with complete D1 evidence and known source',()=>{
 const state={mediaCatalogue:[entry],drafts:{'101':{pages:[]}},shared:{pages:[]}};
 assert.equal(inSavedContent(state,SRC),false,'Inventory entry itself is not a use');
 assert.equal(canSafelyDeleteMedia(entry,state,new Set()),true);
 assert.equal(canSafelyDeleteMedia(entry,state,null),false,'No D1 audit = fail closed');
 assert.equal(canSafelyDeleteMedia({...entry,general:true},state,new Set()),false);
 assert.equal(canSafelyDeleteMedia({...entry,source:'historical'},state,new Set()),false);
 assert.equal(canSafelyDeleteMedia({...entry,source:'unknown'},state,new Set()),false);
 assert.equal(canSafelyDeleteMedia(entry,state,new Set([SRC])),false);
 assert.equal(canSafelyDeleteMedia(entry,state,new Set(['new/a99b88c77d.mp3'])),false);
 assert.equal(canSafelyDeleteMedia(entry,state,new Set(['a99b88c77d.mp3'])),false);
 assert.equal(referencesMedia({blocks:[{coverAssetId:'abc',src:SRC}]},SRC),true);
});
test('D1 protected reference list loads once with fail-closed errors',async()=>{
 const db={prepare(sql){assert.match(sql,/SELECT storage_path,cover_storage_path,external_url FROM celebrations_contents/);
  return {all:async()=>({results:[{storage_path:'new/a99b88c77d.mp3',cover_storage_path:null,external_url:'https://site/video'}]})}}};
 const found=await readLegacyMediaReferences(db);
 assert.ok(found instanceof Set);
 assert.equal(canSafelyDeleteMedia(entry,{drafts:{},shared:{pages:[]}},found),false);
 assert.equal(await readLegacyMediaReferences({prepare(){throw Error('DB unavailable')}}),null);
 assert.equal(await readLegacyMediaReferences(null),null);
});
test('media frontend only offers DELETE when the backend attests safe unused status',()=>{
 assert.match(code,/const unused=record\.canDelete===true&&refs\.length===0/);
 assert.match(code,/if\(unused\)controls\.append\(b\('Supprimer si inutilisé'/);
 assert.match(code,/const unused=false;/);
 assert.match(code,/block\?\.coverAssetId===fileId/);
 assert.match(api,/const legacyRefs=await readLegacyMediaReferences\(env\.DB\)/);
 assert.match(api,/canDelete:canSafelyDeleteMedia\(item,state,legacyRefs\)/);
 assert.match(api,/if\(!canSafelyDeleteMedia\(entry,state,legacyRefs\)\)/);
});
