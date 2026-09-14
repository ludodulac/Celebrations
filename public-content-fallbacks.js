(function(){
  function fallbackKind(c){
    const type=String(c?.type||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const url=String(c?.url||'').toLowerCase();
    if(type==='audio')return String(c.audioKind||'').toLowerCase()==='chant'?'music':'speaker';
    if(type==='pdf'||type==='texte')return 'pen';
    if(type==='video'||/(^|\.)youtube\.com\//.test(url)||/(^|\.)youtu\.be\//.test(url))return 'video';
    return 'dot';
  }
  function fallbackIcon(kind){
    if(kind==='music')return '<span class="fallback-glyph" aria-hidden="true">♪</span>';
    if(kind==='speaker')return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.2-.8a5.5 5.5 0 010 7.6M18.8 5.6a9 9 0 010 12.8"/></svg>';
    if(kind==='pen')return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4.3-1 10.9-10.9-3.3-3.3L5 15.7 4 20zm10.7-14l3.3 3.3M3 21h18"/></svg>';
    if(kind==='video')return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7V5z"/></svg>';
    return '<span class="fallback-glyph" aria-hidden="true">•</span>';
  }
  window.contentFallbackVisual=function(c,className='library-thumb',inlineStyle=''){
    const kind=fallbackKind(c);
    return `<div class="${className} content-fallback-thumb content-fallback-compact" style="${inlineStyle}" aria-hidden="true">${fallbackIcon(kind)}</div>`;
  };
  const style=document.createElement('style');
  style.textContent=`.content-fallback-thumb{display:grid;place-items:center!important;box-sizing:border-box;background:var(--accent)!important;color:#fff!important;text-align:center;overflow:hidden}.content-fallback-thumb svg{width:42%;height:42%;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.content-fallback-thumb svg path[d^="M8 5"]{fill:currentColor;stroke:none}.content-fallback-thumb .fallback-glyph{font-family:Arial,sans-serif;font-size:clamp(1.35rem,3vw,1.8rem);font-weight:700;line-height:1;color:currentColor}.content-fallback-compact{transform:scale(.5);transform-origin:center}img.library-thumb:not([src]),img.public-inline-image:not([src]){display:none!important}img.library-thumb[src]+.content-fallback-thumb,img.public-inline-image[src]+.content-fallback-thumb{display:none}.content-fallback-thumb[style*="display: grid"]{display:grid!important}`;
  document.head.appendChild(style);
})();