(function(){
  const host=document.getElementById('footerPagesAdmin');if(!host)return;
  const PAGE_DEFS={
    'mentions-legales':{title:'Mentions légales',url:'mentions-legales.html'},
    confidentialite:{title:'Déclaration de confidentialité',url:'confidentialite.html'},
    cookies:{title:'Politique de cookies',url:'cookies.html'}
  };
  let currentSlug=null;
  let pages={};
  let adminSession=false;
  let saving=false;
  let status='';

  async function invoke(action,payload={}){
    if(typeof window.celebrationsAccessInvoke!=='function')return {ok:false,error:'Accès serveur indisponible.'};
    return window.celebrationsAccessInvoke(action,payload);
  }

  async function loadPages(){
    const session=await invoke('admin_session');
    adminSession=!!session.ok;
    if(!adminSession)return;
    const result=await invoke('admin_footer_drafts');
    if(!result.ok)return;
    Object.keys(PAGE_DEFS).forEach(slug=>{
      const rows=(result.drafts||[]).filter(r=>r.slug===slug);
      const active=rows.find(r=>r.is_active)||rows.sort((a,b)=>Number(b.draft_number)-Number(a.draft_number))[0]||null;
      pages[slug]={draftNumber:Number(active?.draft_number)||1,title:PAGE_DEFS[slug].title,text:active?.content||'',isPublic:!!active?.is_public};
    });
  }

  async function saveCurrent(){
    if(!currentSlug||saving)return;
    if(!adminSession){status='Accès administrateur requis.';renderEditor();return}
    const text=document.getElementById('footerPageText')?.value||'';
    const isPublic=!!document.getElementById('footerPagePublic')?.checked;
    saving=true;status='Enregistrement…';renderEditorStatus();
    const page=pages[currentSlug]||{draftNumber:1,title:PAGE_DEFS[currentSlug].title,text:'',isPublic:false};
    const result=await invoke('admin_publish_footer',{slug:currentSlug,draft_number:page.draftNumber||1,title:PAGE_DEFS[currentSlug].title,content:text});
    if(!result.ok){saving=false;status=`Erreur : ${result.error||'enregistrement impossible'}`;renderEditorStatus();return}
    const visibility=await invoke('admin_set_footer_public',{slug:currentSlug,is_public:isPublic});
    saving=false;
    if(!visibility.ok){status=`Texte enregistré, mais visibilité non enregistrée : ${visibility.error||'erreur'}`;renderEditorStatus();return}
    page.text=text;page.isPublic=isPublic;pages[currentSlug]=page;status=isPublic?'Enregistré · visible sur le site':'Enregistré · masqué sur le site';renderEditorStatus();
  }

  function renderEditorStatus(){const el=document.getElementById('footerEditorStatus');if(el)el.textContent=status;const btn=document.getElementById('saveFooterPage');if(btn){btn.disabled=saving;btn.textContent=saving?'Enregistrement…':'Enregistrer'}}

  function closeEditor(){currentSlug=null;status='';host.innerHTML='';}

  function renderEditor(){
    if(!currentSlug){host.innerHTML='';return}
    const def=PAGE_DEFS[currentSlug],page=pages[currentSlug]||{text:'',isPublic:false};
    host.innerHTML=`<div class="footer-editor-card"><div class="footer-editor-head"><button type="button" class="footer-editor-back" id="footerEditorBack">← Retour</button><h3>${esc(def.title)}</h3><a href="${def.url}" target="_blank" rel="noopener">Voir la page</a></div>${!adminSession?'<div class="notice">Accès administrateur requis.</div>':''}<label class="check" style="margin:4px 0 2px"><input id="footerPagePublic" type="checkbox" ${page.isPublic?'checked':''}><span><strong>Afficher cette page dans le pied de page du site public</strong><br><span class="muted">Décochez pour conserver la page sans afficher son lien sur le site.</span></span></label><textarea id="footerPageText" class="footer-page-text" aria-label="Texte de ${esc(def.title)}">${esc(page.text||'')}</textarea><div class="footer-editor-actions"><span id="footerEditorStatus" class="footer-editor-status">${esc(status)}</span><button type="button" class="btn primary" id="saveFooterPage">Enregistrer</button></div></div>`;
    document.getElementById('footerEditorBack')?.addEventListener('click',closeEditor);
    document.getElementById('saveFooterPage')?.addEventListener('click',saveCurrent);
    host.scrollIntoView({behavior:'smooth',block:'start'});
  }

  window.openAdminFooterPage=function(slug){if(!PAGE_DEFS[slug])return;currentSlug=slug;status='';renderEditor()};

  (async()=>{if(window.celebrationsAdminReady)await window.celebrationsAdminReady;await loadPages();host.innerHTML='';document.addEventListener('click',e=>{const t=e.target.closest('[data-footer-page]');if(t){e.preventDefault();window.openAdminFooterPage(t.dataset.footerPage)}})})();
})();