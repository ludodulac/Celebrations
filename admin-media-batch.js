(function(){
  let busy=false;
  const waitForCore=()=>window.celebrationsCoreSyncStatus?Promise.resolve():new Promise(resolve=>window.addEventListener('celebrations-core-ready',resolve,{once:true}));
  function currentType(){return document.querySelector('.type-card.active')?.dataset.type||''}
  function install(){
    const type=currentType(),form=document.getElementById('mediaForm');if(!form||!['PDF','Image','Texte'].includes(type))return;
    if(type==='Texte'&&form.querySelector('#mSource')?.value!=='file')return;
    const input=form.querySelector('#mFile');if(input&&!input.multiple){input.multiple=true;input.setAttribute('multiple','');const span=input.closest('label')?.querySelector('span');if(span)span.textContent=type==='PDF'?'Fichiers PDF (plusieurs possibles)':type==='Image'?'Fichiers image (plusieurs possibles)':'Documents texte (plusieurs possibles)'}
    const title=form.querySelector('#mTitle');if(title){title.required=false;title.placeholder='Facultatif : le nom du fichier d’origine sera utilisé'}
    const btn=form.querySelector('#saveMedia');if(btn&&!btn.dataset.batchMedia){btn.dataset.batchMedia='1';btn.textContent=type==='PDF'?'Ajouter les PDF':type==='Image'?'Ajouter les images':'Ajouter les textes';btn.addEventListener('click',batchSave,true)}
  }
  function valid(type,file){if(type==='PDF')return file.type==='application/pdf'||/\.pdf$/i.test(file.name);if(type==='Image')return (file.type||'').startsWith('image/')||/\.(jpe?g|png|gif|webp|avif|svg)$/i.test(file.name);return (file.type||'').startsWith('text/')||/\.(txt|pdf|doc|docx|rtf|odt)$/i.test(file.name)}
  async function batchSave(e){
    const type=currentType(),form=document.getElementById('mediaForm'),input=form?.querySelector('#mFile');if(!['PDF','Image','Texte'].includes(type)||!input||input.files.length<2||(type==='Texte'&&form.querySelector('#mSource')?.value!=='file'))return;
    e.preventDefault();e.stopImmediatePropagation();if(busy)return;const files=[...input.files];if(files.some(f=>!valid(type,f))){toast(`Tous les fichiers doivent correspondre au type ${type}`);return}
    busy=true;const btn=form.querySelector('#saveMedia');btn.disabled=true;await waitForCore();let ok=0;
    try{for(let i=0;i<files.length;i++){
      const file=files[i],id=`${type==='PDF'?'pdf':type==='Image'?'image':'texte'}-${Date.now()}-${i}-${Math.random().toString(36).slice(2,7)}`;btn.textContent=`Chargement ${i+1}/${files.length}…`;
      try{await putMedia(id,file);state.contents.push({id,name:file.name,type,category:type==='PDF'?'PDF':type==='Image'?'Images':'Textes',audience:form.querySelector('#mGroup')?.value||'all',description:form.querySelector('#mDesc')?.value||'',sourceType:'file',url:'',text:'',fileName:file.name,mimeType:file.type||'',hasCover:false});saveState(state);ok++;if(window.celebrationsFlushCore)await window.celebrationsFlushCore()}
      catch(err){console.error('Upload multiple',file.name,err);toast(`Erreur sur ${file.name} — ${ok} fichier(s) déjà enregistré(s)`);break}
    }if(ok===files.length){toast(`${ok} fichiers ajoutés`);renderMedia()}}
    finally{busy=false;if(btn?.isConnected){btn.disabled=false;btn.textContent='Ajouter'}}
  }
  const observer=new MutationObserver(install);observer.observe(document.getElementById('panel'),{childList:true,subtree:true});document.addEventListener('change',e=>{if(e.target?.id==='mSource')setTimeout(install,0)});install();
})();
