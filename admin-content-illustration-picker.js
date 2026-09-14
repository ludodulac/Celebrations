// Permet de choisir visuellement une image existante comme illustration d'un contenu.
// Chargé en dernier pour enrichir l'éditeur existant sans remplacer sa logique.
(function(){
  const sameId=(a,b)=>String(a??'')===String(b??'');
  const baseEditContent=window.editContent;
  if(typeof baseEditContent!=='function')return;

  function imageChoices(){
    return (state.contents||[]).filter(c=>c.type==='Image'&&c.sourceType==='file'&&c.storagePath);
  }

  function thumbUrl(c){
    try{return typeof supabaseMediaUrl==='function'?supabaseMediaUrl(c.storagePath):''}catch(e){return ''}
  }

  function installPicker(c,returnTo){
    if(c.type==='Image')return;
    const coverCard=[...panel.querySelectorAll('.card')].find(el=>el.querySelector('.eyebrow')?.textContent.trim()==='Image d’illustration');
    if(!coverCard)return;
    const images=imageChoices();
    const picker=document.createElement('div');
    picker.className='existing-illustration-picker';
    picker.innerHTML=`<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line)">
      <div style="font-weight:800;margin-bottom:6px">Ou choisir parmi les images existantes</div>
      <div class="meta" style="margin-bottom:10px">Clique sur une image pour la sélectionner. Tu vois exactement l’image avant de l’utiliser.</div>
      ${images.length?`<div id="existingIllustrationGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px">${images.map(img=>{
        const src=thumbUrl(img),id=String(img.id);
        return `<button type="button" data-existing-illustration="${esc(id)}" class="btn" style="padding:7px;border-radius:12px;display:grid;gap:6px;text-align:left;background:#fff!important">
          <img src="${esc(src)}" alt="${esc(img.name||'Image')}" style="width:100%;height:96px;object-fit:cover;border-radius:8px;background:#f3f4f6">
          <span style="font-size:.78rem;line-height:1.2;overflow-wrap:anywhere">${esc(img.name||img.fileName||'Image')}</span>
        </button>`;
      }).join('')}</div>`:'<div class="notice">Aucune image disponible dans Contenus → Images.</div>'}
      <div id="existingIllustrationChoice" class="meta" style="margin-top:10px"></div>
    </div>`;
    coverCard.appendChild(picker);

    let selectedId='';
    const choice=document.getElementById('existingIllustrationChoice');
    picker.querySelectorAll('[data-existing-illustration]').forEach(btn=>{
      btn.onclick=()=>{
        selectedId=btn.dataset.existingIllustration||'';
        picker.querySelectorAll('[data-existing-illustration]').forEach(x=>x.style.outline='');
        btn.style.outline='3px solid var(--accent)';
        const img=imageChoices().find(x=>sameId(x.id,selectedId));
        if(choice)choice.innerHTML=`Image sélectionnée : <strong>${esc(img?.name||img?.fileName||'Image')}</strong>`;
        const fileInput=document.getElementById('ecCover');
        if(fileInput)fileInput.value='';
        const remove=document.getElementById('ecRemoveCover');
        if(remove)remove.checked=false;
      };
    });

    const save=document.getElementById('saveContentEdit');
    if(!save)return;
    const oldSave=save.onclick;
    save.onclick=async ev=>{
      if(selectedId){
        const source=imageChoices().find(x=>sameId(x.id,selectedId));
        if(!source)return toast('Image sélectionnée introuvable');
        try{
          const blob=await getMedia(source.id);
          if(!blob)throw new Error('Image indisponible');
          const filename=source.fileName||`${source.name||'illustration'}.jpg`;
          const file=new File([blob],filename,{type:source.mimeType||blob.type||'image/jpeg'});
          await putMedia('cover-'+c.id,file);
          c.hasCover=true;c.coverFileName=filename;
          selectedId='';
        }catch(e){
          console.error(e);toast('Impossible d’utiliser cette image');return;
        }
      }
      return oldSave?.call(save,ev);
    };
  }

  window.editContent=function(id,returnTo=null){
    const c=(state.contents||[]).find(x=>sameId(x.id,id));
    const result=baseEditContent(c?.id??id,returnTo);
    if(c)installPicker(c,returnTo);
    return result;
  };
})();