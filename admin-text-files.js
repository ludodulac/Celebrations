(function(){
  const TEXT_EXT=/\.(txt|md|markdown|rtf|doc|docx|odt|pages|csv|html?|xml|json|epub)$/i;
  function isTextFile(file){
    const t=(file?.type||'').toLowerCase(),n=file?.name||'';
    return t.startsWith('text/')||TEXT_EXT.test(n)||[
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.oasis.opendocument.text','application/rtf','application/json','application/xml',
      'application/xhtml+xml','text/markdown','text/csv','application/epub+zip'
    ].includes(t);
  }
  function install(){
    const form=document.getElementById('mediaForm');
    if(!form||document.querySelector('.type-card.active')?.dataset.type!=='Texte')return;
    const source=form.querySelector('#mSource');
    if(!source||source.value!=='file')return;
    const input=form.querySelector('#mFile');
    if(!input)return;
    input.accept='.txt,.md,.markdown,.rtf,.doc,.docx,.odt,.pages,.csv,.html,.htm,.xml,.json,.epub,text/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,application/rtf';
    input.multiple=true;
    const label=input.closest('label')?.querySelector('span');if(label)label.textContent='Documents texte (TXT, Word, ODT, RTF, Markdown, CSV, HTML… — plusieurs possibles)';
  }
  document.addEventListener('click',async function(e){
    const btn=e.target?.closest('#saveMedia');if(!btn)return;
    const form=document.getElementById('mediaForm'),source=form?.querySelector('#mSource'),input=form?.querySelector('#mFile');
    if(document.querySelector('.type-card.active')?.dataset.type!=='Texte'||source?.value!=='file'||!input||input.files.length!==1)return;
    e.preventDefault();e.stopImmediatePropagation();
    const file=input.files[0];if(!isTextFile(file)){toast('Choisissez un document texte compatible');return}
    const name=form.querySelector('#mTitle')?.value.trim()||file.name.replace(/\.[^.]+$/,'');
    const id=`texte-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    btn.disabled=true;btn.textContent='Chargement…';
    try{
      await putMedia(id,file);
      const item={id,name,type:'Texte',category:'Textes',audience:form.querySelector('#mGroup')?.value||'all',description:form.querySelector('#mDesc')?.value||'',sourceType:'file',url:'',text:'',fileName:file.name,mimeType:file.type||'application/octet-stream',hasCover:false};
      const cover=form.querySelector('#mCover')?.files?.[0];if(cover){await putMedia('cover-'+id,cover);item.hasCover=true;item.coverFileName=cover.name}
      state.contents.push(item);saveState(state);toast('Document texte ajouté');renderMedia();
    }catch(err){console.error('Ajout document texte',err);toast('Erreur pendant le chargement du document')}
    finally{if(btn?.isConnected){btn.disabled=false;btn.textContent='Ajouter'}}
  },true);
  const obs=new MutationObserver(install);obs.observe(document.getElementById('panel'),{childList:true,subtree:true});document.addEventListener('change',e=>{if(e.target?.id==='mSource')setTimeout(install,0)});install();
})();