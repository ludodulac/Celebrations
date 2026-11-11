// M06: rendering orchestration is detached from the mutable editor state.
// The caller supplies readonly state and deliberate action ports.
export function renderEditorFrame(ctx){
 const {IS_STAGE,document,STAGE_SEED,page,pageSlug,stateOfPage,editorDragState,editorDragFinish,undoAnchor,resetUndoHistory,ensureUndoButton,applyPalette,w,tab,preview,el,pages,footerPages,celebrations,media,userGuide,settings,memberSpaces}=ctx;
 if(IS_STAGE){
  const see=document.getElementById('view-site-btn');
  if(see){
   const current=page(),stage=pageSlug(current);
   see.href='/__editor/voir-le-site?celebration='+encodeURIComponent(STAGE_SEED.celebrationId)+'&page='+encodeURIComponent(stage);
   see.hidden=stateOfPage(current)!=='published';
   see.title=see.hidden?'Page en brouillon : utilisez Aperçu ou Publier cette page.':'Voir la page publiée';
  }
 }
 if(editorDragState)editorDragFinish(editorDragState,false);
 if(undoAnchor===null)resetUndoHistory();
 ensureUndoButton();
 const shell=document.querySelector('.stage-editor');
 if(shell){const general=page()?.group==='page';shell.classList.toggle('is-neutral',general);shell.classList.toggle('is-celebration',!general);
}
 applyPalette();w.replaceChildren();document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));el('preview-btn').textContent=preview?'Revenir à l’édition':'Aperçu du brouillon';if(tab==='pages')pages();else if(tab==='footer')footerPages();else if(tab==='celebrations')celebrations();else if(tab==='media')media();else if(tab==='guide')userGuide();else if(['members-spaces','participants','languages-categories'].includes(tab)&&memberSpaces)memberSpaces();else settings();}
