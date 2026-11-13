import test from 'node:test';
import assert from 'node:assert/strict';
import {
 CELEBRATION_CYCLE_START,CELEBRATION_CYCLE_END,CANONICAL_ARCHANGELS,
 celebrationCycle,preparedCelebrationSlots,cycleFromExisting,
 categorizeExistingCelebrations,visibleSlotCatalogue,canonicalAudience,
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
