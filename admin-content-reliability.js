// Correctifs ciblés pour les associations et l'édition des contenus.
// Chargé après les autres modules admin afin de normaliser les identifiants texte/nombre
// sans modifier la structure des données existante.
(function(){
  const sameId=(a,b)=>String(a??'')===String(b??'');
  const contentById=id=>(state.contents||[]).find(c=>sameId(c.id,id))||null;
  const eventById=id=>(state.events||[]).find(e=>sameId(e.id,id))||null;
  const actualContentId=id=>contentById(id)?.id??id;

  // Une illustration appartient au contenu (cover) et n'est pas une association distincte.
  // Les images de type "Image" restent associables comme images autonomes.
  window.dayLinkedContentRows=function(d){
    const rows=(d.contentIds||[]).map(contentById).filter(Boolean);
    if(!rows.length)return '<div class="notice">Aucun document ou média associé à cette étape.</div>';
    return `<div class="list">${rows.map(c=>{
      const cid=JSON.stringify(String(c.id)),day=JSON.stringify(d.key);
      const illustration=c.hasCover?' · illustration définie':'';
      return `<div class="admin-row"><div><strong>${icon(c.type)} ${esc(c.name)}</strong><div class="meta">${esc(c.type)}${illustration}</div></div><div class="row-actions"><button type="button" class="btn small" onclick='editDayLinkedContent(${cid},${day})'>Modifier</button><button type="button" class="btn small" onclick='unlinkDayContent(${day},${cid})'>Retirer de l’étape</button></div></div>`;
    }).join('')}</div>`;
  };

  window.dayContentPicker=function(d){
    if(!dayContentPickerOpen)return '';
    const linked=new Set((d.contentIds||[]).map(String));
    const available=(state.contents||[]).filter(c=>!linked.has(String(c.id)));
    const docs=available.filter(c=>c.type!=='Image');
    const images=available.filter(c=>c.type==='Image');
    const rows=list=>list.map(c=>{
      const cid=JSON.stringify(String(c.id)),day=JSON.stringify(d.key);
      return `<div class="admin-row"><div><strong>${icon(c.type)} ${esc(c.name)}</strong><div class="meta">${esc(c.type)}${c.hasCover?' · possède une image d’illustration':''}</div></div><button type="button" class="btn small primary" onclick='linkDayContent(${day},${cid})'>Associer</button></div>`;
    }).join('');
    return `<div style="margin-top:10px"><div class="notice" style="margin-bottom:10px"><strong>Association de document / média</strong><br>L’image d’illustration n’est pas une association : elle se règle dans « Modifier le contenu » et s’affiche en haut à gauche du document sur le site.</div>${docs.length?`<div class="list">${rows(docs)}</div>`:'<div class="notice">Aucun document ou média disponible.</div>'}${images.length?`<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700">Associer une image autonome</summary><div class="list" style="margin-top:8px">${rows(images)}</div></details>`:''}</div>`;
  };

  window.linkDayContent=function(dayKey,contentId){
    const d=selected()?.days?.find(x=>x.key===dayKey);if(!d)return;
    const id=actualContentId(contentId);
    d.contentIds=[...new Map([...(d.contentIds||[]),id].map(v=>[String(v),v])).values()];
    saveState(state);dayContentPickerOpen=false;editDay(dayKey);toast('Document associé');
  };
  window.unlinkDayContent=function(dayKey,contentId){
    const d=selected()?.days?.find(x=>x.key===dayKey);if(!d)return;
    d.contentIds=(d.contentIds||[]).filter(id=>!sameId(id,contentId));
    saveState(state);editDay(dayKey);toast('Document retiré de l’étape');
  };
  window.editDayLinkedContent=function(contentId,dayKey){
    captureCurrentDayDraft();
    editContent(actualContentId(contentId),()=>editDay(dayKey));
  };

  // Cases d'association robustes pour les identifiants texte et numériques.
  window.contentChecks=function(ids=[],name='linkedContent'){
    const selectedIds=new Set((ids||[]).map(String));
    if(!(state.contents||[]).length)return '<div class="notice">Aucun contenu dans la bibliothèque.</div>';
    return `<div class="check-grid">${state.contents.map(c=>{
      const cid=JSON.stringify(String(c.id));
      const checked=selectedIds.has(String(c.id));
      const illustration=c.hasCover?' · illustration disponible':'';
      return `<label class="check"><input type="checkbox" name="${name}" value="${esc(String(c.id))}" ${checked?'checked':''}><span><strong>${icon(c.type)} ${esc(c.name)}</strong><br><span class="muted">${esc(c.type)}${illustration}</span></span></label>`;
    }).join('')}</div>`;
  };

  function selectedContentIds(name){
    return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>actualContentId(x.value));
  }

  // Remplace le formulaire de rendez-vous pour conserver les identifiants texte.
  window.showDayEventForm=function(dayKey,eventId=null){
    const c=selected(),e=eventId==null?null:eventById(eventId),target=document.getElementById('dayEventForm');if(!target)return;
    target.innerHTML=`<div class="notice" style="margin-bottom:14px"><div class="form-grid"><label class="field"><span>Heure</span><input id="evtTime" type="time" value="${esc(e?.time||'')}"></label><label class="field"><span>Visible pour</span><select id="evtGroup">${groupOptions(e?.audience||'all')}</select></label><label class="field full"><span>Titre</span><input id="evtTitle" value="${esc(e?.title||'')}"></label><label class="field full"><span>Description</span><textarea id="evtDesc">${esc(e?.description||'')}</textarea></label></div><h4>Documents et médias associés</h4><div class="meta" style="margin-bottom:8px">L’image d’illustration se règle dans le contenu lui-même ; elle n’est pas une association supplémentaire.</div>${contentChecks(e?.contentIds||[],'evtContent')}<div class="actions" style="margin-top:10px"><button class="btn small" id="createEventContent">+ Créer un contenu</button></div><div id="eventInlineContent"></div><div class="actions" style="margin-top:14px"><button class="btn primary" id="saveEventBtn">${e?'Enregistrer':'Ajouter'}</button><button class="btn" type="button" id="cancelEventBtn">Annuler</button></div></div>`;
    document.getElementById('cancelEventBtn').onclick=()=>target.innerHTML='';
    document.getElementById('createEventContent').onclick=()=>renderInlineContentCreator('eventInlineContent',id=>{
      const ids=selectedContentIds('evtContent');ids.push(actualContentId(id));
      const data={celebrationId:c.id,dayKey,time:evtTime.value,title:evtTitle.value.trim()||'Rendez-vous',audience:evtGroup.value,description:evtDesc.value,contentIds:[...new Map(ids.map(v=>[String(v),v])).values()]};
      if(e)Object.assign(e,data);else state.events.push({id:Date.now()+1,sortOrder:state.events.filter(x=>x.celebrationId===c.id&&x.dayKey===dayKey).length,...data});
      saveState(state);editDay(dayKey);
    });
    document.getElementById('saveEventBtn').onclick=()=>{
      const title=evtTitle.value.trim();if(!title)return toast('Indiquez un titre');
      const data={celebrationId:c.id,dayKey,time:evtTime.value,title,audience:evtGroup.value,description:evtDesc.value,contentIds:selectedContentIds('evtContent')};
      if(e)Object.assign(e,data);else state.events.push({id:Date.now(),sortOrder:state.events.filter(x=>x.celebrationId===c.id&&x.dayKey===dayKey).length,...data});
      saveState(state);editDay(dayKey);toast('Rendez-vous enregistré');
    };
  };

  // Normalise l'identifiant avant d'ouvrir l'éditeur de contenu et répare ses actions.
  const baseEditContent=window.editContent;
  window.editContent=function(id,returnTo=null){
    const c=contentById(id);if(!c)return renderMedia();
    const result=baseEditContent(c.id,returnTo);

    // Les boutons Voir/Télécharger générés avec un identifiant texte pouvaient produire un onclick invalide.
    [...panel.querySelectorAll('button')].forEach(b=>{
      const label=b.textContent.trim();
      if(label==='Voir')b.onclick=()=>openStoredFile(c,false);
      if(label==='Télécharger')b.onclick=()=>openStoredFile(c,true);
    });

    const saveAssociations=document.getElementById('saveAssociations');
    if(saveAssociations)saveAssociations.onclick=()=>{
      state.celebrations.forEach(x=>(x.days||[]).forEach(d=>{d.contentIds=(d.contentIds||[]).filter(cid=>!sameId(cid,c.id))}));
      state.events.forEach(e=>{e.contentIds=(e.contentIds||[]).filter(cid=>!sameId(cid,c.id))});
      document.querySelectorAll('[data-content-day]:checked').forEach(el=>{
        const cel=state.celebrations.find(x=>sameId(x.id,el.dataset.celebrationId));
        const d=cel?.days?.find(x=>x.key===el.dataset.dayKey);
        if(d)d.contentIds=[...new Map([...(d.contentIds||[]),c.id].map(v=>[String(v),v])).values()];
      });
      document.querySelectorAll('[data-content-event]:checked').forEach(el=>{
        const ev=eventById(el.dataset.contentEvent);
        if(ev)ev.contentIds=[...new Map([...(ev.contentIds||[]),c.id].map(v=>[String(v),v])).values()];
      });
      saveState(state);editContent(c.id,returnTo);toast('Associations enregistrées');
    };
    return result;
  };
})();
