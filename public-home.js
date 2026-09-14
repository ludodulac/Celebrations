(function(){
  function homeItems(){
    const items=(state.contents||[]).filter(c=>String(c.category||'').toLowerCase()==='accueil');
    const rank=id=>String(id)==='home-intro-2026'?0:String(id)==='home-reliance-2026'?1:10;
    return items.sort((a,b)=>rank(a.id)-rank(b.id));
  }
  function homeBlock(c){
    const text=String(c.text||c.description||'');
    const hasResource=(c.sourceType==='file'&&c.storagePath)||c.url;
    const cover=c.coverStoragePath&&typeof supabaseMediaUrl==='function'?`<div class="home-cover"><img src="${supabaseMediaUrl(c.coverStoragePath)}" alt="${esc(c.name||'Illustration')}" loading="lazy"></div>`:'';
    const resource=hasResource&&typeof contentTitle==='function'?`<div class="home-resource">${contentTitle(c)}</div>`:'';
    return `<article class="card home-editorial-block"><div><h2>${esc(c.name||'')}</h2>${text?`<div class="home-copy">${esc(text).replace(/\n/g,'<br>')}</div>`:''}${cover}${resource}</div></article>`;
  }
  renderInfo=function(){
    const items=homeItems();
    info.innerHTML=items.length?`<div class="home-editorial">${items.map(homeBlock).join('')}</div>`:'<div class="notice">Les informations d’accueil seront publiées prochainement.</div>';
  };
  const style=document.createElement('style');
  style.textContent='.home-editorial{display:grid;gap:14px}.home-editorial-block{border-left:5px solid var(--accent)}.home-editorial-block h2{margin:0 0 8px}.home-copy{white-space:normal;line-height:1.6}.home-cover{margin-top:14px}.home-cover img{display:block;width:100%;max-height:440px;object-fit:contain;border-radius:12px}.home-resource{margin-top:10px}';
  document.head.appendChild(style);
})();