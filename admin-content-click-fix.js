// Correctif ciblé : garantit l'ouverture de l'éditeur depuis Contenus > Modifier.
// La carte contient déjà l'identifiant exact du contenu dans son onclick ; on le lit
// directement au lieu de recalculer le contenu à partir de la position visuelle de la carte.
(function(){
  const panel=document.getElementById('panel');
  if(!panel)return;

  function contentIdForCard(card){
    if(!card)return null;
    const modify=[...card.querySelectorAll('button')].find(button=>button.textContent.trim()==='Modifier');
    const source=modify?.getAttribute('onclick')||card.getAttribute('onclick')||'';
    const match=source.match(/editContent\((?:"([^"]+)"|'([^']+)'|([^\)]+))\)/);
    if(!match)return null;
    const raw=(match[1]??match[2]??match[3]??'').trim();
    if(!raw)return null;
    if(/^[-+]?\d+(?:\.\d+)?$/.test(raw))return Number(raw);
    return raw;
  }

  panel.addEventListener('click',function(event){
    const button=event.target.closest('button');
    const card=event.target.closest('#adminLibraryList .resource-card');
    if(!card)return;

    const isModify=button&&button.textContent.trim()==='Modifier';
    const isCardClick=!button;
    if(!isModify&&!isCardClick)return;

    const contentId=contentIdForCard(card);
    if(contentId==null)return;

    event.preventDefault();
    event.stopPropagation();
    if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();
    if(typeof window.editContent==='function')window.editContent(contentId);
  },true);
})();
