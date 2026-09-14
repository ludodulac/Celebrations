(function(){
  let eventPickerContext=null;
  let contentEditReturn=null;
  let contentEditReturnId=null;

  function captureEventDraft(dayKey,eventId){
    const target=document.getElementById('dayEventForm');
    if(!target)return null;
    return {
      dayKey,
      eventId,
      time:document.getElementById('evtTime')?.value||'',
      audience:document.getElementById('evtGroup')?.value||'all',
      title:document.getElementById('evtTitle')?.value||'',
      description:document.getElementById('evtDesc')?.value||'',
      contentIds:[...document.querySelectorAll('input[name=evtContent]:checked')].map(x=>Number(x.value))
    };
  }

  function restoreEventDraft(draft){
    if(!draft)return;
    const time=document.getElementById('evtTime');if(time)time.value=draft.time;
    const group=document.getElementById('evtGroup');if(group)group.value=draft.audience;
    const title=document.getElementById('evtTitle');if(title)title.value=draft.title;
    const desc=document.getElementById('evtDesc');if(desc)desc.value=draft.description;
    const selected=new Set(draft.contentIds||[]);
    document.querySelectorAll('input[name=evtContent]').forEach(input=>{input.checked=selected.has(Number(input.value))});
  }

  window.editChosenEventContent=function(contentId,dayKey,eventId=null){
    const draft=captureEventDraft(dayKey,eventId);
    editContent(contentId,()=>{
      editDay(dayKey);
      showDayEventForm(dayKey,eventId);
      restoreEventDraft(draft);
    });
  };

  const originalContentChecks=window.contentChecks;
  if(typeof originalContentChecks==='function'){
    window.contentChecks=function(ids=[],name='linkedContent'){
      if(name!=='evtContent'||!eventPickerContext)return originalContentChecks(ids,name);
      const selectedIds=new Set(ids||[]);
      if(!state.contents.length)return '<div class="notice">Aucun contenu dans la bibliothèque.</div>';
      const dayKey=JSON.stringify(eventPickerContext.dayKey);
      const eventId=eventPickerContext.eventId==null?'null':String(eventPickerContext.eventId);
      return `<div class="check-grid">${state.contents.map(c=>{
        const selected=selectedIds.has(c.id);
        const title=selected
          ? `<strong class="admin-clickable" role="button" tabindex="0" title="Modifier ce contenu" onclick="event.preventDefault();event.stopPropagation();editChosenEventContent(${c.id},${dayKey},${eventId})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();editChosenEventContent(${c.id},${dayKey},${eventId})}">${icon(c.type)} ${esc(c.name)}</strong>`
          : `<strong>${icon(c.type)} ${esc(c.name)}</strong>`;
        return `<label class="check"><input type="checkbox" name="${name}" value="${c.id}" ${selected?'checked':''}><span>${title}<br><span class="muted">${esc(c.type)}${selected?' · cliquer sur le titre pour modifier':''}</span></span></label>`;
      }).join('')}</div>`;
    };
  }

  const originalShowDayEventForm=window.showDayEventForm;
  if(typeof originalShowDayEventForm==='function'){
    window.showDayEventForm=function(dayKey,eventId=null){
      eventPickerContext={dayKey,eventId};
      try{return originalShowDayEventForm(dayKey,eventId)}
      finally{eventPickerContext=null}
    };
  }

  const originalEditContent=window.editContent;
  if(typeof originalEditContent==='function'){
    window.editContent=function(id,returnTo=null){
      if(typeof returnTo==='function'){
        contentEditReturn=returnTo;
        contentEditReturnId=String(id);
      }else if(contentEditReturn&&String(id)!==contentEditReturnId){
        contentEditReturn=null;
        contentEditReturnId=null;
      }
      const result=originalEditContent(id);
      if(contentEditReturn&&String(id)===contentEditReturnId){
        const back=[...panel.querySelectorAll('button')].find(button=>button.textContent.trim()==='Retour');
        if(back){
          back.onclick=()=>{
            const fn=contentEditReturn;
            contentEditReturn=null;
            contentEditReturnId=null;
            fn();
          };
        }
      }
      return result;
    };
  }
})();
