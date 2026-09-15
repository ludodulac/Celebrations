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
    const html=previous(c);
    const action=actionFor(c);
    if(!action)return html;
    return `<span class="resource-action-wrap"><span class="resource-action-label">${action}</span>${html}</span>`;
  };

  const style=document.createElement('style');
  style.textContent=`
    .resource-action-wrap{display:inline-flex;flex-direction:column;align-items:flex-start;max-width:100%;vertical-align:top}
    .resource-action-label{display:block;margin:0 0 4px 4px;font-size:.82rem;line-height:1.15;font-weight:700;color:#596273;letter-spacing:.01em}
    .resources .resource-action-wrap{margin:0 8px 8px 0}
    @media(max-width:850px){.resource-action-label{font-size:.78rem;margin-bottom:3px}}
  `;
  document.head.appendChild(style);
})();
