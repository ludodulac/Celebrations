let libraryFamily='audio';
let libraryAudioKind='all';

function contentLocations(contentId){
  const locations=[];
  const add=label=>{if(label&&!locations.includes(label))locations.push(label)};
  state.celebrations.forEach(c=>(c.days||[]).forEach(d=>{
    if((d.contentIds||[]).includes(contentId))add(d.label);
  }));
  state.events.forEach(e=>{
    if(!(e.contentIds||[]).includes(contentId))return;
    const cel=state.celebrations.find(c=>c.id===e.celebrationId);
    const day=cel?.days?.find(d=>d.key===e.dayKey);
    if(day?.label)add(day.label);
  });
  return locations;
}
function contentLocationMeta(c){
  const locations=contentLocations(c.id);if(!locations.length)return '';
  const text=locations.length===1?`Se trouve dans ${locations[0]}`:`Se trouve dans ${locations.slice(0,-1).join(', ')} et dans ${locations[locations.length-1]}`;
  return `<div class="content-event-meta">${esc(text)}</div>`;
}
function libraryMatches(c){
  if(c.category==='Accueil')return false;
  if(libraryFamily==='audio'){
    if(c.type!=='Audio')return false;
    if(libraryAudioKind==='chant')return c.category==='Chants audio';
    if(libraryAudioKind==='other')return c.category!=='Chants audio';
    return true;
  }
  if(libraryFamily==='video')return c.type==='Vidéo';
  if(libraryFamily==='text')return c.type==='Texte'||c.type==='PDF';
  if(libraryFamily==='image')return c.type==='Image';
  if(libraryFamily==='pdf')return c.type==='PDF';
  return false;
}
function simpleLibraryCard(c){
  const fallback=window.contentFallbackVisual?window.contentFallbackVisual(c):'';
  const visual=c.type==='Image'&&c.sourceType==='file'?`<img data-image-id="${c.id}" alt="" class="library-thumb" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='grid')">${fallback}`:c.hasCover?`<img data-cover-id="${c.id}" alt="" class="library-thumb" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='grid')">${fallback}`:fallback;
  const body=`<div class="simple-library-body"><div class="resource-type">${esc(c.type)}${c.type==='Audio'&&c.category?` · ${esc(c.category)}`:''}</div><h3>${esc(c.name)}</h3>${c.description?`<p class="muted">${esc(c.description)}</p>`:''}${contentLocationMeta(c)}<div class="resources">${contentButtons(c)}</div></div>`;
  return `<article class="resource-card simple-library-card ${visual?'has-library-visual':''}">${visual?`<div class="simple-library-visual">${visual}</div>`:''}${body}</article>`;
}
function renderLibrary(){
  const list=state.contents.filter(libraryMatches);
  const audioSubs=libraryFamily==='audio'?`<div class="library-audio-tabs"><button class="chip ${libraryAudioKind==='all'?'active':''}" data-audio-kind="all">Tous</button><button class="chip ${libraryAudioKind==='chant'?'active':''}" data-audio-kind="chant">Chants</button><button class="chip ${libraryAudioKind==='other'?'active':''}" data-audio-kind="other">Autres audios</button></div>`:'';
  library.innerHTML=`<div class="library-fixed-head"><div class="section-head"><div><div class="eyebrow">Médiathèque</div><h2>Contenus</h2></div></div><div class="library-main-tabs"><button class="btn ${libraryFamily==='audio'?'primary':''}" data-library-family="audio">Tous les audios</button><button class="btn ${libraryFamily==='video'?'primary':''}" data-library-family="video">Toutes les vidéos</button><button class="btn ${libraryFamily==='text'?'primary':''}" data-library-family="text">Tous les textes</button><button class="btn ${libraryFamily==='image'?'primary':''}" data-library-family="image">Toutes les images</button><button class="btn ${libraryFamily==='pdf'?'primary':''}" data-library-family="pdf">Tous les PDF</button></div>${audioSubs}</div><div class="library-scroll"><div class="grid3">${list.length?list.map(simpleLibraryCard).join(''):'<div class="notice">Aucun contenu disponible.</div>'}</div></div>`;
  library.querySelectorAll('[data-library-family]').forEach(b=>b.onclick=()=>{libraryFamily=b.dataset.libraryFamily;libraryAudioKind='all';renderLibrary()});
  library.querySelectorAll('[data-audio-kind]').forEach(b=>b.onclick=()=>{libraryAudioKind=b.dataset.audioKind;renderLibrary()});
  hydrateDynamic(library);
}

openContentFamily=function(category){
  if(category==='Chants audio'){libraryFamily='audio';libraryAudioKind='chant'}
  else if(category==='Audios parlés'||category==='Audio'){libraryFamily='audio';libraryAudioKind='other'}
  else if(category==='Vidéos'){libraryFamily='video';libraryAudioKind='all'}
  else if(category==='Textes'){libraryFamily='text';libraryAudioKind='all'}
  else if(category==='Images'){libraryFamily='image';libraryAudioKind='all'}
  else if(category==='PDF'){libraryFamily='pdf';libraryAudioKind='all'}
  showTab('library');renderLibrary();
};

const libraryStyle=document.createElement('style');
libraryStyle.textContent=`
body.public-app #library:not(.hidden){display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden!important;gap:10px}
.library-fixed-head{display:grid;gap:8px}.library-fixed-head .section-head{margin:0}.library-main-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.library-main-tabs .btn{white-space:normal}.library-audio-tabs{display:flex;gap:7px;flex-wrap:wrap}.library-scroll{min-height:0;overflow:auto;overscroll-behavior:contain;padding-right:2px}.content-event-meta{font-size:.72rem;color:var(--muted);margin:7px 0 10px;line-height:1.35;font-style:italic}
.simple-library-card.has-library-visual{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;align-items:start}.simple-library-visual{width:92px;aspect-ratio:1/1}.library-thumb{width:100%;height:100%;aspect-ratio:1/1;object-fit:cover;border-radius:10px;margin:0;background:#f3f4f6}.simple-library-body{min-width:0}.simple-library-body h3{margin-top:3px}
@media(max-width:850px){body.public-app{height:auto;min-height:100dvh;overflow-x:hidden;overflow-y:auto}body.public-app .container{overflow:visible;min-height:auto}body.public-app #library:not(.hidden){display:block;overflow:visible!important}.library-scroll{min-height:auto;overflow:visible;overscroll-behavior:auto;padding-right:0}.library-main-tabs{grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.library-main-tabs .btn{font-size:.7rem;padding:7px 5px;min-height:38px}.library-audio-tabs{gap:5px}.library-audio-tabs .chip{font-size:.7rem;padding:6px 9px}.library-scroll .grid3{gap:8px}.simple-library-card{padding:9px}.simple-library-card h3{font-size:.92rem;margin:3px 0}.simple-library-card .muted{font-size:.75rem;margin:3px 0;line-height:1.35}.simple-library-card.has-library-visual{display:grid;grid-template-columns:82px minmax(0,1fr);gap:9px;align-items:start}.simple-library-visual{width:82px;aspect-ratio:1/1}.library-thumb{width:82px;height:82px;max-height:82px;aspect-ratio:1/1;object-fit:cover;margin:0}.content-fallback-thumb.library-thumb{width:82px!important;height:82px!important;max-height:82px!important;aspect-ratio:1/1!important;border-radius:9px}.content-fallback-thumb.library-thumb span{font-size:.7rem}.content-event-meta{font-size:.68rem;margin:4px 0 6px;line-height:1.3}.simple-library-card .resource-type{font-size:.68rem}.simple-library-card .resources{margin-top:4px}.simple-library-card audio{height:38px}}
`;
document.head.appendChild(libraryStyle);
renderLibrary();