(async function(){
  const app=document.querySelector('main.container');
  if(app){app.style.visibility='hidden';app.setAttribute('aria-busy','true')}
  try{
    const fresh=await loadStateFromSupabase();
    Object.keys(state).forEach(k=>delete state[k]);
    Object.assign(state,fresh);
    window.state=state;
    const c=current();
    if(typeof openPublicCelebration==='function'&&c)openPublicCelebration(c.id,false);
    else{renderHero();renderProgram();renderLibrary();renderInfo()}

    const slug=decodeURIComponent(location.pathname.split('/').filter(Boolean).pop()||'').toLowerCase();
    const days=typeof dayList==='function'?dayList():[];
    const urlDay=typeof dayFromLocation==='function'?dayFromLocation(days):null;
    if(urlDay){
      activeDay=urlDay.key;
      if(typeof showTab==='function')showTab('program');
    }else if(slug==='programme'){
      if(typeof showTab==='function')showTab('program');
    }else if(slug==='bibliotheque'||slug==='mediatheque'){
      if(typeof showTab==='function')showTab('library');
    }
  }catch(e){
    console.error('Chargement Supabase impossible',e);
    const hero=document.getElementById('hero');
    if(hero)hero.insertAdjacentHTML('afterbegin','<div class="notice">Connexion aux données momentanément indisponible.</div>')
  }finally{
    document.body.classList.remove('public-loading');
    if(app){app.style.visibility='';app.removeAttribute('aria-busy')}
  }
})();