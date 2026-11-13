import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {
 CELEBRATION_CYCLE_START,CELEBRATION_CYCLE_END,CANONICAL_ARCHANGELS,
 celebrationCycle,preparedCelebrationSlots,cycleFromExisting,
 categorizeExistingCelebrations,visibleSlotCatalogue,publicCelebrationEntries,canonicalAudience,
 celebrationVersionKey,validateNewCelebrationVersion
} from '../migration/cloudflare/app/domain/celebration-cycle-registry.mjs';

const languages=[{id:'fr',name:'Français'},{id:'en',name:'Anglais'},{id:'es',name:'Espagnol'}];
const categories=[{id:'porteurs',name:"Porteurs d'ange"},{id:'inactif',name:'Archivé',disabled:true}];
const publicFR={name:'Michaël 2026',audience:{scope:'PUBLIC',categoryId:''},languageId:'fr',key:'PUBLIC|fr'};
const opts={celebrationTitle:'Michaël 2026',languages,categories,existing:[publicFR]};
const input=(name,scope,languageId,categoryId='')=>({name,audience:{scope,categoryId},languageId});

test('14 cycles, four unique slots per cycle, no handcrafted extra years',()=>{
 const slots=preparedCelebrationSlots();
 assert.equal(CELEBRATION_CYCLE_START,2026);
 assert.equal(CELEBRATION_CYCLE_END,2039);
 assert.deepEqual(CANONICAL_ARCHANGELS,['Michaël','Gabriel','Raphaël','Ouriel']);
 assert.equal(slots.length,56);
 assert.equal(new Set(slots.map(x=>x.slotKey)).size,56);
 for(let year=2026;year<=2039;year++){
  assert.equal(slots.filter(x=>x.cycleYear===year).length,4);
 }
 assert.deepEqual(slots.slice(0,4).map(x=>x.title),
  ['Michaël 2026','Gabriel 2026–2027','Raphaël 2027','Ouriel 2027']);
 assert.deepEqual(slots.slice(-4).map(x=>x.title),
  ['Michaël 2039','Gabriel 2039–2040','Raphaël 2040','Ouriel 2040']);
 assert.throws(()=>celebrationCycle('Michaël',2040),RangeError);
 assert.throws(()=>celebrationCycle('Other',2026),RangeError);
 assert.equal(celebrationCycle('Michael',2026).title,'Michaël 2026');
});
test('D1 year strings are converted without silently rewriting historical DB rows',()=>{
 assert.equal(cycleFromExisting({archangel:'Gabriel',year:'2026–2027'}).slotKey,'gabriel-2026');
 assert.equal(cycleFromExisting({archangel:'Raphaël',year:'2027'}).slotKey,'raphael-2026');
 assert.equal(cycleFromExisting({archangel:'Ouriel',year:'2027'}).slotKey,'ouriel-2026');
 assert.equal(cycleFromExisting({archangel:'Michaël',year:'2026'}).slotKey,'michael-2026');
 assert.equal(cycleFromExisting({archangel:'Ouriel',year:'2028'}).slotKey,'ouriel-2027');
 assert.equal(cycleFromExisting({archangel:'Gabriel',year:'2027'}),null,'historical bad year string must be audited');
});
test('known duplicate D1 Michaël 2026 identity cannot be silently selected',()=>{
 const rows=[{id:101,archangel:'Michaël',year:'2026',status:'active'},
  {id:105,archangel:'Michaël',year:'2026',status:'draft'},
  {id:106,archangel:'Michaël',year:'2026',status:'draft'},
  {id:102,archangel:'Gabriel',year:'2026–2027',status:'planned'},
  {id:107,archangel:'Gabriel',year:'2027',status:'draft'}];
 const result=categorizeExistingCelebrations(rows);
 assert.equal(result.duplicates.length,2);
 assert.equal(result.byKey.get('michael-2026').id,101);
 assert.deepEqual(result.unsupported.map(x=>x.id),[107]);
});
test('all future slots are hidden; only explicitly published Michaël is visible',()=>{
 const rows=[{id:101,archangel:'Michaël',year:'2026',status:'active'}];
 const data=visibleSlotCatalogue(rows,{'101':'published'});
 assert.equal(data.slots.length,56);
 assert.equal(data.slots.filter(x=>x.visibility==='published').length,1);
 assert.equal(data.slots.find(x=>x.slotKey==='michael-2026').id,'101');
 assert.equal(data.slots.filter(x=>!x.provisioned).length,55);
 assert.equal(data.slots.at(-1).visibility,'hidden');
 assert.equal(visibleSlotCatalogue(rows,{'101':'hidden'}).slots[0].visibility,'hidden');
 assert.equal(visibleSlotCatalogue([{...rows[0],status:'draft'}],{'101':'published'}).slots[0].visibility,'published',
  'Publishing in R2 is authoritative regardless of legacy D1 status');
});
test('public French is the only default and cannot duplicate itself under another name',()=>{
 assert.throws(()=>validateNewCelebrationVersion(input('Copie de Michaël','PUBLIC','fr'),opts),
  /version existe déjà/);
 assert.throws(()=>validateNewCelebrationVersion(input('Michaël 2026','PUBLIC','en'),opts),
  /nom différent/);
 assert.throws(()=>validateNewCelebrationVersion(input('  Michaël 2026 ','PUBLIC','es'),opts),
  /nom différent/);
 assert.throws(()=>validateNewCelebrationVersion(input('Michaël English','PUBLIC','en'),{
  ...opts,existing:[...opts.existing,{name:'Michaël English',key:'PUBLIC|es'}]}),/nom de version/);
});
test('public English and Spanish are separate from public French and always drafts',()=>{
 const en=validateNewCelebrationVersion(input('Michaël 2026 — English','PUBLIC','en'),opts);
 assert.deepEqual(en.audience,{scope:'PUBLIC',categoryId:''});
 assert.equal(en.key,'PUBLIC|en');
 assert.equal(en.visibility,'draft');
 const es=validateNewCelebrationVersion(input('Michaël 2026 — Español','PUBLIC','es'),{
  ...opts,existing:[publicFR,en]});
 assert.equal(es.key,'PUBLIC|es');
 assert.throws(()=>validateNewCelebrationVersion(input('Another public English','PUBLIC','en'),{
  ...opts,existing:[publicFR,en]}),/version existe déjà/);
});
test('without any real category, no additional version may be created, even public English',()=>{
 const noCategory={...opts,categories:[]};
 for(const [name,scope,language,category] of [
  ['Michaël English','PUBLIC','en',''],
  ['Michaël Spanish','PUBLIC','es',''],
  ['Tous les membres','ALL_PRIVATE_TYPES','fr',''],
  ['Porteurs','SELECTED_TYPES','fr','porteurs']
 ])assert.throws(()=>validateNewCelebrationVersion(input(name,scope,language,category),noCategory),
  /Créez d’abord une catégorie/);
 assert.throws(()=>validateNewCelebrationVersion(input('Michaël English','PUBLIC','en'),{
  ...opts,categories:[{id:'obsolete',name:'Ancienne',disabled:true}]}),/Créez d’abord une catégorie/);
});
test('private version requires real active categories; never invent one',()=>{
 assert.throws(()=>validateNewCelebrationVersion(input('Private French','SELECTED_TYPES','fr','porteurs'),{
  ...opts,categories:[]}),/Créez d’abord une catégorie/);
 assert.throws(()=>validateNewCelebrationVersion(input('Private French','SELECTED_TYPES','fr','unknown'),opts),
  /catégorie désactivée|Destinataires inconnus/);
 assert.throws(()=>validateNewCelebrationVersion(input('Private French','SELECTED_TYPES','fr','inactif'),opts),
  /catégorie désactivée|Destinataires inconnus/);
 assert.throws(()=>canonicalAudience({scope:'ALL_PRIVATE_TYPES'},[]),/Créez d’abord une catégorie/);
 assert.throws(()=>canonicalAudience({scope:'OTHER'},categories),/Destinataires inconnus/);
});
test('different category or language permits private versions, but same pair conflicts',()=>{
 const french=validateNewCelebrationVersion(input('Michaël — porteurs FR','SELECTED_TYPES','fr','porteurs'),opts);
 assert.equal(french.key,'category:porteurs|fr');
 const english=validateNewCelebrationVersion(input('Michaël — porteurs EN','SELECTED_TYPES','en','porteurs'),{
  ...opts,existing:[publicFR,french]});
 assert.equal(english.key,'category:porteurs|en');
 assert.throws(()=>validateNewCelebrationVersion(input('Another porteurs French','SELECTED_TYPES','fr','porteurs'),{
  ...opts,existing:[publicFR,french,english]}),/version existe déjà/);
 assert.equal(celebrationVersionKey({scope:'ALL_PRIVATE_TYPES',categoryId:''},'fr'),'ALL_PRIVATE_TYPES|fr');
 assert.throws(()=>celebrationVersionKey({scope:'SELECTED_TYPES',categoryId:''},'fr'),TypeError);
 assert.throws(()=>celebrationVersionKey({scope:'PUBLIC',categoryId:'porteurs'},'fr'),TypeError);
 assert.throws(()=>celebrationVersionKey({scope:'HACKED',categoryId:''},'fr'),TypeError);
});
test('invalid language ids, unpublished or non-existing languages are refused',()=>{
 assert.throws(()=>validateNewCelebrationVersion(input('Chinese','PUBLIC','zh'),opts),/langue n’est pas disponible/);
 assert.throws(()=>celebrationVersionKey({scope:'PUBLIC'},'javascript:alert(1)'),TypeError);
 assert.throws(()=>validateNewCelebrationVersion(input('English','PUBLIC','en'),{...opts,existing:null}),TypeError);
});

test('M05 deferred unique D1 index refuses duplicate identity after old copies are cleaned',()=>{
 const sql=readFileSync(new URL('../migration/cloudflare/manual-after-m030-cleanup/m030_unique_celebration_cycles.sql',import.meta.url),'utf8');
 assert.match(sql,/idx_celebrations_archangel_year_unique/);
 assert.ok(!sql.includes('DELETE FROM'),'M05 never deletes production data');
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('CREATE TABLE celebrations_celebrations(id INTEGER PRIMARY KEY,archangel TEXT NOT NULL,year TEXT,status TEXT)');
  db.prepare('INSERT INTO celebrations_celebrations(id,archangel,year) VALUES(?,?,?)').run(101,'Michaël','2026');
  db.prepare('INSERT INTO celebrations_celebrations(id,archangel,year) VALUES(?,?,?)').run(102,'Gabriel','2026–2027');
  db.exec(sql); db.exec(sql); // idempotent
  assert.throws(()=>db.prepare('INSERT INTO celebrations_celebrations(id,archangel,year) VALUES(?,?,?)').run(
   105,' Michaël ','2026'),/UNIQUE constraint failed/);
  assert.throws(()=>db.prepare('INSERT INTO celebrations_celebrations(id,archangel,year) VALUES(?,?,?)').run(
   106,'michaël','2026'),/UNIQUE constraint failed/);
  db.prepare('INSERT INTO celebrations_celebrations(id,archangel,year) VALUES(?,?,?)').run(107,'Michaël','2027');
  assert.equal(db.prepare('SELECT count(*) n FROM celebrations_celebrations').get().n,3);
 }finally{db.close()}
});
test('M05 deferred unique D1 index fails safely if the old Michaël duplicates still exist',()=>{
 const sql=readFileSync(new URL('../migration/cloudflare/manual-after-m030-cleanup/m030_unique_celebration_cycles.sql',import.meta.url),'utf8');
 const db=new DatabaseSync(':memory:');
 try{
  db.exec('CREATE TABLE celebrations_celebrations(id INTEGER PRIMARY KEY,archangel TEXT NOT NULL,year TEXT,status TEXT)');
  for(const id of [101,105,106])
   db.prepare('INSERT INTO celebrations_celebrations(id,archangel,year) VALUES(?,?,?)').run(id,'Michaël','2026');
  assert.throws(()=>db.exec(sql),/UNIQUE constraint failed/,
   'Mission 5 cannot apply D1 index before mission 10 official cleanup');
  assert.equal(db.prepare('SELECT count(*) n FROM celebrations_celebrations').get().n,3);
 }finally{db.close()}
});

test('M05–M06 existing editor has one 14-cycle selector and one safeguarded variant dialog',()=>{
 const editor=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
 const generated=readFileSync(new URL('../migration/cloudflare/editor-demo-client.mjs',import.meta.url),'utf8');
 const start=editor.indexOf('async function duplicateChoice(entry)');
 const end=editor.indexOf('function accessControls(',start);
 assert.ok(start>0&&end>start,'Only one dialogue for duplication within a celebration');
 const dialog=editor.slice(start,end);
 for(const word of ['Nom distinct de la version','Destinataires','Langue',
  "if(!categories.length)",'Création non confirmée par le serveur',
  "memberPanel.commandContent('duplicate-version'"]){
  assert.ok(dialog.includes(word),'Missing UI requirement: '+word);
 }
 assert.ok(dialog.indexOf("if(!categories.length)")<dialog.indexOf("await siteDialog("),
  'Cannot offer a new version when no category exists');
 const catalog=editor.slice(editor.indexOf('function celebrations(){'),
  editor.indexOf('// Media usage is obtained'));
 assert.ok(catalog.includes('cycleRegistry.CELEBRATION_CYCLE_START'));
 assert.ok(catalog.includes('cycleRegistry.CELEBRATION_CYCLE_END'));
 assert.ok(catalog.includes('Célébrations prévues (2026–2039)'));
 assert.ok(catalog.includes('m030-cycle-group'),'Future cycles are grouped in foldable rows');
 assert.ok(catalog.includes("publication.append(b('Dupliquer'"));
 assert.ok(generated.includes('Nom distinct de la version'),
  'Regenerated editor contains the same single duplicate dialogue');
});

test('M08 visitor sees a canonical cycle once despite historical D1 duplicates',()=>{
 const rows=[
  {id:101,archangel:'Michaël',year:'2026'},
  {id:105,archangel:'Michaël',year:'2026'},
  {id:106,archangel:'Michael',year:'2026'},
  {id:102,archangel:'Gabriel',year:'2026–2027'},
  {id:103,archangel:'Raphaël',year:'2027'},
  {id:104,archangel:'Ouriel',year:'2028'},
  {id:107,archangel:'Gabriel',year:'2027'}
 ];
 const vis={'101':'published','105':'published','106':'published','102':'published',
  '103':'draft','104':'hidden','107':'published'};
 const policies={'102':{mode:'SELECTED_TYPES',typeIds:['porteurs']},
  '105':{mode:'SELECTED_TYPES',typeIds:['porteurs']}};
 const cards=publicCelebrationEntries(rows,vis,policies);
 assert.deepEqual(cards.map(x=>x.id),['101','102']);
 assert.deepEqual(cards.map(x=>x.title),['Michaël 2026','Gabriel 2026–2027']);
 assert.equal(cards[0].titleOnly,false);
 assert.equal(cards[1].titleOnly,true,'Private title appears without visitor pages');
 assert.equal(cards[0].slotKey,'michael-2026');
 assert.equal(publicCelebrationEntries(rows,{'101':'hidden'},policies).some(x=>x.id==='101'),false);
 assert.deepEqual(publicCelebrationEntries(rows,{},policies),[],
  'A virtual future slot or unpublished name is never sent to visitors');
});
test('M08 private-only celebration has title only; public version may replace the label',()=>{
 const row1={id:201,archangel:'Michaël',year:'2026'};
 const row2={id:205,archangel:'Michaël',year:'2026'};
 let items=publicCelebrationEntries([row1,row2],{'201':'published','205':'published'},
  {'201':{mode:'ALL_PRIVATE_TYPES'}});
 assert.deepEqual(items.map(x=>x.id),['205'],'Public identity takes priority');
 items=publicCelebrationEntries([row1],{'201':'published'},
  {'201':{mode:'SELECTED_TYPES',typeIds:['porteurs']}});
 assert.equal(items[0].titleOnly,true);
 assert.equal(items[0].id,'201');
});
test('M07 no generated calendar or legacy free-creation form remains in admin and public scripts',async()=>{
 const admin=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
 const visitor=readFileSync(new URL('../migration/cloudflare/editor-trial-site-client.mjs',import.meta.url),'utf8');
 const loader=readFileSync(new URL('../migration/cloudflare/editor-demo-preparation-page.mjs',import.meta.url),'utf8');
 const saveApi=readFileSync(new URL('../migration/cloudflare/editor-server-draft-api.mjs',import.meta.url),'utf8');
 for(const bad of ['Date du mercredi :','Dates de préparation','function validWednesday(',
  'function dayIso(','function updatePreparationDate(','function addPreparationDate('])
  assert.ok(!admin.includes(bad),'Obsolete admin date control: '+bad);
 assert.ok(!visitor.includes('function validWednesday('));
 assert.ok(!visitor.includes('function dayIso('));
 assert.ok(!visitor.includes('function dateForPage('));
 assert.ok(!loader.includes('function plannedCelebration('));
 assert.ok(!loader.includes('Dates : '));
 assert.ok(saveApi.includes('JSON.stringify(body.plans)!==JSON.stringify(current.state.plans)'),
  'Legacy API cannot recreate date-based plans');
 assert.ok(saveApi.includes('!Object.hasOwn(current.state.drafts,body.celebration)'),
  'Legacy API cannot create another celebration record');
 assert.ok(loader.includes('publicCelebrationEntries(allCelebrations'));
 assert.ok(loader.includes("if(selected&&!allowedIds.has(String(selected)))"),
  'Anonymous direct links cannot bypass visibility/rights or duplicate identities');
 assert.ok(visitor.includes('seed.celebrations||[]'));
 assert.ok(!visitor.includes('window.__PUBLIC_SITE_SNAPSHOT__?.titleOnlyCelebrations||[]'),
  'No second shadow list of variants');
});

test('M08 visitor JavaScript bundle parses after removing legacy date/plan branches',async()=>{
 const {TRIAL_SITE_CLIENT}=await import('../migration/cloudflare/editor-trial-site-client.mjs');
 assert.ok(TRIAL_SITE_CLIENT.includes('function celebrations(){'));
 assert.ok(TRIAL_SITE_CLIENT.includes('seed.celebrations||[]'));
 assert.doesNotThrow(()=>new Function(TRIAL_SITE_CLIENT),
  'Visitor code must compile under the existing nonce-protected script');
});
