(function(){
  const url=window.CELEBRATIONS_SUPABASE_URL||'https://jwyayfkssyagvnablttg.supabase.co';
  const key=window.CELEBRATIONS_SUPABASE_KEY||'sb_publishable_qm8yJyH_5LfP-oZ1sz4QLg_r9J5VdnA';
  function text(v,max=500){return String(v??'').trim().slice(0,max)}
  function currentCelebrationId(){try{return typeof current==='function'?current()?.id:null}catch(e){return null}}
  function contextFor(el){
    const event=el.closest?.('.event');
    const eventTitle=event?.querySelector('h3')?.textContent||'';
    const day=document.querySelector?.('.days .day.active');
    return {step_key:text(day?.dataset?.day||'',120)||null,event_id:text(eventTitle,240)||null};
  }
  function infer(el){
    const href=el.tagName==='A'?el.href:'';
    let contentId=el.dataset?.contentId||'';
    let label=el.dataset?.clickLabel||el.textContent||el.getAttribute?.('aria-label')||'';
    let kind=el.dataset?.clickKind||'';
    if(!kind){
      if(el.matches?.('audio'))kind='audio-play';
      else if(/youtu(?:\.be|be\.com)/i.test(href))kind='youtube';
      else if(/\.pdf(?:$|[?#])/i.test(href)||/pdf/i.test(label))kind='pdf';
      else kind=href?'link':'content';
    }
    return {content_id:text(contentId,160)||null,target_kind:text(kind,80)||'link',target_label:text(label,500)||null,target_url:text(href,1500)||null};
  }
  function record(data){
    const ctx=contextFor(data.el);
    const payload={celebration_id:currentCelebrationId(),...infer(data.el),page_path:text(location.pathname+location.search+location.hash,800),...ctx};
    fetch(url+'/rest/v1/celebrations_clicks',{method:'POST',keepalive:true,headers:{apikey:key,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(payload)}).catch(()=>{});
  }
  document.addEventListener('click',e=>{
    const el=e.target.closest?.('a.resource-link,button.resource-link,.home-resource a,.home-resource button,.public-footer-legal a,.public-footer-credit a');
    if(el)record({el});
  },true);
  document.addEventListener('play',e=>{
    if(e.target?.tagName==='AUDIO')record({el:e.target});
  },true);
  window.celebrationsTrackContent=function(content,kind='content'){
    const fake=document.createElement('span');fake.dataset.contentId=String(content?.id||'');fake.dataset.clickLabel=String(content?.name||'Contenu');fake.dataset.clickKind=kind;record({el:fake});
  };
})();
