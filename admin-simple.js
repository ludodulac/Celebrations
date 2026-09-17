// Administration guidée : simplifie le vocabulaire sans modifier le modèle de données.
(function(){
  function helpBox(title,text,steps){
    return `<aside class="admin-guide"><strong>${esc(title)}</strong><p>${esc(text)}</p>${steps?.length?`<ol>${steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>`:''}</aside>`;
  }
  function renameNavigation(){
    const labels={celebrations:'Programme',media:'Bibliothèque', 'committee-links':'Liens du comité'};
    document.querySelectorAll('[data-admin]').forEach(b=>{if(labels[b.dataset.admin])b.textContent=labels[b.dataset.admin]});
    const brand=document.querySelector('.admin-brand');if(brand)brand.textContent='Gestion du site';
  }
  const originalSetTab=setTab;
  setTab=function(t){originalSetTab(t);renameNavigation()};

  const originalCelebrations=renderCelebrations;
  renderCelebrations=function(){
    originalCelebrations();
    const card=panel.querySelector('.card');
    if(card)card.insertAdjacentHTML('afterbegin',helpBox('Par où commencer ?','Choisissez la célébration que vous voulez mettre à jour. Vous pourrez ensuite ouvrir directement chaque étape et ajouter ce qui doit apparaître sur le site.',['Cliquez sur Gérer.','Ouvrez une étape.','Ajoutez le texte, les documents, les liens ou les rendez-vous.']));
    panel.querySelectorAll('.row-actions .primary').forEach(b=>b.textContent='Ouvrir');
  };

  const originalEditDay=editDay;
  editDay=function(key){
    originalEditDay(key);
    const editor=document.querySelector('.day-editor');if(!editor)return;
    const head=editor.querySelector('.admin-view-head');
    if(head)head.insertAdjacentHTML('afterend',helpBox('Vous modifiez cette étape','Tout ce que vous ajoutez ici apparaîtra dans cette partie de la célébration. Pas besoin de gérer les associations techniques : choisissez simplement ce que vous voulez afficher.',['Écrivez le texte de présentation si nécessaire.','Ajoutez un document, une image, un audio, une vidéo, un texte ou un lien.','Ajoutez un rendez-vous uniquement s’il doit apparaître à une heure précise.','Cliquez sur Enregistrer l’étape après avoir modifié le texte ou les liens rapides.']));
    const contents=editor.querySelector('.day-editor-contents');
    if(contents){
      const h=contents.querySelector('h2');if(h)h.textContent='Documents, médias et liens';
      const sub=contents.querySelector('.admin-subtle');if(sub)sub.textContent='Ce que les visiteurs pourront ouvrir pendant toute cette étape';
      const create=document.getElementById('createDayContent');if(create)create.textContent='+ Ajouter quelque chose';
      const associate=document.getElementById('associateDayContent');if(associate){associate.textContent='Choisir dans la bibliothèque';associate.title='Réutiliser un document ou un lien déjà ajouté au site';}
    }
    const events=editor.querySelector('.day-editor-events');
    if(events){const sub=events.querySelector('.admin-subtle');if(sub)sub.textContent='À utiliser seulement pour un élément prévu à une heure précise';}
    const links=editor.querySelector('.day-editor-links h3');if(links)links.textContent='Liens rapides (facultatif)';
    const addLink=document.getElementById('addLink');if(addLink){addLink.textContent='+ Ajouter un lien rapide';addLink.title='Pour un simple lien internet. Pour un document ou média, utilisez Ajouter quelque chose ci-dessous.';}
  };

  if(typeof renderInlineContentCreator==='function'){
    const originalCreator=renderInlineContentCreator;
    renderInlineContentCreator=function(targetId,onCreated){
      originalCreator(targetId,onCreated);
      const target=document.getElementById(targetId);if(!target)return;
      target.insertAdjacentHTML('afterbegin',helpBox('Ajouter quelque chose','Choisissez simplement le type de chose que vous voulez montrer aux visiteurs. Le site s’occupe du reste.',['PDF pour un document.','Audio pour un enregistrement.','Texte pour une lecture directement sur le site.','Vidéo pour un lien vidéo.','Image pour une illustration.','Lien pour envoyer vers une autre page internet.']));
    };
  }

  const originalMedia=renderMedia;
  renderMedia=function(){
    originalMedia();renameNavigation();
    const card=panel.querySelector('.card');
    if(card)card.insertAdjacentHTML('afterbegin',helpBox('Bibliothèque','Cette page sert surtout à retrouver ou réutiliser des contenus déjà présents. Pour ajouter quelque chose à une journée précise, le plus simple est de passer par Programme → étape → Ajouter quelque chose.'));
  };

  renameNavigation();
})();