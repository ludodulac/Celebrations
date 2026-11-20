(function(){
  const TOKEN_KEY='celebrations-admin-token';
  const sb=window.celebrationsCloudflare||null;
  let resolveReady;
  window.celebrationsAdminReady=new Promise(r=>resolveReady=r);

  window.getCelebrationsAdminToken=()=>localStorage.getItem(TOKEN_KEY)||'';
  window.celebrationsAccessInvoke=async function(action,payload={}){
    if(!sb)return {ok:false,error:'Connexion au serveur indisponible.'};
    const adminToken=window.getCelebrationsAdminToken();
    let data,error;
    try{({data,error}=await sb.functions.invoke('celebrations-access',{body:{action,...payload,...(action.startsWith('admin_')&&action!=='admin_login'?{admin_token:adminToken}:{})}}));}
    catch(e){return {ok:false,error:'Connexion au serveur impossible. Réessayez.'};}
    if(error)return {ok:false,error:data?.error||error.message||'Erreur serveur.'};
    return data||{ok:false,error:'Réponse serveur invalide.'};
  };

  function unlock(){
    document.body.classList.remove('admin-auth-locked');
    document.getElementById('adminPasswordGate')?.remove();
    window.dispatchEvent(new CustomEvent('celebrations-admin-auth-changed',{detail:{authenticated:true}}));
    resolveReady?.(true);resolveReady=null;
  }

  function showGate(message=''){
    document.body.classList.add('admin-auth-locked');
    let gate=document.getElementById('adminPasswordGate');
    if(!gate){gate=document.createElement('div');gate.id='adminPasswordGate';gate.className='admin-password-gate';document.body.appendChild(gate)}
    gate.innerHTML=`<form class="admin-password-dialog" id="adminPasswordForm"><div class="eyebrow">Administration</div><h1>Accès administrateur</h1><p>Entrez le mot de passe administrateur. Cet appareil restera ensuite reconnu.</p><label class="field"><span>Mot de passe</span><input id="adminGatePassword" type="password" autocomplete="current-password" required autofocus></label><button class="btn primary" type="submit">Entrer</button>${message?`<div class="admin-auth-error">${esc(message)}</div>`:''}<a class="admin-gate-back" href="index.html">Retour au site</a></form>`;
    document.getElementById('adminPasswordForm').onsubmit=async e=>{
      e.preventDefault();const password=document.getElementById('adminGatePassword').value;
      const btn=e.currentTarget.querySelector('button[type=submit]');btn.disabled=true;btn.textContent='Vérification…';
      const result=await window.celebrationsAccessInvoke('admin_login',{email:'admin@celebrations.local',password});
      if(!result.ok||!result.token){showGate(result.error||'Mot de passe incorrect.');return}
      localStorage.setItem(TOKEN_KEY,result.token);unlock();
    };
  }

  (async()=>{
    const token=window.getCelebrationsAdminToken();
    if(token){
      const result=await window.celebrationsAccessInvoke('admin_session');
      if(result.ok){unlock();return}
      localStorage.removeItem(TOKEN_KEY);
    }
    showGate();
  })();
})();