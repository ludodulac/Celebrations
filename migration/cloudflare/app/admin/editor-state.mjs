// M06: local initialization is pure except for the injected storage read.
// Both the demonstration and the real editor use the same existing IDs and key.
export function createEditorState({STAGE_SEED,KEY,seed,clone,storage,search}){
if(STAGE_SEED)seed.pages=STAGE_SEED.pages;
let db;try{db=JSON.parse(storage.getItem(KEY)||'null')}catch{}
if(!db||!Array.isArray(db.pages))db=clone(seed);
if(STAGE_SEED){
 // Existing local edits take precedence; old historical pages are appended.
 for(const archived of seed.pages)
  if(!db.pages.some(p=>p.id===archived.id))db.pages.push(clone(archived));
 for(const official of seed.pages){
  const previous=db.pages.find(p=>p.id===official.id);
  if(!previous)continue;
  if(official.id.startsWith('apres-celebration-')&&previous.name==='Après préparation')
   previous.name='Après célébration';
  if(official.id.startsWith('accueil-celebration-')){
   for(const extra of official.blocks.filter(b=>Number(b.id)>100000))
    if(!previous.blocks.some(b=>b.id===extra.id))previous.blocks.push(clone(extra));
  }
 }
}
const stageTab=STAGE_SEED&&new URLSearchParams(search).get('tab')==='pages'?'pages':'celebrations';
const stageRequest=String(new URLSearchParams(search).get('page'));
const stageActive=STAGE_SEED?(seed.pages.find(p=>
 p.id===stageRequest+'-'+STAGE_SEED.celebrationId||p.id===stageRequest)||
 seed.pages.find(p=>p.group==='celebration')||seed.pages[0]):null;
return {db,stageTab,stageActive};
}
