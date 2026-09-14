// Gestion explicite des relations étape <-> contenus.
// Un retrait ici ne supprime jamais le contenu de la bibliothèque.
let dayContentPickerOpen=false;

// Navigation directe : les lignes ouvrent l'élément, les boutons restent réservés aux actions distinctes.
dayCard=function(d){const c=selected(),events=state.events.filter(e=>e.celebrationId===c.id&&e.dayKey===d.key);return `<div class="admin-row admin-clickable" role="button" tabindex="0" onclick="editDay('${d.key}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();editDay('${d.key}')}" ><div><strong>${esc(d.label)}</strong><div class="meta">${esc(dayDateLabel(d))} · ${events.length} rendez-vous</div></div></div>`};
eventRow=function(e){const links=(e.links||[]).length,contents=(e.contentIds||[]).length;const meta=[links?`${links} lien${links>1?'s':''}`:'',contents?`${contents} contenu${contents>1?'s':''}`:''].filter(Boolean).join(' · ');return `<div class="admin-row admin-clickable" role="button" tabindex="0" onclick="showDayEventForm('${e.dayKey}',${e.id})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showDayEventForm('${e.dayKey}',${e.id})}"><div><strong>${esc(e.time||'—')} — ${esc(e.title)}</strong>${meta?`<div class="meta">${meta}</div>`:''}</div><div class="row-actions"><button class="btn small danger" onclick="event.stopPropagation();removeEvent(${e.id},'${e.dayKey}')">Supprimer</button></div></div>`};

function dayLinkedContentRows(d){
  const ids=d.contentIds||[];
  const rows=ids.map(id=>state.contents.find(c=>c.id===id)).filter(Boolean);
  if(!rows.length)return '<div class="notice">Aucun contenu.</div>';
  return `<div class="list">${rows.map(c=>`<div class="admin-row admin-clickable" role="button" tabindex="0" onclick="editDayLinkedContent(${c.id},'${d.key}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();editDayLinkedContent(${c.id},'${d.key}')}" ><div><strong>${icon(c.type)} ${esc(c.name)}</strong><div class="meta">${esc(c.type)}</div></div><div class="row-actions"><button type="button" class="btn small danger" onclick="event.stopPropagation();unlinkDayContent('${d.key}',${c.id})">Retirer</button></div></div>`).join('')}</div>`;
}

function dayContentPicker(d){
  if(!dayContentPickerOpen)return '';
  const linked=new Set(d.contentIds||[]);
  const available=state.contents.filter(c=>!linked.has(c.id));
  return `<div style="margin-top:7px">${available.length?`<div class="list">${available.map(c=>`<div class="admin-row"><div><strong>${icon(c.type)} ${esc(c.name)}</strong><div class="meta">${esc(c.type)}</div></div><button type="button" class="btn small primary" onclick="linkDayContent('${d.key}',${c.id})">Ajouter</button></div>`).join('')}</div>`:'<div class="notice">Aucun autre contenu disponible.</div>'}</div>`;
}

function linkDayContent(dayKey,contentId){const d=selected()?.days?.find(x=>x.key===dayKey);if(!d)return;d.contentIds=[...new Set([...(d.contentIds||[]),contentId])];saveState(state);dayContentPickerOpen=false;editDay(dayKey);toast('Contenu associé')}
function unlinkDayContent(dayKey,contentId){const d=selected()?.days?.find(x=>x.key===dayKey);if(!d)return;d.contentIds=(d.contentIds||[]).filter(id=>id!==contentId);saveState(state);editDay(dayKey);toast('Contenu retiré')}
function editDayLinkedContent(contentId,dayKey){editContent(contentId);const back=[...panel.querySelectorAll('button')].find(b=>b.textContent.trim()==='Retour');if(back){back.onclick=()=>editDay(dayKey);back.textContent='Retour'}}

editDay=function(key){
  const c=selected(),d=c.days.find(x=>x.key===key);if(!d)return renderProgram();
  if(!Array.isArray(d.contentIds))d.contentIds=[];
  const events=state.events.filter(e=>e.celebrationId===c.id&&e.dayKey===key).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
  const dateFields=d.label==='Préparation'?`<label class="field"><span>Début</span><input id="dStart" type="date" value="${esc(d.startDate||'')}"></label><label class="field"><span>Fin</span><input id="dEnd" type="date" value="${esc(d.endDate||'')}"></label>`:d.label==='Après célébration'?'':`<label class="field"><span>Date</span><input id="dStart" type="date" value="${esc(d.startDate||'')}"></label>`;
  panel.innerHTML=`<div class="day-editor"><div class="admin-view-head" style="justify-content:flex-start"><button class="btn" onclick="editCelebration(${c.id})">Retour</button><div><h1>${esc(d.label)}</h1><div class="admin-subtle">${esc(c.archangel)} ${esc(c.year)}</div></div></div><div class="card day-editor-main day-editor-section day-editor-general"><div class="day-editor-section-head"><div><h2>Informations générales</h2></div></div><div class="day-fields"><div class="form-grid">${dateFields}<label class="field full"><span>Texte</span><textarea id="dText">${esc(d.text||'')}</textarea></label></div><div class="day-editor-links"><h3>Liens</h3><div id="dayLinks">${(d.links||[]).map((l,i)=>linkRow(l,i)).join('')}</div></div><div class="actions day-editor-general-actions"><button type="button" class="btn small" id="addLink">+ Lien</button><button class="btn primary" id="saveDay">Enregistrer l’étape</button></div></div></div><div class="day-editor-columns"><div class="card day-editor-section day-editor-contents"><div class="section-head day-editor-section-head"><div><h2>Contenus</h2><div class="admin-subtle">Disponibles pendant toute l’étape</div></div></div>${dayLinkedContentRows(d)}<div class="actions day-editor-section-actions"><button type="button" class="btn small primary" id="createDayContent">Ajouter un contenu</button><button type="button" class="btn small" id="associateDayContent">Associer un contenu existant</button></div><div id="dayInlineContent"></div>${dayContentPicker(d)}</div><div class="card day-editor-section day-editor-events"><div class="section-head day-editor-section-head"><div><h2>Rendez-vous</h2><div class="admin-subtle">À une heure précise</div></div></div><div id="dayEventForm"></div><div class="list">${events.length?events.map(eventRow).join(''):'<div class="notice">Aucun rendez-vous.</div>'}</div><div class="actions day-editor-section-actions"><button class="btn small primary" onclick="showDayEventForm('${key}')">Ajouter un rendez-vous</button></div></div></div></div>`;
  document.getElementById('addLink').onclick=()=>dayLinks.insertAdjacentHTML('beforeend',linkRow({label:'',url:''},dayLinks.children.length));
  document.getElementById('createDayContent').onclick=()=>{
    dayContentPickerOpen=false;
    if(typeof renderInlineContentCreator!=='function')return toast('Création de contenu indisponible');
    renderInlineContentCreator('dayInlineContent',id=>{d.contentIds=[...new Set([...(d.contentIds||[]),id])];saveState(state);editDay(key)});
  };
  document.getElementById('associateDayContent').onclick=()=>{dayContentPickerOpen=!dayContentPickerOpen;editDay(key)};
  document.getElementById('saveDay').onclick=()=>{
    if(d.label==='Préparation'){const s=document.getElementById('dStart').value,e=document.getElementById('dEnd').value||s;if(s&&e&&e<s)return toast('Date de fin incorrecte');d.startDate=s;d.endDate=e}
    else if(d.label==='Après célébration'){d.startDate='';d.endDate=''}
    else{const s=document.getElementById('dStart').value;d.startDate=s;d.endDate=s}
    d.text=dText.value;d.links=[...dayLinks.querySelectorAll('[data-link-row]')].map(r=>({label:r.querySelector('[data-link-label]').value.trim(),url:r.querySelector('[data-link-url]').value.trim()})).filter(x=>x.url);saveState(state);editDay(key);toast('Enregistré')
  };
};
