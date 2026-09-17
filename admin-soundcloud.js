// Permet à un administrateur de coller un lien SoundCloud ou le code iframe complet.
(function(){
  function extractSoundCloud(raw){
    const text=String(raw||'').trim();if(!text)return null;
    let candidate=text;
    if(/<iframe\b/i.test(text)){
      const doc=new DOMParser().parseFromString(text,'text/html');
      const iframe=doc.querySelector('iframe');candidate=iframe?.getAttribute('src')||'';
    }
    try{
      const u=new URL(candidate),host=u.hostname.replace(/^www\./,'').toLowerCase();
      if(host==='w.soundcloud.com'&&u.pathname.startsWith('/player'))return {player:u.toString(),original:u.searchParams.get('url')||u.toString()};
      if(host==='soundcloud.com'||host.endsWith('.soundcloud.com'))return {original:u.toString(),player:`https://w.soundcloud.com/player/?url=${encodeURIComponent(u.toString())}&color=%23ff5500&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true`};
    }catch(_e){}
    return null;
  }
  function enhanceAudio(target,onCreated){
    const form=target.querySelector('[data-wizard-form]');if(!form)return;
    const fileField=form.querySelector('[data-f=file]');if(!fileField)return;
    const label=fileField.closest('label');if(!label)return;
    label.outerHTML=`<div class="field full soundcloud-choice"><span>Comment voulez-vous ajouter l’audio ?</span><div class="soundcloud-choice-buttons"><button type="button" class="btn small primary" data-audio-mode="file">Envoyer un fichier audio</button><button type="button" class="btn small" data-audio-mode="soundcloud">Ajouter un lecteur SoundCloud</button></div></div><div class="field full" data-audio-source></div>`;
    const source=form.querySelector('[data-audio-source]'),buttons=[...form.querySelectorAll('[data-audio-mode]')];
    const drawMode=mode=>{
      buttons.forEach(b=>{b.classList.toggle('primary',b.dataset.audioMode===mode)});
      if(mode==='file')source.innerHTML='<label class="field full"><span>Choisir le fichier audio</span><input data-f="audioFile" type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg"></label>';
      else source.innerHTML='<div class="soundcloud-paste-help"><strong>Collez ce que vous avez reçu</strong><p>Vous pouvez coller soit le lien SoundCloud normal, soit tout le code du lecteur qui commence par &lt;iframe…&gt;. L’administration s’occupe du code automatiquement.</p></div><label class="field full"><span>Lien SoundCloud ou code du lecteur intégré</span><textarea data-f="soundcloud" rows="6" placeholder="Collez ici le lien ou le code <iframe…></iframe>"></textarea></label><div class="soundcloud-detection" data-soundcloud-status>En attente du lien ou du code…</div>';
      if(mode==='soundcloud'){const input=source.querySelector('[data-f=soundcloud]'),status=source.querySelector('[data-soundcloud-status]');input.oninput=()=>{const found=extractSoundCloud(input.value);status.textContent=found?'✓ SoundCloud reconnu — le lecteur sera intégré automatiquement.':'Collez un lien SoundCloud ou le code iframe fourni par SoundCloud.';status.classList.toggle('ok',!!found)}}
      form.dataset.audioMode=mode;
    };
    buttons.forEach(b=>b.onclick=()=>drawMode(b.dataset.audioMode));drawMode('file');
    const save=form.querySelector('[data-a=save]');
    save.onclick=async()=>{
      const title=form.querySelector('[data-f=title]')?.value.trim();if(!title)return toast('Indiquez le titre qui sera visible sur le site');
      const id=Date.now(),mode=form.dataset.audioMode||'file',item={id,name:title,type:'Audio',category:TYPE_CATEGORY.Audio||'Audio',audience:form.querySelector('[data-f=group]')?.value||'all',description:form.querySelector('[data-f=desc]')?.value||'',sourceType:'',url:'',text:'',fileName:'',hasCover:false};ensureCategory(item.category);
      if(mode==='soundcloud'){
        const found=extractSoundCloud(form.querySelector('[data-f=soundcloud]')?.value);if(!found)return toast('Le lien ou le code SoundCloud n’est pas reconnu');item.sourceType='url';item.url=found.original;item.embedUrl=found.player;item.audioProvider='soundcloud';
      }else{
        const file=form.querySelector('[data-f=audioFile]')?.files[0];if(!file)return toast('Choisissez le fichier audio');if(!file.type.startsWith('audio/'))return toast('Choisissez un fichier audio');item.sourceType='file';item.fileName=file.name;await putMedia(id,file);
      }
      const cover=form.querySelector('[data-f=cover]')?.files[0];if(cover){if(!cover.type.startsWith('image/'))return toast('L’illustration doit être une image');await putMedia('cover-'+id,cover);item.hasCover=true;item.coverFileName=cover.name}
      state.contents.push(item);saveState(state);target.innerHTML='';onCreated(id);toast(mode==='soundcloud'?'Lecteur SoundCloud ajouté':'Audio ajouté');
    };
  }
  const previous=window.renderInlineContentCreator;if(typeof previous!=='function')return;
  window.renderInlineContentCreator=function(targetId,onCreated){
    previous(targetId,onCreated);const target=document.getElementById(targetId);if(!target)return;
    const audio=target.querySelector('.wizard-type[data-type="Audio"]');if(!audio)return;
    const oldClick=audio.onclick;audio.onclick=function(e){if(oldClick)oldClick.call(this,e);enhanceAudio(target,onCreated)};
  };
})();
