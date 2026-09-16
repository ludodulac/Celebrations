// Indique clairement l'action associée à chaque ressource publique.
(function(){
  function actionFor(c){
    if(!c)return '';
    if(c.type==='Audio')return 'Écouter';
    if(c.type==='Vidéo')return 'Visionner';
    if(c.type==='PDF'||c.type==='Texte')return 'Lire';
    return '';
  }

  function youtubeId(url){
    try{
      const u=new URL(String(url||''),location.href);
      const host=u.hostname.replace(/^www\./,'').toLowerCase();
      if(host==='youtu.be')return u.pathname.split('/').filter(Boolean)[0]||'';
      if(host==='youtube.com'||host==='m.youtube.com'||host==='music.youtube.com'){
        if(u.pathname==='/watch')return u.searchParams.get('v')||'';
        const m=u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
        return m?m[1]:'';
      }
    }catch(_e){}
    return '';
  }

  const previous=window.contentButtons;
  if(typeof previous!=='function')return;

  window.contentButtons=function(c){
    const action=actionFor(c);
    if(!action)return previous(c);

    if(c.type==='Vidéo'){
      const id=youtubeId(c.url||c.externalUrl||c.external_url);
      if(id){
        const title=esc(c.name||'Vidéo');
        // modestbranding réduit l'habillage YouTube disponible. YouTube peut néanmoins
        // afficher certains éléments de marque dans son lecteur natif selon son contexte.
        const src=`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`;
        return `<span class="resource-action-wrap resource-youtube"><span class="resource-video-title">${title}</span><div class="youtube-frame"><iframe src="${src}" title="${title}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div></span>`;
      }
    }

    if(c.type==='Audio'&&c.sourceType==='file'){
      const title=`<span class="resource-audio-title">${esc(c.name||'Audio')}</span>`;
      return `<span class="resource-action-wrap resource-audio-simple">${title}<span class="resource-action-label">Écouter</span><div data-audio-id="${esc(c.id)}"></div></span>`;
    }

    return `<span class="resource-action-wrap"><span class="resource-action-label">${action}</span>${previous(c)}</span>`;
  };

  const style=document.createElement('style');
  style.textContent=`
    .resource-action-wrap{display:inline-flex;flex-direction:column;align-items:flex-start;max-width:100%;vertical-align:top}
    .resource-action-label{display:block;margin:0 0 4px 4px;font-size:.82rem;line-height:1.15;font-weight:700;color:#596273;letter-spacing:.01em}
    .resource-audio-title,.resource-video-title{display:block;margin:0 0 6px 4px;font-size:.95rem;line-height:1.25;font-weight:700;color:#20242b}
    .resources .resource-action-wrap{margin:0 8px 8px 0}
    .resources .resource-audio-simple,.resources .resource-youtube{display:flex;width:100%;margin-right:0}
    .resource-audio-simple [data-audio-id]{width:100%}
    .resource-audio-simple audio{width:100%}
    .resource-youtube{max-width:760px!important}
    .youtube-frame{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:12px;background:#000;box-shadow:0 2px 10px rgba(0,0,0,.12)}
    .youtube-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
    @media(max-width:850px){.resource-action-label{font-size:.78rem;margin-bottom:3px}.resource-audio-title,.resource-video-title{font-size:.92rem}.youtube-frame{border-radius:9px}}
  `;
  document.head.appendChild(style);
})();
