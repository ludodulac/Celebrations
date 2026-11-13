// M030 — the ONE definition of a celebration and its variants.
// Never import browser globals or persistence: D1 stores canonical identities;
// R2 stores pages/versions; this module validates both, unchanged.
// Factory is serialized into the existing editor bootstrap: one contract for
// browser and Worker, no duplicate date/identity logic to fall out of sync.
export function createCelebrationCycleRegistry(){
const CELEBRATION_CYCLE_START=2026;
const CELEBRATION_CYCLE_END=2039;
const CANONICAL_ARCHANGELS=Object.freeze(['Michaël','Gabriel','Raphaël','Ouriel']);
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr').trim();
function canonicalArchangel(value){
 return CANONICAL_ARCHANGELS.find(s=>normalize(s)===normalize(value))||null;
}
function validCycleYear(value){
 return Number.isInteger(value)&&value>=CELEBRATION_CYCLE_START&&value<=CELEBRATION_CYCLE_END;
}
function celebrationCycle(archangel,cycleYear){
 const arch=canonicalArchangel(archangel),y=Number(cycleYear);
 if(!arch||!validCycleYear(y))throw new RangeError('Célébration hors calendrier');
 const year=arch==='Gabriel'?y+'–'+(y+1):String(arch==='Raphaël'||arch==='Ouriel'?y+1:y);
 return Object.freeze({slotKey:normalize(arch)+'-'+y,archangel:arch,cycleYear:y,
  year,title:arch+' '+year});
}
function preparedCelebrationSlots(){
 const slots=[];
 for(let y=CELEBRATION_CYCLE_START;y<=CELEBRATION_CYCLE_END;y++)
  for(const a of CANONICAL_ARCHANGELS)
   slots.push(celebrationCycle(a,y));
 return slots;
}
// D1 used both YYYY and YYYY–YYYY for historical Gabriel; the actual D1
// values are NOT silently rewritten. Duplicates will first be audited.
function cycleFromExisting(row){
 const arch=canonicalArchangel(row?.archangel);
 const raw=String(row?.year||''),match=/^20\d{2}/.exec(raw);
 if(!arch||!match)return null;
 const y=Number(match[0])-(arch==='Raphaël'||arch==='Ouriel'?1:0);
 if(!validCycleYear(y))return null;
 const slot=celebrationCycle(arch,y);
 return slot.year===raw?slot:null;
}
function categorizeExistingCelebrations(rows){
 if(!Array.isArray(rows))throw new TypeError('Catalogue D1 requis');
 const byKey=new Map(),duplicates=[],unsupported=[];
 for(const row of rows){
  const slot=cycleFromExisting(row);
  if(!slot){unsupported.push(row);continue}
  const prev=byKey.get(slot.slotKey);
  if(prev)duplicates.push({slotKey:slot.slotKey,ids:[String(prev.id),String(row.id)]});
  else byKey.set(slot.slotKey,row);
 }
 return {byKey,duplicates,unsupported};
}
function visibleSlotCatalogue(existingRows=[],visibility={}){
 const {byKey,duplicates,unsupported}=categorizeExistingCelebrations(existingRows);
 return {duplicates,unsupported,slots:preparedCelebrationSlots().map(slot=>{
  const original=byKey.get(slot.slotKey),id=original?String(original.id):null;
  // 56 scheduled identities are not 56 pages or 56 published celebrations.
  const isVisible=id&&visibility[id]==='published';
  return {...slot,id,provisioned:!!id,visibility:isVisible?'published':'hidden'};
 })};
}
function canonicalAudience({scope,categoryId}={},categories=[]){
 const active=new Set(categories.filter(c=>!c.disabled&&typeof c.id==='string').map(c=>c.id));
 if(scope==='PUBLIC'&&(!categoryId))return Object.freeze({scope:'PUBLIC',categoryId:''});
 // No fake categories. Until one is created, there is no private variant.
 if(!active.size)throw new RangeError('Créez d’abord une catégorie pour les versions privées');
 if(scope==='ALL_PRIVATE_TYPES'&&!categoryId)return Object.freeze({scope,categoryId:''});
 if(scope==='SELECTED_TYPES'&&typeof categoryId==='string'&&active.has(categoryId))
  return Object.freeze({scope,categoryId});
 throw new RangeError('Destinataires inconnus ou catégorie désactivée');
}
function celebrationVersionKey(audience,languageId){
 const {scope,categoryId=''}=audience||{};
 if(!['PUBLIC','ALL_PRIVATE_TYPES','SELECTED_TYPES'].includes(scope)||
    (scope==='SELECTED_TYPES'?!categoryId:!!categoryId))throw new TypeError('Public cible invalide');
 if(typeof languageId!=='string'||!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(languageId))
  throw new TypeError('Langue invalide');
 return (scope==='SELECTED_TYPES'?'category:'+categoryId:scope)+'|'+languageId;
}
function validateNewCelebrationVersion(input,{celebrationTitle,existing=[],categories=[],languages=[]}={}){
 if(!input||typeof input!=='object')throw new TypeError('Version requise');
 const title=String(input.name||'').trim();
 if(!title||title.length>120||normalize(title)===normalize(celebrationTitle))
  throw new RangeError('Donnez un nom différent à cette version');
 if(!Array.isArray(existing))throw new TypeError('Versions existantes requises');
 if(existing.some(v=>normalize(v.name)===normalize(title)))
  throw new RangeError('Ce nom de version existe déjà');
 const audience=canonicalAudience(input.audience,categories);
 if(!languages.some(l=>l.id===input.languageId))
  throw new RangeError('Cette langue n’est pas disponible');
 const key=celebrationVersionKey(audience,input.languageId);
 if(existing.some(v=>v.key===key||
    (v.audience&&v.languageId&&celebrationVersionKey(v.audience,v.languageId)===key)))
  throw new RangeError('Une version existe déjà pour cette langue et ces destinataires');
 return Object.freeze({name:title,languageId:input.languageId,audience,key,visibility:'draft'});
}

return Object.freeze({CELEBRATION_CYCLE_START,CELEBRATION_CYCLE_END,CANONICAL_ARCHANGELS,canonicalArchangel,validCycleYear,celebrationCycle,preparedCelebrationSlots,cycleFromExisting,categorizeExistingCelebrations,visibleSlotCatalogue,canonicalAudience,celebrationVersionKey,validateNewCelebrationVersion});
}
export const {CELEBRATION_CYCLE_START,CELEBRATION_CYCLE_END,CANONICAL_ARCHANGELS,canonicalArchangel,validCycleYear,celebrationCycle,preparedCelebrationSlots,cycleFromExisting,categorizeExistingCelebrations,visibleSlotCatalogue,canonicalAudience,celebrationVersionKey,validateNewCelebrationVersion}=createCelebrationCycleRegistry();
