// Correctif final, chargé en dernier : cible uniquement l'affichage des rendez-vous publics.
(function(){
  function polishProgram(){
    const mobile=window.matchMedia('(max-width:850px)').matches;
    const size=mobile?72:96;
    document.querySelectorAll('#program .event img').forEach(img=>{
      ['width','min-width','max-width','height','min-height','max-height'].forEach(p=>img.style.setProperty(p,size+'px','important'));
      img.style.setProperty('aspect-ratio','1 / 1','important');
      img.style.setProperty('object-fit','cover','important');
      img.style.setProperty('margin','0','important');
      img.style.setProperty('border-radius','10px','important');
      const box=img.closest('.public-content');
      if(box){
        box.style.setProperty('display','grid','important');
        box.style.setProperty('grid-template-columns',size+'px minmax(0,1fr)','important');
        box.style.setProperty('gap','10px','important');
        box.style.setProperty('align-items','start','important');
        box.style.setProperty('width','100%','important');
      }
    });
    document.querySelectorAll('#program .event .meta').forEach(meta=>{
      meta.textContent=meta.textContent.replace(/\s*[·•]\s*Tous\s*$/i,'').trim();
    });
  }
  const program=document.getElementById('program');
  if(program){
    polishProgram();
    new MutationObserver(polishProgram).observe(program,{childList:true,subtree:true});
    window.addEventListener('resize',polishProgram);
  }
})();
