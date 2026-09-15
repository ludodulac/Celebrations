// Visibilité publique d'un rendez-vous : utilise audience='hidden' sans modifier le schéma.
(function(){
  function patchForm(){
    const target=document.getElementById('dayEventForm');
    if(!target)return;
    const title=document.getElementById('evtTitle');
    if(!title)return;
    const dayKey=window.__visibilityDayKey;
    const eventId=window.__visibilityEventId;
    const e=eventId!=null?state.events.find(x=>String(x.id)===String(eventId)):null;
    const group=document.getElementById('evtGroup');
    if(group&&e?.audience==='hidden')group.value='all';
    const grid=title.closest('.form-grid');
    if(grid&&!document.getElementById('evtHidden'))grid.insertAdjacentHTML('beforeend',`<label class="check field full"><input id="evtHidden" type="checkbox" ${e?.audience==='hidden'?'checked':''}><span>Cacher ce rendez-vous du site public</span></label>`);
    const save=document.getElementById('saveEventBtn');
    if(save&&!save.dataset.visibilityWrapped){
      save.dataset.visibilityWrapped='1';
      save.addEventListener('click',()=>{
        const hidden=document.getElementById('evtHidden')?.checked;
        if(hidden&&group)group.value='hidden';
      },true);
    }
  }
  const original=window.showDayEventForm;
  if(typeof original!=='function')return;
  window.showDayEventForm=function(dayKey,eventId=null){
    window.__visibilityDayKey=dayKey;window.__visibilityEventId=eventId;
    const r=original.apply(this,arguments);patchForm();return r;
  };
})();
