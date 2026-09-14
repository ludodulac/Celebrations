// Ordre manuel des rendez-vous dans une étape.
// Chargé après admin-day-content-actions.js pour conserver toute l'interface existante.
(function(){
  function orderedDayEvents(dayKey){
    const c=selected();
    return state.events
      .filter(e=>e.celebrationId===c.id&&e.dayKey===dayKey)
      .sort((a,b)=>(Number(a.sortOrder??999)-Number(b.sortOrder??999))||String(a.time||'').localeCompare(String(b.time||''))||String(a.id).localeCompare(String(b.id)));
  }

  window.moveEventOrder=function(dayKey,eventId,direction){
    const events=orderedDayEvents(dayKey);
    const index=events.findIndex(e=>String(e.id)===String(eventId));
    if(index<0)return;
    const target=index+Number(direction||0);
    if(target<0||target>=events.length)return;
    [events[index],events[target]]=[events[target],events[index]];
    events.forEach((e,i)=>{e.sortOrder=i});
    saveState(state);
    editDay(dayKey);
    toast('Ordre des rendez-vous mis à jour');
  };

  // Remplace seulement le rendu d'une ligne de rendez-vous :
  // ajout des flèches haut/bas et prise en charge des identifiants texte.
  eventRow=function(e){
    const eventId=JSON.stringify(e.id);
    const dayKey=JSON.stringify(e.dayKey);
    const order=Number(e.sortOrder??999);
    return `<div class="admin-row admin-clickable" data-event-order="${order}" style="order:${order}" role="button" tabindex="0" onclick='showDayEventForm(${dayKey},${eventId})' onkeydown='if(event.key==="Enter"||event.key===" "){event.preventDefault();showDayEventForm(${dayKey},${eventId})}'><div><strong>${esc(e.time||'—')} — ${esc(e.title)}</strong></div><div class="row-actions"><button type="button" class="btn small" title="Monter" aria-label="Monter ce rendez-vous" onclick='event.stopPropagation();moveEventOrder(${dayKey},${eventId},-1)'>↑</button><button type="button" class="btn small" title="Descendre" aria-label="Descendre ce rendez-vous" onclick='event.stopPropagation();moveEventOrder(${dayKey},${eventId},1)'>↓</button><button class="btn small danger" onclick='event.stopPropagation();removeEvent(${eventId},${dayKey})'>Supprimer</button></div></div>`;
  };

  // À l'ouverture d'une étape, normalise les rendez-vous sans sortOrder
  // afin qu'un nouveau rendez-vous arrive naturellement à la fin.
  const originalEditDay=editDay;
  editDay=function(key){
    const events=orderedDayEvents(key);
    let changed=false;
    events.forEach((e,i)=>{
      if(!Number.isFinite(Number(e.sortOrder))){e.sortOrder=i;changed=true}
    });
    if(changed)saveState(state);
    originalEditDay(key);
  };
})();
