(async function(){
  const app=document.querySelector('main.container');
  if(app){app.style.visibility='hidden';app.setAttribute('aria-busy','true')}
  try{
    const fresh=await loadStateFromSupabase();
    Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,fresh);window.state=state;
    const c=current();if(typeof openPublicCelebration==='function'&&c)openPublicCelebration(c.id,false);else{renderHero();renderProgram();renderLibrary();renderInfo()}
    if(typeof window.restorePublicRoute==='function')window.restorePublicRoute();
  }catch(e){console.error('Chargement Supabase impossible',e);const hero=document.getElementById('hero');if(hero)hero.insertAdjacentHTML('afterbegin','<div class="notice">Connexion aux données momentanément indisponible.</div>')}
  finally{document.documentElement.classList.add('public-ready');document.body.classList.remove('public-loading');if(app){app.style.visibility='';app.removeAttribute('aria-busy')}}
})();