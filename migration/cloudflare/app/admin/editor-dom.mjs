// M06: DOM event registrations with explicit ports for mutable state.
// No background upload, save or publication is initiated here.
export function bindEditorShell({document,window,el,enter,onPreview,isPreview,deselect,shouldWarnBeforeUnload}){
 document.querySelectorAll('[data-tab]').forEach(x=>x.onclick=()=>enter(x.dataset.tab));
 el('preview-btn').onclick=onPreview;
document.addEventListener('pointerdown',e=>{
 // Keep the selected block while tapping any section toolbar. On touch
 // devices, deselecting here reflows the editor between pointerdown and
 // pointerup; the green + then never receives the click event.
 if(isPreview()||e.target.closest('dialog,.block,.section-column-actions,.section-root-actions,.section-insert,.section-element-menu,.existing-block-add,.section-settings'))return;
 deselect();
});
window.addEventListener('beforeunload',e=>{
 if(shouldWarnBeforeUnload()){e.preventDefault();e.returnValue=''}
});
}
