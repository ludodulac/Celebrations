let libraryFamily='audio';
let libraryAudioKind='all';
let galleryObjectUrls=[];

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
function normalizeLibraryText(v){
  return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function libraryDescription(c){
  const description=String(c?.description||'').trim();if(!description)return '';
  const title=normalizeLibraryText(c?.name),desc=normalizeLibraryText(description);
  if(!desc||desc===title)return '';
  const shorter=title.length<desc.length?title:desc,longer=title.length<desc.length?desc:title;
  if(shorter.length>=24&&longer.includes(shorter)&&shorter.length/longer.length>=.88)return '';
  return description;
}
function libraryLocationLabel(c){
  const locations=contentLocations(c.id);
  if(locations.length)return locations.join(' · ');
  const category=String(c.category||'').trim();
  return ['Préparation','Mercredi','Jeudi','Vendredi','Samedi','Dimanche','Après célébration'].includes(category)?category:'';
}
function libraryMatches(c){
  if(c.category==='Accueil')return false;
  if(libraryFamily==='audio'){
    if(c.type!=='Audio')return false;
    if(libraryAudioKind==='chant')return String(c.audioKind||'').toLowerCase()==='chant';
    if(libraryAudioKind==='other')return String(c.audioKind||'').toLowerCase()!=='chant';
    return true;
  }
  if(libraryFamily==='video')return c.type==='Vidéo';
  if(libraryFamily==='text')return c.type==='Texte'||c.type==='PDF';
  return false;
}
function simpleLibraryCard(c){
  const fallback=window.contentFallbackVisual?window.contentFallbackVisual(c):'';
  const visual=c.type==='Image'&&c.sourceType==='file'?`<img data-image-id="${c.id}" alt="" class="library-thumb" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='grid')">${fallback}`:c.hasCover?`<img data-cover-id="${c.id}" alt="" class="library-thumb" onerror="this.style.display='none';this.nextElementSibling&&(this.nextElementSibling.style.display='grid')">${fallback}`:fallback;
  const location=libraryLocationLabel(c),description=libraryDescription(c);
  const meta=location?`<div class="resource-type">${esc(location)}</div>`:'';
  const action=c.type==='Audio'&&c.sourceType==='file'?`<div data-audio-id="${esc(c.id)}"></div>`:`<div class="resources">${contentButtons(c)}</div>`;
  const body=`<div class="simple-library-body">${meta}<h3>${esc(c.name)}</h3>${description?`<p class="muted">${esc(description)}</p>`:''}${action}</div>`;
  return `<article class="resource-card simple-library-card ${visual?'has-library-visual':''}">${visual?`<div class="simple-library-visual">${visual}</div>`:''}${body}</article>`;
}
function normalizeGallerySource(v){
  const raw=String(v||'').trim();if(!raw)return '';
  if(!/^https?:\/\//i.test(raw))return raw.replace(/^\/+|\/+$/g,'').toLowerCase();
  try{const u=new URL(raw);u.hash='';return u.toString().toLowerCase()}catch(e){return raw.toLowerCase()}
}
function normalizeGalleryName(v){return String(v||'').trim().toLowerCase().replace(/\s+/g,' ')}
function imageGalleryItems(){
  const out=[],seen=new Set();
  for(const c of state.contents||[]){
    let source='',kind='',fileName='';
    if(c.type==='Image'&&c.sourceType==='file'&&c.storagePath){source=c.storagePath;kind='image';fileName=c.fileName||''}
    else if(c.hasCover&&c.coverStoragePath){source=c.coverStoragePath;kind='cover';fileName=c.coverFileName||''}
    else continue;
    const sourceKey=normalizeGallerySource(source);
    const nameKey=kind==='cover'?normalizeGalleryName(fileName):'';
    const identity=nameKey?`cover-name:${nameKey}`:`source:${sourceKey}`;
    if(!sourceKey||seen.has(identity))continue;
    seen.add(identity);out.push({content:c,kind,source,identity});
  }
  return out;
}
function galleryOriginMeta(c){
  const locations=contentLocations(c.id);
  const origin=locations.length?locations.join(' · '):libraryLocationLabel(c);
  return origin?`<div class="content-event-meta">${esc(origin)}</div>`:'';
}
function imageGalleryCard(item,index){
  const c=item.content;
  return `<article class="resource-card image-gallery-card" data-gallery-card="${index}" hidden><button type="button" class="image-gallery-open" data-gallery-open="${index}" aria-label="Ouvrir l’image ${esc(c.name)}"><img class="image-gallery-thumb" data-gallery-image="${index}" alt=""></button><div class="image-gallery-body"><div class="resource-type">Image</div><h3>${esc(c.name)}</h3>${galleryOriginMeta(c)}</div></article>`;
}
function clearGalleryObjectUrls(){galleryObjectUrls.forEach(URL.revokeObjectURL);galleryObjectUrls=[]}
async function hydrateGalleryImages(items){
  const grid=library.querySelector('[data-image-gallery-grid]');if(!grid)return;
  let visible=0;
  await Promise.all(items.map(async(item,index)=>{
    const card=library.querySelector(`[data-gallery-card="${index}"]`),img=library.querySelector(`[data-gallery-image="${index}"]`),button=library.querySelector(`[data-gallery-open="${index}"]`);
    if(!card||!img||!button)return;
    try{
      const key=item.kind==='cover'?`cover-${item.content.id}`:String(item.content.id);
      const file=await getMedia(key);if(!file||!String(file.type||'').startsWith('image/')){card.remove();return}
      const url=URL.createObjectURL(file);galleryObjectUrls.push(url);img.src=url;card.hidden=false;visible++;
      button.onclick=()=>window.open(url,'_blank','noopener');
    }catch(e){card.remove()}
  }));
  if(!visible)grid.innerHTML='<div class="notice">Aucune image disponible.</div>';
}
function renderLibrary(){
  clearGalleryObjectUrls();
  const imageItems=libraryFamily==='image'?imageGalleryItems():null;
  const list=imageItems||state.contents.filter(libraryMatches);
  const audioSubs=libraryFamily==='audio'?`<div class="library-audio-tabs"><button class="chip ${libraryAudioKind==='all'?'active':''}" data-audio-kind="all">Tous</button><button class="chip ${libraryAudioKind==='chant'?'active':''}" data-audio-kind="chant">Chants</button><button class="chip ${libraryAudioKind==='other'?'active':''}" data-audio-kind="other">Audios parlés</button></div>`:'';
  const cards=libraryFamily==='image'?(list.length?list.map(imageGalleryCard).join(''):'<div class="notice">Aucune image disponible.</div>'):(list.length?list.map(simpleLibraryCard).join(''):'<div class="notice">Aucun contenu disponible.</div>');
  library.innerHTML=`<div class="library-fixed-head"><div class="library-main-tabs"><button class="btn ${libraryFamily==='audio'?'primary':''}" data-library-family="audio">Tous les audios</button><button class="btn ${libraryFamily==='video'?'primary':''}" data-library-family="video">Toutes les vidéos</button><button class="btn ${libraryFamily==='text'?'primary':''}" data-library-family="text">Tous les textes et PDF</button><button class="btn ${libraryFamily==='image'?'primary':''}" data-library-family="image">Toutes les images</button></div>${audioSubs}</div><div class="library-scroll"><div class="grid3" ${libraryFamily==='image'?'data-image-gallery-grid':''}>${cards}</div></div>`;
  library.querySelectorAll('[data-library-family]').forEach(b=>b.onclick=()=>{libraryFamily=b.dataset.libraryFamily;libraryAudioKind='all';renderLibrary()});
  library.querySelectorAll('[data-audio-kind]').forEach(b=>b.onclick=()=>{libraryAudioKind=b.dataset.audioKind;renderLibrary()});
  if(libraryFamily==='image')hydrateGalleryImages(imageItems);else hydrateDynamic(library);
}

openContentFamily=function(category){
  if(category==='Chants audio'){libraryFamily='audio';libraryAudioKind='chant'}
  else if(category==='Audios parlés'||category==='Audio'){libraryFamily='audio';libraryAudioKind='other'}
  else if(category==='Vidéos'){libraryFamily='video';libraryAudioKind='all'}
  else if(category==='Textes'||category==='PDF'){libraryFamily='text';libraryAudioKind='all'}
  else if(category==='Images'){libraryFamily='image';libraryAudioKind='all'}
  showTab('library');renderLibrary();
};

const libraryStyle=document.createElement('style');
libraryStyle.textContent=`
body.public-app #library:not(.hidden){display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden!important;gap:10px}
.library-fixed-head{display:grid;gap:8px}.library-main-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.library-main-tabs .btn{white-space:normal}.library-audio-tabs{display:flex;gap:7px;flex-wrap:wrap}.library-scroll{min-height:0;overflow:auto;overscroll-behavior:contain;padding-right:2px}.content-event-meta{font-size:.72rem;color:var(--muted);margin:7px 0 10px;line-height:1.35;font-style:italic}
.simple-library-card.has-library-visual{display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;align-items:start}.simple-library-visual{width:92px;aspect-ratio:1/1}.library-thumb{width:100%;height:100%;aspect-ratio:1/1;object-fit:cover;border-radius:10px;margin:0;background:#f3f4f6}.simple-library-body{min-width:0}.simple-library-body h3{margin-top:3px}
.image-gallery-card{display:grid;gap:10px;padding:12px}.image-gallery-card[hidden]{display:none!important}.image-gallery-open{appearance:none;border:0;padding:0;background:transparent;display:block;width:100%;cursor:pointer}.image-gallery-thumb{display:block;width:100%;height:190px;object-fit:cover;border-radius:10px;background:#f3f4f6}.image-gallery-body{min-width:0}.image-gallery-body h3{margin:4px 0 0;font-size:.95rem;line-height:1.3}
@media(max-width:850px){body.public-app{height:auto;min-height:100dvh;overflow-x:hidden;overflow-y:auto}body.public-app .container{overflow:visible;min-height:auto}body.public-app #library:not(.hidden){display:block;overflow:visible!important}.library-scroll{min-height:auto;overflow:visible;overscroll-behavior:auto;padding-right:0}.library-main-tabs{grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.library-main-tabs .btn{font-size:.7rem;padding:7px 5px;min-height:38px}.library-audio-tabs{gap:5px}.library-audio-tabs .chip{font-size:.7rem;padding:6px 9px}.library-scroll .grid3{gap:8px}.simple-library-card{padding:9px}.simple-library-card h3{font-size:.92rem;margin:3px 0}.simple-library-card .muted{font-size:.75rem;margin:3px 0;line-height:1.35}.simple-library-card.has-library-visual{display:grid;grid-template-columns:82px minmax(0,1fr);gap:9px;align-items:start}.simple-library-visual{width:82px;aspect-ratio:1/1}.library-thumb{width:82px;height:82px;max-height:82px;aspect-ratio:1/1;object-fit:cover;margin:0}.content-fallback-thumb.library-thumb{width:82px!important;height:82px!important;max-height:82px!important;aspect-ratio:1/1!important;border-radius:9px}.content-fallback-thumb.library-thumb span{font-size:.7rem}.content-event-meta{font-size:.68rem;margin:4px 0 6px;line-height:1.3}.simple-library-card .resource-type{font-size:.68rem}.simple-library-card .resources{margin-top:4px}.simple-library-card audio{height:38px}.image-gallery-card{grid-template-columns:96px minmax(0,1fr);gap:9px;padding:9px;align-items:start}.image-gallery-thumb{width:96px;height:82px}.image-gallery-body h3{font-size:.88rem;margin:3px 0}.image-gallery-card .content-event-meta{margin-bottom:0}}
`;
document.head.appendChild(libraryStyle);
renderLibrary();