// Illustration propre au rendez-vous, séparée des contenus associés.
// Si aucune illustration manuelle n'est définie, on conserve le comportement historique :
// première image autonome associée, sinon première couverture disponible d'un contenu associé.
(function(){
  const KIND='event-illustration';

  function manualIllustration(e){
    const m=(e?.links||[]).find(l=>l.kind===KIND);
    if(!m)return null;
    const id=String(m.url||'').replace(/^content:/,'');
    return state.contents.find(c=>String(c.id)===id&&((c.type==='Image'&&c.sourceType==='file')||c.hasCover))||null;
  }

  function historicalIllustration(contents){
    return contents.find(c=>c.type==='Image'&&c.sourceType==='file')
      || contents.find(c=>c.hasCover)
      || null;
  }

  function visualHtml(illustration,title){
    if(!illustration)return '';
    if(illustration.type==='Image'&&illustration.sourceType==='file'){
      return `<img class="event-illustration" data-image-id="${esc(illustration.id)}" alt="Illustration de ${esc(title)}">`;
    }
    if(illustration.hasCover){
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
    const illustration=manualIllustration(e)||historicalIllustration(contents);
    const visual=visualHtml(illustration,e.title);
    const hasTime=String(e.time||'').trim()!=='';
    const timeHtml=hasTime?`<div class="time">${esc(e.time)}</div>`:'';
    return `<article class="event ${hasTime?'':'event-no-time'}">${timeHtml}<div class="event-body"><div class="event-head ${visual?'has-event-illustration':''}">${visual}<div><h3 style="margin:0 0 5px">${esc(e.title)}</h3><div class="meta">${esc(d?.label||'')} · ${esc(groupName(state,e.audience))}</div>${e.description?`<p>${esc(e.description)}</p>`:''}</div></div><div class="resources">${contents.map(contentButtons).join('')}</div></div></article>`;
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
