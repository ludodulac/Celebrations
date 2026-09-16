// Conserve le type de contenu sélectionné dans l'administration après un ajout.
(function(){
  let selectedType='PDF';

  function applySelectedType(){
    const cards=[...document.querySelectorAll('.type-card[data-type]')];
    if(!cards.length)return;
    const target=cards.find(b=>b.dataset.type===selectedType);
    if(!target)return;
    cards.forEach(b=>b.classList.toggle('active',b===target));
    if(typeof window.renderMediaForm==='function')window.renderMediaForm(selectedType);
  }

  document.addEventListener('click',function(e){
    const card=e.target.closest?.('.type-card[data-type]');
    if(card)selectedType=card.dataset.type;
  },true);

  const original=window.renderMedia;
  if(typeof original==='function'){
    window.renderMedia=function(){
      original.apply(this,arguments);
      if(selectedType!=='PDF')applySelectedType();
    };
  }
})();
