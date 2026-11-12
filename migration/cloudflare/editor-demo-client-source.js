const modalStyle=document.createElement('style');modalStyle.nonce=document.querySelector('script[nonce]')?.nonce||'';modalStyle.textContent=M012B.css;document.head.append(modalStyle);
const siteDialog=options=>M012B.dialog(document,options);
const siteConfirm=message=>siteDialog({message}).then(Boolean);
const sitePrompt=(message,value='')=>siteDialog({title:message,fields:[{name:'value',label:'',value,required:true}]}).then(r=>r?.value??null);
const siteNotice=message=>{void siteDialog({title:'Information',message:String(message),confirm:'Fermer'});};
const STAGE_SEED=window.__PREPARATION_SEED__||null;
const KEY=STAGE_SEED?'celebrations-demo-preparation-'+String(STAGE_SEED.celebrationId):'celebrations-demo-editor-v1';
const seed={pages:[
{id:'home',name:'Accueil',group:'page',blocks:[{id:1,kind:'heading',text:'Bienvenue dans nos célébrations',align:'center'},{id:2,kind:'text',text:'Un lieu de rencontre, de partage et de célébration. Touchez ce texte pour le modifier.',align:'center'},{id:3,kind:'image',text:'Votre photographie',src:'',align:'center'},{id:4,kind:'button',text:'Découvrir le programme',href:'/programme/',align:'center'}]},
{id:'mercredi',name:'Date du mercredi :',group:'celebration',blocks:[{id:5,kind:'heading',text:'La célébration du mercredi',align:'center'},{id:6,kind:'text',text:'Accueil des participants\nTemps de partage\nCélébration\nClôture',align:'left'}]},
{id:'demarche',name:'Notre démarche',group:'page',blocks:[{id:7,kind:'heading',text:'Notre démarche',align:'center'},{id:8,kind:'text',text:'Un texte de présentation que vous pouvez modifier directement.',align:'left'}]}]};
const clone=o=>JSON.parse(JSON.stringify(o));
const localEditorState=createEditorState({STAGE_SEED,KEY,seed,clone,storage:localStorage,search:location.search});
let db=localEditorState.db;
const {stageTab,stageActive}=localEditorState;
let tab=stageTab,id=stageActive?.id||'home',
 dirty=false,preview=false,target=null,imageCoverTarget=false,selectedBlockId=null,mediaCategory='images';

const LIVE_MEDIA_UPLOAD_HOST=(location.hostname==='ronde-des-archanges-universelle.eu'||location.hostname==='www.ronde-des-archanges-universelle.eu'||location.hostname==='celebrations-m016-admin-preprod.rondes.workers.dev');
const IS_STAGE=!!STAGE_SEED,SHARED_KEY='celebrations-demo-shared-pages-v1',PLANS_KEY='celebrations-demo-planned-v1';
// M021-B: a persisted DISPLAY preference, never a permission or publication policy.
let adminMembersEnabled=false,adminModeLoaded=false,adminModeRevision=null;
async function loadAdminMode(){
 if(!IS_STAGE)return;
 try{
  const response=await fetch('/api/site-identity',{credentials:'same-origin',cache:'no-store'});
  const data=await response.json();
  if(!response.ok||data.ok!==true||!Number.isSafeInteger(data.revision))throw Error(data.error||'Réglages indisponibles');
  adminMembersEnabled=data.memberAccessUiEnabled===true;
  adminModeRevision=data.revision;adminModeLoaded=true;
 }catch{adminModeLoaded=false;adminMembersEnabled=false;}
}
function applyAdminMenu(){
 if(!IS_STAGE)return;
 const memberLink=document.querySelector('[data-tab="members-spaces"]');
 if(memberLink)memberLink.hidden=!adminMembersEnabled;
 const languagesLink=document.querySelector('[data-tab="languages-categories"]');
 if(languagesLink)languagesLink.textContent=adminMembersEnabled?'◇ Langues et catégories':'◇ Langues';
}
const {validIso,prettyDate,validTime,validHref,validColor}=createEditorLocalRules();
const ARCHANGELS=['Michaël','Gabriel','Raphaël','Ouriel'];
const editorPageModel=createPageModel();
const editorPageCommands=createEditorPageCommands({model:editorPageModel});
const editorSyncPolicy=createEditorSyncPolicy();
// M004: page translations are private editor drafts, never public snapshots.
const LOCALIZATION_KEY='celebrations-demo-localization-v1';
const emptyLocalization=()=>({registry:createPreparedLanguageRegistry(),pages:{}});
function normalizeLocalization(saved){
 if(!saved)return emptyLocalization();
 const registry=createPreparedLanguageRegistry(saved.registry);
 const pages=saved.pages&&typeof saved.pages==='object'&&!Array.isArray(saved.pages)?clone(saved.pages):{};
 return {registry,pages};
}
let editorLocalization;
try{editorLocalization=normalizeLocalization(JSON.parse(localStorage.getItem(LOCALIZATION_KEY)||'null'))}
catch{editorLocalization=emptyLocalization()}
let celebrationMetadata={};
let editingLanguageId='fr',localeView=null,localeCanonical=null,localeLangId=null;
function clearLocaleView(){localeView=null;localeCanonical=null;localeLangId=null}
function saveLocalizationLocal(){localStorage.setItem(LOCALIZATION_KEY,JSON.stringify(editorLocalization))}
function localizedLabel(p){
 if(!['page','celebration'].includes(p?.group)||editingLanguageId==='fr')return p?.name||'';
 return editorLocalization.pages[p.id]?.[editingLanguageId]?.name||p.name;
}
const archSlug=name=>String(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function cycleYear(entry){
 const str=String(entry?.title||entry?.year||entry?.date||'');
 const years=[...str.matchAll(/20\d{2}/g)].map(m=>Number(m[0]));
 return years.length?years.at(-1):2027;
}
function suggestedCycleYear(previous,next){
 const end=cycleYear(previous);
 // Gabriel straddles New Year, so the next Raphaël belongs to its END year.
 return next==='Raphaël'?end:end;
}
function canonicalTitle(archangel,year){
 const n=Math.max(2020,Math.min(2100,Number(year)||2027));
 return archangel+' '+(archangel==='Gabriel'?n+'-'+(n+1):n);
}
function proposedTitle(archangel,date,previous){
 const d=String(date||'');
 let year=/^20\d{2}-\d{2}-\d{2}$/.test(d)?Number(d.slice(0,4)):Number(String(previous?.year||'').slice(0,4))||2027;
 // The archangel cycle does not jump forward one year at Raphaël→Ouriel or Ouriel→Michaël.
 if(previous){
  const expected=suggestedCycleYear(previous,archangel);
  if(archangel==='Raphaël'&&previous.archangel==='Gabriel')year=cycleYear(previous);
  else if(['Ouriel','Michaël','Gabriel'].includes(archangel) &&
    ((previous.archangel==='Raphaël'&&archangel==='Ouriel')||
     (previous.archangel==='Ouriel'&&archangel==='Michaël')||
     (previous.archangel==='Michaël'&&archangel==='Gabriel')))year=Number(String(previous.title||previous.year||'').match(/20\d{2}/)?.[0])||expected;
 }
 return canonicalTitle(archangel,year);
}
function celebrationLabel(entry){
 return String(entry?.title||'').trim()||canonicalTitle(entry.archangel,entry.year||String(entry.date||'').slice(0,4));
}
function currentDateForDraft(entry){
 if(!entry)return '';
 if(entry.id===String(window.__PREPARATION_SEED__?.celebrationId))return currentDates().wednesday||entry.date||'';
 try{
  const saved=JSON.parse(localStorage.getItem('celebrations-demo-preparation-'+entry.id)||'null');
  return saved?.celebrationDates?.wednesday||entry.date||'';
 }catch{return entry.date||''}
}
function savePlannedTitle(id,title){
 const value=String(title||'').trim().slice(0,100);
 if(!value)return false;
 const rows=plannedEntries(),entry=rows.find(x=>x.id===id);
 if(!entry)return false;
 entry.title=value;entry.customTitle=true;
 try{localStorage.setItem(PLANS_KEY,JSON.stringify(rows));return true}catch{return false}
}
function plannedEntries(){
 try{
  const values=JSON.parse(localStorage.getItem(PLANS_KEY)||'[]');
  if(!Array.isArray(values))return [];
  const drafts=values.filter(p=>p&&editorPageModel.validPlannedId(p.id)).slice(0,100);
  // Correct the old automatic Ouriel 2028 after Raphaël 2027, while leaving
  // explicitly user-edited titles untouched. This never silently changes a date.
  for(let i=0;i<drafts.length;i++){
   const p=drafts[i];if(p.customTitle&&p.title)continue;
   const prev=drafts[i-1]||null;
   p.title=proposedTitle(p.archangel,p.date,prev);
  }
  return drafts;
 }catch{return []}
}
function celebrationEntries(){
 return [...(window.__PREPARATION_SEED__?.celebrations||[]).map(p=>({id:String(p.id),archangel:String(p.archangel||''),year:String(p.year||''),kind:'historical',visibility:p.status==='draft'?'draft':'published',title:celebrationMetadata[String(p.id)]?.title||String(p.archangel||'')+' '+String(p.year||'')})),...plannedEntries()];
}
function openCelebration(ref){
 if(!celebrationEntries().some(c=>c.id===String(ref)))return;
 if(dirty){save();if(dirty)return}
 location.assign(editorPageModel.editorUrl(ref));
}
function restoreShared(){
 if(!IS_STAGE)return;
 try{
  const saved=JSON.parse(localStorage.getItem(SHARED_KEY)||'null');
  editorPageCommands.restoreSharedPages(db,saved);
 }catch{}
}
function saveShared(){
 if(!IS_STAGE)return;
 let before={};try{before=JSON.parse(localStorage.getItem(SHARED_KEY)||'{}')}catch{}
 localStorage.setItem(SHARED_KEY,JSON.stringify(editorPageCommands.sharedSnapshot(db,before)));
}
function validWednesday(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));
 return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
}

restoreShared();
// Remove only the generated, unformatted page-name heading (id 1).
// Authored headings, names, links, styles, images and paragraphs are preserved.
function isBoilerplateTitle(p,block){
 return p?.group==='celebration'&&block?.id===1&&block.kind==='heading'&&
  String(block.text||'').trim()===String(p.name||'').trim()&&
  !block.rich&&!block.bold&&!block.italic&&!block.color&&!block.size&&
  (!block.align||block.align==='center');
}
function removeBoilerplateTitles(pages){
 for(const p of pages||[])if(isBoilerplateTitle(p,p.blocks?.[0]))p.blocks.shift();
}
removeBoilerplateTitles(db.pages);
// Keep earlier edits while updating obsolete default labels / site welcome picture.
const homeMedia=window.__PREPARATION_SEED__?.pages?.find(p=>p.id==='neutral-accueil-general')?.blocks.find(b=>b.kind==='image')?.src||'';
for(const p of db.pages||[]){
 if(p.id==='apres-celebration-'+window.__PREPARATION_SEED__?.celebrationId&&p.name==='Après préparation')p.name='Après célébration';
 if(p.id==='neutral-accueil-general'&&homeMedia&&
  p.blocks?.some(b=>b.kind==='heading'&&['Accueil général','Ronde des Archanges Universelle','Bienvenue sur le site de la Ronde des Archanges Universelle'].includes(b.text))&&
  // The original welcome image may now be inside a populated section.
  // Never append a duplicate on reload when the old root image is nested.
  !p.blocks.some(b=>b.kind==='image'||(b.kind==='section'&&
    (b.columns||[]).some(col=>Array.isArray(col)&&col.some(x=>x.kind==='image'))))){
  p.blocks.push({id:99991,kind:'image',text:'Ronde des Archanges Universelle',src:homeMedia,align:'center'});
 }
}


// Dates are scoped to ONE celebration and stored alongside its local draft.
// No automatic rewriting of authored titles or historical event descriptions.
const DAY_SLUGS=['mercredi','jeudi','vendredi','samedi','dimanche'];
function dayIso(wednesday,offset){
 if(!validWednesday(wednesday)||offset<0||offset>4)return '';
 const [year,month,day]=wednesday.split('-').map(Number);
 const dt=new Date(Date.UTC(year,month-1,day+offset));
 return dt.toISOString().slice(0,10);
}
function currentDates(){
 const stored=db.celebrationDates&&typeof db.celebrationDates==='object'?db.celebrationDates:{};
 const seedDate=window.__PREPARATION_SEED__?.start_date||'';
 return {
  wednesday:Object.hasOwn(stored,'wednesday')?stored.wednesday:(validWednesday(seedDate)?seedDate:''),
  preparationDates:Array.isArray(stored.preparationDates)?stored.preparationDates.filter(x=>x===''||validIso(x)).slice(0,30):
   [stored.preparationStart,stored.preparationEnd].filter(validIso)
 };
}
// A time belongs to a particular celebration DAY, not to the entire cycle.
// Desktop and mobile: choose a quarter-hour or type any exact HH:MM.
// Unlike input[type=time], these controls do not expose the browser's awkward minute spinner.
function timeChooser(value,label,saveHour){
 const wrap=n('div','time-chooser'),title=n('span','time-label','Heure');
 const options=n('select','time-quarter-select');
 options.setAttribute('aria-label','Choisir un quart d’heure');
 const empty=n('option','','Choisir une heure');empty.value='';options.append(empty);
 const standard=new Set();
 for(let hour=0;hour<24;hour++)for(const minute of [0,15,30,45]){
  const clock=String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');
  const choice=n('option','',clock);choice.value=clock;options.append(choice);standard.add(clock);
 }
 const exact=validTime(value)?value:'';
 if(exact&&!standard.has(exact)){const extra=n('option','',exact+' (précis)');extra.value=exact;options.append(extra)}
 options.value=exact;
 const typed=n('input','time-exact-input');
 typed.type='text';typed.inputMode='numeric';typed.autocomplete='off';
 typed.placeholder='HH:MM';typed.maxLength=5;typed.value=exact;
 typed.setAttribute('aria-label',label);typed.title='Saisir une heure précise (ex. 18:32)';
 const normalize=raw=>{
  const match=String(raw||'').trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if(!match)return raw?null:'';
  const result=match[1].padStart(2,'0')+':'+match[2].padStart(2,'0');
  return validTime(result)?result:null;
 };
 options.onchange=()=>{
  typed.value=options.value;
  if(options.value!==exact)saveHour(options.value);
 };
 typed.oninput=()=>{if(validTime(typed.value)&&typed.value!==exact)saveHour(typed.value)};
 typed.onchange=()=>{
  const next=normalize(typed.value);
  if(next===null){siteNotice('Utilisez le format HH:MM (ex. 18:30).');typed.value=exact;return}
  typed.value=next;
  if(next!==exact)saveHour(next);
 };
 typed.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();typed.blur()}};
 wrap.append(title,options,typed);return wrap;
}
function dayTime(p){
 const slug=pageSlug(p);
 if(p?.group!=='celebration'||!DAY_SLUGS.includes(slug))return '';
 const stored=db.celebrationTimes&&typeof db.celebrationTimes==='object'?db.celebrationTimes:{};
 return validTime(stored[slug])?stored[slug]:'';
}
function updateDayTime(p,value){
 if(value&&!validTime(value)){siteNotice('Heure incorrecte.');return}
 const slug=pageSlug(p);
 if(p.group!=='celebration'||!DAY_SLUGS.includes(slug))return;
 db.celebrationTimes={...(db.celebrationTimes||{}),[slug]:value};
 mark();save();
 // The active text editor must keep its DOM while a clock field is edited.
 const summary=document.querySelector('[data-role="celebration-date"]');
 if(summary)summary.textContent=[dateSummary(p),value].filter(Boolean).join(' · ');
}
function stageDate(p){
 if(p?.group!=='celebration')return '';
 const slot=DAY_SLUGS.indexOf(pageSlug(p));
 return slot<0?'':dayIso(currentDates().wednesday,slot);
}
function dateSummary(p){
 if(p?.group!=='celebration')return '';
 const date=stageDate(p);
 if(date)return prettyDate(date);
 if(pageSlug(p)==='preparation'){
  return currentDates().preparationDates.filter(validIso).map(prettyDate).join(' · ');
 }
 return '';
}
function updateDate(key,value){
 if(value&&!validIso(value)){siteNotice('Date invalide.');return}
 const values={...currentDates(),[key]:value};
 db.celebrationDates=values;
 if(key==='wednesday'&&String(window.__PREPARATION_SEED__?.celebrationId).startsWith('plan-')){
  try{
   const drafts=plannedEntries(),entry=drafts.find(p=>p.id===String(window.__PREPARATION_SEED__.celebrationId));
   if(entry){
    entry.date=value;
    if(!entry.customTitle)entry.title=proposedTitle(entry.archangel,value,drafts[drafts.indexOf(entry)-1]);
    localStorage.setItem(PLANS_KEY,JSON.stringify(drafts));
   }
  }catch{}
 }
 mark();save();render();
}
function updatePreparationDate(index,value){
 if(value&&!validIso(value)){siteNotice('Date invalide.');return}
 const values=currentDates(),list=values.preparationDates.slice();
 if(index<0||index>29)return;
 list[index]=value;
 if(value&&list.some((x,i)=>i!==index&&x===value)){siteNotice('Cette date existe déjà.');return}
 db.celebrationDates={...values,preparationDates:list};mark();save();render();
}
function addPreparationDate(){
 const values=currentDates(),dates=values.preparationDates;
 if(dates.length>=30)return;
 db.celebrationDates={...values,preparationDates:dates.length?[...dates,'']:['','']};mark();save();render();
}
function removePreparationDate(index){
 const values=currentDates(),dates=values.preparationDates.slice();
 dates.splice(index,1);db.celebrationDates={...values,preparationDates:dates};mark();save();render();
}
// Older planned celebrations inserted a read-only date line into their page content.
// Remove only the unchanged generated line; customised text is never removed.
function removeGeneratedDates(pages){
 if(!String(window.__PREPARATION_SEED__?.celebrationId||'').startsWith('plan-'))return;
 for(const p of pages||[]){
  if(p.group!=='celebration'||!DAY_SLUGS.some(day=>p.id===day+'-'+window.__PREPARATION_SEED__.celebrationId))continue;
  const original=window.__PREPARATION_SEED__.pages.find(x=>x.id===p.id)?.blocks.find(x=>x.id===2);
  if(!original||!/^Date : \d{4}-\d{2}-\d{2}$/.test(original.text||''))continue;
  p.blocks=p.blocks.filter(x=>!(x.id===2&&x.kind==='text'&&x.text===original.text&&!x.rich&&!x.bold&&!x.italic&&!x.color&&!x.size));
 }
}
removeGeneratedDates(db.pages);
// Old unedited historical date lines can still be in local browser drafts.
for(const p of db.pages||[])for(const b of p.blocks||[]){
 if(b.kind!=='text'||b.rich)continue;
 const match=/^Dates : ([0-9]{4}-[0-9]{2}-[0-9]{2})(?:[ ]*→[ ]*([0-9]{4}-[0-9]{2}-[0-9]{2}))?$/.exec(String(b.text||''));
 if(!match||!validIso(match[1])||(match[2]&&!validIso(match[2])))continue;
 b.text=prettyDate(match[1])+(match[2]?' → '+prettyDate(match[2]):'');
}



const fileRecords=new Map(),assetUrls=new Map(),selectedImageFiles=new Set();let chosenBlock=null,mediaReturnTab='celebrations',storageReady=false;
let mediaUploadState=null;
const MAX_ASSET_BYTES=60*1024*1024;
function fileDb(){return new Promise((resolve,reject)=>{if(!window.indexedDB){reject(Error('Indisponible'));return}const q=indexedDB.open('celebrations-demo-files-v1',1);q.onupgradeneeded=()=>{if(!q.result.objectStoreNames.contains('files'))q.result.createObjectStore('files',{keyPath:'id'})};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})}
async function fileOperation(mode,record){const database=await fileDb();try{return await new Promise((resolve,reject)=>{const tx=database.transaction('files',mode==='list'?'readonly':'readwrite'),store=tx.objectStore('files'),r=mode==='list'?store.getAll():mode==='put'?store.put(record):store.delete(record);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);tx.onerror=()=>reject(tx.error)})}finally{database.close()}}
function rememberFile(a){const prev=assetUrls.get(a.id);if(prev)URL.revokeObjectURL(prev);fileRecords.set(a.id,a);assetUrls.set(a.id,URL.createObjectURL(a.blob))}
// Imported images live in IndexedDB, not in a page. A page only keeps the image ID.
function imageDataBlob(data){
 const m=String(data||'').match(/^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=]+)$/i);
 if(!m||m[2].length>12000000)return null;
 try{
  const binary=atob(m[2]);if(binary.length>8000000)return null;
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return new Blob([bytes],{type:m[1].toLowerCase()});
 }catch{return null}
}
async function migrateEmbeddedImages(){
 // Existing trials stored direct uploads as data URLs inside the page.
 // Move each image once into the SAME local library; never erase the source on a failed write.
 const bySource=new Map(),changes=[];
 for(const p of db.pages||[])for(const block of p.blocks||[]){
  if(block.kind!=='image'||block.assetId||!String(block.src||'').startsWith('data:image/'))continue;
  let asset=bySource.get(block.src);
  if(!asset){
   const blob=imageDataBlob(block.src);
   if(!blob)continue;
   asset={id:crypto.randomUUID(),name:block.text||'Image importée',type:blob.type,size:blob.size,createdAt:new Date().toISOString(),blob};
   try{await fileOperation('put',asset);rememberFile(asset)}catch{continue}
   bySource.set(block.src,asset);
  }
  changes.push({block,asset,original: block.src});
 }
 if(changes.length){
  for(const {block,asset} of changes){block.assetId=asset.id;block.src=''}
  // If the quota blocks draft saving, retain source data to avoid losing the image.
  try{localStorage.setItem(KEY,JSON.stringify(db))}
  catch{for(const {block,original} of changes){block.src=original;delete block.assetId}}
 }
}
async function loadFiles(){
 try{
  (await fileOperation('list')).forEach(rememberFile);
  storageReady=true;await migrateEmbeddedImages();
 }catch{storageReady=false;status.textContent='Stockage local indisponible : vos images existantes ne sont pas effacées.'}
 render();
}
async function importFiles(files){
 if(IS_STAGE&&LIVE_MEDIA_UPLOAD_HOST){
  let success=0;const failures=[];
  for(const file of files){
   const mp3=/\.mp3$/i.test(file.name);
   const actual=mp3&&!file.type?new File([file],file.name,{type:'audio/mpeg'}):file;
   if(mp3)mediaUploadFeedback(0,'Envoi du MP3 : '+file.name+' (0 %)');
   try{
    await uploadToMediaServer(actual,mp3?pct=>
     mediaUploadFeedback(pct,'Envoi du MP3 : '+file.name+' ('+pct+' %)'):null);
    success++;
    if(mp3)mediaUploadFeedback(100,'✓ MP3 importé : '+file.name);
   }catch(e){
    failures.push(file.name+' : '+e.message);
    status.textContent='❌ '+file.name+' : '+e.message;
    if(mp3)mediaUploadFeedback(mediaUploadState?.percent||0,
      '❌ Transfert interrompu : '+e.message);
   }
  }
  status.textContent=(success?'✓ '+success+' fichier(s) conservé(s) sur le serveur. ':'')+
   (failures.length?'❌ '+failures.length+' échec(s) : '+failures.join(' ; '):'');
  render();return;
 }
 if(!storageReady){status.textContent='Stockage indisponible.';return}
 let total=0;
 for(const file of files){
  if(file.size>60_000_000)continue;
  const item={id:crypto.randomUUID(),name:file.name,type:file.type,size:file.size,
   createdAt:new Date().toISOString(),blob:file};
  try{await fileOperation('put',item);rememberFile(item);total++}catch{}
 }
 status.textContent=total+' fichier(s) conservé(s) sur cet appareil.';render();
}

// Open the complete site media library in a modal; do not navigate away.
function chooseFile(x){
 const choosingVideo=x.kind==='video';
 const dialog=n('dialog','image-picker-dialog file-picker-dialog');
 const head=n('div','image-picker-header');
 const title=n('h3','image-picker-title',choosingVideo?'Choisir une vidéo de la médiathèque':'Choisir un fichier du site');
 title.id='file-picker-heading';dialog.setAttribute('aria-labelledby',title.id);
 const close=b('×',()=>dialog.close(),'image-picker-close');
 close.setAttribute('aria-label','Fermer');head.append(title,close);dialog.append(head);
 const search=n('input','file-picker-search');search.type='search';
 search.placeholder='Rechercher un fichier…';search.setAttribute('aria-label','Rechercher un fichier');
 dialog.append(search);
 const tabs=n('div','file-picker-tabs'),grid=n('div','file-picker-results');
 grid.setAttribute('role','group');grid.setAttribute('aria-label','Fichiers disponibles');
 grid.dataset.view='list';
 dialog.append(tabs,grid);
 const hint=n('p','file-picker-hint','Sélectionnez un fichier. Votre page reste ouverte derrière cette fenêtre.');
 dialog.append(hint);
 const categories=choosingVideo?[['videos','Vidéos']]:[['all','Tous'],...FILE_CATEGORIES];
 let filter=choosingVideo?'videos':'all';
 const inventory=()=>mediaCatalogue.pickerItems(
  [...(globalFiles||[]),...publicFiles()],globalMedia
 );
 const select=file=>{
  if(typeof x?.onSelect==='function'){
   if(file.category!=='images'){siteNotice('Choisissez une image.');return}
   x.onSelect(file);dialog.close();return;
  }
  if(!editorMediaCommands.chooseFile(x,file,choosingVideo))return;
  mark();dialog.close();render();
 };
 const draw=()=>{
  const all=inventory();tabs.replaceChildren();
  for(const [type,name] of categories){
   const count=type==='all'?all.length:all.filter(f=>f.category===type).length;
   const choice=b(name+' ('+count+')',()=>{filter=type;draw()},filter===type?'primary sm':'sm');
   choice.setAttribute('aria-pressed',String(filter===type));tabs.append(choice);
  }
  grid.dataset.view=filter==='images'?'gallery':'list';
  grid.replaceChildren();
  const plain=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const results=all.filter(f=>(filter==='all'||f.category===filter)&&plain(f.name).includes(plain(search.value)));
  const labelOf=Object.fromEntries(FILE_CATEGORIES);
  for(const f of results){
   const item=b('',()=>select(f),'file-picker-card');
   item.dataset.kind=f.category;
   item.setAttribute('aria-label','Choisir '+f.name);
   item.title=f.name;
   const visual=n('span','file-picker-icon');
   if(f.category==='images'){
    const img=n('img');img.src=f.src;img.alt='';img.loading='lazy';
    img.onerror=()=>{img.remove();visual.textContent='▧';visual.classList.add('is-unavailable')};
    visual.append(img);
   }else visual.textContent=({pdf:'📄',audios:'♫',videos:'▶',autres:'📎'})[f.category]||'📎';
   const caption=n('span','file-picker-caption');
   const filename=n('strong','file-picker-filename',f.name);
   const type=n('small','file-picker-filetype',labelOf[f.category]||'Fichier');
   caption.append(filename,type);
   item.append(visual,caption);grid.append(item);
  }
  if(!results.length)grid.append(n('p','image-picker-empty',all.length?'Aucun fichier correspondant.':'Chargement des fichiers…'));
 };
 search.oninput=draw;
 const actions=n('div','file-actions image-picker-footer');
 actions.append(b('Annuler',()=>dialog.close(),'sm'));dialog.append(actions);
 document.body.append(dialog);dialog.onclose=()=>dialog.remove();
 dialog.showModal();draw();
 if(!globalFiles)void loadGlobalFiles().then(()=>{if(dialog.open)draw()}).catch(()=>{
  if(dialog.open)hint.textContent='Certains anciens fichiers ne peuvent pas être chargés.';
 });
 if(IS_STAGE&&!globalMediaLoaded)void refreshGlobalMedia().then(()=>{if(dialog.open)draw()});
}
// This prototype has no server media catalogue: inspect the current unsaved page
// and every other saved staging celebration on this same browser/origin.
function savedPageSets(){
 const all=[{key:KEY,pages:db.pages||[]}];
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);
  if(key===KEY||!(key==='celebrations-demo-editor-v1'||key?.startsWith('celebrations-demo-preparation-')))continue;
  try{const obj=JSON.parse(localStorage.getItem(key));if(Array.isArray(obj?.pages))all.push({key,pages:obj.pages})}catch{}
 }
 return all;
}
function fileUsages(fileId){
 const matches=[];
 for(const group of savedPageSets()){
  for(const p of group.pages){
   let count=0;
   const visit=blocks=>{for(const block of blocks||[]){if(block?.assetId===fileId||block?.coverAssetId===fileId)count++;
    if(block?.kind==='section')for(const col of block.columns||[])visit(col);}};
   visit(p.blocks);
   if(!count)continue;
   let section='';
   if(group.key.startsWith('celebrations-demo-preparation-')){
    const num=group.key.slice('celebrations-demo-preparation-'.length);
    section=num===String(window.__PREPARATION_SEED__?.celebrationId)
     ?String(window.__PREPARATION_SEED__?.archangel||'Célébration')+' '+String(window.__PREPARATION_SEED__?.year||'') 
     :'Célébration '+num;
   }else section='Ancienne maquette';
   matches.push({page:section+' — '+String(p.name||p.id),count});
  }
 }
 for(const [pageId,versions] of Object.entries(editorLocalization.pages||{}))
  for(const [lang,version] of Object.entries(versions||{})){
   let count=0;
   const visit=blocks=>{for(const block of blocks||[]){
    if(block?.assetId===fileId||block?.coverAssetId===fileId)count++;
    if(block?.kind==='section')for(const col of block.columns||[])visit(col);
   }};
   visit(version.blocks);
   if(count)matches.push({page:'Traduction '+lang+' — '+pageId,count});
  }
 return matches;
}
// Files can only be deleted when no page or event references remain.
// A used file must never be removed, even after an extra confirmation.
async function removeFiles(records){
 const todo=records.filter(r=>r&&fileRecords.has(r.id));
 if(!todo.length)return;
 const stillUsed=todo.filter(r=>fileUsages(r.id).length>0);
 if(stillUsed.length){
  status.textContent='Fichier utilisé : retirez-le de toutes les pages avant de le supprimer.';
  return;
 }
 if(!(await siteConfirm('Supprimer définitivement '+todo.length+' fichier(s) inutilisé(s) de cet appareil ?')))return;
 // Recheck after confirmation, in case a page changed in another tab.
 if(todo.some(r=>fileUsages(r.id).length>0)){
  status.textContent='Suppression annulée : le fichier est utilisé.';return;
 }
 let count=0;
 for(const r of todo){
  try{
   await fileOperation('delete',r.id);
   const old=assetUrls.get(r.id);if(old)URL.revokeObjectURL(old);
   assetUrls.delete(r.id);fileRecords.delete(r.id);selectedImageFiles.delete(r.id);count++;
  }catch{status.textContent='Impossible de supprimer '+r.name;break}
 }
 render();status.textContent=count+' fichier(s) supprimé(s).';
}
async function deleteFile(r){await removeFiles([r])}
function buttonHref(x){return x.assetId?(assetUrls.get(x.assetId)||''):(validHref(x.href)?x.href:'')}

const el=s=>document.getElementById(s),w=el('workspace'),status=el('status');
let memberPanel=null,memberPanelRoot=null;
let privateEdit=null,privateReturn=null,privateBusy=false,privateRedo=[];
const n=(t,c,v)=>{const a=document.createElement(t);if(c)a.className=c;if(v!==undefined)a.textContent=v;return a};
const b=(label,fn,c)=>{const x=n('button','btn '+(c||''),label);x.type='button';x.onclick=fn;return x};
const canonicalPage=()=>db.pages.find(p=>p.id===id)||db.pages[0];
const page=()=>{
 const canonical=canonicalPage();
 if(!IS_STAGE||!['page','celebration'].includes(canonical?.group)||editingLanguageId==='fr')return canonical;
 if(localeView&&localeCanonical===canonical&&localeLangId===editingLanguageId)return localeView;
 const variant=editorLocalization.pages[canonical.id]?.[editingLanguageId];
 // A new language begins with no French blocks and is never auto-translated.
 localeView={...canonical,name:variant?.name??'Titre à traduire',
  blocks:clone(variant?.blocks??[])};
 localeCanonical=canonical;localeLangId=editingLanguageId;
 return localeView;
};
function commitLocalizedView(){
 if(!IS_STAGE||editingLanguageId==='fr'||!localeView||localeView.id!==canonicalPage()?.id)return;
 const canonical=canonicalPage();
 if(!['page','celebration'].includes(canonical.group))return;
 const versions=editorLocalization.pages[canonical.id]||{};
 const before=versions[editingLanguageId]||{};
 const content={...before,name:localeView.name,blocks:localeView.blocks};
 const next=setPageTranslation({...canonical,translations:versions},
  editorLocalization.registry,editingLanguageId,content);
 editorLocalization.pages[canonical.id]=next.translations;
}
const mediaCatalogue=createMediaCatalogue({validHref});
const editorMediaCommands=createEditorMediaCommands();
const FILE_CATEGORIES=mediaCatalogue.categories;
function categoryOfLocal(record){return mediaCatalogue.categoryOfLocal(record)}
function publicFiles(){return mediaCatalogue.publicFiles(window.__PREPARATION_SEED__?.files)}
// The file library is global; each public reference records all celebration/day uses.
const fileSeeds=new Map(),fileGroups=new Map();
let globalFiles=null,globalFilesLoading=null,globalFilesComplete=false,hiddenFileIds=new Set();
let globalMedia=[],remoteMediaLoading=false,globalMediaLoaded=false;
const mediaCategoryOf=m=>mediaCatalogue.mediaCategoryOf(m);
async function refreshGlobalMedia(){
 if(remoteMediaLoading)return;
 remoteMediaLoading=true;
 try{
  const response=await fetch('/api/editor-media',{cache:'no-store'});
  if(!response.ok)throw Error('Bibliothèque distante indisponible');
  const result=await response.json();
  globalMedia=Array.isArray(result.items)?result.items:[];
  globalMediaLoaded=true;
  if(tab==='media')render();
 }catch{status.textContent='La médiathèque du serveur n’est pas accessible. Les fichiers existants sont conservés.'}
 finally{remoteMediaLoading=false}
}
function mediaUploadFeedback(percent,message){
 mediaUploadState={percent,message};
 const bar=document.getElementById('media-upload-progress');
 const label=document.getElementById('media-upload-feedback');
 if(bar){bar.hidden=false;bar.value=percent}
 if(label){label.hidden=false;label.textContent=message}
}
async function uploadToMediaServer(file,onProgress=null){
 const form=new FormData();form.append('file',file);
 let result;
 if(onProgress){
  // A real upload event (not a timer) reports bytes transmitted to the server.
  result=await new Promise((resolve,reject)=>{
   const xhr=new XMLHttpRequest();
   xhr.open('POST','/api/editor-media?action=upload',true);
   xhr.responseType='json';
   xhr.withCredentials=true;
   xhr.upload.onprogress=e=>{
    if(e.lengthComputable&&e.total>0)onProgress(Math.min(99,Math.round(e.loaded*100/e.total)));
    if(e.lengthComputable&&e.loaded===e.total)mediaUploadFeedback(99,'Envoi terminé. Vérification de l’enregistrement par le serveur…');
   };
   xhr.onload=()=>{
    const data=xhr.response||{};
    if(xhr.status>=200&&xhr.status<300&&data.ok===true&&data.item)resolve(data);
    else reject(Error(data.error||'Envoi vers le serveur impossible ('+xhr.status+')'));
   };
   xhr.onerror=()=>reject(Error('Connexion interrompue pendant le transfert'));
   xhr.onabort=()=>reject(Error('Transfert annulé'));
   xhr.send(form);
  });
 }else{
  const response=await fetch('/api/editor-media?action=upload',{method:'POST',body:form});
  result=await response.json().catch(()=>({}));
  if(!response.ok||result.ok!==true||!result.item)throw Error(result.error||'Envoi vers le serveur impossible');
 }
 globalMedia=globalMedia.filter(x=>x.id!==result.item.id).concat(result.item);
 serverRevision=result.revision;
 return result.item;
}
async function createExternalMedia(){
 const value=String((await sitePrompt('Lien HTTPS vers une vidéo, un PDF, une image, un audio ou une page :'))||'').trim();
 if(!/^https:\/\//i.test(value))return;
 let url;try{url=new URL(value)}catch{siteNotice('Adresse invalide');return}
 if(url.username||url.password){siteNotice('Adresse invalide');return}
 const choices=['Vidéo','PDF','Image','Audio'];
 const input=String((await sitePrompt('Type : 1 Vidéo, 2 PDF, 3 Image, 4 Audio','1'))||'').trim();
 const type=({1:'video',2:'pdf',3:'image',4:'audio'})[input];
 if(!type){siteNotice('Choisissez 1, 2, 3 ou 4.');return}
 const name=String((await sitePrompt('Nom du média :',url.hostname))||'').trim().slice(0,120);
 const response=await fetch('/api/editor-media?action=external',{method:'POST',
  headers:{'content-type':'application/json'},body:JSON.stringify({type,src:url.href,name:name||url.hostname})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok){siteNotice(result.error||'Enregistrement impossible');return}
 serverRevision=result.revision;
 globalMedia=globalMedia.filter(x=>x.id!==result.item.id).concat(result.item);
 status.textContent='✓ Lien conservé dans la médiathèque globale';render();
}
async function deleteGlobalMedia(media){
 if(!(await siteConfirm('Supprimer « '+media.name+' » de la médiathèque ? Si ce fichier est encore utilisé, la suppression sera refusée.')))return;
 const response=await fetch('/api/editor-media?action=delete',{method:'POST',
  headers:{'content-type':'application/json'},body:JSON.stringify({id:media.id})});
 const result=await response.json().catch(()=>({}));
 if(!response.ok){siteNotice(result.error||'Suppression non autorisée');return}
 serverRevision=result.revision;globalMedia=globalMedia.filter(x=>x.id!==media.id);
 status.textContent='✓ Média inutilisé supprimé du catalogue';render();
}

try{hiddenFileIds=new Set(JSON.parse(localStorage.getItem('celebrations-files-hidden-v1')||'[]'))}catch{}
if(IS_STAGE)fileSeeds.set(String(window.__PREPARATION_SEED__.celebrationId),window.__PREPARATION_SEED__);
function fileKey(r){return mediaCatalogue.fileKey(r)}
function filePageRef(seed,step){
 const page=seed.pages.find(p=>p.group==='celebration'&&p.name===step);
 if(!page)return null;
 const cid=String(seed.celebrationId);
 return {celebrationId:cid,name:seed.archangel+' '+seed.year,pageId:page.id,pageName:page.name,
  slug:page.id.endsWith('-'+cid)?page.id.slice(0,-cid.length-1):page.id};
}
function addCatalogueSeed(map,seed){
 for(const record of seed.files||[]){
  const key=fileKey(record);
  let file=map.get(key);
  if(!file){file={...record,uses:[]};map.set(key,file)}
  for(const name of record.pages||[]){
   const use=filePageRef(seed,name);
   if(use&&!file.uses.some(u=>u.celebrationId===use.celebrationId&&u.pageId===use.pageId))file.uses.push(use);
  }
 }
 // Draft attachments can reuse an archive in any celebration; only this device is scanned.
 let stored=null;
 try{stored=String(seed.celebrationId)===String(window.__PREPARATION_SEED__.celebrationId)?db:
  JSON.parse(localStorage.getItem('celebrations-demo-preparation-'+seed.celebrationId)||'null')}catch{}
 if(!stored?.pages)return;
 for(const p of stored.pages.filter(p=>p.group==='celebration')){
  const use=filePageRef(seed,p.name);if(!use)continue;
  for(const block of p.blocks||[]){
   const category=block.kind==='image'?'images':block.kind==='audio'?'audios':
    block.kind==='button'?'pdf':block.kind==='text'?'autres':'';
   if(!category)continue;
   const key=category+':'+String(block.src||block.remoteKey||block.href||'');
   let file=map.get(key);
   if(!file)continue;
   if(!file.uses.some(u=>u.celebrationId===use.celebrationId&&u.pageId===use.pageId))file.uses.push(use);
  }
 }
}
async function loadFileSeed(cid){
 cid=String(cid);
 if(fileSeeds.has(cid))return fileSeeds.get(cid);
 const response=await fetch('/__editor/demo-preparation?celebration='+encodeURIComponent(cid)+'&format=json',{credentials:'same-origin',cache:'no-store'});
 if(!response.ok)throw Error('Célébration indisponible');
 const payload=await response.json();
 if(!payload?.ok||String(payload.seed?.celebrationId)!==cid)throw Error('Célébration incorrecte');
 fileSeeds.set(cid,payload.seed);return payload.seed;
}
function loadGlobalFiles(){
 if(globalFilesLoading)return globalFilesLoading;
 globalFilesLoading=(async()=>{
  const map=new Map(),ids=celebrationEntries().map(x=>String(x.id));
  const settled=await Promise.allSettled(ids.map(id=>loadFileSeed(id)));
  globalFilesComplete=settled.every(result=>result.status==='fulfilled');
  for(let i=0;i<settled.length;i++)if(settled[i].status==='fulfilled')addCatalogueSeed(map,settled[i].value);
  globalFiles=[...map.values()];
  return globalFiles;
 })().catch(()=>{globalFiles=null;return null});
 return globalFilesLoading;
}
function fileUses(r){return mediaCatalogue.fileUses(r)}
function localCategory(r){return categoryOfLocal(r)}
// Historical public media are held in staging R2 and can only be physically
// deleted after their D1 references, including other audience views, are cleared.
// Never offer a misleading local-only "hide" action in place of deletion.
function makeLibraryBlock(r,time){return mediaCatalogue.makeLibraryBlock(r,time,uniqueBlockId())}
function cloudAudioUsages(key){
 const uses=[];
 for(const group of savedPageSets())for(const p of group.pages)
  if((p.blocks||[]).some(b=>b.kind==='audio'&&b.remoteKey===key))uses.push(p.name);
 return [...new Set(uses)];
}
const pageSlug=p=>editorPageModel.pageSlug(p,window.__PREPARATION_SEED__?.celebrationId);
async function createPage(group){
 const entered=await sitePrompt(group==='celebration'?'Nom de la page supplémentaire de la célébration :':group==='footer'?'Titre de la page de bas de page :':'Nom de la page hors célébration :');
 const name=String(entered||'').trim().slice(0,95);
 if(!name)return;
 if(dirty){save();if(dirty)return}
 const uid=crypto.randomUUID();
 const isCelebration=group==='celebration';
 const suffix=window.__PREPARATION_SEED__?.celebrationId||'demo';
 const q=editorPageModel.createPage(group,name,uid,suffix);
 db.pages.push(q);id=q.id;selectedBlockId=null;tab=isCelebration?'celebrations':group==='footer'?'footer':'pages';
 mark();save();render();
 // New pages are immediately written to the shared server as private drafts.
 if(IS_STAGE&&typeof serverSave==='function')void serverSave();
}


/* Colourways are limited to the current archangel and never colour body text. */
const pagePalettes=()=>window.__PREPARATION_SEED__?.palettes;
function selectedPalette(){
 const options=pagePalettes();
 if(!Array.isArray(options)||options.length!==5)return null;
 const index=Number.isInteger(db.themeIndex)&&db.themeIndex>=0&&db.themeIndex<5?db.themeIndex:0;
 return options[0];
}
function applyPalette(){
 const stage=document.querySelector('.stage-editor'),chosen=selectedPalette();
 if(!stage||!chosen||!Array.isArray(chosen.shades)||chosen.shades.length!==5)return;
 if(/^#[0-9a-f]{6}$/i.test(chosen.shades[3]))stage.style.setProperty('--frame-color',chosen.shades[3]);
}
const BLOCK_SIZES=[14,16,18,20,24,28,32,40],ALIGNMENTS=['left','center','right'];
function uniqueBlockId(){return 'block-'+crypto.randomUUID()}
const editorBlockModel=createBlockModel();
const editorBlockCommands=createEditorBlockCommands({model:editorBlockModel});
// Keep only bold, italic and strictly validated inline colours in saved drafts.
function inlineColor(value){
 const v=String(value||'').trim().toLowerCase();
 if(/^#[0-9a-f]{6}$/.test(v))return v;
 const match=v.match(/^rgb\(([^)]+)\)$/);
 if(!match)return '';
 const values=match[1].split(/[\s,]+/).filter(Boolean);
 if(values.length!==3||values.some(n=>!/^\d{1,3}$/.test(n)||Number(n)>255))return '';
 return '#'+values.map(n=>Number(n).toString(16).padStart(2,'0')).join('');
}
function htmlSafe(source){
 const temp=document.createElement('div');
 const raw=document.createElement('template');raw.innerHTML=String(source||'').slice(0,18000);
 let count=0;
 function copy(from,to){
  if(count++>15000)return;
  for(const node of from.childNodes){
   if(node.nodeType===3){to.append(document.createTextNode(node.textContent||''));continue}
   if(node.nodeType!==1)continue;
   const tag=node.tagName.toLowerCase();
   if(['script','style','iframe','svg','object','template'].includes(tag))continue;
   if(tag==='br'){to.append(document.createElement('br'));continue}
   if(['strong','b','em','i'].includes(tag)){
    const child=document.createElement(['strong','b'].includes(tag)?'strong':'em');
    copy(node,child);to.append(child);continue;
   }
   if(tag==='span'||tag==='font'){
    const raw=node.getAttribute('style')||'';
    const specified=raw.match(/(?:^|;)\s*color\s*:\s*([^;]+)(?:;|$)/i);
    const colour=inlineColor(tag==='font'?node.getAttribute('color')||node.style.color:(specified?.[1]||node.style.color));
    if(colour){const child=document.createElement('span');child.style.color=colour;copy(node,child);to.append(child)}
    else copy(node,to);
    continue;
   }
   if(['div','p'].includes(tag)&&to.childNodes.length)to.append(document.createElement('br'));
   copy(node,to);
  }
 }
 copy(raw.content,temp);return temp.innerHTML;
}
// CSP-safe: restore only checked colours via DOM style properties after HTML parsing.
function restoreInlineColours(z){
 for(const span of z.querySelectorAll('span[style]')){
  const raw=span.getAttribute('style')||'';
  const m=raw.match(/(?:^|;)\s*color\s*:\s*([^;]+)(?:;|$)/i);
  const value=inlineColor(m?.[1]);
  if(value){span.removeAttribute('style');span.style.color=value}
 }
}
function saveRich(x,z){if(x.kind==='button'){x.text=z.innerText.slice(0,IS_STAGE?50000:5000)}else{
 const safe=htmlSafe(z.innerHTML).slice(0,18000);x.rich=safe;x.text=z.innerText.slice(0,5000)}
 mark();
}
function sizeOf(x){return BLOCK_SIZES.includes(Number(x.size))?Number(x.size):(x.kind==='heading'?28:16)}
function pageMainTitle(p){
 return p.blocks.flatMap(y=>y.kind==='section'
  ?[...(y.columns?.[0]||[]),...(y.columns?.[1]||[])]:[y]).find(y=>y.kind==='heading');
}
function displayedHeadingSize(x,p){
 if(!['heading','event'].includes(x.kind)||BLOCK_SIZES.includes(Number(x.size)))return sizeOf(x);
 return x.kind==='heading'&&pageMainTitle(p)===x?28:24;
}
function duplicateBlock(x,p,items=p.blocks){
 const copy=editorBlockCommands.duplicateInContainer(x,items,uniqueBlockId(),clone);
 if(!copy)return;
 // Keep exactly the displayed source size without making a second page title.
 if(['heading','event'].includes(x.kind)&&!BLOCK_SIZES.includes(Number(x.size)))
  copy.size=displayedHeadingSize(x,p);
 selectedBlockId=String(copy.id);
 mark();render();
}
// Keep the user's selection when a button or the native mobile colour picker takes focus.
let rememberedSelection=null;
function rangeInEditor(z){
 const sel=window.getSelection();
 if(sel&&sel.rangeCount&&!sel.isCollapsed&&z.contains(sel.anchorNode)&&z.contains(sel.focusNode))
  return sel.getRangeAt(0).cloneRange();
 if(rememberedSelection?.host===z&&z.isConnected&&z.contains(rememberedSelection.range.commonAncestorContainer))
  return rememberedSelection.range.cloneRange();
 return null;
}
document.addEventListener('selectionchange',()=>{
 const sel=window.getSelection();
 if(!sel||!sel.rangeCount)return;
 if(!sel.isCollapsed){
  const a=sel.anchorNode?.nodeType===1?sel.anchorNode:sel.anchorNode?.parentElement;
  const z=a?.closest?.('.ed[contenteditable="true"]');
  if(z&&z.contains(sel.focusNode))rememberedSelection={host:z,range:sel.getRangeAt(0).cloneRange()};
 }
});
function editorFormatToolbar(x,z,box){
 const bar=n('div','formatbar');
 const make=(label,title,fn)=>{
  const bt=b(label,fn,'sm format-button');bt.title=title;bt.setAttribute('aria-label',title);
  bt.addEventListener('mousedown',e=>e.preventDefault());
  bar.append(bt);return bt
 };
 function format(command,prop){
  const range=rangeInEditor(z);
  if(range){
   const tag=prop==='bold'?'strong':'em';
   const element=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
   const existing=element?.closest?.(tag);
   if(existing&&z.contains(existing)&&range.toString()===existing.textContent){
    existing.replaceWith(...existing.childNodes);
    rememberedSelection=null;
   }else{
    const wrapper=document.createElement(tag);
    wrapper.append(range.extractContents());
    range.insertNode(wrapper);
    const selected=document.createRange();selected.selectNodeContents(wrapper);
    rememberedSelection={host:z,range:selected};
   }
   saveRich(x,z);
  }else{x[prop]=!x[prop];z.style[prop==='bold'?'fontWeight':'fontStyle']=x[prop]?(prop==='bold'?'700':'italic'):'normal';mark()}
 }
 make('G','Gras (sélection ou bloc)',()=>format('bold','bold'));
 make('I','Italique (sélection ou bloc)',()=>format('italic','italic'));
 const sizes=n('select','format-select');sizes.setAttribute('aria-label','Taille du texte');sizes.title='Taille du paragraphe entier';
 for(const num of BLOCK_SIZES){const opt=n('option','',num+' px');opt.value=String(num);if(num===(Number.parseInt(z.style.fontSize,10)||sizeOf(x)))opt.selected=true;sizes.append(opt)}
 sizes.onchange=()=>{x.size=Number(sizes.value);z.style.fontSize=x.size+'px';mark()};bar.append(sizes);
 const label=n('label','color-picker');label.title='Couleur de la sélection ou de tout le paragraphe';label.append(n('span','','Couleur '));
 const color=n('input');color.type='color';color.setAttribute('aria-label','Couleur du texte');color.value=validColor(x.color)?x.color:'#323744';
 let colourRange=null,colourSpan=null;
 const capture=()=>{colourRange=rangeInEditor(z);colourSpan=null};
 color.addEventListener('pointerdown',capture);
 color.addEventListener('focus',()=>{if(!colourRange)capture()});
 color.oninput=()=>{
  if(colourSpan&&z.contains(colourSpan)){colourSpan.style.color=color.value;saveRich(x,z);return}
  const range=colourRange||rangeInEditor(z);
  if(range&&!range.collapsed&&z.contains(range.commonAncestorContainer)){
   const span=document.createElement('span');span.style.color=color.value;
   span.append(range.extractContents());range.insertNode(span);
   colourSpan=span;
   const selected=document.createRange();selected.selectNodeContents(span);
   rememberedSelection={host:z,range:selected};
   saveRich(x,z);
  }else{
   x.color=color.value;z.style.color=color.value;mark();
  }
 };
 color.addEventListener('change',()=>{colourRange=null;colourSpan=null});
 label.append(color);bar.append(label);
 const align=n('select','format-select');align.setAttribute('aria-label','Alignement');
 for(const [value,name] of [['left','Gauche'],['center','Centré'],['right','Droite']]){const opt=n('option','',name);opt.value=value;if((x.align||'left')===value)opt.selected=true;align.append(opt)}
 align.onchange=()=>{x.align=align.value;box.style.textAlign=align.value;mark()};bar.append(align);
 return bar;
}

// Bounded local editor history. Ctrl+Z and the mobile arrow restore the
// previous authoring state without writing or publishing until Save is clicked.

// Server-side staging synchronization; deliberately separate from local autosave.
// Shared staging copy: a browser displays the last deliberately saved server version.
const SERVER_ENDPOINT='/api/editor-open-draft';
const SERVER_ID=String(window.__PREPARATION_SEED__?.celebrationId||'');
let serverRevision=null,serverRemoteVersion=0,serverSaving=false,serverDiverged=false;
let serverBaseRecord=null,serverBaseShared=null,serverBasePlans=null,serverBaseLocalization=null;
let serverSaveQueued=false,serverLocalEditCounter=0;
const serverSame=(a,b)=>editorSyncPolicy.same(a,b);
const serverHeaders=()=>({});
function serverMessage(message){
 status.textContent=message;
 const old=document.getElementById('server-login-link');if(old)old.remove();
}
async function serverLoad(){
 try{
  const response=await fetch(SERVER_ENDPOINT+'?celebration='+encodeURIComponent(SERVER_ID),{cache:'no-store'});
  if(!response.ok){
   serverMessage('Impossible de charger la version commune : vos modifications locales restent intactes.');return;
  }
  const payload=await response.json();
  serverRevision=payload.revision;if(payload.celebrationMetadata)celebrationMetadata=payload.celebrationMetadata;
  globalMedia=Array.isArray(payload.mediaCatalogue)?payload.mediaCatalogue:globalMedia;
  const remote=payload.record;
  serverBaseRecord=clone(remote);serverBaseShared=clone(payload.shared);
  serverBasePlans=clone(payload.plans||[]);
  serverBaseLocalization=clone(payload.localization??null);
  // Never lose a page with a failed server save merely because it is reloaded.
  let pending=null;
  try{pending=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
  if(pending?._serverPending===true&&Array.isArray(pending.pages)){
   db._serverRevision=serverRevision;db._serverPending=true;
   serverDiverged=true;
   serverMessage('⚠️ Modifications locales non transmises retrouvées. Elles sont conservées. Cliquez sur Enregistrer pour les envoyer au serveur.');
   return;
  }
  if(!remote){
   if(payload.localization){editorLocalization=normalizeLocalization(payload.localization);clearLocaleView();saveLocalizationLocal();}
   serverMessage('Aucune version commune enregistrée. Depuis l’appareil contenant les bonnes pages, cliquez sur Enregistrer.');
   return;
  }
  let local=null,localShared=null,localPlans=null;
  try{local=JSON.parse(localStorage.getItem(KEY)||'null')}catch{}
  try{localShared=JSON.parse(localStorage.getItem(SHARED_KEY)||'null')}catch{}
  try{localPlans=JSON.parse(localStorage.getItem(PLANS_KEY)||'null')}catch{}
  const changed=!!local&&JSON.stringify(local.pages?.filter(p=>p.group==='celebration'))!==JSON.stringify(remote.pages);
  const sharedChanged=!!localShared&&Array.isArray(payload.shared?.pages)&&payload.shared.pages.length>0&&
   JSON.stringify(localShared.pages)!==JSON.stringify(payload.shared.pages);
  let localLocalization=null;
  try{localLocalization=JSON.parse(localStorage.getItem(LOCALIZATION_KEY)||'null')}catch{}
  const localizationChanged=!!localLocalization&&
   JSON.stringify(localLocalization)!==JSON.stringify(payload.localization??emptyLocalization());
  // Never silently destroy older browser-specific drafts: keep one recoverable archive.
  if(changed||sharedChanged||localizationChanged){
   try{
    const key='celebrations-last-browser-draft-before-sync-v1';
    if(!localStorage.getItem(key))
     localStorage.setItem(key,JSON.stringify({celebration:SERVER_ID,record:local,shared:localShared,plans:localPlans,localization:localLocalization}));
   }catch{}
  }
  const shared=payload.shared;
  const general=Array.isArray(shared?.pages)?clone(shared.pages):
   db.pages.filter(p=>p.group==='page');
  const ids=new Set(general.map(p=>p.id));
  const homeId=ids.has(shared?.homeId)?shared.homeId:general.find(p=>p.id==='neutral-accueil-general')?.id||general[0]?.id||'neutral-accueil-general';
  db={...db,...clone(remote),pages:general.concat(clone(remote.pages)),
   siteHomeId:homeId,_serverRevision:payload.revision,_serverPending:false};
  if(Array.isArray(shared?.pages))
   localStorage.setItem(SHARED_KEY,JSON.stringify({...shared,pages:general,homeId}));
  editorLocalization=normalizeLocalization(payload.localization);
  clearLocaleView();saveLocalizationLocal();
  if(Array.isArray(payload.plans))localStorage.setItem(PLANS_KEY,JSON.stringify(payload.plans));
  try{localStorage.setItem(KEY,JSON.stringify(db))}catch{}
  serverDiverged=false;
  serverMessage('✓ Version commune chargée depuis le serveur. Même contenu sur tous les appareils.');
 }catch{
  serverMessage('Connexion au serveur impossible. Votre brouillon sur cet appareil est conservé.');
 }
}
// Saving creates a private draft. Publication is an explicit second action
// and updates ONLY the chosen public page or celebration.
async function serverPublish(command,{flushContent=true}={}){
 if(serverSaving){serverMessage('Un enregistrement est en cours. Réessayez après confirmation.');return false;}
 // A visibility choice is not an implicit save of unsaved edits.
 const unsavedContent=dirty||!!db._serverPending;
 if(flushContent&&unsavedContent){
  if(dirty)save();
  await serverSave();
  if(db._serverPending||serverRevision===null)return false;
 }
 if(serverRevision===null){serverMessage('Rechargez la version du serveur avant de publier.');return false}
 try{
  if(command.kind==='celebration'){
   ensureMemberPanel();const record=await memberPanel.readContent();
   if(record.record.spaces?.length||record.record.pages?.some(p=>p.privateManaged)){
    privateCatalogue=await memberPanel.commandContent('celebration-visibility',{visibility:command.visibility});
    serverRevision=privateCatalogue.revision;db._serverRevision=serverRevision;
    let shared={};try{shared=JSON.parse(localStorage.getItem(SHARED_KEY)||'{}')}catch{}
    shared.celebrationVisibility={...shared.celebrationVisibility,[SERVER_ID]:command.visibility};
    localStorage.setItem(SHARED_KEY,JSON.stringify(shared));
    render();serverMessage('Visibilité enregistrée.');return true;
   }
  }
  const response=await fetch('/api/editor-publication',{method:'POST',cache:'no-store',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({celebration:SERVER_ID,expectedRevision:serverRevision,...command})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok){
   if(response.status===409)serverRevision=null;
   serverMessage('❌ '+(result.error||'Publication impossible. Le brouillon reste enregistré.'));
   return false;
  }
  serverRevision=result.revision;
  db._serverRevision=serverRevision;
  if(!unsavedContent||flushContent)db._serverPending=false;
  if(command.kind==='page'){
   const item=db.pages.find(p=>p.id===command.pageId);if(item)item.visibility=command.visibility;
  }else if(command.kind==='celebration'){
   let shared={};try{shared=JSON.parse(localStorage.getItem(SHARED_KEY)||'{}')}catch{}
   shared.celebrationVisibility||={};
   shared.celebrationVisibility[SERVER_ID]=command.visibility;
   localStorage.setItem(SHARED_KEY,JSON.stringify(shared));
   const plans=plannedEntries(),plan=plans.find(x=>x.id===SERVER_ID);
   if(plan){plan.visibility=command.visibility;localStorage.setItem(PLANS_KEY,JSON.stringify(plans));}
  }else if(command.kind==='media'){
   const item=globalMedia.find(x=>x.id===command.mediaId);if(item)item.general=command.general;
  }
  localStorage.setItem(KEY,JSON.stringify(db));
  serverMessage(command.kind==='language-registry'?'✓ Langues publiques actualisées.':
   command.kind==='translation'?'✓ Publication de la traduction actualisée.':
   command.visibility==='published'?'✓ Publié : les visiteurs voient cette version.':
   command.visibility==='hidden'||command.visibility==='draft'?'✓ Masqué du site public.':
   '✓ Médiathèque générale actualisée.');
  // Publication is a remote operation, not an undoable local edit. Reset
  // history here so Ctrl+Z can never roll back a published/hidden status.
  if(typeof resetUndoHistory==='function'&&(!unsavedContent||flushContent))resetUndoHistory();
  render();
  if(!flushContent&&unsavedContent)serverMessage('✓ Visibilité modifiée. Le contenu en cours reste à enregistrer.');
  return true;
 }catch(e){serverMessage('❌ Connexion indisponible : aucun changement public effectué.');return false}
}
const serverFileAsDataURL=file=>new Promise((resolve,reject)=>{
 const reader=new FileReader();reader.onload=()=>resolve(reader.result);
 reader.onerror=()=>reject(Error('Lecture image impossible'));reader.readAsDataURL(file);
});
async function serverRecord(){
 const record=clone(db);
 record.pages=record.pages.filter(p=>p.group==='celebration'&&p.id.endsWith('-'+SERVER_ID));
 delete record._serverPending;delete record._serverRevision;
 async function persistImages(blocks){
  for(const block of blocks||[]){
   if(block.kind==='section'){
    for(const column of block.columns||[])await persistImages(column);
    continue;
   }
   for(const [field,source] of [['assetId','src'],['coverAssetId','cover']]){
    if(!block[field])continue;
    const file=fileRecords.get(block[field]);
    if(!file||!file.blob||!/^image\/(?:jpeg|png|webp)$/.test(file.type||'')||file.size>700000)
     throw Error('Une image est uniquement sur cet appareil. Téléchargez-la sur le site avant Enregistrer.');
    block[source]=await serverFileAsDataURL(file.blob);
    delete block[field];
   }
  }
 }
 for(const p of record.pages)await persistImages(p.blocks);
 const localization=clone(editorLocalization);
 for(const versions of Object.values(localization.pages||{}))
  for(const content of Object.values(versions||{}))
   await persistImages(content.blocks);
 return {record,localization};
}
async function serverSave(){
 // Private pages are stored by their own canonical guarded command, never legacy R2.
 if(privateEdit)return savePrivatePage();
 if(serverSaving){serverSaveQueued=true;return false}
 if(serverRevision===null){
  db._serverPending=true;
  serverMessage('❌ Impossible de joindre la version du serveur. Vos modifications sont conservées dans ce navigateur. Connectez-vous à nouveau à l’administration.');
  return false;
 }
 serverSaving=true;
 const button=el('save-btn');button.disabled=true;button.textContent='Enregistrement sur le serveur…';syncSecondarySave();
 button.classList.remove('save-confirmed','save-failed');
 serverMessage('Sauvegarde sécurisée en cours…');
 const started=serverLocalEditCounter;
 try{
  const {record,localization}=await serverRecord(),plans=plannedEntries();
  let shared;
  try{shared=JSON.parse(localStorage.getItem(SHARED_KEY)||'null')}catch{}
  // Always send the CURRENT in-memory page, not a stale localStorage copy.
  // Full browser storage may reject writes while server storage still works.
  shared={...(shared||{}),pages:db.pages.filter(p=>p.group==='page'),
   homeId:db.siteHomeId||'neutral-accueil-general'};
  const selected=(tab==='pages'||tab==='celebrations')?page():null;
  const pageId=selected?.id||null;
  if(serverDiverged){
   // A locally recovered draft must never overwrite newer server work quietly.
   if(!(await siteConfirm('Cette version locale diffère du serveur. Souhaitez-vous envoyer vos modifications ? Une copie locale de secours est conservée.'))){
    serverMessage('Modifications locales conservées ; rien n’a été écrasé sur le serveur.');
    return false;
   }
   serverDiverged=false;
  }
  let response,payload={};
  for(let attempt=0;attempt<2;attempt++){
   response=await fetch(SERVER_ENDPOINT,{method:'POST',cache:'no-store',
    headers:{...serverHeaders(),'content-type':'application/json'},
    body:JSON.stringify({celebration:SERVER_ID,expectedRevision:serverRevision,
     record,plans,shared,localization,...(pageId?{publishPageId:pageId}:{})})});
   payload=await response.json().catch(()=>({}));
   if(response.ok)break;
   if(response.status!==409||attempt===1)
    throw Error(payload.error||('Le serveur a refusé la sauvegarde (HTTP '+response.status+').'));
   const reload=await fetch(SERVER_ENDPOINT+'?celebration='+encodeURIComponent(SERVER_ID),{cache:'no-store'});
   if(!reload.ok)throw Error('Version du serveur indisponible après conflit.');
   const fresh=await reload.json();
   const unchanged=editorSyncPolicy.unchangedRemote(fresh,serverBaseRecord,serverBaseShared,serverBasePlans,serverBaseLocalization);
   serverRevision=fresh.revision;
   if(!unchanged){
    serverDiverged=true;
    throw Error('Une autre version de ces pages existe sur le serveur. Votre travail reste ici. Cliquez à nouveau sur Enregistrer pour décider.');
   }
  }
  if(!response?.ok)throw Error(payload.error||'Enregistrement refusé.');
  serverRevision=payload.revision;if(payload.celebrationMetadata)celebrationMetadata=payload.celebrationMetadata;
  serverBaseRecord=clone(record);serverBaseShared=clone(shared);
  serverBaseLocalization=clone(localization);
  serverBasePlans=clone(plans);
  const stillCurrent=editorSyncPolicy.noNewEdits(started,serverLocalEditCounter);
  db._serverRevision=serverRevision;db._serverPending=!stillCurrent;
  if(stillCurrent)dirty=false;
  if(!stillCurrent)serverSaveQueued=true;
  try{localStorage.setItem(KEY,JSON.stringify(db))}catch{}
  // HTTP 200 is not a reliable success message unless the page can be read
  // back intact from the same server and its expected revision.
  let confirmed=false;
  try{
   const check=await fetch(SERVER_ENDPOINT+'?celebration='+encodeURIComponent(SERVER_ID),{cache:'no-store'});
   if(check.ok){
    const saved=await check.json();
    confirmed=editorSyncPolicy.readbackConfirmed(saved,payload.revision,pageId,record,shared,localization);
    if(confirmed){serverBaseRecord=clone(saved.record);serverBaseShared=clone(saved.shared);
     serverBasePlans=clone(saved.plans||[]);serverBaseLocalization=clone(saved.localization??null);}
   }
  }catch{}
  if(!confirmed){
   db._serverPending=true;
   try{localStorage.setItem(KEY,JSON.stringify(db))}catch{}
   throw Error('Le serveur a accepté l’envoi, mais sa relecture ne confirme pas encore votre page.');
  }
  const live=!!payload.publishedPageId;
  const label=live?'✓ Enregistré et mis à jour sur le site public':
   '✓ Enregistré sur le serveur (brouillon)';
  button.textContent=label;button.classList.add('save-confirmed');syncSecondarySave();
  serverMessage(label+' — contenu revérifié après enregistrement.');
  clearTimeout(saveFeedbackTimer);
  saveFeedbackTimer=setTimeout(()=>{
   button.classList.remove('save-confirmed');
   if(!dirty)button.textContent='Enregistrer';
  },5000);
  return true;
 }catch(e){
  button.textContent='Échec — réessayer';button.classList.add('save-failed');
  db._serverPending=true;
  try{localStorage.setItem(KEY,JSON.stringify(db))}catch{}
  serverMessage('❌ '+(e.message||'Erreur réseau')+' Modifications conservées sur cet appareil.');
  return false;
 }finally{
  serverSaving=false;button.disabled=false;syncSecondarySave();
  if(serverSaveQueued){
   serverSaveQueued=false;
   // Another edit made while the first save was in flight is never discarded.
   if(db._serverPending&&started!==serverLocalEditCounter)
    queueMicrotask(()=>{save();void serverSave()});
  }
 }
}
const UNDO_STEPS=36,UNDO_BYTES=6000000;
const editorUndoPolicy=createEditorUndoPolicy({steps:UNDO_STEPS,bytes:UNDO_BYTES});
let undoStack=[],undoAnchor=null,lastTyping='',lastTypedAt=0,historyReplaying=false;
function undoSnapshot(){return editorUndoPolicy.snapshot(db)}
function updateUndoButton(){
 const bt=document.getElementById('undo-btn');
 if(bt){
  bt.disabled=preview||undoStack.length===0;
  bt.setAttribute('aria-label','Annuler la dernière action');
 }
}
function resetUndoHistory(){
 undoStack=[];privateRedo=[];undoAnchor=undoSnapshot();lastTyping='';lastTypedAt=0;
 updateUndoButton();
}
function typingField(){
 const e=document.activeElement;
 if(!e)return '';
 if(e.isContentEditable||e.closest?.('[contenteditable="true"]'))
  return id+':'+(selectedBlockId||'')+':texte';
 if(e.matches?.('textarea,input[type="text"],input[type="search"],input[type="url"],input:not([type])'))
  return id+':'+(selectedBlockId||'')+':'+(e.getAttribute('aria-label')||e.placeholder||e.type);
 return '';
}
function rememberUndoChange(){
 const current=undoSnapshot();
 if(undoAnchor===null){undoAnchor=current;return}
 if(current===undoAnchor)return;
 if(privateEdit&&!historyReplaying)privateRedo=[];
 const result=editorUndoPolicy.record(undoStack,undoAnchor,current,
  typingField(),Date.now(),lastTyping,lastTypedAt);
 undoAnchor=result.anchor;lastTyping=result.lastTyping;lastTypedAt=result.lastTypedAt;
 updateUndoButton();
}
function undoLastEditorAction(){
 if(preview||!undoStack.length)return false;
 if(editorDragState)editorDragFinish(editorDragState,false);
 if(privateEdit)privateRedo.push(undoSnapshot());
 const prior=JSON.parse(undoStack.pop());
 // Remote publication is NEVER undone; preserve current visibility.
 db.pages=editorUndoPolicy.restorePages(prior.pages,db.pages);
 db.siteHomeId=prior.siteHomeId;
 if(prior.celebrationDates===null)delete db.celebrationDates;
 else db.celebrationDates=prior.celebrationDates;
 if(prior.celebrationTimes===null)delete db.celebrationTimes;
 else db.celebrationTimes=prior.celebrationTimes;
 if(!db.pages.some(p=>p.id===id))
  id=db.pages.find(p=>p.group==='celebration')?.id||db.pages[0]?.id||'home';
 selectedBlockId=null;blockEditSession=null;undoAnchor=undoSnapshot();lastTyping='';lastTypedAt=0;
 historyReplaying=true;mark();historyReplaying=false;render();updateUndoButton();
 status.textContent='↶ Action annulée — cliquez sur Enregistrer pour la conserver.';
 return true;
}
function redoPrivateEditorAction(){
 if(!privateEdit||preview||!privateRedo.length)return false;
 const next=JSON.parse(privateRedo.pop());undoStack.push(undoSnapshot());
 db.pages=editorUndoPolicy.restorePages(next.pages,db.pages);
 db.siteHomeId=next.siteHomeId;
 if(next.celebrationDates===null)delete db.celebrationDates;
 else db.celebrationDates=next.celebrationDates;
 if(next.celebrationTimes===null)delete db.celebrationTimes;
 else db.celebrationTimes=next.celebrationTimes;
 selectedBlockId=null;blockEditSession=null;undoAnchor=undoSnapshot();
 historyReplaying=true;mark();historyReplaying=false;render();
 return true;
}
function ensureUndoButton(){
 const actions=document.querySelector('.stage-editor .topbar .actions');
 if(!actions)return;
 let bt=document.getElementById('undo-btn');
 if(!bt){
  bt=n('button','btn editor-undo-button','↶');
  bt.id='undo-btn';bt.type='button';bt.title='Annuler (Ctrl+Z)';
  bt.onclick=()=>undoLastEditorAction();actions.prepend(bt);
 }
 updateUndoButton();
 if(privateEdit){
  let redo=document.getElementById('redo-btn');
  if(!redo){redo=n('button','btn editor-redo-button','↷');redo.id='redo-btn';redo.type='button';redo.title='Rétablir (Ctrl+Y)';redo.onclick=redoPrivateEditorAction;actions.prepend(redo);}
  redo.disabled=preview||!privateRedo.length;
 }else document.getElementById('redo-btn')?.remove();
}
document.addEventListener('keydown',event=>{
 if(tab==='members-spaces'||preview||!(event.ctrlKey||event.metaKey)||event.altKey)return;
 const key=String(event.key||'').toLowerCase();
 if(privateEdit&&(key==='y'||key==='z'&&event.shiftKey)){
  event.preventDefault();redoPrivateEditorAction();return;
 }
 if(event.shiftKey||key!=='z')return;
 const focus=document.activeElement;
 // Text fields keep their familiar native Ctrl+Z. Outside them, page
 // operations (move, add, delete, format) use our own history.
 if(focus&&(focus.isContentEditable||focus.closest?.('[contenteditable="true"]')||
  focus.matches?.('input,textarea')))return;
 if(undoStack.length){event.preventDefault();undoLastEditorAction()}
});
function syncSecondarySave(){
 const secondary=document.querySelector('.stage-editor .m022-save'),primary=el('save-btn');
 if(secondary&&primary){secondary.disabled=primary.disabled;secondary.textContent=primary.textContent;}
}
function saveCurrentContent(){if(IS_STAGE){save();void serverSave()}else save(true)}
function mark(){
 commitLocalizedView();
 if(IS_STAGE&&!privateEdit){serverLocalEditCounter++;db._serverPending=true;}
 dirty=true;rememberUndoChange();el('save-btn').textContent='Enregistrer •';
 syncSecondarySave();status.textContent='Modifications non enregistrées';
}
let saveFeedbackTimer=null;
function save(explicit=false){
 // Private M005 pages must NEVER enter localStorage or legacy editor R2.
 if(privateEdit){if(explicit)void savePrivatePage();return;}
 try{
  localStorage.setItem(KEY,JSON.stringify(db));saveShared();saveLocalizationLocal();dirty=false;
  const button=el('save-btn');
  button.textContent='Enregistrer';button.classList.remove('save-failed');
  status.textContent='✓ Enregistré dans ce navigateur.';
  syncSecondarySave();refreshBlockEditBaseline();
  if(explicit===true){
   button.textContent='✓ Enregistré';button.classList.add('save-confirmed');
   const toast=el('editor-save-toast');if(toast){toast.textContent='✓ Enregistré';toast.hidden=false}
   clearTimeout(saveFeedbackTimer);
   saveFeedbackTimer=setTimeout(()=>{
    button.classList.remove('save-confirmed');
    if(!dirty)button.textContent='Enregistrer';
    if(toast)toast.hidden=true;
   },2800);
  }
 }catch{
  const button=el('save-btn');button.textContent='Échec';button.classList.add('save-failed');
  status.textContent='Enregistrement impossible : vérifiez l’espace disponible.';
 }
}
function enter(t,p){if(!adminMembersEnabled&&['members-spaces','participants'].includes(t))return;if(privateEdit){if(t==='members-spaces')closePrivatePage();return;}if(['members-spaces','participants','languages-categories'].includes(t))preview=false;if(dirty){save();if(dirty)return}if(p)id=p;clearLocaleView();selectedBlockId=null;blockEditSession=null;tab=t;render();}
let blockEditSession=null;
function refreshBlockEditBaseline(){
 if(!blockEditSession)return;
 const p=db.pages.find(p=>String(p.id)===blockEditSession.pageId);
 const location=p&&editorElementLocation(p,blockEditSession.blockId);
 if(!location){blockEditSession=null;return}
 blockEditSession.before=clone(location.block);
 blockEditSession.snapshot=undoSnapshot();
 blockEditSession.dirty=dirty;
 blockEditSession.pending=!!db._serverPending;
 blockEditSession.undoLength=undoStack.length;
}
function selectBlock(box){
 if(preview)return;
 const blockId=String(box.dataset.id),p=page();
 if(!blockEditSession||blockEditSession.blockId!==blockId||
    blockEditSession.pageId!==String(p.id)){
  const location=editorElementLocation(p,blockId);
  blockEditSession=location?{
   blockId,pageId:String(p.id),before:clone(location.block),
   snapshot:undoSnapshot(),dirty,pending:!!db._serverPending,
   undoLength:undoStack.length
  }:null;
 }
 selectedBlockId=blockId;
 const canvas=box.closest('.canvas');
 if(canvas)canvas.querySelectorAll('.block').forEach(el=>el.classList.toggle('is-selected',el===box));
}
function cancelBlockEdit(box){
 if(serverSaving){status.textContent='Enregistrement en cours : réessayez ensuite.';return}
 const session=blockEditSession,p=page();
 const location=editorElementLocation(p,box.dataset.id);
 if(session&&session.pageId===String(p.id)&&session.blockId===String(box.dataset.id)&&location){
  if(JSON.stringify(location.block)!==JSON.stringify(session.before)){
   location.array[location.index]=clone(session.before);
   if(undoSnapshot()===session.snapshot){
    // Reverting just this block must not create a phantom unsaved edit.
    dirty=session.dirty;
    db._serverPending=!!db._serverPending&&session.pending;
    if(undoStack.length>=session.undoLength)undoStack.length=session.undoLength;
    undoAnchor=undoSnapshot();lastTyping='';lastTypedAt=0;
    updateUndoButton();
    el('save-btn').textContent=dirty||db._serverPending?'Enregistrer •':'Enregistrer';
   }else{
    // Other edits remain untouched and are still saved through the normal path.
    mark();
   }
  }
 }
 selectedBlockId=null;blockEditSession=null;
 render();
 status.textContent='Modification de ce bloc annulée — vous restez dans l’administration.';
}
// New labels are visual hints, not text the visitor would see or save.
const STARTER_TEXT={heading:'Nouveau titre',text:'Votre paragraphe',button:'Mon bouton',event:'Titre de l’événement'};
async function validateBlock(box,button){
 if(button.disabled)return;
 // Important for the precise-time input: blur commits a freshly typed HH:MM.
 const focused=document.activeElement;
 if(focused&&box.contains(focused)&&focused!==button&&typeof focused.blur==='function')focused.blur();
 const needsSave=dirty||!!db._serverPending;
 button.disabled=true;button.textContent='Validation…';
 try{
  if(IS_STAGE&&typeof serverSave==='function'){
   if(dirty)save();
   if(dirty)return; // local persistence failed
   if(needsSave){
    await serverSave();
    // The server may refuse a conflict or be unreachable. Keep the editor open.
    if(db._serverPending)return;
   }
  }else{
   save(true);
   if(dirty)return;
  }
  // Do not hide an element the user has switched away from during the request.
  if(!box.isConnected||selectedBlockId!==String(box.dataset.id))return;
  selectedBlockId=null;blockEditSession=null;
  button.blur();
  // A full rerender removes the previously focused editor and its toolbar.
  // It can be re-opened with a new tap on the heading or paragraph.
  if(typeof render==='function')render();
  else box.classList.remove('is-selected');
 }finally{
  button.disabled=false;button.textContent='✓ Valider';
 }
}
// Pointer drag-and-drop moves the *original* block object between existing
// containers. No text/photo/video is copied, serialized or rewritten in transit.
const editorDragModel=createEditorDragModel({createSection:editorBlockModel.createSection});
function editorElementLocation(p,blockId){return editorDragModel.locate(p,blockId)}
function moveEditorElement(p,blockId,sectionId='',columnIndex=0,anchorId=null,after=false){
 return editorDragModel.move(p,blockId,sectionId,columnIndex,anchorId,after);
}
function moveEditorIntoBlock(p,sourceId,targetId,after=true){
 return editorDragModel.intoBlock(p,sourceId,targetId,after,()=>uniqueBlockId());
}
let editorDragState=null;
function editorDropTarget(p,x,y){
 const hit=document.elementFromPoint(x,y);
 const canvas=hit?.closest('.canvas');
 if(!canvas)return null;
 const block=hit.closest('.block[data-id]');
 if(block){
  const loc=editorElementLocation(p,block.dataset.id);
  if(!loc)return null;
  const rect=block.getBoundingClientRect(),after=y>=rect.top+rect.height/2;
  // Before this change, a drop over a historical standalone title or image
  // only moved ABOVE or BELOW it. The user expects it to go INSIDE the block.
  // Hover its central region to group both items into one editable zone.
  const edge=Math.min(16,rect.height*.18);
  if(!loc.sectionId&&y>rect.top+edge&&y<rect.bottom-edge){
   return {mode:'into-block',anchorId:block.dataset.id,after,
    indicator:block,indicatorClass:'editor-drop-into'};
  }
  return {sectionId:loc.sectionId,columnIndex:loc.columnIndex,
   anchorId:block.dataset.id,after,indicator:block,
   indicatorClass:after?'editor-drop-after':'editor-drop-before'};
 }
 const column=hit.closest('.section-column[data-column-index]');
 if(column){
  const section=column.closest('.content-section[data-section-id]');
  if(!section)return null;
  const col=Number(column.dataset.columnIndex);
  if(!Number.isInteger(col)||col<0||col>1)return null;
  const children=[...column.children].filter(el=>el.matches('.block[data-id]'));
  const next=children.find(el=>y<el.getBoundingClientRect().top+el.getBoundingClientRect().height/2);
  return {sectionId:section.dataset.sectionId,columnIndex:col,
   anchorId:next?.dataset.id||null,after:false,
   indicator:next||column,indicatorClass:next?'editor-drop-before':'editor-drop-column'};
 }
 const insert=hit.closest('.section-insert[data-insert-index]');
 if(insert){
  const index=Number(insert.dataset.insertIndex);
  if(Number.isInteger(index)&&index>=0&&index<=p.blocks.length){
   const anchor=p.blocks[index];
   return {sectionId:'',columnIndex:0,anchorId:anchor?.id??null,
    after:false,indicator:insert,indicatorClass:'editor-drop-insert'};
  }
 }
 const section=hit.closest('.content-section[data-section-id]');
 if(section){
  // Dropping over a zone header, the empty center or its layout tools should
  // target that zone rather than merely placing the element beside the zone.
  const rect=section.getBoundingClientRect(),isTwo=section.dataset.layout==='columns';
  const col=isTwo&&x>=rect.left+rect.width/2?1:0;
  const cell=section.querySelector('.section-column[data-column-index="'+col+'"]')||section;
  return {sectionId:section.dataset.sectionId,columnIndex:col,anchorId:null,
   after:false,indicator:cell,indicatorClass:'editor-drop-column'};
 }
 // Blank space in the page canvas is also a valid destination.
 const next=[...canvas.children].filter(el=>el.matches('.block[data-id],.content-section[data-section-id]'))
  .find(el=>y<el.getBoundingClientRect().top+el.getBoundingClientRect().height/2);
 return {sectionId:'',columnIndex:0,
  anchorId:next?.dataset.id||next?.dataset.sectionId||null,after:false,
  indicator:next||canvas,indicatorClass:next?'editor-drop-before':'editor-drop-column'};
}
function editorDragClearTarget(state){
 if(state?.target?.indicator)state.target.indicator.classList.remove(state.target.indicatorClass);
 state.target=null;
}
function editorDragShowTarget(state,target){
 if(state.target?.indicator===target?.indicator&&state.target?.indicatorClass===target?.indicatorClass)return;
 editorDragClearTarget(state);
 if(target?.indicator){
  state.target=target;
  target.indicator.classList.add(target.indicatorClass);
 }
}
function editorDragActivate(state){
 if(editorDragState!==state||state.active)return;
 state.active=true;
 if(state.timer)clearTimeout(state.timer);
const original=state.box;
 if(state.isTouch){
  // Mobile: a tap edits, but a long press turns into a drag, never both.
  // Suppress the synthetic click after a long press.
  original._suppressClickUntil=Date.now()+850;
  const active=document.activeElement;
  if(active&&original.contains(active)&&active.isContentEditable)active.blur();
  if(selectedBlockId===state.sourceId){
   selectedBlockId=null;blockEditSession=null;
   original.classList.remove('is-selected');
  }
 }
 if(document.getSelection)document.getSelection()?.removeAllRanges();
 original.classList.add('editor-drag-source');
 const label=original.querySelector('.ed,.editor-event-display,.picture img');
 const summary=String(label?.innerText||label?.alt||original.dataset.kind||'Élément')
  .replace(/\s+/g,' ').trim().slice(0,65);
 const ghost=document.createElement('div');ghost.className='editor-drag-ghost';
 ghost.textContent='⠿ '+(summary||'Élément');ghost.setAttribute('aria-hidden','true');
 document.body.append(ghost);state.ghost=ghost;
 document.body.classList.add('editor-reordering');
 editorDragUpdate(state,state.startX,state.startY);
}
function editorDragUpdate(state,x,y){
 if(!state.active)return;
 state.lastX=x;state.lastY=y;
 if(state.ghost)state.ghost.style.transform='translate('+Math.min(x+12,innerWidth-200)+'px,'+
   Math.min(y+15,innerHeight-62)+'px)';
 editorDragShowTarget(state,editorDropTarget(state.page,x,y));
 const margin=65;
 if(y<margin)window.scrollBy(0,-20);
 else if(y>innerHeight-margin)window.scrollBy(0,20);
}
function editorDragFinish(state,shouldMove=false){
 if(!state||editorDragState!==state)return false;
 editorDragState=null;
 if(state.timer)clearTimeout(state.timer);
 const destination=state.target;
 editorDragClearTarget(state);
 state.box?.classList.remove('editor-drag-source');
 state.ghost?.remove();
 document.body.classList.remove('editor-reordering');
 if(state.onMove)document.removeEventListener('pointermove',state.onMove);
 if(state.onUp)document.removeEventListener('pointerup',state.onUp);
 if(state.onCancel)document.removeEventListener('pointercancel',state.onCancel);
 try{
  if(state.handle?.hasPointerCapture?.(state.pointerId))
   state.handle.releasePointerCapture(state.pointerId);
 }catch{}
 if(!shouldMove||!state.active||!destination||preview)return false;
 const changed=destination.mode==='into-block'?
  moveEditorIntoBlock(state.page,state.sourceId,destination.anchorId,destination.after):
  moveEditorElement(state.page,state.sourceId,destination.sectionId,
   destination.columnIndex,destination.anchorId,destination.after);
 if(changed){
  selectedBlockId=null;blockEditSession=null;
  mark();render();
  status.textContent='Élément déplacé dans le brouillon — cliquez sur Enregistrer pour le conserver.';
 }
 return changed;
}
function startEditorPointerDrag(e,box,x,p,handle){
 if(!editorDragModel.pointerAllowed(e,preview))return;
 e.stopPropagation();
 if(editorDragState)editorDragFinish(editorDragState,false);
 const state={page:p,box,handle,sourceId:String(x.id),pointerId:e.pointerId,
  isTouch:e.pointerType==='touch'||e.pointerType==='pen',
  startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,
  active:false,target:null,ghost:null,timer:null};
 editorDragState=state;
 try{handle.setPointerCapture?.(e.pointerId)}catch{}
 state.onMove=ev=>{
  if(editorDragState!==state||ev.pointerId!==state.pointerId)return;
  if(!state.active){
   const intent=editorDragModel.pointerIntent(state,ev);
   if(intent==='cancel'){editorDragFinish(state,false);return}
   if(intent==='wait')return;
   editorDragActivate(state);
  }
  if(ev.cancelable)ev.preventDefault();
  editorDragUpdate(state,ev.clientX,ev.clientY);
 };
 state.onUp=ev=>{
  if(ev.pointerId!==state.pointerId)return;
  if(state.active)editorDragUpdate(state,ev.clientX,ev.clientY);
  editorDragFinish(state,true);
 };
 state.onCancel=ev=>{if(ev.pointerId===state.pointerId)editorDragFinish(state,false)};
 document.addEventListener('pointermove',state.onMove,{passive:false});
 document.addEventListener('pointerup',state.onUp);
 document.addEventListener('pointercancel',state.onCancel);
 if(state.isTouch)state.timer=setTimeout(()=>{
  if(editorDragState===state)editorDragActivate(state);
 },430);
}
function editorMoveHandle(box,x,p){
 const handle=n('button','editor-move-handle','⠿');
 handle.type='button';handle.title='Glisser pour déplacer cet élément';
 handle.setAttribute('aria-label','Déplacer : glisser cet élément vers un autre bloc ou une autre colonne');
 handle.setAttribute('aria-grabbed','false');
 handle.draggable=false;handle.ondragstart=e=>e.preventDefault();
 handle.oncontextmenu=e=>e.preventDefault();
 handle.onpointerdown=e=>startEditorPointerDrag(e,box,x,p,handle);
 handle.onkeydown=e=>{if(e.key==='Escape'&&editorDragState){
  editorDragFinish(editorDragState,false);e.preventDefault()
 }};
 return handle;
}
function enableTouchLongPressDragging(box,x,p){
 // On devices without hover the whole unselected element is the drag target.
 // Keep ordinary taps and editing controls intact.
 box.addEventListener('pointerdown',e=>{
  if(preview||!['touch','pen'].includes(e.pointerType)||
     box.classList.contains('is-selected'))return;
  if(e.target.closest('.editor-move-handle,.tools,button,input,select,textarea,a,.existing-block-add,.formatbar,.custom-divider-settings,.block-validate-actions,.link-line,.block-edit-actions'))return;
  startEditorPointerDrag(e,box,x,p,box);
 });
 box.addEventListener('touchmove',e=>{
  // A held element can move without triggering page scrolling; ordinary scroll stays native.
  if(editorDragState?.box===box&&editorDragState.active&&e.cancelable)e.preventDefault();
 },{passive:false});
 box.addEventListener('contextmenu',e=>{
  if(editorDragState?.box===box&&editorDragState.isTouch)e.preventDefault();
 });
}
function visibilityEyeIcon(willHide){
 // Actual SVG eye (with an optional slash), never a device-dependent glyph.
 const ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg');
 svg.setAttribute('class','visibility-eye-icon');
 svg.setAttribute('viewBox','0 0 24 24');
 svg.setAttribute('fill','none');
 svg.setAttribute('stroke','currentColor');
 svg.setAttribute('stroke-width','1.8');
 svg.setAttribute('stroke-linecap','round');
 svg.setAttribute('stroke-linejoin','round');
 svg.setAttribute('aria-hidden','true');
 const eye=document.createElementNS(ns,'path');
 eye.setAttribute('d','M2 12c2.4-4 5.8-6 10-6s7.6 2 10 6c-2.4 4-5.8 6-10 6S4.4 16 2 12Z');
 const iris=document.createElementNS(ns,'circle');
 iris.setAttribute('cx','12');iris.setAttribute('cy','12');iris.setAttribute('r','3');
 svg.append(eye,iris);
 if(willHide){
  const slash=document.createElementNS(ns,'path');
  slash.setAttribute('d','M3 21 21 3');
  slash.setAttribute('stroke-width','2.5');
  svg.append(slash);
 }
 return svg;
}
function block(x,p,items=p.blocks,section=null){
 const box=n('div','block');box.style.textAlign=ALIGNMENTS.includes(x.align)?x.align:'left';box.dataset.id=x.id;box.dataset.kind=x.kind;
 if(x.hideOnSite){
  box.classList.add('hidden-on-public');
  if(!preview)box.append(n('small','hidden-public-note','Invisible aux visiteurs'));
 }
 if(x.kind!=='event'&&x.atTime&&validTime(x.atTime))box.append(n('time','block-insert-time',x.atTime));
 if(!preview){
  // Desktop mouse hover shows the grip; mobile long press starts the same drag.
  // Editing controls and media are unchanged until an actual drop.
  box.append(editorMoveHandle(box,x,p));
  enableTouchLongPressDragging(box,x,p);
  const tools=n('div','tools'),i=items.indexOf(x);
  const buttons=[
   ['↑','Monter',()=>{if(i>0){items.splice(i,1);items.splice(i-1,0,x);mark();render()}}],
   ['↓','Descendre',()=>{if(i<items.length-1){items.splice(i,1);items.splice(i+1,0,x);mark();render()}}],
   ['⧉','Dupliquer',()=>duplicateBlock(x,p,items)],
   ['✕','Supprimer',async ()=>{if((await siteConfirm(x.kind==='image'?'Retirer cette image de la page ? Elle restera dans la bibliothèque de fichiers.':'Supprimer cet élément ?'))){items.splice(items.indexOf(x),1);mark();render()}}]
  ];
  buttons.splice(2,0,[null,
   x.hideOnSite===true?'Afficher cet élément aux visiteurs':'Masquer cet élément aux visiteurs',
   ()=>{
    x.hideOnSite=x.hideOnSite!==true;
    mark();render();
   }]);
  if(section&&section.layout==='columns'){
   const other=section.columns[0]===items?1:0;
   buttons.splice(2,0,[other===0?'←':'→','Déplacer '+(other===0?'à gauche':'à droite'),()=>{
    items.splice(items.indexOf(x),1);section.columns[other].push(x);mark();render();
   }]);
  }
  for(const [txt,title,fn] of buttons){
   const bt=n('button',title==='Supprimer'?'danger':'',txt===null?'':txt);
   if(txt===null)bt.append(visibilityEyeIcon(x.hideOnSite!==true));
   bt.type='button';bt.title=title;bt.setAttribute('aria-label',title);bt.onclick=fn;tools.append(bt);
  }
  box._tools=tools;
 }
 if(['heading','text','button','event'].includes(x.kind)){
  const href=x.kind==='button'?buttonHref(x):'';
  if(x.kind==='button'&&preview&&href){const a=n('a','link-block',x.text);a.href=href;a.target='_blank';a.rel='noopener noreferrer';box.append(a)}
  else{
   const z=n('div','ed '+(x.kind==='heading'||x.kind==='event'?'heading':x.kind==='text'?'text':'link-block'));
   if(x.kind!=='button'&&typeof x.rich==='string'&&x.rich){z.innerHTML=htmlSafe(x.rich);restoreInlineColours(z)}else z.textContent=x.text||'';
   z.contentEditable=String(!preview);z.dataset.placeholder=STARTER_TEXT[x.kind]||'Touchez pour écrire…';z.setAttribute('role','textbox');
   if(x.kind!=='button'){
    // A single main heading per page; later headings are readable subheadings.
    const isPrimary=x.kind==='heading'&&pageMainTitle(p)===x;
    if(x.kind==='heading'||x.kind==='event')z.classList.add(isPrimary?'heading-primary':'heading-secondary');
    z.style.fontSize=displayedHeadingSize(x,p)+'px';
    if(x.bold)z.style.fontWeight='700';
    if(x.italic)z.style.fontStyle='italic';
    if(validColor(x.color))z.style.color=x.color;
   }
   z.onfocus=()=>{
    selectBlock(box);
    // Older drafts contain real starter labels. One tap selects the whole
    // label so the next keystroke replaces it, including on Android.
    if(!preview&&!x.rich&&x.text===STARTER_TEXT[x.kind])
     requestAnimationFrame(()=>{
      if(!z.isConnected||document.activeElement!==z||z.innerText!==STARTER_TEXT[x.kind])return;
      const range=document.createRange(),selection=window.getSelection();
      if(!selection)return;
      range.selectNodeContents(z);selection.removeAllRanges();selection.addRange(range);
     });
   };
   z.addEventListener('pointerdown',()=>{if(rememberedSelection?.host===z)rememberedSelection=null});
   z.addEventListener('keydown',()=>{if(rememberedSelection?.host===z)rememberedSelection=null});
   z.oninput=()=>{rememberedSelection=null;saveRich(x,z)};
   z.onpaste=e=>{e.preventDefault();document.execCommand('insertText',false,e.clipboardData.getData('text/plain'))};
   if(x.kind==='event'){
    const line=n('div','editor-event-display');
    if(validTime(x.atTime))line.append(n('time','editor-event-hour',x.atTime+' — '));
    line.append(z);box.append(line);
   }else box.append(z);
   if(x.kind!=='button'&&!preview)box.append(editorFormatToolbar(x,z,box));
   if(x.kind==='event'&&!preview){
    const timeRow=timeChooser(x.atTime,'Heure de l’événement',hour=>{
     x.atTime=hour;mark();
     // Do not recreate a focused contenteditable while its blur event fires.
     const line=box.querySelector('.editor-event-display');
     let marker=line?.querySelector('time.editor-event-hour');
     if(!hour){if(marker)marker.remove()}
     else if(marker)marker.textContent=hour+' — ';
     else if(line){marker=n('time','editor-event-hour',hour+' — ');line.prepend(marker)}
    });
    timeRow.classList.add('event-time');box.append(timeRow);
   }
  }
  if(x.kind==='button'&&!preview){
   const row=n('div','link-line'),inp=n('input','link-input');inp.type='url';inp.value=x.assetId?'':x.href||'';inp.placeholder='Adresse https:// ou /';inp.setAttribute('aria-label','Adresse du bouton');
   inp.onchange=()=>{const v=inp.value.trim();if(v&&!validHref(v)){siteNotice('Adresse incorrecte : utilisez https:// ou un chemin commençant par /');inp.value=x.href||'';return}x.href=v;delete x.assetId;x.displayAsButton=true;delete x.cover;delete x.coverAssetId;mark();render()};
   row.append(inp);const pick=b('📎 Choisir un fichier',()=>chooseFile(x),'sm');pick.dataset.action='choose-asset';row.append(pick);
   if(x.assetId)row.append(n('small','file-chosen','Fichier : '+(fileRecords.get(x.assetId)?.name||'introuvable')));
   box.append(row);
   const actions=n('div','block-edit-actions');
   if(videoInfo(x.href)||/\.(?:mp4|webm|ogg)(?:[?#]|$)/i.test(String(x.href||''))){
    actions.append(b('Afficher comme vidéo avec titre',()=>{
     x.kind='video';delete x.displayAsButton;delete x.assetId;mark();render();
    },'sm'));
   }
   if(actions.childElementCount)box.append(actions);
   if(x.displayAsButton!==true&&validHref(x.href)&&/^https:\/\//.test(x.href)){
    const previewLink=n('div','editor-link-preview');
    const vi=videoInfo(x.href),cover=(x.coverAssetId?assetUrls.get(x.coverAssetId):x.cover)||vi?.thumbnail;
    if(cover){const img=n('img');img.src=cover;img.alt='Miniature';previewLink.append(img)}
    else previewLink.append(websiteThumb(x.href,x.text));
    box.append(previewLink);
   }
  }
 }
 if(x.kind==='audio'){
  const wrap=n('div','audio-block');
  const key=x.remoteKey;
  const src=key&&/^editor-trials\/audio\/[0-9a-f-]{36}\.mp3$/.test(key)
    ?'/api/editor-trial-audio?action=stream&key='+encodeURIComponent(key)
    :/^\/media\/(?!.*\.\.)[^?#]+\.mp3$/i.test(String(x.src||''))?x.src:'';
  if(src){const audio=n('audio','audio-player');audio.controls=true;audio.preload='none';audio.src=src;wrap.append(audio)}
  box.append(wrap);
  if(!preview){
   const title=n('label','audio-title-field','Titre de l’audio');
   const input=n('input');input.type='text';input.maxLength=180;
   input.value=String(x.text||'').replace(/^MP3 à choisir$/,'');
   input.setAttribute('aria-label','Titre du lecteur audio');
   input.onchange=()=>{x.text=input.value.trim().slice(0,180);mark()};
   title.append(input);box.append(title);
   const actions=n('div','block-edit-actions');
   actions.append(b('Choisir un MP3',e=>{
    e.stopPropagation();mediaReturnTab=tab;mediaCategory='audios';
    chosenBlock=x;tab='media';render();
   },'sm'));
   box.append(actions);
  }
 }
 if(x.kind==='video'){
  const href=validHref(x.href)?x.href:'',v=videoInfo(href),cover=(x.coverAssetId?(assetUrls.get(x.coverAssetId)||''):x.cover)||v?.thumbnail||'';
  const visual=n('div','editor-video-preview');
  if(cover){const img=n('img');img.src=cover;img.alt=x.text||'Vidéo';img.loading='lazy';visual.append(img)}
  else if(href)visual.append(websiteThumb(href,x.text||'Lien vidéo'));
  else visual.append(n('span','','▶ Vidéo'));
  box.append(visual);
  // A video title is a plain caption below the thumbnail, never a link button.
  const videoCaption=n('div','editor-video-title',x.text||'');
  videoCaption.hidden=!String(x.text||'').trim();box.append(videoCaption);
  if(!preview){
   const row=n('div','link-line'),inp=n('input','link-input');inp.type='url';
   inp.value=x.href||'';inp.placeholder='Lien YouTube, Vimeo, site ou vidéo';
   inp.setAttribute('aria-label','Lien de la vidéo');
   inp.oninput=()=>{
    const entered=inp.value.trim();
    if(entered&&!validHref(entered))return;
    x.href=entered;mark();
    const v=videoInfo(entered),source=(x.coverAssetId?assetUrls.get(x.coverAssetId):x.cover)||v?.thumbnail;
    visual.replaceChildren();
    if(source){const img=n('img');img.src=source;img.alt=x.text||'Vidéo';img.loading='lazy';visual.append(img)}
    else if(entered)visual.append(websiteThumb(entered,x.text||'Lien vidéo'));
    else visual.append(n('span','','▶ Vidéo'));
   };
   inp.onchange=()=>{if(inp.value&&!validHref(inp.value)){siteNotice('Lien invalide');inp.value=x.href||''}};
   row.append(inp,b('📎 Choisir une vidéo du site',()=>chooseFile(x),'sm'));
   box.append(row);
   const title=n('input','link-input');title.value=x.text||'';title.placeholder='Titre de la vidéo';
   title.setAttribute('aria-label','Titre de la vidéo');
   title.oninput=()=>{x.text=title.value;videoCaption.textContent=x.text;
    videoCaption.hidden=!String(x.text||'').trim();mark()};
   box.append(title);
   const actions=n('div','block-edit-actions');
   actions.append(b('Miniature',()=>showImagePicker(x,true),'sm'));box.append(actions);
  }
 }
if(x.kind==='divider'){
  const color=validColor(x.color)?x.color:'#858c94';
  const thickness=Number.isInteger(x.thickness)&&x.thickness>=1&&x.thickness<=8?x.thickness:1;
  const lineWidth=Number.isInteger(x.widthPct)&&x.widthPct>=20&&x.widthPct<=100?x.widthPct:60;
  const previewLine=n('div','custom-divider-line');
  previewLine.style.backgroundColor=color;
  previewLine.style.height=thickness+'px';previewLine.style.width=lineWidth+'%';
  previewLine.setAttribute('role','separator');previewLine.setAttribute('aria-label','Trait de séparation');
  const holder=n('div','custom-divider-preview');holder.append(previewLine);box.append(holder);
  if(!preview){
   const settings=n('div','custom-divider-settings');
   const colorInput=n('input');colorInput.type='color';colorInput.value=color;
   colorInput.setAttribute('aria-label','Couleur du trait de séparation');
   colorInput.oninput=()=>{
    x.color=colorInput.value;previewLine.style.backgroundColor=x.color;mark();
   };
   const thicknessInput=n('select');thicknessInput.setAttribute('aria-label','Épaisseur du trait de séparation');
   for(let i=1;i<=8;i++){
    const option=n('option','',i+' px');option.value=String(i);option.selected=i===thickness;
    thicknessInput.append(option);
   }
   thicknessInput.onchange=()=>{
    x.thickness=Number(thicknessInput.value);previewLine.style.height=x.thickness+'px';mark();
   };
   const lengthInput=n('input');lengthInput.type='range';lengthInput.min='20';lengthInput.max='100';
   lengthInput.step='5';lengthInput.value=String(lineWidth);
   lengthInput.setAttribute('aria-label','Longueur du trait de séparation en pourcentage');
   const lengthText=n('span','divider-length-label',lineWidth+' %');
   lengthInput.oninput=()=>{
    x.widthPct=Number(lengthInput.value);
    previewLine.style.width=x.widthPct+'%';lengthText.textContent=x.widthPct+' %';mark();
   };
   const label=(caption,input)=>{
    const field=n('label','custom-divider-field',caption);field.append(input);return field;
   };
   settings.append(label('Couleur',colorInput),label('Épaisseur',thicknessInput),
    label('Longueur',lengthInput),lengthText);
   box.append(settings);
  }
}
if(x.kind==='image'){
  const pic=n('div','picture');
  // A stale browser-local ID MUST NOT shadow an existing hosted photo URL.
  // This was one reason a photo could appear live but look blank in the editor.
  const localUrl=x.assetId?(assetUrls.get(x.assetId)||''):'';
  const hostedUrl=typeof x.src==='string'&&validHref(x.src)?x.src:'';
  const src=localUrl||hostedUrl;
  const imageSize=Number.isInteger(x.widthPct)&&x.widthPct>=20&&x.widthPct<=100?x.widthPct:100;
  pic.style.width=imageSize+'%';pic.style.maxWidth='100%';
  pic.style.minHeight='0';pic.style.background='none';pic.style.marginInline='auto';
  if(src){
   const img=n('img');img.src=src;img.alt=x.text||'Image';img.loading='eager';
   img.style.width='100%';img.style.height='auto';img.style.objectFit='contain';
   img.onerror=()=>{
    // Retry the durable server image when a device-only blob is stale.
    if(localUrl&&hostedUrl&&img.src!==new URL(hostedUrl,location.href).href){
     img.src=hostedUrl;return;
    }
    pic.classList.add('image-load-error');
    img.hidden=true;
    if(pic.querySelector('.image-load-note'))return;
    const info=n('div','image-load-note');
    info.append(n('strong','','L’image n’a pas pu se charger dans l’administration.'));
    info.append(n('p','','Vous pouvez la réutiliser depuis la version du site ou choisir une autre image.'));
    info.append(b('Reprendre l’image du site',e=>{
     e.stopPropagation();void restorePageImageFromPublished(p,x);
    },'sm'));
    pic.append(info);
   };
   pic.append(img);
  }else{
   pic.append(n('span','','＋ Image'));
   if(!preview&&x.assetId){
    const restore=b('Reprendre l’image du site',e=>{
     e.stopPropagation();void restorePageImageFromPublished(p,x);
    },'sm');restore.className+=' image-restore';pic.append(restore);
   }
  }
  box.append(pic);
  if(!preview){
   pic.classList.add('image-choose');
   pic.title=src?'Ajuster la taille de l’image':'Choisir une image';
   pic.setAttribute('role','button');pic.tabIndex=0;
   pic.setAttribute('aria-label',src?'Sélectionner l’image pour régler sa taille':'Choisir une image');
   const activate=e=>{e.stopPropagation();if(src)selectBlock(box);else showImagePicker(x)};
   pic.onclick=activate;
   pic.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(e)}};
   if(src){
    const sizing=n('div','image-size-control'),label=n('label','image-size-label','Taille de l’image');
    const input=n('input','image-size-slider'),value=n('output','image-size-value',imageSize+' %');
    input.type='range';input.min='20';input.max='100';input.step='5';input.value=String(imageSize);
    input.id='image-size-'+String(x.id).replace(/[^a-z0-9-]/gi,'-');
    input.setAttribute('aria-label','Taille de l’image en pourcentage');
    label.htmlFor=input.id;value.htmlFor=input.id;
    const resize=()=>{
     const size=Number(input.value);
     if(!Number.isFinite(size)||size<20||size>100)return;
     x.widthPct=Math.round(size);pic.style.width=size+'%';value.textContent=size+' %';
     mark();
     status.textContent='Taille réglée à '+size+' % dans le brouillon. Pour voir le changement sur le site public, utilisez « Publier cette taille ».';
    };
    input.oninput=resize;input.onchange=resize;
    sizing.append(label,input,value);
    // Publishing remains a separate explicit action; the Validate button
    // continues to save privately without altering the visitor site.
    if(IS_STAGE){
     const publish=b('Publier cette taille',async e=>{
      e.stopPropagation();publish.disabled=true;
      const success=await serverPublish({kind:'page',pageId:p.id,visibility:'published'});
      publish.disabled=false;
      if(success){
       selectedBlockId=null;render();
       status.textContent='✓ Taille publiée : la page visible par les visiteurs est mise à jour.';
      }
     },'sm image-publish-size');
     publish.setAttribute('aria-label','Publier cette nouvelle taille sur le site des visiteurs');
     publish.title='Enregistrer la taille et mettre à jour la page publique';
     sizing.append(publish);
    }
    box.append(sizing);
   }
   const actions=n('div','block-edit-actions image-direct-actions');
   const upload=b('Télécharger une image',e=>{e.stopPropagation();startImageUpload(x)},'sm');
   upload.dataset.action='upload-image';actions.append(upload);
   const pick=b('Images du site',e=>{e.stopPropagation();showImagePicker(x)},'sm');
   pick.dataset.action='choose-asset';actions.append(pick);
   if(src){
    const remove=b('Supprimer l’image',e=>{e.stopPropagation();removeImageFromBlock(x)},'block-remove-image');
    remove.dataset.action='remove-image';actions.append(remove);
   }
   box.append(actions);
  }
 }
 if(box._tools)box.append(box._tools);
 if(!preview){
  const row=n('div','block-validate-actions');
  row.setAttribute('role','group');row.setAttribute('aria-label','Terminer la modification');
  // Image removal is shown directly under the picture, not in the Validate dock.
  const validate=b('✓ Valider',e=>{e.stopPropagation();void validateBlock(box,validate)},'block-validate-button');
  validate.setAttribute('aria-label','Valider cet élément et enregistrer le brouillon');
  const cancel=b('Annuler',e=>{e.stopPropagation();cancelBlockEdit(box)},'block-cancel-button');
  cancel.setAttribute('aria-label','Annuler les modifications de cet élément sans quitter l’administration');
  row.append(cancel,validate);box.append(row);
 }
 // Older single-element blocks get the green plus without losing any data.
 // The actual section conversion only occurs after choosing a new item.
 if(!preview&&!section&&items===p.blocks&&p.blocks.includes(x))
   box.append(existingBlockAddControls(x,p,box));
 if(!preview){
   box.onclick=e=>{
    if(Date.now()<(box._suppressClickUntil||0)){e.preventDefault();e.stopPropagation();return}
    selectBlock(box);
   };
   if(selectedBlockId===String(x.id))box.classList.add('is-selected');
 }
 return box;
}
function videoInfo(href){
 try{
  const u=new URL(String(href||'')),host=u.hostname.toLowerCase();
  let id='';
  if(['youtu.be','www.youtu.be'].includes(host))id=u.pathname.split('/')[1];
  else if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host))
   id=u.searchParams.get('v')||(u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/)||[])[1];
  if(/^[\w-]{11}$/.test(id||''))return {provider:'youtube',id,thumbnail:'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg',embed:'https://www.youtube-nocookie.com/embed/'+id};
  if(['vimeo.com','www.vimeo.com','player.vimeo.com'].includes(host)){
   const m=u.pathname.match(/(?:\/video)?\/(\d{6,12})(?:\/|$)/);
   if(m)return {provider:'vimeo',id:m[1],thumbnail:'https://vumbnail.com/'+m[1]+'.jpg',embed:'https://player.vimeo.com/video/'+m[1]};
  }
 }catch{}
 return null;
}
function websiteThumb(href,title){
 const card=n('div','site-thumbnail');
 try{
  const url=new URL(href);
  const favicon=n('img','site-preview-icon');favicon.src=url.origin+'/favicon.ico';favicon.alt='';
  favicon.onerror=()=>favicon.remove();card.append(favicon);
  card.append(n('span','site-preview-domain',url.hostname));
 }catch{}
 card.append(n('strong','site-preview-title',title||'Site'));return card;
}
function startImageUpload(x,cover=false){
 target=x;imageCoverTarget=cover;
 const picker=el('image-input');
 if(picker)picker.click();
}
// A draft may still hold a local device-only assetId while the original
// public photo already has a stable /media/ URL. Do not silently overwrite the
// draft: offer an explicit restoration button using the published/archived page.
const mediaBlocks=blocks=>{
 const output=[];
 for(const item of blocks||[]){
  if(item?.kind==='section'){for(const column of item.columns||[])output.push(...mediaBlocks(column))}
  else if(item)output.push(item);
 }
 return output;
};
function findImageByHeading(page,image,source){
 if(!page||!source)return '';
 const current=mediaBlocks(page.blocks),target=mediaBlocks(source.blocks);
 const pos=current.indexOf(image);
 const before=pos<0?current:current.slice(0,pos);
 const heading=before.slice().reverse().find(b=>b.kind==='heading')?.text;
 if(heading){
  const at=target.findIndex(b=>b.kind==='heading'&&String(b.text||'').trim()===String(heading).trim());
  if(at>=0){
   const next=target.slice(at+1).findIndex(b=>b.kind==='heading');
   const group=target.slice(at+1,next>=0?at+1+next:undefined);
   const found=group.find(b=>b.kind==='image'&&validHref(b.src));
   if(found)return found.src;
  }
 }
 const same=target.find(b=>String(b.id)===String(image.id)&&b.kind==='image'&&validHref(b.src));
 return same?.src||'';
}
async function restorePageImageFromPublished(page,image){
 let url='';
 for(const candidate of window.__PREPARATION_SEED__?.pages||[]){
  if(candidate.id===page.id){url=findImageByHeading(page,image,candidate);if(url)break}
 }
 if(!url){
  try{
   const cid=String(window.__PREPARATION_SEED__?.celebrationId||'101');
   const res=await fetch('/api/editor-publication?celebration='+encodeURIComponent(cid),{cache:'no-store'});
   if(res.ok){
    const result=await res.json();
    const published=[...(result.record?.pages||[]),...(result.shared?.pages||[])];
    const same=published.find(p=>p.id===page.id);
    if(same)url=findImageByHeading(page,image,same);
   }
  }catch{}
 }
 if(!url){siteNotice('Impossible de retrouver automatiquement cette image. Choisissez-la dans « Images du site ».');return}
 image.src=url;delete image.assetId;
 mark();render();
}
async function removeImageFromBlock(x){
 if(!(await siteConfirm('Retirer cette image de la page ? Elle restera dans la médiathèque.')))return;
 x.src='';delete x.assetId;x.text='';delete x.widthPct;
 mark();render();
}
function showImagePicker(x,cover=false){
 const dialog=n('dialog','image-picker-dialog');
 const header=n('div','image-picker-header');
 const title=n('h3','image-picker-title',cover?'Choisir une miniature':'Images du site');
 title.id='image-picker-heading';
 dialog.setAttribute('aria-labelledby',title.id);
 const close=b('×',()=>dialog.close(),'image-picker-close');
 close.setAttribute('aria-label','Fermer la fenêtre');
 close.title='Fermer';header.append(title,close);dialog.append(header);
 const grid=n('div','image-picker-grid');
 grid.setAttribute('role','group');grid.setAttribute('aria-label','Images disponibles');
 dialog.append(grid);
 const actions=n('div','file-actions image-picker-footer');
 actions.append(b('Télécharger une image',()=>{
  dialog.close();startImageUpload(x,cover);
 },'primary sm'));
 // A web image keeps its external URL. Nothing is copied or removed remotely.
 actions.append(b('Lien d’une image web',async ()=>{
  const entered=String((await sitePrompt('Adresse HTTPS de l’image :'))||'').trim();
  if(!entered)return;
  let url;try{url=new URL(entered)}catch{siteNotice('Adresse invalide');return}
  if(url.protocol!=='https:'||url.username||url.password){siteNotice('Lien HTTPS requis');return}
  if(cover){x.cover=url.href;delete x.coverAssetId}
  else{x.src=url.href;delete x.assetId}
  mark();dialog.close();render();
 },'sm'));
 actions.append(b('Annuler',()=>dialog.close(),'sm'));
 dialog.append(actions);
 const choose=(source)=>{
  editorMediaCommands.chooseImage(x,source,cover);
  mark();dialog.close();render();
 };
 const populate=()=>{
  grid.replaceChildren();
  const {entries,local}=mediaCatalogue.imageItems({
   historical:[...(globalFiles||[]),...publicFiles()],
   pages:[...(db.pages||[]),...(window.__PREPARATION_SEED__?.pages||[])],
   globalMedia,fileRecords:[...fileRecords.values()],assetUrls
  });
  function imageCard(name,url,onChoose){
   const item=b('',onChoose,'sm image-picker-card');
   item.title=name;item.setAttribute('aria-label','Choisir '+name);
   const preview=n('span','image-picker-thumbnail');
   const thumb=n('img');thumb.src=url;thumb.alt=name;thumb.loading='eager';
   // A card has one bounded thumbnail and one separately readable filename.
   // Raw image + text children in an implicit grid produced stacked fragments.
   thumb.onerror=()=>{preview.classList.add('image-picker-unavailable')};
   preview.append(thumb);
   const label=n('span','image-picker-filename',name);
   item.append(preview,label);
   return item;
  }
  for(const image of entries){
   grid.append(imageCard(image.name,image.src,()=>choose({src:image.src})));
  }
  for(const record of local){
   grid.append(imageCard(record.name,record.src,()=>choose({assetId:record.assetId})));
  }
  if(!grid.childElementCount)grid.append(n('p','image-picker-empty','Aucune image disponible'));
 };
 document.body.append(dialog);dialog.onclose=()=>dialog.remove();dialog.showModal();
 populate();if(!globalFiles)loadGlobalFiles().then(()=>{if(dialog.open)populate()});
 if(IS_STAGE&&!globalMediaLoaded)void refreshGlobalMedia().then(()=>{
  if(dialog.open)populate();
 });
}
function createContent(kind){return editorBlockModel.createContent(kind,uniqueBlockId(),STARTER_TEXT)}
function add(kind){const p=page(),x=createContent(kind);selectedBlockId=String(x.id);p.blocks.push(x);mark();render()}
function toggleInsertionMenu(menu,trigger,title){
 const mobile=window.matchMedia('(max-width:650px), (hover:none), (pointer:coarse)').matches;
 if(!mobile){
  menu.hidden=!menu.hidden;
  trigger.setAttribute('aria-expanded',String(!menu.hidden));
  return;
 }
 const open=document.querySelector('dialog.editor-insert-dialog[open]');
 if(open)open.close();
 const modal=n('dialog','editor-insert-dialog');
 modal.setAttribute('aria-label',title);
 const header=n('div','editor-insert-dialog-header');
 header.append(n('h3','',title),
  b('Fermer',()=>modal.close(),'editor-insert-dialog-close'));
 const options=n('div','editor-insert-dialog-options');
 const parent=menu.parentNode,next=menu.nextSibling;
 menu.hidden=false;
 options.append(menu);modal.append(header,options);
 document.body.append(modal);
 trigger.setAttribute('aria-expanded','true');
 const onChoice=event=>{
  if(event.target.closest('button'))
   queueMicrotask(()=>{if(modal.open)modal.close()});
 };
 menu.addEventListener('click',onChoice,true);
 modal.addEventListener('click',event=>{
  if(event.target===modal)modal.close();
 });
 modal.addEventListener('close',()=>{
  menu.removeEventListener('click',onChoice,true);
  menu.hidden=true;
  if(parent.isConnected)parent.insertBefore(menu,next?.parentNode===parent?next:null);
  trigger.setAttribute('aria-expanded','false');
  modal.remove();
 },{once:true});
 modal.showModal();
}
function existingBlockAddControls(original,p,box){
 const controls=n('div','existing-block-add'),menu=n('div','existing-block-add-menu');
 const add=b('＋',event=>{
  event.stopPropagation();
  toggleInsertionMenu(menu,add,'Ajouter un élément dans ce bloc');
 },'section-add-green existing-block-add-button');
 add.title='Ajouter dans ce bloc';
 add.setAttribute('aria-label','Ajouter dans ce bloc');
 add.setAttribute('aria-expanded','false');
 menu.hidden=true;
 for(const [label,kind] of [['Titre','heading'],['Image','image'],['Texte','text'],
   ['Titre événement','event'],['Bouton','button'],['Vidéo','video'],['Lecteur audio','audio'],['Trait de séparation','divider']]){
  menu.append(b(label,event=>{
   event.stopPropagation();
   const index=p.blocks.indexOf(original);
   if(index<0)return;
   const added=createContent(kind);
   // Keep the original item and its saved rich text, photos and formatting.
   const section=editorBlockCommands.wrapRootBlock(p,original,added,uniqueBlockId());
   if(!section)return;
   selectedBlockId=String(added.id);
   mark();render();
  },'sm'));
 }
 controls.append(add,menu);
 return controls;
}
function addSection(p,index,layout){
 const section=editorBlockModel.createSection(uniqueBlockId(),layout,[[],[]]);
 p.blocks.splice(index,0,section);selectedBlockId=null;mark();render();
}
// Presets are ordinary editable sections, not separate locked widgets:
function addResourcePreset(p,index,kind='resource'){
 const {section,selectedIndex}=editorBlockModel.createResourcePreset(kind,uniqueBlockId(),createContent);
 p.blocks.splice(index,0,section);
 selectedBlockId=String(section.columns[selectedIndex][0].id);
 mark();render();
}
function sectionMenu(p,index){
 const wrap=n('div','section-insert'),menu=n('div','section-insert-choices');
 wrap.dataset.insertIndex=String(index);
 const toggle=b('＋',event=>{event.stopPropagation();toggleInsertionMenu(menu,toggle,'Ajouter un bloc')},'section-add-blue');
 toggle.title='Ajouter une zone';toggle.setAttribute('aria-label','Ajouter une zone');
 menu.hidden=true;
 menu.append(b('Bloc seul',()=>addSection(p,index,'single'),'sm'),
             b('Deux colonnes',()=>addSection(p,index,'columns'),'sm'),
             b('Ressource : image + document',()=>addResourcePreset(p,index,'resource'),'sm'),
             b('Vidéo : titre + lecteur',()=>addResourcePreset(p,index,'video'),'sm'),
             b('Lecteur audio',()=>{
              const audio=createContent('audio');
              const section=editorBlockModel.createSection(uniqueBlockId(),'single',[[audio],[]]);
              p.blocks.splice(index,0,section);selectedBlockId=String(audio.id);mark();render();
             },'sm'),
             b('Document : titre + PDF',()=>addResourcePreset(p,index,'documents'),'sm'),
             b('Trait de séparation',()=>{
              const divider=createContent('divider');p.blocks.splice(index,0,divider);
              selectedBlockId=String(divider.id);mark();render();
             },'sm'));
 menu.addEventListener('click',e=>e.stopPropagation());
 wrap.append(toggle,menu);return wrap;
}
function sectionStyle(section){return editorBlockModel.sectionStyle(section,validColor)}
function sectionFrame(box,section){
 const st=sectionStyle(section);box.dataset.frame=st.border;
 if(st.border!=='none'){
  box.style.border=st.width+'px solid '+st.color;
  box.style.borderRadius=st.border==='round'?'16px':'0';
 }
 if(st.shadow)box.style.boxShadow='0 5px 19px #16243329';
}
function sectionSettings(section){
 const details=n('details','section-settings'),summary=n('summary','','⚙');
 summary.title='Présentation du bloc';summary.setAttribute('aria-label','Présentation du bloc');details.append(summary);
 const fields=n('div','section-settings-fields'),current=sectionStyle(section);
 const line=(label,input)=>{const row=n('label','',label);row.append(input);fields.append(row)};
 const presentation=n('select');presentation.setAttribute('aria-label','Présentation du bloc');
 for(const [key,label] of [['','Classique'],['resource','Ressource : image et texte'],
  ['video','Vidéo'],['documents','Liste de documents'],
  ['intro','Introduction'],['text','Section de texte']]){
  const option=n('option','',label);option.value=key;
  option.selected=(section.presentation||'')===key;presentation.append(option);
 }
 presentation.onchange=()=>{section.presentation=presentation.value||undefined;mark();render()};
 line('Présentation',presentation);
 const border=n('select');border.setAttribute('aria-label','Forme du cadre');
 for(const [value,label] of [['none','Sans cadre'],['round','Cadre arrondi'],['square','Cadre carré']]){
  const option=n('option','',label);option.value=value;option.selected=value===current.border;border.append(option)
 }
 border.onchange=()=>{section.style=editorBlockModel.patchSectionStyle(section,{border:border.value},validColor);mark();render()};
 line('Cadre',border);
 const color=n('input');color.type='color';color.value=current.color;color.setAttribute('aria-label','Couleur du cadre');
 color.onchange=()=>{section.style=editorBlockModel.patchSectionStyle(section,{color:color.value},validColor);mark();render()};
 line('Couleur',color);
 const width=n('select');width.setAttribute('aria-label','Épaisseur du trait');
 for(let i=1;i<=5;i++){const option=n('option','',i+' px');option.value=String(i);option.selected=i===current.width;width.append(option)}
 width.onchange=()=>{section.style=editorBlockModel.patchSectionStyle(section,{width:Number(width.value)},validColor);mark();render()};
 line('Épaisseur',width);
 const shadow=n('input');shadow.type='checkbox';shadow.checked=current.shadow;shadow.setAttribute('aria-label','Ombrage');
 shadow.onchange=()=>{section.style=editorBlockModel.patchSectionStyle(section,{shadow:shadow.checked},validColor);mark();render()};
line('Ombre',shadow);
 const hidden=section.hideOnSite===true;
 const visibility=b('',event=>{
  event.stopPropagation();
  section.hideOnSite=section.hideOnSite!==true;
  mark();render();
 },'section-visibility-toggle');
 visibility.setAttribute('aria-label',hidden?'Afficher le bloc entier aux visiteurs':'Masquer le bloc entier aux visiteurs');
 visibility.append(visibilityEyeIcon(!hidden),
  n('span','',hidden?'Afficher ce bloc entier':'Masquer ce bloc entier'));
 fields.append(visibility);
 details.append(fields);return details;
}
// The default is top for free columns; historical image/resource cards remain
// centered unless the owner chooses an explicit alignment. These values are
// stored on the section, not on its headings, images, or buttons.
function columnVerticalAlign(section,index){return editorBlockModel.columnVerticalAlign(section,index)}
function columnButtonLayout(section,index){return editorBlockModel.columnButtonLayout(section,index)}
function columnPresentationSettings(section,index){
 const details=n('details','section-column-presentation');
 const side=index===0?'gauche':'droite';
 const summary=n('summary','','↕');
 summary.title='Disposition de la colonne '+side;
 summary.setAttribute('aria-label','Disposition de la colonne '+side);
 details.append(summary);
 const fields=n('div','section-column-presentation-fields');
 const makeChoice=(title,choices,current,commit)=>{
  const line=n('label','',title),select=n('select');
  select.setAttribute('aria-label',title+' — colonne '+side);
  for(const [value,name] of choices){
   const option=n('option','',name);option.value=value;option.selected=value===current;
   select.append(option);
  }
  select.onchange=()=>{commit(select.value);mark();render()};
  line.append(select);fields.append(line);
 };
 if(section.layout==='columns')makeChoice('Alignement vertical',
  [['top','Haut'],['center','Centre'],['bottom','Bas']],
  columnVerticalAlign(section,index),value=>{
   section.columnAlignments=[columnVerticalAlign(section,0),columnVerticalAlign(section,1)];
   section.columnAlignments[index]=value;
  });
 makeChoice('Disposition des boutons',
  [['stack','Les uns sous les autres'],['row','Côte à côte']],
  columnButtonLayout(section,index),value=>{
   section.columnButtonLayouts=[columnButtonLayout(section,0),columnButtonLayout(section,1)];
   section.columnButtonLayouts[index]=value;
  });
 details.append(fields);return details;
}
function sectionColumn(section,p,index,single=false){
 const items=section.columns[index],cell=n('div','section-column');
 cell.dataset.columnIndex=String(index);cell.dataset.sectionId=String(section.id);
 cell.dataset.verticalAlign=columnVerticalAlign(section,index);
 cell.dataset.buttonLayout=columnButtonLayout(section,index);
 let controls=null;
 if(!preview&&!single){
  controls=n('div','section-column-actions');const menu=n('div','section-element-menu');
  const add=b('＋',event=>{
   event.stopPropagation();
   toggleInsertionMenu(menu,add,'Ajouter un élément à '+(index===0?'gauche':'droite'));
  },'section-add-green');
  add.title='Ajouter un élément';add.setAttribute('aria-label','Ajouter '+(index===0?'à gauche':'à droite'));
  menu.hidden=true;
  for(const [label,kind] of [['Titre','heading'],['Image','image'],['Texte','text'],
   ['Titre événement','event'],['Bouton','button'],['Vidéo','video'],['Lecteur audio','audio'],['Trait de séparation','divider']]){
   menu.append(b(label,()=>{
    const x=createContent(kind);items.push(x);selectedBlockId=String(x.id);mark();render();
   },'sm'));
  }
  controls.append(add,columnPresentationSettings(section,index));
  if(index===0)controls.append(sectionSettings(section));controls.append(menu);
 }
 for(const x of items)cell.append(block(x,p,items,section));
 if(controls)cell.append(controls);
 return cell;
}
function renderSection(section,p){
 if(!Array.isArray(section.columns))section.columns=[[],[]];
const wrap=n('div','content-section');wrap.dataset.sectionId=section.id;
 if(section.hideOnSite===true){
  wrap.classList.add('hidden-on-public');
  if(!preview)wrap.append(n('small','hidden-public-note','Bloc entier invisible aux visiteurs'));
 }
 wrap.dataset.layout=section.layout==='columns'?'columns':'single';
 wrap.dataset.presentation=['resource','video','documents','intro','text'].includes(section.presentation)?section.presentation:'';
 sectionFrame(wrap,section);
 if(!preview){
  const tools=n('div','section-root-actions');
  const layoutButton=b('▣',()=>{
   section.layout=editorBlockModel.nextLayout(section.layout);mark();render();
  },'sm section-layout-toggle');
  layoutButton.title='Passer à '+(section.layout==='columns'?'un bloc seul':'deux colonnes');
  layoutButton.setAttribute('aria-label',layoutButton.title);tools.append(layoutButton);
  tools.append(b('✕',async ()=>{if((await siteConfirm('Supprimer cette zone et son contenu ?'))){p.blocks=p.blocks.filter(x=>x!==section);mark();render()}},'sm'));
  wrap.append(tools);
 }
 const grid=n('div','section-columns');
 if(section.layout==='columns'){
  grid.append(sectionColumn(section,p,0),sectionColumn(section,p,1));
 }else{
  const only=sectionColumn(section,p,0);
  for(const x of section.columns[1])only.append(block(x,p,section.columns[1],section));
  grid.append(only);
 }
 wrap.append(grid);return wrap;
}
async function removeCustomPage(q){
 if(!IS_STAGE||!q||!db.pages.some(p=>p.id===q.id))return;
 const plan=editorPageCommands.deletionPlan(db,q,STAGE_SEED?.celebrationId);
 const {general}=plan;
 if(!plan.allowed){siteNotice('Cette page est protégée et ne peut pas être supprimée.');return}
 if(!(await siteConfirm('Supprimer la page « '+q.name+' » ? Cette suppression sera enregistrée sur le serveur.')))return;
 if(stateOfPage(q)==='published'){
  const hidden=await serverPublish({kind:'page',pageId:q.id,visibility:'hidden'});
  if(!hidden){siteNotice('La page est encore publique. Suppression annulée.');return}
 }
 if(general){
  let original={};try{original=JSON.parse(localStorage.getItem(SHARED_KEY)||'{}')}catch{}
  const deleted=editorPageCommands.rememberDeletedPage(original,q.id);
  localStorage.setItem(SHARED_KEY,JSON.stringify({...original,deletedPageIds:deleted}));
 }
 const next=editorPageCommands.removeConfirmedPage(db,q,id,plan);
 if(next===null)return;
 id=next;
 if(general&&typeof editorLocalization!=='undefined')delete editorLocalization.pages[q.id];
 if(typeof clearLocaleView==='function')clearLocaleView();selectedBlockId=null;mark();save();render();
 void serverSave();
}
function moveGeneralPage(p,dir){
 if(dirty){save();if(dirty)return}
 if(!editorPageCommands.moveGeneralPage(db,p,dir))return;
 mark();save();render();
}
function makeHome(p){db.siteHomeId=p.id;mark();save();render()}

// Saving a draft never makes new pages public. These actions publish or hide
// a single chosen page, or the entire celebration, on the server.
const VISIBILITY_LABELS=editorPageModel.visibilityLabels;
function stateOfPage(p){return editorPageModel.pageVisibility(p)}
function sharedVisibility(){
 try{return JSON.parse(localStorage.getItem(SHARED_KEY)||'{}').celebrationVisibility||{}}catch{return {}}
}
function celebrationState(entry){
 return editorPageModel.celebrationVisibility(entry,sharedVisibility());
}
function historicallyPrivate(kind,q){
 const policy=kind==='celebration'?
  (privateCatalogue?.celebrationAccessPolicy||q?.accessPolicy):
  (privateCatalogue?.record?.pages?.find(p=>p.id===q?.id)?.accessPolicy||q?.accessPolicy);
 return q?.privateManaged===true||(policy&&policy.mode!=='PUBLIC');
}
function publicationActions(kind,q){
 if(!adminMembersEnabled&&historicallyPrivate(kind,q))
  return n('p','m021-private-warning','Ce contenu est déjà privé. Réactivez la gestion des membres dans Paramètres pour modifier sa publication ou ses autorisations.');
 const outer=n('div','publication-status-controls');
 const current=kind==='page'?stateOfPage(q):celebrationState(q);
 const badge=n('span','publication-badge state-'+current);
 badge.setAttribute('role','img');badge.setAttribute('aria-label',VISIBILITY_LABELS[current]);outer.append(badge);
 const field=n('label','editor-language-choice','Visibilité'),select=n('select');
 select.setAttribute('aria-label','Visibilité '+(kind==='page'?'de la page':'de la célébration'));
 for(const [value,label]of [['draft','Brouillon'],['published','Visible'],['hidden','Masqué']]){
  const option=n('option','',label);option.value=value;select.append(option);
 }
 select.value=current;
 select.onchange=async()=>{
  const chosen=select.value;
  if(chosen===current)return;
  if(chosen==='hidden'&&!await siteConfirm('Masquer ce contenu pour les visiteurs ?')){
   select.value=current;return;
  }
  select.disabled=true;badge.textContent='En cours…';
  const success=await serverPublish(editorPageModel.publicationIntent(kind,q,chosen),{flushContent:false});
  if(success){q.visibility=chosen;render();}
  else{select.value=current;badge.textContent='';select.disabled=false;}
 };
 field.append(select);outer.append(field);
 return outer;
}
function attachPagePublicationControls(list,group){
 if(!IS_STAGE||preview)return;
 for(const p of db.pages.filter(q=>q.group===group)){
  const choose=[...list.querySelectorAll('button.item')].find(x=>x.dataset.pageId===p.id);
  if(!choose)continue;
  let row=choose.closest('.general-page-row');
  if(!row){row=n('div','general-page-row');choose.replaceWith(row);row.append(choose)}
  // Always expose useful actions: historical stages are protected from
  // destructive deletion but can be edited or hidden and shown again.
  const opts=n('details','page-options');
  const summary=n('summary','','⋯');
  summary.setAttribute('aria-label','Actions pour la page '+p.name);
  summary.title='Modifier et gérer la visibilité de cette page';
  const menu=n('div','page-options-menu');
  menu.append(b('Modifier cette page',()=>enter('celebrations',p.id),'sm'));
  menu.append(publicationActions('page',p));
  const deletion=editorPageCommands.deletionPlan(db,p,STAGE_SEED?.celebrationId);
  if(deletion.allowed){
   const remove=b('Supprimer la page',()=>removeCustomPage(p),'sm');
   remove.classList.add('danger');menu.append(remove);
  }else{
   menu.append(n('small','page-options-protected',
    'Page historique protégée : utilisez « Masqué » pour la retirer du site.'));
  }
  opts.append(summary,menu);row.append(opts);
  const state=stateOfPage(p),badge=n('span','inline-page-state state-'+state);
  badge.setAttribute('role','img');badge.setAttribute('aria-label',VISIBILITY_LABELS[state]);
  badge.title=VISIBILITY_LABELS[state];row.insertBefore(badge,opts);
 }
}

function pageWorkspace(group,mount=w){
 if(!privateEdit&&IS_STAGE){ensureMemberPanel();if(adminMembersEnabled)privatePageButtons(group,mount);}
 const listed=editorPageModel.groupPages(db.pages,group);
 if(!listed.length){
  if(group!=='footer'){const empty=n('section','panel');empty.append(n('h2','',group==='celebration'?'Pages de la célébration':'Pages'),n('p','','Aucune page pour le moment.'),b('＋ Ajouter une page',()=>createPage(group),'sm primary'));mount.append(empty);}
  if(group==='footer'){
   const empty=n('section','panel footer-page-empty');
   empty.append(n('h2','','Pages de bas de page'),
    n('p','','Créez une page (mentions légales, confidentialité…) ; son titre deviendra un lien en bas du site une fois publiée.'),
    b('＋ Page de bas de page',()=>createPage('footer'),'sm primary'));
   mount.append(empty);return;
  }
  return;
 }
 if(!listed.some(q=>q.id===id)){
  id=editorPageModel.activePageId(db.pages,group,id);
 }
 const p=page(),layout=n('div','layout'),side=n('aside','panel');
 if(group==='footer')side.append(n('h2','','Pages de bas de page'));
 if(p.group==='celebration'&&IS_STAGE&&!privateEdit){
  const dates=currentDates(),timing=n('div','celebration-date-time'),field=n('label','date-field','Date du mercredi :');
  const input=n('input','celebration-wednesday');input.type='date';input.value=dates.wednesday;
  input.setAttribute('aria-label','Mercredi de la célébration');
  input.onchange=()=>updateDate('wednesday',input.value);
  field.append(input);timing.append(field);
  if(DAY_SLUGS.includes(pageSlug(p))){
   const clock=timeChooser(dayTime(p),'Heure du '+pageSlug(p),hour=>updateDayTime(p,hour));
   clock.dataset.day=pageSlug(p);clock.classList.add('celebration-day-hour');
   timing.append(clock);
  }
  side.append(timing);
  if(dates.wednesday){
   const week=n('div','week-dates');
   week.textContent=prettyDate(dates.wednesday)+' – '+prettyDate(dayIso(dates.wednesday,4));
   side.append(week);
  }
 }
 const list=n('div',group==='celebration'?'list':'list general-pages-list');
 if(group==='celebration'){
  for(const q of editorPageModel.groupPages(db.pages,'celebration')){
   const date=stageDate(q),label='✧ '+q.name+(date?' · '+prettyDate(date):'');
   const choose=b(label,()=>enter('celebrations',q.id));
   choose.className='item'+(q.id===p.id?' active':'');choose.dataset.pageId=q.id;list.append(choose);
  }
  if(!privateEdit)attachPagePublicationControls(list,'celebration');side.append(list);
  if(!privateEdit){const actions=n('div','foot');actions.append(b('＋ Page',()=>createPage('celebration')));side.append(actions);}
 }else{
  for(const q of editorPageModel.groupPages(db.pages,group)){
   const row=n('div','general-page-row'),
     choose=b(localizedLabel(q),()=>enter(group==='footer'?'footer':'pages',q.id));
   choose.className='item page-name'+(q.id===p.id?' active':'');choose.dataset.pageId=q.id;row.append(choose);
   if(IS_STAGE&&!preview){
    const options=n('details','page-options'),summary=n('summary','','⋯');
    summary.setAttribute('aria-label','Options de la page '+q.name);
    summary.title='Options';options.append(summary);
    const commands=n('div','page-options-menu');
    const up=b('Monter',()=>moveGeneralPage(q,-1),'sm');up.disabled=editorPageModel.groupPages(db.pages,group)[0]===q;
    const down=b('Descendre',()=>moveGeneralPage(q,1),'sm');down.disabled=editorPageModel.groupPages(db.pages,group).at(-1)===q;
    commands.append(up,down);
    if(group==='page'&&q.id!==(db.siteHomeId||'neutral-accueil-general')){
     const home=b('Définir comme accueil',()=>makeHome(q),'sm');commands.append(home);
    }
    if(/^neutral-[0-9a-f-]{30,45}$/.test(q.id)){
     const remove=b('Supprimer la page',()=>removeCustomPage(q),'sm');
     remove.classList.add('danger');commands.append(remove);
    }
    options.append(commands);row.append(options);
   }
   list.append(row);
  }
  attachPagePublicationControls(list,'page');side.append(list);
  const actions=n('div','foot');actions.append(b(group==='footer'?'＋ Page de bas de page':'＋ Page',()=>createPage(group)));
  side.append(actions);
 }
 layout.append(side);
 const right=n('section'),head=n('div','editor-head'),info=n('div');
 head.append(info);right.append(head);
 if(IS_STAGE&&!privateEdit&&!preview&&['page','celebration'].includes(p.group)){
  const row=n('div','editor-language-row m020-settings');
  row.append(n('strong','','Réglages de la page'));
  if(editingLanguageId==='fr'&&editorPageModel.removablePage(canonicalPage(),STAGE_SEED?.celebrationId).allowed){
   const rename=n('label','editor-language-choice m024-page-name','Nom de la page');
   const nameInput=n('input');nameInput.type='text';nameInput.maxLength=95;
   nameInput.value=canonicalPage().name;nameInput.setAttribute('aria-label','Renommer cette page');
   nameInput.onchange=()=>{
    const result=editorPageCommands.renameEditablePage(db,canonicalPage(),nameInput.value,STAGE_SEED?.celebrationId);
    if(!result.ok){siteNotice(result.error);nameInput.value=canonicalPage().name;return;}
    if(result.changed){clearLocaleView();mark();render();}
   };
   rename.append(nameInput);row.append(rename);
  }
  row.append(publicationActions('page',canonicalPage()));
  if(adminMembersEnabled)row.append(accessControls('page',canonicalPage()));
  const label=n('label','editor-language-choice','Langue'),picker=n('select');picker.setAttribute('aria-label','Langue');
  for(const lang of editorLocalization.registry.languages){const opt=n('option','',lang.name);opt.value=lang.id;picker.append(opt)}picker.value=editingLanguageId;
  picker.onchange=()=>{if(dirty){save();if(dirty)return}editingLanguageId=picker.value;clearLocaleView();selectedBlockId=null;render()};
  label.append(picker);row.append(label);
   // The celebration already has a clear “＋ Page” action.
   if(p.group!=='celebration')row.append(b('Dupliquer',()=>m018DuplicatePage(canonicalPage()),'sm'));
   row.append(b('Enregistrer',saveCurrentContent,'sm m022-save'));
   right.append(row);
  if(editingLanguageId!=='fr'){
   const field=n('label','editor-language-title','Titre de la page dans cette langue');
   const input=n('input');input.type='text';input.maxLength=180;input.value=p.name;
   input.setAttribute('aria-label','Titre traduit de la page');
   input.onchange=()=>{
    const next=input.value.trim();
    if(!next){input.value=p.name;return}
    page().name=next;mark();render();
   };
   field.append(input);right.append(field);
   const exists=!!editorLocalization.pages[p.id]?.[editingLanguageId];
   right.append(n('small','editor-language-note','Cette version sera publiée avec sa page.'));
  }
 }
 if(p.group==='celebration'&&IS_STAGE&&!privateEdit&&pageSlug(p)==='preparation'&&!preview){
  const dates=currentDates().preparationDates,fields=n('div','preparation-dates');
  fields.append(n('strong','','Dates de préparation'));
  for(let index=0;index<Math.max(1,dates.length);index++){
   const line=n('div','prep-date-row'),input=n('input');
   input.type='date';input.value=dates[index]||'';input.dataset.preparationIndex=String(index);
   input.setAttribute('aria-label','Date de préparation '+(index+1));
   input.onchange=()=>updatePreparationDate(index,input.value);
   line.append(input);
   if(dates.length>0){
    const remove=b('×',()=>removePreparationDate(index),'sm');
    remove.setAttribute('aria-label','Supprimer date de préparation '+(index+1));line.append(remove);
   }
   fields.append(line);
  }
  fields.append(b('＋ Date',addPreparationDate,'sm'));
  right.append(fields);
 }
 const date=dateSummary(p),time=dayTime(p),when=[date,time].filter(Boolean).join(' · ');
 if(when){const info=n('div','page-date',when);info.dataset.role='celebration-date';right.append(info)}
 const outer=n('div','canvas-wrap'),canvas=n('div','canvas');

 if(!preview)canvas.append(sectionMenu(p,0));
 p.blocks.forEach((x,index)=>{
  const element=x.kind==='section'?renderSection(x,p):block(x,p);
  // The insertion target belongs to this block: moving the pointer onto
  // its blue + keeps the parent hovered and the control clickable.
  if(!preview)element.append(sectionMenu(p,index+1));
  canvas.append(element);
 });
 outer.append(canvas);right.append(outer);

 layout.append(right);mount.append(layout);
}
// M018-C: only the editorial content is copied, never participant entitlements.
 function m018DuplicatePage(q){
  if(!IS_STAGE||privateEdit||preview||!q)return;
  if(dirty){save();if(dirty)return}
  const group=q.placement==='footer'?'footer':q.group;
  const copy=editorPageModel.createPage(group,String(q.name||'Page')+' (copie)',crypto.randomUUID(),STAGE_SEED.celebrationId);
  copy.blocks=clone(q.blocks||[]);
  db.pages.splice(db.pages.indexOf(q)+1,0,copy);
  if(editorLocalization.pages[q.id])editorLocalization.pages[copy.id]=clone(editorLocalization.pages[q.id]);
  id=copy.id;tab=group==='page'?'pages':group;
  editingLanguageId='fr';clearLocaleView();selectedBlockId=null;
  mark();save();render();void serverSave();
  status.textContent='Copie en brouillon : aucun droit ni inscription transféré.';
 }
 async function m018CopyContentVersion(target){
  if(!IS_STAGE||privateEdit||target==='fr'||target===editingLanguageId)return;
  if(dirty){save();if(dirty)return}
  const canonical=canonicalPage();
  if(!canonical||!editorLocalization.registry.languages.some(lang=>lang.id===target))return;
  const source=editingLanguageId==='fr'?
   {name:canonical.name,blocks:clone(canonical.blocks||[])}:
   editorLocalization.pages[canonical.id]?.[editingLanguageId];
  if(!source){siteNotice('Cette version ne contient pas encore de contenu enregistré.');return}
  const current=editorLocalization.pages[canonical.id]||{};
  if(current[target]&&!(await siteConfirm('Remplacer le contenu de cette langue par une copie ?')))return;
  try{
   const next=setPageTranslation({...canonical,translations:current},
    editorLocalization.registry,target,{name:source.name,blocks:clone(source.blocks||[])});
   editorLocalization.pages[canonical.id]=next.translations;
   editingLanguageId=target;clearLocaleView();mark();save();render();void serverSave();
   status.textContent='Contenu copié dans cette langue, sans nouveaux droits.';
  }catch(error){siteNotice(error.message||String(error))}
 }
function pages(){pageWorkspace('page')}
function footerPages(){pageWorkspace('footer')}
// Creating a DIFFERENT celebration remains an explicit action, unlike language/category variants.
 async function m018DuplicateCelebration(entry){
  if(!IS_STAGE||privateEdit||!entry)return;
  if(dirty){save();if(dirty)return}
  const choice=await siteDialog({title:'Dupliquer la célébration',fields:[{name:'date',label:'Date du mercredi :',type:'date',value:currentDateForDraft(entry)||entry.date||privateCatalogue?.record?.celebrationDates?.wednesday||currentDates().wednesday||'',required:true},{name:'title',label:'Titre',value:celebrationLabel(entry)+' (copie)',required:true}],confirm:'Créer le brouillon'});
  const date=choice?.date;
  if(!date)return;
  if(!validIso(date)){siteNotice('Choisissez une date valide.');return}
  try{
   ensureMemberPanel();if(dirty||db._serverPending){save();await serverSave();if(db._serverPending)return}
   const result=await memberPanel.commandContent('create-celebration',{archangel:entry.archangel,date,title:choice.title,copy:true});
   location.assign(editorPageModel.editorUrl(result.targetCelebration));
  }catch(error){siteNotice('Copie impossible : '+(error.message||error))}

 }
function celebrations(){
 if(!IS_STAGE){pageWorkspace('celebration');return}
 const selector=n('label','celebration-choice-field'),select=n('select','celebration-select');
 select.setAttribute('aria-label','Choisir la célébration');
 for(const entry of celebrationEntries()){
  const option=n('option','',celebrationLabel(entry));
  option.value=entry.id;option.selected=entry.id===String(window.__PREPARATION_SEED__.celebrationId);select.append(option);
 }
 select.onchange=()=>openCelebration(select.value);
 selector.append(select);w.append(selector);
 const selectedEntry=celebrationEntries().find(x=>x.id===String(window.__PREPARATION_SEED__.celebrationId));
 if(selectedEntry&&!preview){
  const publication=n('div','celebration-publication-controls');
  publication.append(n('strong','','Visibilité de cette célébration'));
  publication.append(publicationActions('celebration',selectedEntry));
if(adminMembersEnabled){
  publication.append(accessControls('celebration',selectedEntry));
  publication.append(b('Versions par catégorie',()=>showContentVersions(),'sm'));
 }
   publication.append(b('Dupliquer',()=>duplicateChoice(selectedEntry),'sm'));
  w.append(publication);
 }
 const current=plannedEntries().find(p=>p.id===String(window.__PREPARATION_SEED__.celebrationId));
 if(current){
  const line=n('label','celebration-title-edit','Titre de la célébration'),input=n('input');
  input.type='text';input.maxLength=100;input.value=celebrationLabel(current);
  input.setAttribute('aria-label','Titre de la célébration');
  input.onchange=()=>{
   if(!savePlannedTitle(current.id,input.value)){input.value=celebrationLabel(current);return}
   input.classList.add('saved');select.selectedOptions[0].textContent=input.value.trim();
   if(IS_STAGE){
    db._serverPending=true;
    localStorage.setItem(KEY,JSON.stringify(db));
    status.textContent='Titre modifié : cliquez sur Enregistrer pour le serveur';
   }else status.textContent='✓ Titre enregistré dans ce navigateur';
  };
  line.append(input);w.append(line);
  const chosen=String(currentDateForDraft(current)||'');
  const year=String(celebrationLabel(current)).match(/20\d{2}/)?.[0]||'';
  if(year&&chosen&&year!==chosen.slice(0,4)){
   const warning=n('small','celebration-date-warning','Date à vérifier : '+chosen.slice(0,4)+' (titre '+year+')');
   w.append(warning);
  }
 }
 const workspace=n('div','celebration-editor');
 w.append(workspace);
 pageWorkspace('celebration',workspace);
 const last=plannedEntries().at(-1)?.archangel||window.__PREPARATION_SEED__?.archangel||'Michaël';
 const index=ARCHANGELS.findIndex(x=>archSlug(x)===archSlug(last));
 const next=ARCHANGELS[((index<0?3:index)+1)%4];
 const details=n('details','new-celebration'),summary=n('summary','','＋ Nouvelle célébration');
 details.append(summary);
 const form=n('form','trial-planning'),label=n('label','','Date du mercredi :'),date=n('input');
 date.type='date';date.required=true;date.setAttribute('aria-label','Date du mercredi');
 label.append(date);form.append(label);
 const lastEntry=plannedEntries().at(-1)||celebrationEntries().find(p=>p.id===String(window.__PREPARATION_SEED__.celebrationId));
 const titleRow=n('label','celebration-title-field','Titre'),name=n('input');
 name.type='text';name.maxLength=100;name.setAttribute('aria-label','Titre proposé');
 const initial=proposedTitle(next,'',lastEntry);
 name.value=initial;titleRow.append(name);form.append(titleRow);
 date.onchange=()=>{
  if(name.value===initial||name.dataset.auto==='true'){
   name.value=proposedTitle(next,date.value,lastEntry);name.dataset.auto='true';
  }
 };
 name.oninput=()=>name.dataset.auto='false';
 const create=n('button','btn primary','Créer '+next);create.type='submit';form.append(create);
 form.onsubmit=async e=>{
  e.preventDefault();if(!validIso(date.value)){siteNotice('Choisissez une date valide.');return}
  const title=String(name.value||'').trim();if(!title){name.focus();return}
  try{
   ensureMemberPanel();if(dirty||db._serverPending){save();await serverSave();if(db._serverPending)return}
   const result=await memberPanel.commandContent('create-celebration',{archangel:next,date:date.value,title,copy:false});
   location.assign(editorPageModel.editorUrl(result.targetCelebration));
  }catch(error){siteNotice('Création impossible : '+(error.message||error))}

 };
 details.append(form);w.append(details);
}
// Media usage is obtained from the shared server's draft AND published pages.
// Local scans cover edits not yet sent to the server.
function mediaLinksFor(record,related=[]){
 const entries=[],seen=new Set(),currentId=String(window.__PREPARATION_SEED__?.celebrationId||'101');
 function push(use){
  if(!use||!use.pageName)return;
  const cid=String(use.celebrationId||currentId),slug=String(use.slug||use.pageId||'');
  const key=(use.group==='page'?'page:':'celebration:'+cid+':')+String(use.pageId||slug);
  if(!slug||seen.has(key))return;
  seen.add(key);
  entries.push({name:use.group==='page'?use.pageName:
    String(use.name||'Célébration')+' · '+use.pageName,
   href:'/__editor/voir-le-site?celebration='+encodeURIComponent(cid)+'&page='+encodeURIComponent(slug)});
 }
 for(const use of record.uses||[])push(use);
 for(const use of related)push(use);
 function visit(blocks,page,cid){
  for(const block of blocks||[]){
   if(block?.kind==='section'){for(const col of block.columns||[])visit(col,page,cid);continue}
   if(block?.src===record.src||block?.href===record.src||block?.cover===record.src)
    push({pageId:page.id,pageName:page.name,celebrationId:cid,group:page.group,
     slug:page.group==='page'?page.id:(page.id.endsWith('-'+cid)?page.id.slice(0,-cid.length-1):page.id),
     name:String(window.__PREPARATION_SEED__?.archangel||'Célébration')+' '+String(window.__PREPARATION_SEED__?.year||'')});
  }
 }
 for(const page of db.pages||[])visit(page.blocks,page,currentId);
 return entries;
}
function libraryTypeLabel(record){
 const name=String(record.name||'')+' '+String(record.src||'');
 if(/\.pdf(?:[?#\s]|$)/i.test(name))return 'PDF';
 if(/\.txt(?:[?#\s]|$)/i.test(name))return 'Texte';
 if(/\.csv(?:[?#\s]|$)/i.test(name))return 'Tableau CSV';
 if(/\.(?:doc|docx|odt|rtf)(?:[?#\s]|$)/i.test(name))return 'Document';
 if(/\.zip(?:[?#\s]|$)/i.test(name))return 'Archive ZIP';
 if(/\.json(?:[?#\s]|$)/i.test(name))return 'Données';
 return 'Fichier';
}
function libraryTitle(card,name,src){
 const heading=n('h3','media-card-title');
 if(src){
  const link=n('a','media-open-link',name);link.href=src;
  link.target='_blank';link.rel='noopener noreferrer';heading.append(link);
 }else heading.textContent=name;
 card.append(heading);
}
function libraryPicture(card,name,src,unused){
 if(!src)return;
 const link=n('a','media-picture-link'+(unused?' is-unused':''));link.href=src;
 link.target='_blank';link.rel='noopener noreferrer';link.title='Voir '+name;
 const img=n('img','library-thumb');img.src=src;img.alt=name;img.loading='lazy';link.append(img);
 if(unused)link.append(n('span','media-unused-ribbon','Inutilisé'));
 card.append(link);
}
function libraryUnusedText(card,unused,hasImage){
 if(unused&&!hasImage)card.append(n('span','media-unused-text','Inutilisé'));
}
function libraryLocationLinks(card,links){
 const box=n('div','file-usage-links');
 for(const item of links){
  const link=n('a','file-location-link',item.name+' ↗');
  link.href=item.href;link.target='_blank';link.rel='noopener noreferrer';box.append(link);
 }
 card.append(box);
}
function attachChosenAudio(record){
 if(!chosenBlock||chosenBlock.kind!=='audio')return false;
 const src=String(record.src||'');
 if(!/^\/media\/(?!.*\.\.)[^?#]+\.(?:mp3|wav)$/i.test(src)){
  status.textContent='Choisissez un MP3 ou WAV hébergé sur le site.';
  return false;
 }
 chosenBlock.src=src;delete chosenBlock.remoteKey;
 if(!chosenBlock.text||chosenBlock.text==='MP3 à choisir')chosenBlock.text=String(record.name||'Enregistrement audio').slice(0,180);
 chosenBlock=null;selectedBlockId=null;
 mark();tab=mediaReturnTab;render();
 status.textContent='✓ Lecteur audio ajouté. Enregistrez puis publiez la page.';
 return true;
}
// Preview the existing URL: same cookies, ACL and Range gateway as the site.
function libraryPreview(card,name,src,category){
 if(!src||!['audios','videos','pdf'].includes(category))return;
 const box=n('div','library-preview');
 if(category==='pdf'){
  const url=new URL(src,location.href);
  if(url.origin===location.origin||url.protocol==='blob:'){
  const details=n('details'),summary=n('summary','','Prévisualiser le PDF');
  details.append(summary);
  details.addEventListener('toggle',()=>{
   if(!details.open||details.dataset.loaded)return;
   // Embedded documents stay on the authenticated origin. External PDFs open by link.
   const url=new URL(src,location.href);
   if(url.origin!==location.origin&&url.protocol!=='blob:')return;
   const frame=n('iframe');frame.title='Aperçu : '+name;frame.src=src;
   frame.loading='lazy';details.append(frame);details.dataset.loaded='true';
  });box.append(details);
  }
 }else{
  const player=n(category==='audios'?'audio':'video');
  player.controls=true;player.preload='metadata';player.src=src;
  player.setAttribute('aria-label',name);
  if(category==='videos')player.playsInline=true;
  player.addEventListener('play',()=>document.querySelectorAll('.library-preview audio,.library-preview video').forEach(other=>{if(other!==player)other.pause()}));
  player.addEventListener('error',()=>{
   if(!box.querySelector('.hint'))box.append(n('p','hint','Lecture indisponible : vérifiez votre connexion, votre accès ou le format du fichier.'));
  });box.append(player);
 }
 const open=n('a','media-open-link','Ouvrir '+(category==='pdf'?'le PDF':'le fichier')+' ↗');
 open.href=src;open.target='_blank';open.rel='noopener noreferrer';box.append(open);card.append(box);
}
let mediaSearch='';
function media(){
 if(IS_STAGE&&!remoteMediaLoading&&!globalMediaLoaded)void refreshGlobalMedia();
 if(!globalFilesLoading)
  loadGlobalFiles().then(()=>{if(tab==='media'&&!document.querySelector('.audio-import-section[open]'))render()});
 // Ignore historical inline paragraphs, obsolete descriptions and navigation links.
 const historical=(globalFiles||publicFiles().map(r=>({...r,uses:
  (r.pages||[]).map(name=>filePageRef(window.__PREPARATION_SEED__,name)).filter(Boolean)})))
  .filter(r=>typeof r.src==='string'&&r.src.length>0&&r.category!=='links');
 const {local,remote,usedUrls,countFor}=mediaCatalogue.libraryCollections(
  historical,[...fileRecords.values()],globalMedia);
 const tabs=n('div','file-category-tabs');
 for(const [value,label] of [['images','Images'],['audios','Audios'],['videos','Vidéos'],['autres','Documents']]){
  const count=countFor(value)+(value==='autres'?countFor('pdf'):0);
  const button=b(label+' ('+count+')',()=>{mediaCategory=value;render()},
   mediaCategory===value?'primary sm':'sm');
  button.dataset.fileCategory=value;button.setAttribute('aria-pressed',String(mediaCategory===value));tabs.append(button);
 }
 w.append(tabs);
 w.append(n('h2','page-title','Médiathèque de l’administration'));
 const external=b('＋ Référencer un média externe',()=>void createExternalMedia(),'sm');
 w.append(external);
 w.append(n('p','hint','Import serveur : JPG, PNG, WebP, PDF, MP3, WAV, TXT et DOCX. Pour les vidéos, référencez un lien externe.'));
 const importButton=b(mediaCategory==='audios'?'＋ Importer un MP3':'＋ Importer',()=>{
  const picker=el('asset-file-picker');
  picker.accept=mediaCategory==='audios'?'.mp3,audio/mpeg':
   '.pdf,.txt,.docx,.jpg,.jpeg,.png,.webp,.mp3,.wav';
  picker.click();
 },'sm');
 importButton.disabled=!IS_STAGE&&!storageReady;importButton.dataset.action='upload-file';w.append(importButton);
 if(mediaCategory==='audios'){
  const label=n('p','media-upload-feedback',mediaUploadState?.message||'Le transfert MP3 affiche sa progression en temps réel (25 Mo maximum).');
  label.id='media-upload-feedback';label.setAttribute('role','status');label.setAttribute('aria-live','polite');w.append(label);
  const bar=n('progress','media-upload-progress');
  bar.id='media-upload-progress';bar.max=100;
  bar.value=mediaUploadState?.percent||0;bar.hidden=!mediaUploadState;
  bar.setAttribute('aria-label','Progression de l’import MP3');w.append(bar);
 }
 const search=n('input','media-search');search.type='search';search.placeholder='Rechercher un fichier';
 search.setAttribute('aria-label','Rechercher un fichier');search.value=mediaSearch;w.append(search);
 const cards=n('div','cards');
 const filterCards=()=>{const query=mediaSearch.trim().toLocaleLowerCase('fr');let visible=0;for(const card of cards.children){card.hidden=!card.querySelector('h3')?.textContent.toLocaleLowerCase('fr').includes(query);if(!card.hidden)visible++}empty.hidden=visible>0;};
 search.oninput=()=>{mediaSearch=search.value;filterCards()};
 const matches=category=>category===mediaCategory||mediaCategory==='autres'&&category==='pdf';
 for(const record of remote.filter(x=>matches(mediaCategoryOf(x))&&!usedUrls.has(x.src))){
  const refs=mediaLinksFor(record);
  const unused=record.canDelete===true&&refs.length===0;
  const hasImage=record.type==='image';
  const card=n('article','card global-media-card'+(unused?' unused-file':''));
  card.dataset.mediaId=record.id;card.dataset.usage=unused?'unused':'used';
  libraryTitle(card,record.name,record.src);
  card.append(n('small','media-format-label',
   ({image:'Image',pdf:'PDF',audio:'Audio',video:'Vidéo'})[record.type]||'Fichier'));
  if(hasImage)libraryPicture(card,record.name,record.src,unused);
  libraryPreview(card,record.name,record.src,record.category||mediaCategoryOf(record));
  libraryUnusedText(card,unused,hasImage);
  libraryLocationLinks(card,refs);
  const controls=n('div','file-actions');
  if(chosenBlock&&mediaCategory==='audios'&&record.type==='audio')
   controls.append(b('Insérer dans le lecteur',()=>attachChosenAudio(record),'sm primary'));
  if(unused)controls.append(b('Supprimer si inutilisé',()=>void deleteGlobalMedia(record),'sm'));
  card.append(controls);cards.append(card);
 }
 for(const record of historical.filter(x=>matches(x.category))){
  const remoteCopy=remote.find(x=>x.src===record.src&&mediaCategoryOf(x)===mediaCategory);
  const refs=mediaLinksFor(remoteCopy||record,fileUses(record));
  // The historical collection is not an authoritative inventory of every
  // unpublished, multilingual or private reference. Never mark it unused.
  const unused=false;
  const hasImage=record.category==='images';
  const card=n('article','card historic-file'+(unused?' unused-file':''));
  card.dataset.publicFileId=record.id;card.dataset.fileCategory=record.category;
  card.dataset.usage=unused?'unused':'used';
  libraryTitle(card,record.name,record.src);
  if(record.category==='autres')
   card.append(n('small','media-format-label',libraryTypeLabel(record)));
  if(hasImage)libraryPicture(card,record.name,record.src,unused);
  libraryPreview(card,record.name,record.src,record.category||mediaCategoryOf(record));
  libraryUnusedText(card,unused,hasImage);
  libraryLocationLinks(card,refs);
  if(chosenBlock&&mediaCategory==='audios'&&record.category==='audios')
   card.append(b('Insérer dans le lecteur',()=>attachChosenAudio(record),'sm primary'));
  if(unused){
   const info=n('small','delete-pending','Suppression après vérification des références');
   card.append(info);
  }
  cards.append(card);
 }
 for(const record of local.filter(x=>matches(localCategory(x)))){
  const localUrl=assetUrls.get(record.id)||'';
  const refs=fileUsages(record.id),unused=refs.length===0,hasImage=mediaCategory==='images';
  const card=n('article','card'+(unused?' unused-file':''));card.dataset.fileId=record.id;
  card.dataset.usage=unused?'unused':'used';
  libraryTitle(card,record.name,localUrl);
  card.append(n('small','media-origin-label',Math.round(record.size/1024)+' Ko'));
  if(mediaCategory==='autres')
   card.append(n('small','media-format-label',libraryTypeLabel(record)));
  if(hasImage)libraryPicture(card,record.name,localUrl,unused);
  libraryPreview(card,record.name,localUrl,String(record.type||'').startsWith('video/')?'videos':localCategory(record));
  libraryUnusedText(card,unused,hasImage);
  const locations=n('div','file-usage-links');
  for(const use of refs)locations.append(n('p','',use.page));
  card.append(locations);
  if(unused){
   const actions=n('div','file-actions'),del=b('Supprimer',()=>deleteFile(record),'sm');
   del.dataset.action='delete-unused-file';actions.append(del);card.append(actions);
  }
  cards.append(card);
 }
 const empty=n('p','hint','Aucun fichier ne correspond à votre recherche.');w.append(cards,empty);filterCards();
 if(mediaCategory==='audios'&&window.__STAGING_AUDIO__&&!LIVE_MEDIA_UPLOAD_HOST){
  const details=n('details','audio-import-section'),summary=n('summary','','Importer MP3 / WAV');
  details.append(summary);w.append(details);
  details.addEventListener('toggle',()=>{
   if(!details.open||details.dataset.loaded)return;
   details.dataset.loaded='true';
   // The file library manages files; insertion takes place only from a page editor.
   window.__STAGING_AUDIO__.render(details,{usages:cloudAudioUsages});
  });
 }
 if(globalFilesLoading&&!globalFiles)w.append(n('p','file-loading','Chargement…'));
}
/* Entire administration guide: static instructions, no remote services or writes.
   Each topic documents controls that exist in the live editor. */
const GUIDE_TOPICS=[
 {group:'Premiers pas',title:'Se connecter à l’administration',
  info:'Le site est public ; la modification des pages demande une connexion.',
  steps:['Depuis le site, choisissez « Administration » (ou ouvrez /admin.html).','Saisissez le code d’accès qui vous a été remis, puis « Ouvrir l’administration ».','Une fois connecté, choisissez Pages, Pages de bas de page, Célébrations ou Médiathèque.','La connexion est conservée pendant une durée limitée sur votre navigateur : si le formulaire réapparaît, reconnectez-vous.'],
  note:'Ne mettez pas le code d’accès dans les textes publics du site.'},
 {group:'Premiers pas',title:'Comprendre les onglets et les boutons du haut',
  info:'Chaque onglet ouvre directement son espace de travail.',
  steps:['Pages : accueil général et autres pages indépendantes des célébrations.','Pages de bas de page : pages dont les titres s’affichent en bas du site, après publication.','Célébrations : programme et pages de chaque célébration.','Médiathèque de l’administration : fichiers conservés à usage privé jusqu’à insertion et publication.','Mode d’emploi : ce guide, consultable à tout moment.','Aperçu : masquer les outils pour contrôler la page en cours. « Revenir à l’édition » permet de poursuivre.','Voir le site : ouvrir la page côté visiteur dans un nouvel onglet. « Enregistrer » conserve les modifications.']},
 {group:'Premiers pas',title:'Enregistrer et retrouver les mêmes pages sur deux appareils',
  info:'La page en cours peut changer visuellement avant d’être publiée dans la version commune.',
  steps:['Modifiez votre page ou votre bloc.','Appuyez sur « Enregistrer » en haut de l’administration.','Attendez un message confirmant « Enregistré sur le serveur ».','Rouvrez ou actualisez le site sur votre autre téléphone ou ordinateur.'],
  note:'« Enregistré dans ce navigateur » ne signifie pas « enregistré sur le serveur ». Les fichiers importés localement constituent un cas particulier : consultez aussi la rubrique Fichiers.'},
 {group:'Premiers pas',title:'Utiliser l’éditeur sur téléphone',
  info:'Les commandes sont identiques mais les zones et colonnes se placent les unes sous les autres.',
  steps:['Choisissez l’onglet puis la page à modifier.','Touchez un titre, un texte ou une image pour sélectionner son élément.','Si le clavier masque les boutons, fermez-le avec la commande Retour du téléphone.','Faites défiler la page pour voir les + et les menus de la zone.','En deux colonnes, elles s’empilent verticalement sur un écran étroit, mais restent côte à côte sur ordinateur.'],
  note:'Le + bleu et le + vert ne font pas la même chose : voir les rubriques consacrées aux zones.'},
 {group:'Pages et célébrations',title:'Modifier l’accueil général ou une page indépendante',
  info:'L’onglet Pages réunit les pages qui ne dépendent pas d’une célébration.',
  steps:['Ouvrez « Pages ».','Choisissez « Accueil général » ou une autre page dans la liste.','Touchez les textes, images et blocs pour les modifier.','Utilisez « + Page » pour créer une nouvelle page et lui donner un nom.','Enregistrez.'],
  note:'Les pages générales ne sont pas une copie des pages de chaque célébration.'},
 {group:'Pages et célébrations',title:'Changer l’ordre ou la page d’accueil',
  info:'Les options ⋯ des pages générales permettent de les organiser.',
  steps:['Dans Pages, repérez la page souhaitée.','Touchez « ⋯ » à côté de son nom.','Choisissez « Monter » ou « Descendre » pour la déplacer.','Utilisez « Définir comme accueil » si cette option est proposée.','Appuyez sur « Enregistrer » et vérifiez avec « Voir le site ».'],
  note:'La page déjà définie comme accueil n’affiche pas l’option pour se définir elle-même.'},
 {group:'Pages et célébrations',title:'Créer ou supprimer une page générale',
  info:'Seules les pages que vous créez peuvent être supprimées par ce menu.',
  steps:['Dans Pages, touchez « + Page » et indiquez son nom.','Pour supprimer une page créée, ouvrez « ⋯ » près de son nom puis « Supprimer la page ».','Lisez la confirmation avant de valider.','Enregistrez, puis contrôlez le résultat sur le site.'],
  note:'Les anciennes pages historiques sont protégées contre cette suppression.'},
 {group:'Pages et célébrations',title:'Choisir une célébration et ses étapes',
  info:'Chaque célébration possède ses propres pages, notamment Préparation et les jours de la semaine.',
  steps:['Ouvrez « Célébrations ».','Choisissez la célébration dans la liste déroulante.','Touchez la page à modifier : accueil de la célébration, préparation, mercredi, jeudi, vendredi, samedi, dimanche ou après célébration.','Modifiez le contenu puis enregistrez.'],
  note:'Vérifiez la célébration sélectionnée avant de modifier les dates ou les horaires.'},
 {group:'Pages et célébrations',title:'Créer une nouvelle célébration',
  info:'La commande « + Nouvelle célébration » prépare le prochain cycle.',
  steps:['Ouvrez Célébrations et développez « + Nouvelle célébration ».','Choisissez la date du mercredi de départ.','Contrôlez le titre proposé, ou personnalisez-le si besoin.','Touchez « Créer » puis ouvrez les pages de cette nouvelle célébration.','Complétez le programme et enregistrez.'],
  note:'Le jour de départ doit être un mercredi. Le titre automatiquement proposé suit le cycle des archanges.'},
 {group:'Pages et célébrations',title:'Modifier les dates et les horaires',
  info:'Les dates du programme et les heures d’événements sont des réglages distincts.',
  steps:['Dans Célébrations, choisissez le mercredi de la célébration : les dates des cinq jours en découlent.','Dans la page Préparation, utilisez « + Date » pour ajouter une date et × pour en retirer une.','Pour mercredi, jeudi, vendredi, samedi ou dimanche, sélectionnez l’heure de la page dans la liste par quarts d’heure ou saisissez une heure exacte au format HH:MM.','Un « Titre événement » peut aussi posséder son horaire propre, indépendant de l’heure de la page.','Enregistrez votre travail.'],
  note:'Les dates de préparation identiques sont refusées ; la saisie d’heure accepte notamment 18:30 et 18:32.'},
 {group:'Pages et célébrations',title:'Créer ou supprimer une page supplémentaire dans une célébration',
  info:'On peut ajouter une page au programme d’une célébration donnée.',
  steps:['Choisissez la célébration, puis « + Page » dans la liste de ses pages.','Donnez un nom à cette page supplémentaire.','Ajoutez les éléments souhaités et enregistrez.','Pour supprimer uniquement une page supplémentaire, utilisez « ⋯ » près de son nom puis « Supprimer la page ».'],
  note:'Les étapes historiques du programme ne se suppriment pas via ce menu.'},
 {group:'Pages et célébrations',title:'Créer des pages de bas de page',
  info:'Le titre d’une page publiée devient automatiquement un lien à côté d’Administration, tout en bas du site.',
  steps:['Ouvrez « Pages de bas de page ».','Cliquez sur « + Page de bas de page » et saisissez son titre.','Rédigez la page avec les mêmes outils que les pages générales.','Enregistrez le brouillon puis publiez la page pour faire apparaître son lien.','Les pages de bas de page ne figurent pas dans le menu principal.']},
 {group:'Pages et célébrations',title:'Médiathèques visibles par les visiteurs',
  info:'La médiathèque générale a été retirée du site public. Chaque célébration garde sa médiathèque.',
  steps:['Les fichiers restent accessibles dans la médiathèque de l’administration.','La médiathèque des visiteurs se limite aux fichiers insérés dans les pages publiées de cette célébration.','Les images des pages générales et des pages de bas de page ne sont pas ajoutées à la médiathèque d’une célébration.','Un élément ou un bloc masqué aux visiteurs ne doit pas être affiché dans leur médiathèque.']},
 {group:'Construire les blocs',title:'Différence entre le + bleu et le + vert',
  info:'C’est la distinction essentielle pour construire une page.',
  steps:['Le + BLEU apparaît au bas du bloc survolé sur ordinateur et ajoute une nouvelle zone ; sur téléphone, utilisez le + affiché après sélection.','Après le + bleu, choisissez « Bloc seul » ou « Deux colonnes ».','Le + VERT apparaît au survol d’un élément et ajoute un élément DANS la zone : titre, texte, image, bouton, vidéo, audio ou titre d’événement.','Répétez le + vert autant de fois que nécessaire pour composer votre zone.'],
  note:'Pour mettre une image et du texte dans un même cadre, utilisez le + vert, pas un nouveau + bleu.'},
 {group:'Construire les blocs',title:'Ajouter quelque chose dans un bloc déjà rempli',
  info:'Un ancien bloc avec seulement un titre, une image ou un texte peut devenir un bloc composé.',
  steps:['Touchez l’élément déjà présent pour le sélectionner.','Le petit + vert « Ajouter dans ce bloc » apparaît à l’intérieur du bloc.','Choisissez « Titre », « Image », « Texte », « Titre événement », « Bouton » ou « Vidéo ».','Le nouvel élément rejoint l’ancien dans le MÊME bloc, sans supprimer ni remplacer l’original.','Pour ajouter un troisième élément, utilisez le + vert de cette zone.'],
  note:'Après le premier ajout, le bloc simple devient une zone contenant plusieurs éléments. Aucun nouveau + bleu n’est nécessaire.'},
 {group:'Construire les blocs',title:'Créer une zone en deux colonnes',
  info:'Deux colonnes permettent de mettre, par exemple, une image à gauche et du texte à droite.',
  steps:['Touchez le + bleu à l’endroit voulu.','Choisissez « Deux colonnes ».','Utilisez le + vert de la colonne gauche ou droite pour ajouter ses éléments.','Touchez un élément et utilisez ← ou → pour le déplacer d’une colonne à l’autre.','Sur téléphone, les deux colonnes sont montrées l’une sous l’autre.'],
  note:'Chaque colonne garde son contenu et son ordre.'},
 {group:'Construire les blocs',title:'Passer de deux colonnes à une, et inversement',
  info:'Le petit bouton ▣ change la disposition de la zone.',
  steps:['Sur une zone, touchez ▣ « Passer à un bloc seul » ou « Passer à deux colonnes ».','En mode une colonne, tous les éléments des deux anciennes colonnes restent visibles, les uns à la suite des autres.','Si vous repassez à deux colonnes, les éléments retrouvent leur colonne d’origine.','Enregistrez après avoir choisi la disposition.'],
  note:'Changer la disposition ne supprime ni le texte ni les images.'},
 {group:'Construire les blocs',title:'Déplacer, dupliquer ou supprimer un élément',
  info:'Les commandes apparaissent quand on sélectionne l’élément.',
  steps:['Touchez l’élément à modifier.','↑ Monter et ↓ Descendre changent son ordre dans la même zone.','⧉ Dupliquer crée une copie immédiatement après l’élément.','✕ Supprimer retire cet élément après confirmation.','Dans une zone à deux colonnes, ← et → déplacent l’élément dans l’autre colonne.'],
  note:'Le bouton ✕ d’une zone entière est différent : il supprime toute cette zone et son contenu, après confirmation.'},
 {group:'Construire les blocs',title:'Ajouter un cadre, une bordure ou une ombre',
  info:'Le bouton ⚙ d’une zone règle le cadre du bloc complet.',
  steps:['Ouvrez les paramètres ⚙ de la zone.','Cadre : choisissez « Sans cadre », « Cadre arrondi » ou « Cadre carré ».','Choisissez la couleur et l’épaisseur du trait (1 à 5 px).','Activez ou désactivez « Ombre ».','Enregistrez et vérifiez dans l’aperçu.'],
  note:'Ces paramètres concernent toute la zone, pas seulement un paragraphe.'},
 {group:'Textes, images et liens',title:'Écrire et mettre en forme un titre ou un texte',
  info:'On peut écrire directement dans la page, sans formulaire séparé.',
  steps:['Touchez le titre ou le paragraphe, puis écrivez avec le clavier.','Sélectionnez des mots pour leur appliquer G (gras), I (italique) ou une couleur.','Sans sélection, ces commandes peuvent s’appliquer au bloc de texte entier.','La liste « px » change la taille du texte ; la liste d’alignement choisit Gauche, Centré ou Droite.','Touchez ailleurs, puis enregistrez.'],
  note:'Un titre principal et un titre secondaire peuvent avoir une taille différente ; vous pouvez toujours régler la taille manuellement.'},
 {group:'Textes, images et liens',title:'Ajouter, choisir ou remplacer une image',
  info:'Une image peut être choisie parmi les images du site ou envoyée depuis votre appareil.',
  steps:['Ajoutez « Image » avec le + vert de la zone concernée.','Touchez « Télécharger une image » pour choisir un fichier sur votre appareil, ou « Images du site » pour réutiliser une image déjà présente.','Une croix × et le bouton Annuler ferment la liste des images du site.','Pour remplacer une image existante, sélectionnez-la puis choisissez l’une de ces deux actions.','Enregistrez et vérifiez la page publique.'],
  note:'Les téléchargements directs d’images dans cet éditeur acceptent JPG, PNG ou WebP, jusqu’à 8 Mo. Les fichiers provenant du stockage local de l’appareil ne deviennent pas automatiquement des URL publiques.'},
 {group:'Textes, images et liens',title:'Réduire ou agrandir une image',
  info:'Le curseur règle la largeur d’affichage, sans déformer le fichier original.',
  steps:['Touchez une image déjà présente pour la sélectionner.','Repérez « Taille de l’image » et déplacez le curseur de 20 % à 100 %.','L’image change immédiatement de largeur ; sa hauteur s’adapte.','Utilisez « ↔ Aligner » si vous voulez aussi changer son alignement.','Cliquez sur « ✓ Valider » pour conserver ce réglage.'],
  note:'Le curseur ne réduit pas les dimensions ni le poids du fichier d’origine.'},
 {group:'Textes, images et liens',title:'Ajouter un bouton ou un lien vers un document',
  info:'Un bouton peut ouvrir un site HTTPS ou un chemin interne du site.',
  steps:['Ajoutez « Bouton » avec le + vert.','Touchez son libellé pour remplacer « Mon bouton » par le texte voulu.','Saisissez une adresse commençant par https:// ou un chemin du site commençant par /.','Pour associer un fichier, utilisez « 📎 Choisir un fichier ».','Utilisez « Miniature » pour choisir une image de présentation, et « ↔ Aligner » pour sa position.','Enregistrez puis testez le lien dans « Voir le site ».'],
  note:'Ne changez pas les URL de fichiers historiques qui ont déjà été envoyées par e-mail.'},
 {group:'Textes, images et liens',title:'Ajouter une vidéo ou une miniature',
  info:'La page peut montrer un aperçu de vidéo relié à son adresse.',
  steps:['Ajoutez « Vidéo » avec le + vert.','Renseignez le lien YouTube, Vimeo ou HTTPS de la vidéo.','Donnez un titre à la vidéo si le champ est proposé.','Choisissez ou remplacez la miniature si cette commande apparaît.','Enregistrez et testez le lien depuis la vue du site.'],
  note:'La vidéo reste hébergée à son adresse d’origine ; le lien ne télécharge pas nécessairement une vidéo sur le serveur Célébrations.'},
 {group:'Textes, images et liens',title:'Ajouter un titre d’événement et son heure',
  info:'Un événement dispose d’un titre et peut afficher une heure avant son texte.',
  steps:['Dans la zone souhaitée, appuyez sur le + vert puis « Titre événement ».','Touchez le texte « Titre de l’événement » pour le remplacer.','Choisissez son heure dans la liste (par pas de 15 minutes) ou saisissez HH:MM.','Enregistrez.'],
  note:'L’heure de l’événement est distincte de l’horaire général affiché pour le jour de la célébration.'},
 {group:'Fichiers et audio',title:'Comprendre l’onglet Fichiers et les catégories',
  info:'Le catalogue regroupe les ressources publiques existantes et certains fichiers importés sur l’appareil.',
  steps:['Ouvrez « Fichiers ».','Choisissez la catégorie : Images, PDF, Audios ou Autres.','Utilisez « Ouvrir » pour consulter une ressource.','Les liens d’utilisation indiquent dans quelles célébrations et pages certains fichiers publics sont référencés.','Utilisez « Insérer » pour associer un fichier à une page.'],
  note:'Les fichiers historiques disposent d’adresses publiques déjà utilisées : il faut les conserver.'},
 {group:'Fichiers et audio',title:'Insérer un fichier dans une célébration et à une heure',
  info:'Le bouton « Insérer » ouvre un petit formulaire.',
  steps:['Dans Fichiers, choisissez la catégorie et la ressource.','Touchez « Insérer ».','Sélectionnez la célébration et la page/jour souhaités.','Choisissez une heure si la ressource doit être placée dans le programme à un horaire précis.','Validez « Insérer », puis ouvrez la page pour vérifier son emplacement.','Appuyez sur « Enregistrer » pour enregistrer le brouillon commun.'],
  note:'L’insertion sur d’autres célébrations peut d’abord créer un brouillon local dans votre navigateur : vérifiez toujours la confirmation serveur de la célébration cible.'},
 {group:'Fichiers et audio',title:'Importer de nouveaux fichiers',
  info:'« + Importer » ajoute des fichiers à la bibliothèque locale du navigateur.',
  steps:['Dans Médiathèque, choisissez Audios puis « + Importer un MP3 » pour un audio ; les autres catégories utilisent « + Importer ».','Choisissez un ou plusieurs fichiers compatibles : images, PDF, MP3, WAV, texte ou document.','Le MP3 affiche sa progression réelle pendant le transfert (25 Mo maximum sur le site officiel). À la fin, il apparaît dans Audios.','Utilisez ensuite « Insérer » si vous voulez le placer dans une page.'],
  note:'Important : cet import classique conserve le fichier sur CET APPAREIL (limite de 60 Mo par fichier). Il ne garantit pas qu’il sera disponible sur un autre appareil ni en public. Pour un lien durable, privilégiez un fichier déjà publié dans le catalogue du site.'},
 {group:'Fichiers et audio',title:'Ajouter un MP3, convertir un WAV et l’écouter',
  info:'Les ressources audio peuvent être lues et insérées dans le programme.',
  steps:['Dans Médiathèque, choisissez « Audios » pour retrouver les MP3.','Dans la page à modifier, ajoutez « Lecteur audio » à un bloc, puis « Choisir un MP3 ». Depuis Audios, cliquez sur « Insérer dans le lecteur ».','La rubrique « Importer MP3 / WAV » de l’atelier de test n’est pas l’import officiel : sur le site, utilisez « Importer un MP3 » et sa barre de progression.','Le lecteur possède les commandes de lecture et un titre personnalisable. Enregistrez puis publiez la page.'],
  note:'Certaines commandes de stockage audio nécessitent une connexion spécifique au service audio : si l’interface la demande, ne confondez pas avec le simple code de l’administration.'},
 {group:'Fichiers et audio',title:'Supprimer un fichier sans casser ses liens',
  info:'Les fichiers utilisés sont protégés contre une suppression accidentelle.',
  steps:['Dans Fichiers, repérez les ressources et leurs utilisations.','Un fichier local inutilisé peut afficher « Supprimer » et demander confirmation.','Si un fichier est encore utilisé, retirez d’abord ses références des pages concernées.','Pour les fichiers publics historiques, la suppression physique n’est pas proposée avant vérification des références.'],
  note:'Retirer une image d’une page avec « Supprimer l’image » ne supprime pas son fichier de la bibliothèque. Ne remplacez pas un ancien lien PDF par un nouveau chemin si ce lien a déjà été transmis.'},
 {group:'Vérification et sécurité',title:'Aperçu, vue du site et mise en ligne',
  info:'Vérifiez le résultat avant de partager une page.',
  steps:['Dans l’éditeur, utilisez « Aperçu » pour masquer les commandes sans changer de page.','Appuyez sur « Revenir à l’édition » pour poursuivre les modifications.','Utilisez « Voir le site » pour ouvrir la version visible par les visiteurs.','Après un changement, cliquez sur « Enregistrer », attendez le message du serveur puis actualisez la vue publique.'],
  note:'« Aperçu » ne sauvegarde pas et ne publie pas à lui seul vos modifications.'},
 {group:'Vérification et sécurité',title:'Vérifier les liens anciens et les fichiers manquants',
  info:'Les URL des fichiers envoyés dans des e-mails doivent continuer à fonctionner.',
  steps:['Ouvrez la page publique et testez les boutons et les liens des documents.','Pour une image manquante, vérifiez qu’elle pointe vers une image publique existante.','Ne renommez pas les chemins des anciens fichiers PDF, MP3 ou images sans disposer d’une redirection contrôlée.','Dans le doute, ne supprimez pas le fichier : signalez son adresse pour une vérification.'],
  note:'Une image seulement stockée localement dans un navigateur peut ne pas apparaître sur un autre appareil.'},
 {group:'Vérification et sécurité',title:'En cas de problème ou de bouton introuvable',
  info:'Quelques vérifications simples suffisent souvent à retrouver une commande.',
  steps:['Touchez d’abord le bloc : beaucoup de commandes n’apparaissent que lorsqu’il est sélectionné.','Fermez le clavier du téléphone pour voir le bas du bloc et le petit + vert.','Si vous cherchez un nouveau bloc, regardez le + bleu situé entre les zones.','Actualisez l’administration si vous voyez encore l’ancienne interface.','Vérifiez le message sous l’éditeur : une sauvegarde locale et une sauvegarde serveur ne sont pas équivalentes.'],
  note:'Évitez de supprimer ou réinitialiser quoi que ce soit pour résoudre un problème d’affichage.'}
];
function userGuide(){
 const root=n('section','editor-guide'),header=n('header','guide-intro');
 header.append(n('h1','','Mode d’emploi du site'),n('p','',
  'Toutes les commandes de l’administration, expliquées pas à pas. Touchez une rubrique pour lire les instructions.'));
 const bar=n('div','guide-controls'),input=n('input','guide-search');
 input.type='search';input.placeholder='Rechercher : image, colonne, PDF, enregistrement…';
 input.setAttribute('aria-label','Rechercher dans le mode d’emploi');
 const count=n('span','guide-count');
 const all=b('Tout ouvrir',()=>setAll(true),'sm'),none=b('Tout fermer',()=>setAll(false),'sm');
 bar.append(input,all,none,count);root.append(header,bar);
 const results=n('div','guide-results'),empty=n('p','guide-empty','Aucune rubrique trouvée. Essayez un autre mot.');
 root.append(results,empty);w.append(root);
 const fold=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const topics=[];
 for(const topic of GUIDE_TOPICS){
  const details=n('details','guide-topic'),summary=n('summary','guide-topic-title',topic.title);
  const description=n('p','guide-topic-info',topic.info);
  const ordered=n('ol','guide-topic-steps');
  for(const step of topic.steps)ordered.append(n('li','',step));
  details.append(summary,description,ordered);
  if(topic.note)details.append(n('p','guide-topic-note','À retenir : '+topic.note));
  topics.push({topic,details,haystack:fold([topic.group,topic.title,topic.info,
    ...topic.steps,topic.note||''].join(' '))});
 }
 function setAll(open){
  for(const x of topics)if(!x.details.hidden)x.details.open=open;
 }
 function display(){
  const query=fold(input.value.trim()),words=query.split(/\s+/).filter(Boolean);
  results.replaceChildren();
  let shown=0,group='',groupRoot=null;
  for(const item of topics){
   const visible=words.every(word=>item.haystack.includes(word));
   item.details.hidden=!visible;
   if(!visible)continue;
   if(group!==item.topic.group){
    group=item.topic.group;
    const wrapper=n('section','guide-group');
    const heading=n('h2','',group);
    groupRoot=n('div','guide-group-topics');
    wrapper.append(heading,groupRoot);results.append(wrapper);
   }
   item.details.open=words.length>0;
   groupRoot.append(item.details);shown++;
  }
  count.textContent=shown+' rubrique'+(shown>1?'s':'');
  empty.hidden=shown>0;
 }
 input.addEventListener('input',display);
 display();
}

function settings(){
 // A single persisted switch; changing it never writes access policies.
 const mode=n('section','settings-actions m021b-admin-mode');
 const modeCss=n('style');modeCss.nonce=document.querySelector('script[nonce]')?.nonce||'';
 modeCss.textContent='.m021b-admin-mode{border:1px solid #cad7d8;border-radius:12px;padding:14px;margin:0 0 16px;max-width:790px}.m021b-mode-choice{display:flex;align-items:center;gap:12px;min-height:46px;cursor:pointer;font-weight:600}.m021b-mode-choice input{flex:0 0 auto;min-width:22px;min-height:22px;accent-color:#246a59}.m021b-admin-mode p{margin:.4rem 0;line-height:1.45}.m021-private-warning{color:#805316;background:#fff7dd;padding:.6rem;border-radius:8px;font-size:.93rem}.stage-editor [data-tab="members-spaces"][hidden]{display:none!important}@media(max-width:600px){.m021b-admin-mode{padding:12px}.m021b-mode-choice{align-items:flex-start}}';
 const modeTitle=n('h2','','Mode de l’administration'),modeLabel=n('label','m021b-mode-choice');
 const modeCheck=n('input');modeCheck.type='checkbox';modeCheck.checked=adminMembersEnabled;
 modeCheck.disabled=!adminModeLoaded;
 modeCheck.setAttribute('aria-label','Activer la gestion des membres et des accès privés');
 modeLabel.append(modeCheck,n('span','','Activer la gestion des membres et des accès privés'));
 const modeHelp=n('p','',adminMembersEnabled?
  'Mode complet : membres, catégories et autorisations privées accessibles.':
  'Mode simplifié : uniquement les fonctions nécessaires au site public.');
 const modeStatus=n('p');modeStatus.setAttribute('role','status');
 if(!adminModeLoaded)modeStatus.textContent='Réglage indisponible : actualisez la page avant de le modifier.';
 mode.append(modeCss,modeTitle,modeLabel,modeHelp,modeStatus);
 w.append(mode);
 modeCheck.onchange=async()=>{
  const desired=modeCheck.checked;
  modeCheck.disabled=true;modeStatus.textContent='Enregistrement du mode…';
  try{
   // Obtain the current revision, refusing to overwrite newer editor data.
   const fresh=await fetch('/api/site-identity',{credentials:'same-origin',cache:'no-store'});
   const snapshot=await fresh.json();
   if(!fresh.ok||!snapshot.ok)throw Error(snapshot.error||'Réglage indisponible');
   if(snapshot.memberAccessUiEnabled!==adminMembersEnabled)
    throw Error('Le mode a changé sur un autre appareil. Actualisez les paramètres.');
   const response=await fetch('/api/site-identity',{method:'POST',credentials:'same-origin',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({expectedRevision:snapshot.revision,memberAccessUiEnabled:desired})});
   const result=await response.json();
   if(!response.ok||!result.ok)throw Error(result.error||'Enregistrement refusé');
   adminModeRevision=result.revision;adminMembersEnabled=result.memberAccessUiEnabled===true;
   modeStatus.textContent='✓ Mode enregistré.';
   render(); // Existing menu and form commands update immediately.
  }catch(error){
   modeCheck.checked=adminMembersEnabled;
   modeStatus.textContent='❌ '+(error.message||error);
  }finally{modeCheck.disabled=false;}
 };

}
function m018LanguagesCategories(){
  const panel=n('section','m018-language-panel');
  panel.append(n('h2','','Langues'));
  panel.append(n('p','','Les huit langues sont prêtes. Une langue apparaît sur le site dès qu’un contenu publié est accessible. Les textes des pages sont rédigés par l’administrateur.'));
  const form=n('form','m018-language-form');
  const input=n('input');input.type='text';input.required=true;input.maxLength=120;
  input.placeholder='Nom de la langue';input.setAttribute('aria-label','Nom de la nouvelle langue');
  const add=n('button','btn sm','＋ Ajouter une langue');add.type='submit';
  form.append(input,add);
  form.onsubmit=event=>{
   event.preventDefault();const name=input.value.trim();if(!name)return;
   const labels={francais:'fr',anglais:'en',espagnol:'es',allemand:'de',italien:'it',
    portugais:'pt',neerlandais:'nl',polonais:'pl',russe:'ru',arabe:'ar',chinois:'zh'};
   const key=name.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
   const code=labels[key]||'und-'+crypto.randomUUID().replaceAll('-','').slice(0,8);
   try{
    editorLocalization.registry=addLanguage(editorLocalization.registry,{id:code,name,flag:'',active:true});
    mark();save();void serverSave();render();
   }catch(e){siteNotice(e.message||String(e))}
  };
  panel.append(form);
  const rows=n('div','m018-language-list');
  for(const language of editorLocalization.registry.languages){
   const row=n('div','m018-language-entry');
   const name=n('input');name.value=language.name;name.maxLength=120;
   name.setAttribute('aria-label','Renommer '+language.name);
   const rename=b('Renommer',()=>{
    try{
     editorLocalization.registry=renameLanguage(editorLocalization.registry,language.id,name.value.trim());
     mark();save();void serverSave();render();
    }catch(e){siteNotice(e.message||String(e))}
   },'sm');
   row.append(name,rename);rows.append(row);
  }
  panel.append(rows);
  w.append(panel);

 }
let catalogueTab='languages',privateCatalogue=null,availableCategories=[];
function ensureMemberPanel(){
 if(memberPanel)return;
 memberPanelRoot=n('div','real-member-spaces');
 memberPanel=M012B.mount(memberPanelRoot,{celebrations:celebrationEntries(),currentCelebrationId:String(STAGE_SEED.celebrationId),
  styleNonce:document.querySelector('script[nonce]')?.nonce,css:M012B.css,onEditPage:openPrivatePage,
  onCategories:types=>{availableCategories=types;},
  onSessionChange:active=>{if(!active&&privateEdit)closePrivatePage(true);}});
 void memberPanel.readContent().then(value=>{privateCatalogue=value;if(['pages','footer','celebrations'].includes(tab))render()}).catch(()=>{});
}
function memberSpaces(){
 if(!IS_STAGE||typeof M012B==='undefined')return;
 if(!adminMembersEnabled){m018LanguagesCategories();return;}
 ensureMemberPanel();
 if(tab==='languages-categories'){
  const tabs=n('div','member-spaces-actions');
  tabs.append(b('Langues',()=>{catalogueTab='languages';render()}),b('Catégories',()=>{catalogueTab='categories';render()}));w.append(tabs);
  if(catalogueTab==='languages'){m018LanguagesCategories();return}
  memberPanel.showCategories();
 }else memberPanel.showMembers();
 w.append(memberPanelRoot);
}
async function refreshPrivateCatalogue(){
 privateCatalogue=await memberPanel.readContent();
}
async function editAccess(kind,p){
 try{
  ensureMemberPanel();
  if(dirty||db._serverPending){save();await serverSave();if(db._serverPending)return}
  const current=await memberPanel.readContent(),types=await memberPanel.categories();
  const old=kind==='celebration'?current.celebrationAccessPolicy:p.accessPolicy||{mode:'PUBLIC'};
  const active=types.filter(t=>!t.disabled);
  const fields=[{name:'mode',label:'Accès',radio:true,value:old.mode==='PUBLIC'?'PUBLIC':'PRIVATE',options:[['PUBLIC','Public'],['PRIVATE','Privé']]}];
  if(active.length)fields.push({name:'scope',label:'Si privé',radio:true,value:old.mode==='SELECTED_TYPES'?'selected':'registered',options:[['registered','Tous les inscrits à cette célébration'],['selected','Catégories sélectionnées']]},{name:'types',label:'Catégories',multiple:true,value:old.typeIds||[],options:active.map(t=>[t.id,t.name])});
  const result=await siteDialog({title:kind==='celebration'?'Accès à la célébration':'Accès à la page',fields,confirm:'Enregistrer'});
  if(!result)return;
  const accessPolicy=result.mode==='PUBLIC'?{mode:'PUBLIC'}:result.scope==='selected'?{mode:'SELECTED_TYPES',typeIds:result.types}:{mode:'ALL_PRIVATE_TYPES'};
  if(accessPolicy.mode==='SELECTED_TYPES'&&!accessPolicy.typeIds.length){siteNotice('Choisissez au moins une catégorie.');return}
  await memberPanel.commandContent(kind==='celebration'?'celebration-access':'page-access',{...(kind==='page'?{id:p.id}:{}),accessPolicy});
  await serverLoad();await refreshPrivateCatalogue();render();
  status.textContent=kind==='page'?'Accès enregistré. Publiez la page quand elle sera prête.':'Accès enregistré.';
 }catch(e){siteNotice('Enregistrement impossible : '+e.message)}
}
function privatePageButtons(group,mount){
 for(const p of privateCatalogue?.record?.pages||[]){
  if(!p.privateManaged)continue;
  const pg=p.group==='page'?(p.placement==='footer'?'footer':'page'):'celebration';
  if(pg!==group)continue;
  const row=n('div','general-page-row');row.append(b(p.name+' · Privé',()=>openManagedPage(p.id)),b('Accès',()=>editAccess('page',p),'sm'));mount.append(row);
 }
}
async function openManagedPage(pageId,language='fr'){
 try{
  await refreshPrivateCatalogue();
  const canonical=()=>privateCatalogue.record.pages.find(x=>x.id===pageId);
  const localized=()=>language==='fr'?clone(canonical()):{...clone(canonical()),name:canonical().translations?.[language]?.name||'Titre à rédiger',blocks:clone(canonical().translations?.[language]?.blocks||[])};
  if(!canonical())return;
  const command=async(action,fields)=>{privateCatalogue=await memberPanel.commandContent(action,fields);return localized()};
  openPrivatePage({languageId:language,page:localized(),
   save:async({name,blocks})=>{const original=clone(canonical());if(language==='fr'){original.name=name;original.blocks=blocks}else original.translations={...original.translations,[language]:{name,blocks}};return command('save',{pages:[original]})},
   reload:async()=>{await refreshPrivateCatalogue();return localized()},
   publish:()=>command('publish',{kind:'page',id:pageId}),unpublish:(visibility='draft')=>command('unpublish',{kind:'page',id:pageId,visibility}),
   isPublished:()=>privateCatalogue.pageReleases.some(r=>r.pageId===pageId)});
 }catch(e){siteNotice(e.message)}
}
async function showContentVersions(){
 try{
  ensureMemberPanel();if(dirty){save();await serverSave();if(db._serverPending)return}
  availableCategories=await memberPanel.categories();await refreshPrivateCatalogue();
  w.replaceChildren();w.append(b('← Célébrations',()=>{tab='celebrations';render()}));
  memberPanel.showSpaces();w.append(memberPanelRoot);
 }catch(e){siteNotice('Versions indisponibles : '+e.message)}
}
async function duplicateChoice(entry){
 if(!entry)return;
 if(!adminMembersEnabled)return m018DuplicateCelebration(entry);
 if(dirty||db._serverPending){
  siteNotice('Enregistrez vos modifications de contenu avant de créer une version.');
  return;
 }
 try{
  ensureMemberPanel();
  const pages=db.pages.filter(p=>p.group==='celebration'&&
   p.id.endsWith('-'+String(STAGE_SEED.celebrationId)))
   .map(p=>({name:p.name,group:p.group,blocks:clone(p.blocks||[]),
    translations:clone(editorLocalization.pages[p.id]||{})}));
  const created=await memberPanel.duplicateCelebrationVersion(pages,celebrationLabel(entry));
  if(created)status.textContent='✓ Version créée en brouillon : '+celebrationLabel(entry)+' — '+created.category+' — '+created.language+' ('+created.pages+' pages).';
 }catch(e){siteNotice('Duplication impossible : '+(e.message||e))}
}
function accessControls(kind,p){
 const box=n('div','m020-access'),label=n('label','editor-language-choice','Accès'),select=n('select');
 select.setAttribute('aria-label','Accès '+(kind==='page'?'de la page':'à la célébration'));
 const currentSpace=p.spaceId?privateCatalogue?.record.spaces.find(s=>s.id===p.spaceId):null;
 const original=currentSpace?
  (currentSpace.visibility==='PUBLIC'?{mode:'PUBLIC'}:
   currentSpace.accessPolicy.mode==='PUBLIC'?{mode:'ALL_PRIVATE_TYPES'}:currentSpace.accessPolicy):
  kind==='celebration'?privateCatalogue?.celebrationAccessPolicy:p.accessPolicy;
 let confirmed=clone(original||{mode:'PUBLIC'}),busy=false;
 for(const [value,title]of [['PUBLIC','Public'],['PRIVATE','Privé']]){
  const option=n('option','',title);option.value=value;select.append(option);
 }
 const categories=n('fieldset');categories.append(n('legend','','Catégories'));
 const all=n('input');all.type='checkbox';
 const allLabel=n('label','','Tous les inscrits à cette célébration');allLabel.prepend(all);categories.append(allLabel);
 const checks=[];
 for(const type of availableCategories.filter(t=>!t.disabled)){
  const check=n('input');check.type='checkbox';check.value=type.id;
  const item=n('label','',type.name);item.prepend(check);categories.append(item);checks.push(check);
 }
 const toggle=()=>{categories.hidden=select.value!=='PRIVATE'};
 const restore=()=>{
  select.value=confirmed.mode==='PUBLIC'?'PUBLIC':'PRIVATE';
  all.checked=confirmed.mode!=='SELECTED_TYPES';
  checks.forEach(c=>{c.checked=!!confirmed.typeIds?.includes(c.value)});
  toggle();
 };
 const policyFromFields=()=>{
  const typeIds=checks.filter(c=>c.checked).map(c=>c.value);
  return select.value==='PUBLIC'?{mode:'PUBLIC'}:
   all.checked?{mode:'ALL_PRIVATE_TYPES'}:
   typeIds.length?{mode:'SELECTED_TYPES',typeIds}:null;
 };
 const widens=(before,after)=>
  before.mode!=='PUBLIC'&&(after.mode==='PUBLIC'||
   before.mode==='SELECTED_TYPES'&&(after.mode==='ALL_PRIVATE_TYPES'||
    after.mode==='SELECTED_TYPES'&&after.typeIds.some(id=>!before.typeIds?.includes(id))));
 async function autoSaveAccess(){
  if(busy)return;
  const next=policyFromFields();
  if(!next){status.textContent='Sélectionnez une catégorie ou « Tous les inscrits ». ';return}
  if(JSON.stringify(next)===JSON.stringify(confirmed))return;
  // Access changes must not trigger a hidden content save or discard local edits.
  if(dirty||db._serverPending||privateBusy){
   restore();siteNotice('Enregistrez d’abord vos modifications de contenu avant de changer les accès.');return;
  }
  if(widens(confirmed,next)&&!await siteConfirm('Cette modification élargit les accès au contenu. Confirmer ?')){
   restore();return;
  }
  busy=true;for(const input of [select,all,...checks])input.disabled=true;
  try{
   ensureMemberPanel();
   if(currentSpace){
    const spaces=clone(privateCatalogue.record.spaces);
    const target=spaces.find(s=>s.id===currentSpace.id);
    if(!target)throw Error('Espace introuvable');
    target.visibility=next.mode==='PUBLIC'?'PUBLIC':'PRIVATE';
    target.accessPolicy=next.mode==='ALL_PRIVATE_TYPES'?{mode:'PUBLIC'}:next;
    await memberPanel.commandContent('save',{spaces});
   }else{
    await memberPanel.commandContent(kind==='page'?'page-access':'celebration-access',{
     ...(kind==='page'?{id:p.id}:{}),accessPolicy:next
    });
   }
   confirmed=clone(next);
   if(privateEdit)await closePrivatePage(true);
   else await serverLoad();
   await refreshPrivateCatalogue();render();
   status.textContent='✓ Accès enregistré automatiquement.';
  }catch(error){
   restore();
   status.textContent='❌ Changement d’accès refusé : '+(error.message||error);
  }finally{
   busy=false;for(const input of [select,all,...checks])input.disabled=false;
  }
 }
 select.onchange=()=>{toggle();void autoSaveAccess()};
 all.onchange=()=>{if(all.checked)checks.forEach(c=>c.checked=false);void autoSaveAccess()};
 checks.forEach(check=>{check.onchange=()=>{
  if(check.checked)all.checked=false;
  void autoSaveAccess();
 }});
 restore();label.append(select);box.append(label,categories);
 return box;
}
async function openPrivatePage(controller){
 if(privateEdit||!controller?.page||dirty)return;
 try{await refreshPrivateCatalogue()}catch(e){siteNotice(e.message);return}
 if(privateEdit)return;
 privateReturn={db,id,tab};privateEdit=controller;
 db={...db,pages:[{...clone(controller.page),group:controller.page.group||'celebration'}],_serverPending:false};
 id=controller.page.id;tab='celebrations';preview=false;dirty=false;
 selectedBlockId=null;blockEditSession=null;clearLocaleView();editingLanguageId='fr';
 resetUndoHistory();render();
}
async function closePrivatePage(force=false){
 if(!privateEdit||privateBusy)return;
 if(!force&&dirty&&!(await siteConfirm('Abandonner les modifications de cette page non enregistrées ?')))return;
 db=privateReturn.db;id=privateReturn.id;tab=privateReturn.tab;
 privateReturn=null;privateEdit=null;dirty=false;preview=false;
 selectedBlockId=null;blockEditSession=null;clearLocaleView();resetUndoHistory();
 await serverLoad();await refreshPrivateCatalogue();render();
}
async function savePrivatePage(){
 if(!privateEdit||privateBusy)return false;
 const current=page();
 privateBusy=true;
 try{
  const saved=await privateEdit.save({name:current.name,blocks:clone(current.blocks)});
  if(!saved||saved.id!==id)throw Error('Confirmation de page invalide');
  db.pages=[{...clone(saved),group:saved.group||'celebration'}];dirty=false;db._serverPending=false;
  resetUndoHistory();render();status.textContent='✓ Page enregistrée.';
  return true;
 }catch(e){status.textContent='❌ Enregistrement canonique refusé : '+(e.message||e);return false}
 finally{privateBusy=false;render();}
}
async function reloadPrivatePage(){
 if(!privateEdit||privateBusy||dirty&&!(await siteConfirm('Abandonner les modifications non enregistrées ?')))return;
 privateBusy=true;
 try{const loaded=await privateEdit.reload();db.pages=[{...clone(loaded),group:loaded.group||'celebration'}];dirty=false;resetUndoHistory();render();status.textContent='✓ Page rechargée.';}
 catch(e){status.textContent='❌ Rechargement refusé : '+(e.message||e)}
 finally{privateBusy=false;render();}
}
async function publishPrivatePage(action,visibility='draft'){
 if(!privateEdit||privateBusy)return;
 if(dirty&&!await savePrivatePage())return;
 privateBusy=true;
 try{await privateEdit[action](visibility);if(action==='unpublish')page().visibility=visibility;render();status.textContent=action==='publish'?'✓ Page publiée explicitement.':'✓ Page dépubliée.';}
 catch(e){status.textContent='❌ Publication refusée : '+(e.message||e)}
 finally{privateBusy=false;render();}
}
function privatePageWorkspace(){
 const selectors=n('div','editor-language-row');
 const langLabel=n('label','editor-language-choice','Langue'),lang=n('select');lang.setAttribute('aria-label','Langue');
 lang.value=privateEdit.languageId||'fr';
 lang.onchange=async()=>{if(dirty&&!await savePrivatePage())return;const language=lang.value,title=page().name,type=privateCatalogue.record.spaces.find(s=>s.id===page().spaceId)?.accessPolicy.typeIds?.[0]||'',pid=page().id,sid=page().spaceId;await closePrivatePage(true);if(sid)await memberPanel.openVersion(type,language,title);else await openManagedPage(pid,language)};
 langLabel.append(lang);selectors.append(langLabel);
 if(adminMembersEnabled)selectors.append(accessControls('page',page()));
 else selectors.append(n('p','m021-private-warning','Page privée existante : les droits sont conservés. Réactivez le mode complet pour les modifier.'));
 const visibilityLabel=n('label','editor-language-choice','Visibilité'),visibility=n('select');visibility.setAttribute('aria-label','Visibilité de la page');
 for(const [value,label]of [['draft','Brouillon'],['published','Visible'],['hidden','Masqué']]){const option=n('option','',label);option.value=value;visibility.append(option)}visibility.value=privateEdit.isPublished()?'published':page().visibility==='hidden'?'hidden':'draft';
 visibility.onchange=()=>void publishPrivatePage(visibility.value==='published'?'publish':'unpublish',visibility.value);visibilityLabel.append(visibility);selectors.prepend(visibilityLabel);w.append(selectors);
 const actions=n('div','member-spaces-actions');
 const back=b('← Célébrations',()=>closePrivatePage());
 const saveButton=b('Enregistrer',()=>void savePrivatePage());
 const reload=b('Recharger',()=>void reloadPrivatePage());
 const publish=b('Publier cette page',()=>void publishPrivatePage('publish'));
 const unpublish=b('Dépublier cette page',()=>void publishPrivatePage('unpublish'));
 back.disabled=privateBusy;saveButton.disabled=privateBusy;
 reload.disabled=privateBusy;publish.disabled=privateBusy;unpublish.disabled=privateBusy;
 actions.append(back,saveButton,reload);
 w.append(actions,n('h2','',page().name));
 const editor=n('div','celebration-editor');w.append(editor);pageWorkspace(page().group==='page'?(page().placement==='footer'?'footer':'page'):'celebration',editor);
}
function render(){
 if(!adminMembersEnabled&&['members-spaces','participants'].includes(tab))tab='pages';
 applyAdminMenu();
 const inMembers=['members-spaces','participants','languages-categories'].includes(tab);
 document.querySelector('.stage-editor')?.classList.toggle('is-catalogue',inMembers);
 const result=renderEditorFrame({IS_STAGE,document,STAGE_SEED,page,pageSlug,stateOfPage,editorDragState,editorDragFinish,undoAnchor,resetUndoHistory,ensureUndoButton,applyPalette,w,tab,preview,el,pages,footerPages,celebrations:privateEdit?privatePageWorkspace:celebrations,media,userGuide,settings,memberSpaces});
 for(const key of ['save-btn','preview-btn','undo-btn','status']){
  const control=el(key);if(control)control.hidden=inMembers||!!privateEdit&&key==='save-btn';
 }
 if((inMembers||privateEdit)&&el('view-site-btn'))el('view-site-btn').hidden=true;
 syncSecondarySave();
 return result;
}
bindEditorShell({document,window,el,enter,onPreview:()=>{preview=!preview;selectedBlockId=null;blockEditSession=null;render()},isPreview:()=>preview,deselect:()=>{selectedBlockId=null;blockEditSession=null;document.querySelectorAll('.canvas .block.is-selected').forEach(box=>box.classList.remove('is-selected'))},shouldWarnBeforeUnload:()=>{if(memberPanel?.changed)return true;if(dirty||(IS_STAGE&&(db._serverPending||serverSaving)))return true;return false}});
el('save-btn').onclick=saveCurrentContent;
el('image-input').onchange=async function(){
 const file=this.files&&this.files[0],x=target;this.value='';
 if(!file||!x)return;
 if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>8000000){
  siteNotice('Image JPG, PNG ou WebP de moins de 8 Mo.');return;
 }
 const source=URL.createObjectURL(file),img=new Image();
 try{
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=source});
  const ratio=Math.min(1,1200/Math.max(img.width,img.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(img.width*ratio));
  canvas.height=Math.max(1,Math.round(img.height*ratio));
  canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.84));
  if(!blob)throw Error('Conversion de l’image impossible');
  if(IS_STAGE&&LIVE_MEDIA_UPLOAD_HOST){
   const record=await uploadToMediaServer(new File([blob],file.name.replace(/\.[^.]+$/,'.jpg'),{type:'image/jpeg'}));
   if(imageCoverTarget){x.cover=record.src;delete x.coverAssetId}
   else{x.src=record.src;delete x.assetId;x.text=file.name}
   mark();render();
  }else{
   const record={id:crypto.randomUUID(),name:file.name,type:'image/jpeg',size:blob.size,
    createdAt:new Date().toISOString(),blob};
   await fileOperation('put',record);rememberFile(record);
   if(imageCoverTarget){x.coverAssetId=record.id;x.cover=''}
   else{x.assetId=record.id;x.src='';x.text=file.name}
   mark();render();
  }
 }catch(e){siteNotice('L’image n’a pas été ajoutée : '+(e.message||e)+'. Le contenu précédent est intact.')}
 finally{URL.revokeObjectURL(source);target=null;imageCoverTarget=false}
};

const uploadPicker=n('input');uploadPicker.id='asset-file-picker';uploadPicker.type='file';uploadPicker.accept=IS_STAGE&&LIVE_MEDIA_UPLOAD_HOST?'.pdf,.txt,.docx,.jpg,.jpeg,.png,.webp,.mp3,.wav':'.pdf,.txt,.doc,.docx,.odt,.rtf,.csv,image/*,audio/*,video/*';uploadPicker.multiple=true;uploadPicker.hidden=true;document.body.append(uploadPicker);
uploadPicker.onchange=async()=>{const files=[...uploadPicker.files];uploadPicker.value='';await importFiles(files)};
if(IS_STAGE){await loadAdminMode();await serverLoad();if(db._serverPending){serverDiverged=false;await serverSave();}}
render();loadFiles();

})();