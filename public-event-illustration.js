// Illustration propre au rendez-vous, séparée des contenus associés.
(function(){
  const KIND='event-illustration';
  function illustrationContent(e){
    const m=(e?.links||[]).find(l=>l.kind===KIND);
    if(!m)return null;
    const id=String(m.url||'').replace(/^content:/,'');
    return state.contents.find(c=>String(c.id)===id&&((c.type==='Image'&&c.sourceType==='file')||c.hasCover))||null;
  }
  window.eventHtml=function(e){
    const c=current(),d=dayForEvent(c,e);
    const illustration=illustrationContent(e);
    const contents=(e.contentIds||[]).map(id=>state.contents.find(x=>String(x.id)===String(id))).filter(Boolean).filter(x=>audienceOk(x.audience));
    const visual=illustration?(illustration.type==='Image'&&illustration.sourceType==='file'
      ?`<img class="event-illustration" data-image-id="${esc(illustration.id)}" alt="Illustration de ${esc(e.title)}">`
      :`<img class="event-illustration" data-cover-id="${esc(illustration.id)}" alt="Illustration de ${esc(e.title)}">`):'';
    return `<article class="event"><div class="time">${esc(e.time||'—')}</div><div class="event-body"><div class="event-head ${illustration?'has-event-illustration':''}">${visual}<div><h3 style="margin:0 0 5px">${esc(e.title)}</h3><div class="meta">${esc(d?.label||'')} · ${esc(groupName(state,e.audience))}</div>${e.description?`<p>${esc(e.description)}</p>`:''}</div></div><div class="resources">${contents.map(contentButtons).join('')}</div></div></article>`;
  };
  const style=document.createElement('style');
  style.textContent=`.event-head.has-event-illustration{display:grid;grid-template-columns:96px minmax(0,1fr);gap:12px;align-items:start}.event-illustration{width:96px;height:96px;object-fit:cover;border-radius:10px;background:#f3f4f6;display:block}.event-body{min-width:0}@media(max-width:850px){.event-head.has-event-illustration{grid-template-columns:72px minmax(0,1fr);gap:10px}.event-illustration{width:72px;height:72px}}`;
  document.head.appendChild(style);
})();
