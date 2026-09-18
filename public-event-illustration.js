// Illustration propre au rendez-vous, séparée des contenus associés.
// Les rendez-vous Programme et Cercle d'Entraide réutilisent toujours leur illustration de référence.
(function(){
  const KIND='event-illustration';

  function isImage(c){
    return c?.type==='Image' && (c.sourceType==='file' || (c.sourceType==='link' && c.url));
  }

  function driveImageUrl(url){
    const value=String(url||'');
    const m=value.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
    return m ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(m[1])}&sz=w1200` : value;
  }

  function manualIllustration(e){
    const m=(e?.links||[]).find(l=>l.kind===KIND);
    if(!m)return null;
    const id=String(m.url||'').replace(/^content:/,'');
    return state.contents.find(c=>String(c.id)===id&&(isImage(c)||c.hasCover))||null;
  }

  function namedIllustration(e){
    const title=String(e?.title||'').toLowerCase();
    if(title.includes('programme')){
      return state.contents.find(c=>String(c.id)==='guide-file-30'&&c.hasCover)||null;
    }
    if(title.includes('cercle')&&title.includes('entraide')){
      return state.contents.find(c=>String(c.id)==='guide-file-291'&&c.hasCover)
        || state.contents.find(c=>String(c.id)==='guide-file-399'&&c.hasCover)
        || state.contents.find(c=>String(c.id)==='image-1789467043343-6-p1bsh'&&isImage(c))
        || null;
    }
    return null;
  }

  function historicalIllustration(contents){
    return contents.find(isImage)
      || contents.find(c=>c.hasCover)
      || null;
  }

  function visualHtml(illustration,title){
    if(!illustration)return '';
    if(isImage(illustration)){
      if(illustration.sourceType==='link'){
        const src=driveImageUrl(illustration.url);
        return `<img class="event-illustration" src="${esc(src)}" alt="Illustration de ${esc(title)}">`;
      }
      return `<img class="event-illustration" data-image-id="${esc(illustration.id)}" alt="Illustration de ${esc(title)}">`;
    }
    if(illustration.hasCover){
      const path=String(illustration.coverStoragePath||'');
      if(/^https?:\/\//i.test(path)){
        return `<img class="event-illustration" src="${esc(driveImageUrl(path))}" alt="Illustration de ${esc(title)}">`;
      }
      return `<img class="event-illustration" data-cover-id="${esc(illustration.id)}" alt="Illustration de ${esc(title)}">`;
    }
    return '';
  }

  window.eventHtml=function(e){
    const c=current(),d=dayForEvent(c,e);
    const contents=(e.contentIds||[])
      .map(id=>state.contents.find(x=>String(x.id)===String(id)))
      .filter(Boolean)
      .filter(x=>audienceOk(x.audience));
    const illustration=manualIllustration(e)||namedIllustration(e)||historicalIllustration(contents);
    const visual=visualHtml(illustration,e.title);
    // Les contenus Image servent uniquement d'illustrations visuelles dans le programme.
    // Ils restent disponibles dans la bibliothèque, mais ne sont jamais proposés comme document à ouvrir/télécharger ici.
    const resources=contents.filter(x=>x.type!=='Image');
    const hasTime=String(e.time||'').trim()!=='';
    const timeHtml=hasTime?`<div class="time">${esc(e.time)}</div>`:'';
    return `<article class="event ${hasTime?'':'event-no-time'}">${timeHtml}<div class="event-body"><div class="event-head ${visual?'has-event-illustration':''}">${visual}<div><h3 style="margin:0 0 5px">${esc(e.title)}</h3><div class="meta">${esc(d?.label||'')}</div>${e.description?`<p>${esc(e.description)}</p>`:''}</div></div><div class="resources">${resources.map(contentButtons).join('')}</div></div></article>`;
  };

  const style=document.createElement('style');
  style.textContent=`
    body.public-app #program .event.event-no-time{grid-template-columns:minmax(0,1fr)!important;gap:0!important}
    .event-head.has-event-illustration{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;align-items:start}
    .event-illustration{width:96px;height:96px;object-fit:cover;border-radius:10px;background:#f3f4f6;display:block}
    .event-body{min-width:0}
    @media(max-width:850px){
      body.public-app #program .event.event-no-time{grid-template-columns:minmax(0,1fr)!important;gap:0!important}
      .event-head.has-event-illustration{grid-template-columns:72px minmax(0,1fr);gap:10px}
      .event-illustration{width:72px;height:72px}
    }
  `;
  document.head.appendChild(style);
})();
