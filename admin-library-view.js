let adminLibraryFamily='Audio',adminAudioKind='all';

function adminContentEventMeta(contentId){
  const rows=[];
  state.events.forEach(e=>{if(!(e.contentIds||[]).includes(contentId))return;const c=state.celebrations.find(x=>x.id===e.celebrationId),d=c?.days?.find(x=>x.key===e.dayKey);rows.push(`${d?.label||'Étape'} · ${e.time||'—'} · ${e.title||'Rendez-vous'}`)});
  return rows;
}
function adminLibraryMatches(c){
  if(adminLibraryFamily==='Audio'){if(c.type!=='Audio')return false;if(adminAudioKind==='chants')return c.category==='Chants audio';if(adminAudioKind==='spoken')return c.category!=='Chants audio';return true}
  if(adminLibraryFamily==='Vidéo')return c.type==='Vidéo';
  if(adminLibraryFamily==='Texte')return c.type==='Texte';
  if(adminLibraryFamily==='Image')return c.type==='Image';
  if(adminLibraryFamily==='PDF')return c.type==='PDF';
  return false;
}
function adminLibraryCard(c){
  const metas=adminContentEventMeta(c.id),label=c.type==='Audio'?(c.category==='Chants audio'?'Chant':'Audio'):c.type;
  return `<article class="resource-card admin-clickable" role="button" tabindex="0" onclick="editContent(${JSON.stringify(c.id)})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();editContent(${JSON.stringify(c.id)})}"><div class="resource-type">${esc(label)}</div><h3>${esc(c.name)}</h3>${metas.length?`<div class="meta">${metas.slice(0,2).map(esc).join('<br>')}${metas.length>2?`<br>+ ${metas.length-2}`:''}</div>`:''}<div class="actions"><button class="btn small primary" type="button" onclick="event.stopPropagation();editContent(${JSON.stringify(c.id)})">Modifier</button><button class="btn small danger" type="button" onclick="event.stopPropagation();removeContent(${JSON.stringify(c.id)})">Supprimer</button></div></article>`;
}
function renderAdminLibraryList(){const box=document.getElementById('adminLibraryList');if(!box)return;const list=state.contents.filter(adminLibraryMatches).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'fr',{sensitivity:'base',numeric:true}));box.innerHTML=list.length?`<div class="admin-library-grid">${list.map(adminLibraryCard).join('')}</div>`:'<div class="notice">Aucun contenu.</div>'}
function selectAdminLibraryFamily(family){adminLibraryFamily=family;adminAudioKind='all';renderAdminLibraryView()}
function selectAdminAudioKind(kind){adminAudioKind=kind;renderAdminLibraryView()}
function renderAdminLibraryView(){
  const root=document.getElementById('adminLibraryView');if(!root)return;
  const families=['Audio','PDF','Vidéo','Texte','Image'];
  root.innerHTML=`<div class="admin-library-tabs">${families.map(v=>`<button class="chip ${adminLibraryFamily===v?'active':''}" onclick="selectAdminLibraryFamily('${v}')">${v}</button>`).join('')}</div>${adminLibraryFamily==='Audio'?`<div class="admin-library-tabs"><button class="chip ${adminAudioKind==='all'?'active':''}" onclick="selectAdminAudioKind('all')">Tous</button><button class="chip ${adminAudioKind==='chants'?'active':''}" onclick="selectAdminAudioKind('chants')">Chants</button><button class="chip ${adminAudioKind==='spoken'?'active':''}" onclick="selectAdminAudioKind('spoken')">Autres</button></div>`:''}<div id="adminLibraryList"></div>`;
  renderAdminLibraryList();
}

const renderMediaBeforeAdminLibrary=renderMedia;
renderMedia=function(){renderMediaBeforeAdminLibrary();const first=document.querySelector('#panel .card');if(first){const h=first.querySelector('h2');if(h)h.textContent='Nouveau contenu'}const existing=document.querySelector('#panel .card.section');if(existing)existing.innerHTML='<div class="section-head"><h2>Bibliothèque</h2><span class="admin-subtle">'+state.contents.length+'</span></div><div id="adminLibraryView"></div>';renderAdminLibraryView()};