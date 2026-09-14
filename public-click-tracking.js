(function(){
  const url=window.CELEBRATIONS_SUPABASE_URL||'https://jwyayfkssyagvnablttg.supabase.co';
  const key=window.CELEBRATIONS_SUPABASE_KEY||'sb_publishable_qm8yJyH_5LfP-oZ1sz4QLg_r9J5VdnA';
  function text(v,max=500){return String(v??'').trim().slice(0,max)}
  function visitorId(){let id=localStorage.getItem('celebrations-anonymous-visitor');if(!id){id=(crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`);localStorage.setItem('celebrations-anonymous-visitor',id)}return id}
  function currentCelebrationId(){try{return typeof current==='function'?current()?.id:null}catch(e){return null}}
  function send(payload){fetch(url+'/rest/v1/celebrations_clicks',{method:'POST',keepalive:true,headers:{apikey:key,'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({...payload,visitor_id:visitorId()})}).catch(()=>{})}
  function contextFor(el){const event=el.closest?.('.event');const eventTitle=event?.querySelector('h3')?.textContent||'';const day=document.querySelector?.('.days .day.active');return {step_key:text(day?.dataset?.day||'',120)||null,event_id:text(eventTitle,240)||null}}
  function infer(el){const href=el.tagName==='A'?el.href:'';let contentId=el.dataset?.contentId||'',label=el.dataset?.clickLabel||el.textContent||el.getAttribute?.('aria-label')||'',kind=el.dataset?.clickKind||'';if(!kind){if(el.matches?.('audio'))kind='audio-play';else if(/youtu(?:\.be|be\.com)/i.test(href))kind='youtube';else if(/\.pdf(?:$|[?#])/i.test(href)||/pdf/i.test(label))kind='pdf';else kind=href?'link':'content'}return {content_id:text(contentId,160)||null,target_kind:text(kind,80)||'link',target_label:text(label,500)||null,target_url:text(href,1500)||null}}
  function record(el){send({celebration_id:currentCelebrationId(),...infer(el),page_path:text(location.pathname+location.search+location.hash,800),...contextFor(el)})}
  function pageView(){send({celebration_id:currentCelebrationId(),target_kind:'page-view',target_label:text(document.title,500)||'Page',page_path:text(location.pathname+location.search+location.hash,800)})}
  document.addEventListener('click',e=>{const el=e.target.closest?.('a.resource-link,button.resource-link,.home-resource a,.home-resource button,.public-footer-legal a,.public-footer-credit a');if(el)record(el)},true);
  document.addEventListener('play',e=>{if(e.target?.tagName==='AUDIO')record(e.target)},true);
  window.addEventListener('hashchange',pageView);
  pageView();
  window.celebrationsTrackContent=function(content,kind='content'){const fake=document.createElement('span');fake.dataset.contentId=String(content?.id||'');fake.dataset.clickLabel=String(content?.name||'Contenu');fake.dataset.clickKind=kind;record(fake)};
})();
