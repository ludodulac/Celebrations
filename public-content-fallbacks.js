(function(){
  function extensionLabel(c){
    const file=String(c?.fileName||'');
    const ext=(file.match(/\.([^.]+)$/)?.[1]||'').toUpperCase();
    if(ext)return ext.slice(0,5);
    if(c?.type==='Audio')return 'MP3';
    if(c?.type==='Vidéo')return 'VID';
    if(c?.type==='Image')return 'JPG';
    if(c?.type==='Texte')return 'TXT';
    if(c?.type==='PDF')return 'PDF';
    return String(c?.type||'DOC').toUpperCase().slice(0,5);
  }
  window.contentFallbackVisual=function(c,className='library-thumb',inlineStyle=''){
    const label=c?.type==='PDF'?'':extensionLabel(c);
    return `<div class="${className} content-fallback-thumb" style="${inlineStyle}" aria-hidden="true">${label?`<span>${esc(label)}</span>`:''}</div>`;
  };
  const style=document.createElement('style');
  style.textContent=`.content-fallback-thumb{display:grid;place-items:center!important;box-sizing:border-box;background:var(--accent)!important;color:#fff!important;font-weight:800!important;letter-spacing:.04em;text-align:center;overflow:hidden}.content-fallback-thumb span{font-size:clamp(.72rem,2vw,1.05rem);line-height:1}img.library-thumb:not([src]),img.public-inline-image:not([src]){display:none!important}img.library-thumb[src]+.content-fallback-thumb,img.public-inline-image[src]+.content-fallback-thumb{display:none}.content-fallback-thumb[style*="display: grid"]{display:grid!important}`;
  document.head.appendChild(style);
})();