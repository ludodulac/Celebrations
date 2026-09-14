(function(){
  function homeItems(){
    return (state.contents||[]).filter(c=>String(c.category||'').toLowerCase()==='accueil');
  }
  function homeBlock(c){
    const text=String(c.text||c.description||'');
    const visual=typeof contentVisual==='function'?contentVisual(c):'';
    const hasResource=(c.sourceType==='file'&&c.storagePath)||c.url;
    const resource=hasResource&&typeof contentTitle==='function'?`<div class="home-resource">${contentTitle(c)}</div>`:'';
    return `<article class="card home-editorial-block">${visual?`<div class="home-editorial-layout">${visual}<div>`:'<div>'}<h2>${esc(c.name||'')}</h2>${text?`<div class="home-copy">${esc(text).replace(/\n/g,'<br>')}</div>`:''}${resource}${visual?'</div></div>':'</div>'}</article>`;
  }
  renderInfo=function(){
    const items=homeItems();
    info.innerHTML=`<div class="section-head"><div><div class="eyebrow">Accueil</div><h2>Bienvenue</h2></div></div>${items.length?`<div class="home-editorial">${items.map(homeBlock).join('')}</div>`:'<div class="notice">Les informations d’accueil seront publiées prochainement.</div>'}`;
    if(typeof hydrateDynamic==='function')hydrateDynamic(info);
  };
  const style=document.createElement('style');
  style.textContent='.home-editorial{display:grid;gap:14px}.home-editorial-block{border-left:5px solid var(--accent)}.home-editorial-block h2{margin:0 0 8px}.home-copy{white-space:normal;line-height:1.6}.home-editorial-layout{display:grid;grid-template-columns:96px minmax(0,1fr);gap:14px;align-items:start}.home-resource{margin-top:10px}@media(max-width:620px){.home-editorial-layout{grid-template-columns:76px minmax(0,1fr)}}';
  document.head.appendChild(style);
})();