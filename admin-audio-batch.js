(function(){
  const AUDIO_KINDS=['Chants audio','Audios parlés'];
  let busy=false;
  const waitForCore=()=>window.celebrationsCoreSyncStatus?Promise.resolve():new Promise(resolve=>window.addEventListener('celebrations-core-ready',resolve,{once:true}));
  function install(){
    const form=document.getElementById('mediaForm');
    if(!form||document.querySelector('.type-card.active')?.dataset.type!=='Audio')return;
    const input=form.querySelector('#mFile');
    if(input&&!input.multiple){input.multiple=true;input.setAttribute('multiple','');const span=input.closest('label')?.querySelector('span');if(span)span.textContent='Fichiers MP3 / audio (plusieurs possibles)';}
    const title=form.querySelector('#mTitle');if(title){title.required=false;title.placeholder='Facultatif en chargement multiple : le nom du fichier sera utilisé';}
    const btn=form.querySelector('#saveMedia');if(btn&&!btn.dataset.batchAudio){btn.dataset.batchAudio='1';btn.textContent='Ajouter les audios';btn.addEventListener('click',batchSave,true);}
  }
  async function batchSave(e){
    const form=document.getElementById('mediaForm'),input=form?.querySelector('#mFile'),source=form?.querySelector('#mSource');
    if(!form||document.querySelector('.type-card.active')?.dataset.type!=='Audio'||source?.value!=='file'||!input||input.files.length<2)return;
    e.preventDefault();e.stopImmediatePropagation();if(busy)return;
    const kind=form.querySelector('[data-audio-kind=global]')?.value;
    if(!kind){toast('Choisissez Chant audio ou Audio parlé');return;}
    const files=[...input.files];if(files.some(f=>!(f.type||'').startsWith('audio/')&&!/\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(f.name))){toast('Tous les fichiers doivent être des audios');return;}
    busy=true;const btn=form.querySelector('#saveMedia');btn.disabled=true;
    await waitForCore();
    let ok=0;
    try{
      for(let i=0;i<files.length;i++){
        const file=files[i],id=`audio-${Date.now()}-${i}-${Math.random().toString(36).slice(2,7)}`;
        btn.textContent=`Chargement ${i+1}/${files.length}…`;
        try{
          await putMedia(id,file);
          const base=file.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
          state.contents.push({id,name:base||file.name,type:'Audio',category:kind,audioKind:kind==='Chants audio'?'chant':'spoken',audience:form.querySelector('#mGroup')?.value||'all',description:form.querySelector('#mDesc')?.value||'',sourceType:'file',url:'',text:'',fileName:file.name,mimeType:file.type||'audio/mpeg',hasCover:false});
          saveState(state);ok++;
          if(window.celebrationsFlushCore)await window.celebrationsFlushCore();
        }catch(err){console.error('Upload audio',file.name,err);toast(`Erreur sur ${file.name} — ${ok} audio(s) déjà enregistré(s)`);break;}
      }
      if(ok===files.length){toast(`${ok} audios ajoutés dans « ${kind} »`);renderMedia();}
    }finally{busy=false;if(btn?.isConnected){btn.disabled=false;btn.textContent='Ajouter les audios';}}
  }
  const observer=new MutationObserver(()=>install());observer.observe(document.getElementById('panel'),{childList:true,subtree:true});install();
})();
