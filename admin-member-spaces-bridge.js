// M011-C integration hook, loaded LAST in the existing admin.html.
// Do not replace render(), admin auth, navigation or the legacy save lifecycle.
(function(){
  if(typeof setTab!=='function'||!document.getElementById('panel'))return;
  const originalSetTab=setTab;
  let mount=null, navigationVersion=0;
  const panelRoot=document.getElementById('panel');
  async function openMemberSpaces(){
    const version=++navigationVersion;
    mount?.destroy();mount=null;
    document.querySelectorAll('[data-admin]').forEach(button=>
      button.classList.toggle('active',button.dataset.admin==='members-spaces'));
    const heading=document.createElement('p');
    heading.setAttribute('role','status');
    heading.textContent='Ouverture de la gestion des membres et des espaces…';
    panelRoot.replaceChildren(heading);
    try {
      const authenticated=await window.celebrationsAdminReady;
      if(version!==navigationVersion)return;
      if(authenticated!==true || document.body.classList.contains('admin-auth-locked'))
        throw new Error('Authentification administrateur nécessaire.');
      const module=await import('./migration/cloudflare/app/admin/editor-member-spaces-integration.mjs');
      if(version!==navigationVersion)return;
      const transport=module.createMemberDirectoryTransport({
        tokenProvider:()=>window.getCelebrationsAdminToken?.()||''
      });
      mount=module.mountExistingEditorMemberSpaces(panelRoot,{
        transport,celebrations:state.celebrations,
        currentCelebrationId:state.adminCelebrationId
      });
    }catch(error){
      if(version===navigationVersion){
        heading.textContent='Gestion indisponible : '+(error?.message||'erreur inconnue');
        panelRoot.replaceChildren(heading);
      }
    }
  }
  setTab=function(section){
    if(section==='members-spaces'){void openMemberSpaces();return;}
    ++navigationVersion;
    if(mount){mount.destroy();mount=null;}
    return originalSetTab(section);
  };
  // Other existing tabs use their own handlers and remain untouched.
  window.addEventListener('celebrations-admin-auth-changed',event=>{
    if(event.detail?.authenticated===false && mount){
      ++navigationVersion;mount.destroy();mount=null;panelRoot.replaceChildren();
    }
  });
})();
