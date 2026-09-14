(function(){
  function fallbackSymbol(c){
    if(c?.type==='Audio')return String(c.category||'').toLowerCase().includes('chant')?'♪':'🔊';
    if(c?.type==='PDF'||c?.type==='Texte')return '✒';
    if(c?.type==='Vidéo')return '▶';
    if(c?.type==='Image')return '▧';
    return '•';
  }
  window.contentFallbackVisual=function(c,className='library-thumb',inlineStyle=''){
    const symbol=fallbackSymbol(c);
    return `<div class="${className} content-fallback-thumb content-fallback-compact" style="${inlineStyle}" aria-hidden="true"><span>${symbol}</span></div>`;
  };
  const style=document.createElement('style');
  style.textContent=`.content-fallback-thumb{display:grid;place-items:center!important;box-sizing:border-box;background:var(--accent)!important;color:#fff!important;font-weight:800!important;text-align:center;overflow:hidden}.content-fallback-thumb span{font-size:clamp(1rem,2.5vw,1.4rem);line-height:1}.content-fallback-compact{transform:scale(.5);transform-origin:center}img.library-thumb:not([src]),img.public-inline-image:not([src]){display:none!important}img.library-thumb[src]+.content-fallback-thumb,img.public-inline-image[src]+.content-fallback-thumb{display:none}.content-fallback-thumb[style*="display: grid"]{display:grid!important}`;
  document.head.appendChild(style);
})();