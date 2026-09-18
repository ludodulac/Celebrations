function contentAssociationData(contentId){
  const days=[],events=[];
  state.celebrations.forEach(c=>{
    (c.days||[]).forEach(d=>{
      if((d.contentIds||[]).includes(contentId))days.push({celebration:c,day:d});
    });
  });
  state.events.forEach(e=>{
    if(!(e.contentIds||[]).includes(contentId))return;
    const c=state.celebrations.find(x=>x.id===e.celebrationId);
    const d=c?.days?.find(x=>x.key===e.dayKey);
    events.push({celebration:c,day:d,event:e});
  });
  return {days,events};
}

function associationSummary(contentId){
  const a=contentAssociationData(contentId),rows=[];
  a.days.forEach(x=>rows.push(`<div class="admin-row"><div><strong>${esc(x.celebration?`Archange ${x.celebration.archangel} ${x.celebration.year}`:'Célébration')}</strong><div class="meta">${esc(x.day?.label||'Étape')}</div></div><span class="badge">Étape</span></div>`));
  a.events.forEach(x=>rows.push(`<div class="admin-row"><div><strong>${esc(x.celebration?`Archange ${x.celebration.archangel} ${x.celebration.year}`:'Célébration')}</strong><div class="meta">${esc(x.day?.label||'Étape')} · ${esc(x.event.time||'Sans heure')} · ${esc(x.event.title||'Rendez-vous')}</div></div><span class="badge">Rendez-vous</span></div>`));
  return rows.length?`<div class="list">${rows.join('')}</div>`:'<div class="notice">Ce contenu n’est associé à aucune étape ni aucun rendez-vous.</div>';
}

function associationEditor(contentId){
  return state.celebrations.map(c=>{
    const dayRows=(c.days||[]).map(d=>{
      const dayChecked=(d.contentIds||[]).includes(contentId)?'checked':'';
      const events=state.events.filter(e=>e.celebrationId===c.id&&e.dayKey===d.key).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
      const eventRows=events.map(e=>`<label class="check"><input type="checkbox" data-content-event="${e.id}" ${((e.contentIds||[]).includes(contentId))?'checked':''}><span><strong>${esc(e.time||'Sans heure')} — ${esc(e.title||'Rendez-vous')}</strong><br><span class="muted">${esc(d.label)}</span></span></label>`).join('');
      return `<div style="margin:12px 0"><label class="check"><input type="checkbox" data-content-day data-celebration-id="${c.id}" data-day-key="${esc(d.key)}" ${dayChecked}><span><strong>${esc(d.label)}</strong><br><span class="muted">Associer directement à cette étape</span></span></label>${eventRows?`<div class="check-grid" style="margin:8px 0 0 22px">${eventRows}</div>`:''}</div>`;
    }).join('');
    return `<details class="card" style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">Archange ${esc(c.archangel)} ${esc(c.year)}</summary>${dayRows}</details>`;
  }).join('');
}

async function hydrateContentEditorPreview(c){
  const image=document.getElementById('ecPreviewImage');
  if(image){
    const key=c.type==='Image'&&c.sourceType==='file'?c.id:'cover-'+c.id;
    const file=await getMedia(key);
    if(file){const url=URL.createObjectURL(file);image.src=url;image.style.display='block';image.onload=()=>setTimeout(()=>URL.revokeObjectURL(url),2000)}
    else image.style.display='none';
  }
}

function contentFileBlock(c){
  if(c.sourceType==='file'){
    const label=c.type==='Image'?'Image':'Fichier';
    return `<div class="card" style="margin-top:14px"><div class="eyebrow">${label}</div><strong>${esc(c.fileName||'Fichier enregistré')}</strong><div class="actions" style="margin-top:10px"><button class="btn" type="button" onclick="openStoredFile(state.contents.find(x=>x.id===${c.id}),false)">Voir</button><button class="btn" type="button" onclick="openStoredFile(state.contents.find(x=>x.id===${c.id}),true)">Télécharger</button></div><label class="field" style="margin-top:12px"><span>Remplacer le ${c.type==='Image'?'fichier image':'fichier'}</span><input id="ecFile" type="file" ${c.type==='PDF'?'accept="application/pdf,.pdf"':c.type==='Audio'?'accept="audio/*,.mp3,.m4a,.wav,.ogg"':c.type==='Image'?'accept="image/*"':''}></label></div>`;
  }
  if(c.url)return `<label class="field full"><span>Lien</span><input id="ecUrl" type="url" value="${esc(c.url)}"></label>`;
  if(c.type==='Texte'&&c.sourceType==='text')return `<label class="field full"><span>Texte</span><textarea id="ecText">${esc(c.text||'')}</textarea></label>`;
  return '';
}

editContent=function(id){
  const c=state.contents.find(x=>x.id===id);if(!c)return renderMedia();
  const hasIllustration=c.type!=='Image';
  panel.innerHTML=`<div class="card"><div class="eyebrow">Contenu</div><h2>Modifier le contenu</h2><div class="form-grid"><label class="field full"><span>Titre</span><input id="ecTitle" value="${esc(c.name)}"></label><label class="field"><span>Visible pour</span><select id="ecGroup">${groupOptions(c.audience||'all')}</select></label><label class="field full"><span>Description</span><textarea id="ecDesc">${esc(c.description||'')}</textarea></label>${contentFileBlock(c)}</div>${hasIllustration?`<div class="card" style="margin-top:14px"><div class="eyebrow">Image d’illustration</div><img id="ecPreviewImage" alt="Illustration de ${esc(c.name)}" style="display:none;width:100%;max-width:520px;max-height:300px;object-fit:contain;border-radius:12px;margin:10px 0;background:#f3f4f6"><div class="meta">${c.hasCover&&c.coverFileName?esc(c.coverFileName):c.hasCover?'Illustration enregistrée':'Aucune illustration'}</div><label class="field" style="margin-top:12px"><span>${c.hasCover?'Changer / remplacer l’image':'Ajouter une image'}</span><input id="ecCover" type="file" accept="image/*"></label>${c.hasCover?'<label class="check" style="margin-top:10px"><input id="ecRemoveCover" type="checkbox"><span>Retirer l’image d’illustration</span></label>':''}</div>`:`<div class="card" style="margin-top:14px"><div class="eyebrow">Aperçu de l’image</div><img id="ecPreviewImage" alt="${esc(c.name)}" style="display:none;width:100%;max-width:520px;max-height:300px;object-fit:contain;border-radius:12px;margin:10px 0;background:#f3f4f6"></div>`}<div class="actions" style="margin-top:16px"><button class="btn primary" id="saveContentEdit">Enregistrer</button><button class="btn" onclick="renderMedia()">Retour</button><button class="btn danger" id="deleteContentEdit">Supprimer</button></div></div><div class="card section"><div class="eyebrow">Utilisation</div><h2>Associé à</h2>${associationSummary(c.id)}</div><div class="card section"><h2>Modifier les associations</h2>${associationEditor(c.id)}<div class="actions" style="margin-top:18px"><button class="btn primary" id="saveAssociations">Enregistrer les associations</button></div></div>`;
  hydrateContentEditorPreview(c);
  if(c.type==='Audio'){const grid=panel.querySelector('.form-grid');if(grid&&!grid.querySelector('[data-audio-kind=edit]'))grid.insertAdjacentHTML('beforeend',audioKindField(window.canonicalAudioKind?.(c)||'Audios parlés','edit'));}
  saveContentEdit.onclick=async()=>{
    if(c.type==='Audio'){const kind=panel.querySelector('[data-audio-kind=edit]')?.value;if(!kind)return toast('Choisissez Chant audio ou Audio parlé');window.applyAudioKind?.(c,kind)}
    c.name=ecTitle.value.trim()||c.name;c.audience=ecGroup.value;c.description=ecDesc.value;
    if(document.getElementById('ecUrl'))c.url=ecUrl.value.trim();if(document.getElementById('ecText'))c.text=ecText.value;
    const file=document.getElementById('ecFile')?.files[0];
    if(file){
      if(c.type==='PDF'&&file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))return toast('Le fichier doit être un PDF');
      if(c.type==='Audio'&&!file.type.startsWith('audio/'))return toast('Le fichier doit être un audio');
      if(c.type==='Image'&&!file.type.startsWith('image/'))return toast('Le fichier doit être une image');
      await putMedia(c.id,file);c.fileName=file.name;c.sourceType='file';
    }
    const cover=document.getElementById('ecCover')?.files[0];
    if(cover){if(!cover.type.startsWith('image/'))return toast('L’illustration doit être une image');await putMedia('cover-'+c.id,cover);c.hasCover=true;c.coverFileName=cover.name;}
    if(document.getElementById('ecRemoveCover')?.checked){c.hasCover=false;c.coverFileName='';}
    saveState(state);editContent(c.id);toast('Contenu enregistré');
  };
  deleteContentEdit.onclick=()=>{if(typeof deleteEditedContent==='function')deleteEditedContent(c.id);else removeContent(c.id)};
  saveAssociations.onclick=()=>{
    state.celebrations.forEach(x=>(x.days||[]).forEach(d=>{d.contentIds=(d.contentIds||[]).filter(cid=>cid!==c.id)}));
    state.events.forEach(e=>{e.contentIds=(e.contentIds||[]).filter(cid=>cid!==c.id)});
    document.querySelectorAll('[data-content-day]:checked').forEach(el=>{const cel=state.celebrations.find(x=>x.id===Number(el.dataset.celebrationId));const d=cel?.days?.find(x=>x.key===el.dataset.dayKey);if(d)d.contentIds=[...new Set([...(d.contentIds||[]),c.id])]});
    document.querySelectorAll('[data-content-event]:checked').forEach(el=>{const e=state.events.find(x=>x.id===Number(el.dataset.contentEvent));if(e)e.contentIds=[...new Set([...(e.contentIds||[]),c.id])]});
    saveState(state);editContent(c.id);toast('Associations enregistrées');
  };
};
