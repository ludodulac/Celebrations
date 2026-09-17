// Administration guidée : interface orientée tâches, sans modifier le modèle de données.
(function(){
  const guide=(title,text,steps=[])=>`<aside class="admin-guide"><strong>${esc(title)}</strong><p>${esc(text)}</p>${steps.length?`<ol>${steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:''}</aside>`;
  function renameNavigation(){
    const labels={celebrations:'Programme',media:'Bibliothèque','committee-links':'Liens du comité'};
    document.querySelectorAll('[data-admin]').forEach(b=>{if(labels[b.dataset.admin])b.textContent=labels[b.dataset.admin]});
    const brand=document.querySelector('.admin-brand');if(brand)brand.textContent='Gestion du site';
  }
  function decorateDay(){
    const editor=document.querySelector('.day-editor');if(!editor)return;
    const head=editor.querySelector('.admin-view-head');
    if(head&&!editor.querySelector(':scope > .admin-guide'))head.insertAdjacentHTML('afterend',guide('Cette page suffit dans la plupart des cas','Modifiez ici ce que les visiteurs doivent voir pendant cette étape. La bibliothèque reste disponible uniquement pour réutiliser un ancien élément.',['1. Vérifiez le texte et la date.','2. Ajoutez ce que vous voulez montrer.','3. Ajoutez un rendez-vous seulement si une heure précise est nécessaire.']));
    const contents=editor.querySelector('.day-editor-contents');
    if(contents){
      const h=contents.querySelector('h2');if(h)h.textContent='Ce que les visiteurs peuvent ouvrir';
      const sub=contents.querySelector('.admin-subtle');if(sub)sub.textContent='Documents, images, audios, vidéos, textes et liens de cette étape';
      const create=document.getElementById('createDayContent');if(create)create.textContent='+ Ajouter';
      const associate=document.getElementById('associateDayContent');if(associate){associate.textContent='Réutiliser un ancien contenu';associate.classList.add('admin-secondary-action');}
    }
    const events=editor.querySelector('.day-editor-events');
    if(events){const sub=events.querySelector('.admin-subtle');if(sub)sub.textContent='Uniquement pour quelque chose prévu à une heure précise';}
    const links=editor.querySelector('.day-editor-links');
    if(links){links.classList.add('admin-advanced');const h=links.querySelector('h3');if(h)h.textContent='Liens rapides — option avancée';}
    const addLink=document.getElementById('addLink');if(addLink){addLink.textContent='+ Lien rapide';addLink.classList.add('admin-secondary-action');}
  }

  const oldSetTab=setTab;setTab=function(t){oldSetTab(t);renameNavigation()};
  const oldCelebrations=renderCelebrations;renderCelebrations=function(){oldCelebrations();const card=panel.querySelector('.card');if(card)card.insertAdjacentHTML('afterbegin',guide('Que voulez-vous modifier ?','Ouvrez la célébration concernée, puis l’étape à modifier. Tout le travail courant se fait ensuite dans cette étape.',['Ouvrez une célébration.','Ouvrez une étape.','Ajoutez ou modifiez ce qui doit apparaître.']));panel.querySelectorAll('.row-actions .primary').forEach(b=>b.textContent='Ouvrir')};
  const oldEditDay=editDay;editDay=function(key){oldEditDay(key);decorateDay()};

  // Assistant unique pour créer un contenu. Le modèle de données existant est conservé.
  renderInlineContentCreator=function(targetId,onCreated){
    const target=document.getElementById(targetId);if(!target)return;
    target.innerHTML=`<div class="admin-add-wizard"><div class="wizard-head"><div><h3>Qu’est-ce que vous voulez ajouter ?</h3><p>Choisissez un type. Vous ne verrez ensuite que les champs utiles.</p></div><button type="button" class="btn small" data-a="cancel">Fermer</button></div><div class="wizard-types">${['PDF','Audio','Texte','Vidéo','Image','Lien'].map(t=>`<button type="button" class="wizard-type" data-type="${t}"><strong>${icon(t)} ${t==='Lien'?'Lien internet':t}</strong><span>${({PDF:'Un document PDF',Audio:'Un enregistrement audio',Texte:'Un texte à lire sur le site',Vidéo:'Une vidéo accessible par un lien',Image:'Une image à afficher',Lien:'Un lien vers une autre page'})[t]}</span></button>`).join('')}</div><div data-wizard-form></div></div>`;
    target.querySelector('[data-a=cancel]').onclick=()=>target.innerHTML='';
    const form=target.querySelector('[data-wizard-form]');
    const draw=t=>{
      target.querySelectorAll('.wizard-type').forEach(b=>b.classList.toggle('active',b.dataset.type===t));
      const source=t==='PDF'?'<label class="field full"><span>Choisir le PDF</span><input data-f="file" type="file" accept="application/pdf,.pdf"></label>':t==='Image'?'<label class="field full"><span>Choisir l’image</span><input data-f="file" type="file" accept="image/*"></label>':t==='Audio'?'<label class="field full"><span>Choisir l’audio</span><input data-f="file" type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg"></label>':t==='Texte'?'<label class="field full"><span>Texte à afficher</span><textarea data-f="text" rows="8" placeholder="Écrivez ou collez le texte ici…"></textarea></label>':`<label class="field full"><span>${t==='Vidéo'?'Adresse de la vidéo':'Adresse du lien'}</span><input data-f="url" type="url" placeholder="https://…"></label>`;
      form.innerHTML=`<div class="wizard-form-card"><div class="wizard-step">Vous ajoutez : <strong>${esc(t==='Lien'?'Lien internet':t)}</strong></div><div class="form-grid"><label class="field full"><span>Titre visible sur le site</span><input data-f="title" placeholder="Ex. Livret de la célébration"></label>${source}<details class="wizard-options"><summary>Options facultatives</summary><div class="form-grid"><label class="field"><span>Visible pour</span><select data-f="group">${groupOptions()}</select></label><label class="field full"><span>Petite description</span><textarea data-f="desc"></textarea></label>${!['Image','Texte'].includes(t)?'<label class="field full"><span>Image d’illustration</span><input data-f="cover" type="file" accept="image/*"></label>':''}</div></details></div><div class="actions"><button type="button" class="btn primary" data-a="save">Ajouter sur cette étape</button><button type="button" class="btn" data-a="back">Choisir un autre type</button></div></div>`;
      form.querySelector('[data-a=back]').onclick=()=>{form.innerHTML='';target.querySelectorAll('.wizard-type').forEach(b=>b.classList.remove('active'))};
      form.querySelector('[data-a=save]').onclick=async()=>{
        const title=form.querySelector('[data-f=title]').value.trim();if(!title)return toast('Indiquez le titre qui sera visible sur le site');
        const id=Date.now(),item={id,name:title,type:t,category:TYPE_CATEGORY[t]||t,audience:form.querySelector('[data-f=group]')?.value||'all',description:form.querySelector('[data-f=desc]')?.value||'',sourceType:'',url:'',text:'',fileName:'',hasCover:false};ensureCategory(item.category);
        if(t==='Vidéo'||t==='Lien'){const u=form.querySelector('[data-f=url]').value.trim();if(!u)return toast('Collez une adresse internet');item.sourceType='url';item.url=u;}
        else if(t==='Texte'){const tx=form.querySelector('[data-f=text]').value.trim();if(!tx)return toast('Écrivez ou collez le texte');item.sourceType='text';item.text=tx;}
        else {const file=form.querySelector('[data-f=file]').files[0];if(!file)return toast('Choisissez le fichier à ajouter');if(t==='PDF'&&file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))return toast('Choisissez un fichier PDF');if(t==='Audio'&&!file.type.startsWith('audio/'))return toast('Choisissez un fichier audio');if(t==='Image'&&!file.type.startsWith('image/'))return toast('Choisissez une image');item.sourceType='file';item.fileName=file.name;await putMedia(id,file);}
        const cover=form.querySelector('[data-f=cover]')?.files[0];if(cover){if(!cover.type.startsWith('image/'))return toast('L’illustration doit être une image');await putMedia('cover-'+id,cover);item.hasCover=true;item.coverFileName=cover.name;}
        state.contents.push(item);saveState(state);target.innerHTML='';onCreated(id);toast('Ajouté sur l’étape');
      };
    };
    target.querySelectorAll('.wizard-type').forEach(b=>b.onclick=()=>draw(b.dataset.type));
  };

  const oldMedia=renderMedia;renderMedia=function(){oldMedia();renameNavigation();const card=panel.querySelector('.card');if(card)card.insertAdjacentHTML('afterbegin',guide('Bibliothèque — pour réutiliser ou corriger','Vous n’avez normalement pas besoin de venir ici pour ajouter quelque chose à une étape. Utilisez Programme → étape → Ajouter. Cette page sert à retrouver un élément déjà créé, le corriger ou le réutiliser.'));};

  // Rend les rendez-vous compréhensibles après les différents modules existants.
  const oldEvent=window.showDayEventForm;
  if(typeof oldEvent==='function')window.showDayEventForm=function(dayKey,eventId=null){oldEvent(dayKey,eventId);const target=document.getElementById('dayEventForm');if(!target)return;const box=target.firstElementChild;if(box&&!target.querySelector('.event-guide'))box.insertAdjacentHTML('afterbegin',`<div class="event-guide"><strong>${eventId?'Modifier ce rendez-vous':'Nouveau rendez-vous'}</strong><span>Indiquez l’heure et le titre. Ajoutez un lien seulement si les visiteurs doivent ouvrir une vidéo, une visioconférence ou une page internet.</span></div>`);const heading=[...target.querySelectorAll('h4')].find(h=>/contenus associés/i.test(h.textContent));if(heading)heading.textContent='Documents ou médias liés à ce rendez-vous (facultatif)';};
  renameNavigation();
})();