// Correctif ciblé : garantit l'ouverture de l'éditeur depuis Contenus > Modifier.
// On intercepte le clic au niveau du panneau afin de ne pas dépendre des onclick générés.
(function(){
  const panel=document.getElementById('panel');
  if(!panel)return;

  function contentForCard(card){
    const list=document.getElementById('adminLibraryList');
    if(!list||!card)return null;
    const cards=[...list.querySelectorAll('.resource-card')];
    const index=cards.indexOf(card);
    if(index<0)return null;
    const visible=(state.contents||[]).filter(c=>typeof adminLibraryMatches==='function'?adminLibraryMatches(c):true);
    return visible[index]||null;
  }

  panel.addEventListener('click',function(event){
    const button=event.target.closest('button');
    const card=event.target.closest('#adminLibraryList .resource-card');
    if(!card)return;

    const isModify=button&&button.textContent.trim()==='Modifier';
    const isCardClick=!button;
    if(!isModify&&!isCardClick)return;

    const content=contentForCard(card);
    if(!content)return;

    event.preventDefault();
    event.stopPropagation();
    if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();
    if(typeof window.editContent==='function')window.editContent(content.id);
  },true);
})();
