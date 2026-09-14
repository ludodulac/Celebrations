(function(){
  const sb=window.celebrationsSupabase||null;
  const PREF_KEY='celebrations-admin-preferences';
  let coreReady=false,syncing=false,pending=null;
  const pendingMedia=new Map();

  function preferences(){try{return JSON.parse(localStorage.getItem(PREF_KEY)||'{}')}catch(e){return {}}}
  function savePreferences(s){localStorage.setItem(PREF_KEY,JSON.stringify({adminCelebrationId:s.adminCelebrationId||null}))}
  function cloneData(v){return JSON.parse(JSON.stringify(v||[]))}
  function uploadStatus(detail){window.dispatchEvent(new CustomEvent('celebrations-upload-status',{detail}))}
  function applyPendingMedia(s){for(const [key,meta] of pendingMedia){const cover=key.startsWith('cover-'),id=cover?key.slice(6):key,c=(s.contents||[]).find(x=>String(x.id)===String(id));if(!c)continue;if(cover){c.hasCover=true;c.coverStoragePath=meta.path;c.coverFileName=meta.fileName}else{c.storagePath=meta.path;c.fileName=meta.fileName;c.mimeType=meta.mimeType||'';c.sourceType='file'}pendingMedia.delete(key)}}
  function snapshot(s){applyPendingMedia(s);return {celebrations:cloneData(s.celebrations),events:cloneData(s.events),contents:cloneData(s.contents),groups:cloneData(s.groups)}}

  async function invoke(payload){if(!sb)return {ok:false,error:'Connexion Supabase indisponible.'};const adminToken=window.getCelebrationsAdminToken?.()||'';const {data,error}=await sb.functions.invoke('celebrations-admin-data',{body:{...payload,admin_token:adminToken}});if(error)return {ok:false,error:data?.error||error.message||'Enregistrement Supabase impossible.'};return data||{ok:false,error:'Réponse Supabase invalide.'}}
  async function flush(){if(syncing)return;syncing=true;while(pending){const data=pending;pending=null;window.celebrationsCoreSyncStatus='saving';window.dispatchEvent(new CustomEvent('celebrations-core-saving'));const result=await invoke({action:'replace_all',...data});if(!result.ok){window.celebrationsCoreSyncStatus='error';console.error('Synchronisation Supabase',result.error);try{toast(result.error||'Enregistrement Supabase impossible')}catch(e){}window.dispatchEvent(new CustomEvent('celebrations-core-error',{detail:{error:result.error||'Enregistrement Supabase impossible'}}));pending=data;break}window.celebrationsCoreSyncStatus='saved';window.dispatchEvent(new CustomEvent('celebrations-core-saved'))}syncing=false}
  window.saveState=function(s){savePreferences(s);if(!coreReady)return;pending=snapshot(s);flush()};
  window.celebrationsFlushCore=async()=>{pending=snapshot(state);await flush()};

  window.putMedia=async function(key,file){
    if(!file)throw new Error('Fichier manquant');
    const raw=String(key),cover=raw.startsWith('cover-'),contentId=cover?raw.slice(6):raw;
    uploadStatus({status:'preparing',key:raw,fileName:file.name,size:file.size||0});
    try{
      const signed=await invoke({action:'create_upload',content_id:contentId,kind:cover?'cover':'file',file_name:file.name});
      if(!signed.ok||!signed.path||!signed.token)throw new Error(signed.error||'Préparation de l’upload impossible.');
      uploadStatus({status:'uploading',mode:'signed-standard',key:raw,fileName:file.name,size:file.size||0});
      const {error}=await sb.storage.from(CELEBRATIONS_MEDIA_BUCKET).uploadToSignedUrl(signed.path,signed.token,file,{contentType:file.type||undefined});
      if(error)throw error;
      pendingMedia.set(raw,{path:signed.path,fileName:file.name,mimeType:file.type||''});
      uploadStatus({status:'uploaded',key:raw,fileName:file.name,size:file.size||0,path:signed.path,percent:100});
      return signed.path;
    }catch(error){uploadStatus({status:'error',key:raw,fileName:file.name,size:file.size||0,error:error?.message||String(error)});throw error}
  };
  window.deleteMedia=async function(key){const raw=String(key),cover=raw.startsWith('cover-'),id=cover?raw.slice(6):raw,c=(state.contents||[]).find(x=>String(x.id)===String(id)),path=cover?c?.coverStoragePath:c?.storagePath;if(!path)return;const result=await invoke({action:'delete_paths',paths:[path]});if(!result.ok)throw new Error(result.error||'Suppression impossible.');if(cover){c.hasCover=false;c.coverStoragePath='';c.coverFileName=''}else{c.storagePath='';c.fileName='';c.mimeType=''}};

  async function boot(){if(window.celebrationsAdminReady)await window.celebrationsAdminReady;if(typeof loadStateFromSupabase!=='function')return;try{const fresh=await loadStateFromSupabase(),pref=preferences();if(pref.adminCelebrationId&&fresh.celebrations.some(c=>c.id===Number(pref.adminCelebrationId)))fresh.adminCelebrationId=Number(pref.adminCelebrationId);Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,fresh);if(typeof ensureFixedSteps==='function')state.celebrations.forEach(ensureFixedSteps);coreReady=true;localStorage.removeItem('celebrations-state');try{indexedDB.deleteDatabase('celebrations-media-v1')}catch(e){}window.celebrationsCoreSyncStatus='saved';render();window.dispatchEvent(new CustomEvent('celebrations-core-ready'))}catch(e){console.error('Chargement Supabase administration',e);window.celebrationsCoreSyncStatus='error';const p=document.getElementById('panel');if(p)p.innerHTML='<div class="notice">Impossible de charger les données Supabase. Aucune modification locale ne sera utilisée comme source.</div>'}}boot();
})();