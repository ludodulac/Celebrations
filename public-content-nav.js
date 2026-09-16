renderProgram=function(){
  const c=current();ensurePublicSteps(c);
  const days=dayList();
  const urlDay=typeof dayFromLocation==='function'?dayFromLocation(days):null;
  if(urlDay)activeDay=urlDay.key;
  if(!days.some(d=>d.key===activeDay))activeDay=days[0]?.key||'';
  const day=(c?.days||[]).find(d=>d.key===activeDay);
  const events=state.events.filter(e=>e.celebrationId===c?.id&&e.dayKey===activeDay&&audienceOk(e.audience)).sort((a,b)=>(Number(a.sortOrder??999)-Number(b.sortOrder??999))||String(a.time||'').localeCompare(String(b.time||''))||String(a.id).localeCompare(String(b.id)));
  const body=day?`${dayIntro(day)}<div class="agenda">${events.length?events.map(eventHtml).join(''):'<div class="notice">Aucun rendez-vous pour ce jour.</div>'}</div>`:'<div class="notice">Le programme sera publié prochainement.</div>';
  program.innerHTML=`<div class="program-top"><div class="section-head"><div><div class="eyebrow">Programme</div><h2>Les rendez-vous</h2></div></div>${days.length?`<div class="days days-fixed">${days.map(d=>`<button class="chip day ${d.key===activeDay?'active':''}" data-day="${esc(d.key)}">${esc(d.label)}${d.short?`<span class="sub">${esc(d.short)}</span>`:''}</button>`).join('')}</div>`:''}</div><div class="day-screen-body">${body}</div>`;
  program.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{
    activeDay=b.dataset.day;
    const selected=days.find(d=>d.key===activeDay);
    if(selected&&typeof setPublicDayUrl==='function')setPublicDayUrl(selected);
    renderProgram();
  });
  hydrateDynamic(program);
};

renderProgram();