(function(){
  // Capacité conservée volontairement mais masquée dans l'administration.
  // Si plusieurs célébrations doivent redevenir visibles un jour, remettre ce drapeau à true.
  const ENABLE_OTHER_CELEBRATIONS_ADMIN=false;
  if(!ENABLE_OTHER_CELEBRATIONS_ADMIN)return;

  const host=document.createElement('section');host.id='celebrationVisibilityAdmin';host.className='footer-pages-admin';
  const participants=document.getElementById('participantsAdmin');
  (participants?.parentNode||document.body).insertBefore(host,participants?.nextSibling||null);
  const sb=window.celebrationsCloudflare||null;
  let showOthers=false,loading=true,message='';
  async function invoke(action,payload={}){
    if(!sb)return {ok:false,error:'Connexion au serveur indisponible.'};
    const {data,error}=await sb.functions.invoke('celebrations-visibility',{body:{action,...payload}});
    if(error)return {ok:false,error:data?.error||error.message||'Erreur serveur.'};
    return data||{ok:false,error:'Réponse serveur invalide.'};
  }
  function render(){
    const label=showOthers?'Ne pas afficher les autres célébrations':'Afficher les autres célébrations';
    const explanation=showOthers?'Les visiteurs peuvent actuellement choisir parmi toutes les célébrations.':'Les visiteurs voient uniquement la célébration en cours. Les autres célébrations restent disponibles dans l’administration.';
    host.innerHTML=`<div class="card"><div class="section-head"><div><div class="eyebrow">Affichage public</div><h2 style="margin:4px 0 0">Autres célébrations</h2></div></div><p class="muted">${explanation}</p><button type="button" class="btn ${showOthers?'':'primary'}" id="toggleOtherCelebrations" ${loading?'disabled':''}>${loading?'Chargement…':label}</button>${message?`<div class="meta" style="margin-top:8px">${esc(message)}</div>`:''}</div>`;
    const btn=document.getElementById('toggleOtherCelebrations');if(btn)btn.onclick=toggle;
  }
  async function load(){loading=true;render();const r=await invoke('get');loading=false;if(r.ok)showOthers=!!r.show_other_celebrations;else message=r.error||'Réglage indisponible.';render()}
  async function toggle(){loading=true;message='';render();const r=await invoke('set',{admin_token:window.getCelebrationsAdminToken?.()||'',show_other_celebrations:!showOthers});loading=false;if(r.ok){showOthers=!!r.show_other_celebrations;message=showOthers?'Les autres célébrations sont maintenant visibles sur le site.':'Seule la célébration en cours est maintenant visible sur le site.'}else message=r.error||'Modification impossible.';render()}
  (window.celebrationsAdminReady||Promise.resolve(true)).then(load);
})();