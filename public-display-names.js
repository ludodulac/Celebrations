// Nettoyage purement visuel des titres publics : ne modifie ni les fichiers ni les données.
(function(){
  function cleanPublicName(value){
    let s=String(value||'').trim();
    // Préfixes de classement historiques : 47., 69.4, 291., 4-, 30_, etc.
    s=s.replace(/^\s*\d+(?:[.,]\d+)*\s*[.\-_–—:]\s*/u,'');
    return s.trim()||String(value||'').trim();
  }
  window.cleanPublicName=cleanPublicName;

  function patch(){
    if(typeof window.contentButtons==='function'&&!window.contentButtons.__cleanNames){
      const original=window.contentButtons;
      const wrapped=function(c){
        if(!c)return original(c);
        const copy=Object.assign({},c,{name:cleanPublicName(c.name||c.fileName||'Contenu')});
        return original(copy);
      };
      wrapped.__cleanNames=true;
      window.contentButtons=wrapped;
    }
  }
  patch();
})();