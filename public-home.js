(function(){
  function homeItems(){
    return (state.contents||[]).filter(c=>String(c.category||'').toLowerCase()==='accueil');
  }
  function homeBlock(c){
    const text=String(c.text||c.description||'');
    const hasResource=(c.sourceType==='file'&&c.storagePath)||c.url;
    const resource=!text&&hasResource&&typeof contentTitle==='function'?`<div class="home-resource">${contentTitle(c)}</div>`:'';
    return `<article class="card home-editorial-block"><div><h2>${esc(c.name||'')}</h2>${text?`<div class="home-copy">${esc(text).replace(/\n/g,'<br>')}</div>`:''}${resource}</div></article>`;
  }
  renderInfo=function(){
    const items=homeItems();
    info.innerHTML=items.length?`<div class="home-editorial">${items.map(homeBlock).join('')}</div>`:'<div class="notice">Les informations d’accueil seront publiées prochainement.</div>';
  };
  const style=document.createElement('style');
  style.textContent='.home-editorial{display:grid;gap:14px}.home-editorial-block{border-left:5px solid var(--accent)}.home-editorial-block h2{margin:0 0 8px}.home-copy{white-space:normal;line-height:1.6}.home-resource{margin-top:10px}';
  document.head.appendChild(style);
})();