(async function(){
  const app=document.querySelector('main.container');
  if(app){app.style.visibility='hidden';app.setAttribute('aria-busy','true')}
  try{
    const fresh=await loadStateFromSupabase();
    Object.keys(state).forEach(k=>delete state[k]);
    Object.assign(state,fresh);
    window.state=state;
    const days=dayList();
    const urlDay=typeof dayFromLocation==='function'?dayFromLocation(days):null;
    if(urlDay)activeDay=urlDay.key;
    const c=current();
    if(typeof openPublicCelebration==='function'&&c)openPublicCelebration(c.id,false);
    else{renderHero();renderProgram();renderLibrary();renderInfo()}
  }catch(e){
    console.error('Chargement Supabase impossible',e);
    const hero=document.getElementById('hero');
    if(hero)hero.insertAdjacentHTML('afterbegin','<div class="notice">Connexion aux données momentanément indisponible.</div>')
  }finally{
    if(app){app.style.visibility='';app.removeAttribute('aria-busy')}
  }
})();