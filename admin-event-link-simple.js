(function(){
  const previous=window.showDayEventForm;
  if(typeof previous!=='function')return;
  window.showDayEventForm=function(dayKey,eventId=null){
    previous(dayKey,eventId);
    const target=document.getElementById('dayEventForm');
    const e=eventId!=null?(state.events||[]).find(x=>String(x.id)===String(eventId)):null;
    if(!target||!e)return;
    if(!Array.isArray(e.links))e.links=[];
    const ordinary=e.links.filter(l=>l?.kind!=='event-illustration');
    const current=ordinary[0]||{};
    const box=document.createElement('div');
    box.className='card';
    box.style.marginBottom='14px';
    box.innerHTML=`<h3 style="margin-top:0">Lien à ajouter au rendez-vous</h3><div class="admin-subtle" style="margin-bottom:10px">Pour une vidéo, une visioconférence ou une autre page : indiquez simplement son titre et collez son adresse.</div><div class="form-grid"><label class="field full"><span>Donner un titre à ce lien</span><input id="evtSimpleLinkTitle" placeholder="Ex. Vidéo de Loïc" value="${esc(current.label||'')}"></label><label class="field full"><span>Déposer un lien</span><input id="evtSimpleLinkUrl" type="url" placeholder="https://…" value="${esc(current.url||'')}"></label></div>`;
    const notice=target.firstElementChild;
    if(notice)notice.insertBefore(box,notice.firstChild);
    const save=document.getElementById('saveEventBtn');
    if(!save)return;
    save.addEventListener('click',function(){
      const title=document.getElementById('evtSimpleLinkTitle')?.value.trim()||'';
      const url=document.getElementById('evtSimpleLinkUrl')?.value.trim()||'';
      const special=(e.links||[]).filter(l=>l?.kind==='event-illustration');
      const extras=ordinary.slice(1);
      e.links=[...special,...(url?[{label:title||'Lien',url}]:[]),...extras];
    },true);
  };
})();
