// Indique clairement l'action associée à chaque ressource publique.
(function(){
  function actionFor(c){
    if(!c)return '';
    if(c.type==='Audio')return 'Écouter';
    if(c.type==='Vidéo')return 'Visionner';
    if(c.type==='PDF'||c.type==='Texte')return 'Lire';
    return '';
  }

  const previous=window.contentButtons;
  if(typeof previous!=='function')return;

  window.contentButtons=function(c){
    const action=actionFor(c);
    if(!action)return previous(c);

    // Dans le programme, pas de bouton redondant pour les fichiers audio.
    // Pour les chants, on conserve toutefois leur titre lisible au-dessus du lecteur.
    if(c.type==='Audio'&&c.sourceType==='file'){
      const isChant=String(c.audioKind||'').toLowerCase()==='chant';
      const title=isChant?`<span class="resource-audio-title">${esc(c.name||'Chant')}</span>`:'';
      return `<span class="resource-action-wrap resource-audio-simple">${title}<span class="resource-action-label">Écouter</span><div data-audio-id="${esc(c.id)}"></div></span>`;
    }

    return `<span class="resource-action-wrap"><span class="resource-action-label">${action}</span>${previous(c)}</span>`;
  };

  const style=document.createElement('style');
  style.textContent=`
    .resource-action-wrap{display:inline-flex;flex-direction:column;align-items:flex-start;max-width:100%;vertical-align:top}
    .resource-action-label{display:block;margin:0 0 4px 4px;font-size:.82rem;line-height:1.15;font-weight:700;color:#596273;letter-spacing:.01em}
    .resource-audio-title{display:block;margin:0 0 4px 4px;font-size:.95rem;line-height:1.25;font-weight:700;color:#20242b}
    .resources .resource-action-wrap{margin:0 8px 8px 0}
    .resources .resource-audio-simple{display:flex;width:100%;margin-right:0}
    .resource-audio-simple [data-audio-id]{width:100%}
    .resource-audio-simple audio{width:100%}
    @media(max-width:850px){.resource-action-label{font-size:.78rem;margin-bottom:3px}.resource-audio-title{font-size:.92rem}}
  `;
  document.head.appendChild(style);
})();
