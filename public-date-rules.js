const FIXED_STEPS_PUBLIC=['Préparation','Mercredi','Jeudi','Vendredi','Samedi','Dimanche','Après célébration'];
function publicStepKey(label){return String(label||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-')}
function isPublicAfterCelebration(label){return ['apres-celebration','celebration','celebration-principale'].includes(publicStepKey(label))}
function ensurePublicSteps(c){
  if(!c)return;
  const old=c.days||[],used=new Set();
  c.days=FIXED_STEPS_PUBLIC.map(label=>{
    const wanted=publicStepKey(label);
    let d=old.find(x=>!used.has(x)&&publicStepKey(x.label)===wanted);
    if(!d&&label==='Après célébration')d=old.find(x=>!used.has(x)&&isPublicAfterCelebration(x.label));
    if(d){used.add(d);d.label=label;d.contentIds=Array.isArray(d.contentIds)?d.contentIds:[];return d}
    return {key:`${wanted}-${c.id}`,label,startDate:'',endDate:'',text:'',links:[],contentIds:[]};
  });
}
state.celebrations.forEach(ensurePublicSteps);
function publicDayDate(d){if(d.label==='Après célébration')return '';if(d.label==='Préparation'){if(d.startDate&&d.endDate&&d.startDate!==d.endDate)return `${formatDate(d.startDate,{day:'numeric',month:'short'})} – ${formatDate(d.endDate,{day:'numeric',month:'short'})}`;return d.startDate?formatDate(d.startDate,{day:'numeric',month:'short'}):''}return d.startDate?formatDate(d.startDate,{day:'numeric',month:'short'}):''}
function contentVisual(c){
  const size='var(--public-content-visual-size,96px)';
  const boxStyle=`width:${size}!important;height:${size}!important;min-width:${size}!important;max-width:${size}!important;min-height:${size}!important;max-height:${size}!important;aspect-ratio:1/1!important;border-radius:10px;margin:0!important;overflow:hidden`;
  const imgStyle=`display:none!important;${boxStyle};object-fit:cover!important;background:#f3f4f6`;
  const fallback=window.contentFallbackVisual?window.contentFallbackVisual(c,'public-program-fallback',boxStyle):'';
  const slot=(inner)=>`<span class="public-content-visual-slot" style="display:block;${boxStyle}">${inner}</span>`;
  const paired=(attr)=>slot(`<img ${attr} alt="" class="public-inline-image" style="${imgStyle}" onload="this.style.setProperty('display','block','important');this.nextElementSibling&&this.nextElementSibling.style.setProperty('display','none','important')" onerror="this.style.setProperty('display','none','important');this.nextElementSibling&&this.nextElementSibling.style.setProperty('display','grid','important')">${fallback}`);
  if(c.type==='Image'&&c.sourceType==='file')return paired(`data-image-id="${c.id}"`);
  if(c.hasCover)return paired(`data-cover-id="${c.id}"`);
  return slot(fallback);
}
function contentTitle(c){
  const label=`${icon(c.type)} ${esc(c.name||'Contenu')}`,id=esc(JSON.stringify(c.id));
  if(c.type==='Texte'&&c.sourceType==='text')return `<button type="button" class="public-content-title" onclick="alert(${JSON.stringify(c.text||'')})">${label}</button>`;
  if(c.url)return `<a class="public-content-title" href="${esc(c.url)}" target="_blank" rel="noopener">${label}</a>`;
  if(c.sourceType==='file')return `<button type="button" class="public-content-title" onclick="openStoredFile(state.contents.find(x=>x.id===${id}),false)">${label}</button>`;
  return `<span class="public-content-title-static">${label}</span>`;
}
function contentWithVisual(c){const visual=contentVisual(c);const size='var(--public-content-visual-size,96px)';const layout=visual?`display:grid!important;grid-template-columns:${size} minmax(0,1fr)!important;gap:10px!important;align-items:start!important;width:100%!important`:'width:100%';return `<div class="public-content ${visual?'has-public-visual':''}" style="${layout}">${visual}<div class="public-content-body" style="min-width:0">${contentTitle(c)}${c.type==='Audio'&&c.sourceType==='file'?`<div data-audio-id="${esc(c.id)}" style="margin-top:7px"></div>`:''}${c.description?`<div class="muted" style="white-space:pre-line;margin-top:6px">${esc(c.description)}</div>`:''}</div></div>`}
dayIntro=function(d){const erratum='<div style="margin:0 0 12px;padding:10px 12px;border:2px solid #f59e0b;border-radius:10px;background:#fff7ed;color:#c2410c;font-weight:700">Site en construction pendant 24 h</div>';const links=(d.links||[]).filter(l=>l.url);const contents=(d.contentIds||[]).map(id=>state.contents.find(c=>c.id===id)).filter(Boolean).filter(c=>audienceOk(c.audience));const date=publicDayDate(d);return `${erratum}<div class="card" style="margin:8px 0 14px;border-left:5px solid var(--accent)"><h3 style="margin-top:0">${esc(d.label)}</h3>${date?`<div class="meta">${esc(date)}</div>`:''}${d.text?`<p>${esc(d.text).replace(/\n/g,'<br>')}</p>`:''}${links.length?`<div class="resources">${links.map(l=>`<a class="resource-link" href="${esc(l.url)}" target="_blank" rel="noopener">↗ ${esc(l.label||l.url)}</a>`).join('')}</div>`:''}${contents.length?`<div style="margin-top:12px;display:grid;gap:8px">${contents.map(contentWithVisual).join('')}</div>`:''}</div>`};
eventHtml=function(e){const erratum='';const contents=(e.contentIds||[]).map(id=>state.contents.find(x=>x.id===id)).filter(Boolean).filter(x=>audienceOk(x.audience));return `<article class="event">${erratum}<div class="time">${e.time?esc(e.time):''}</div><div><h3 style="margin:0 0 5px">${esc(e.title)}</h3>${e.description?`<p>${esc(e.description)}</p>`:''}${contents.length?`<div class="public-event-contents" style="display:grid;gap:8px;margin-top:8px">${contents.map(contentWithVisual).join('')}</div>`:''}</div></article>`};
function keepActiveDayVisible(smooth=false){requestAnimationFrame(()=>{const active=program.querySelector('.days [data-day].active');if(active)active.scrollIntoView({behavior:smooth?'smooth':'auto',block:'nearest',inline:'center'})})}
renderProgram=function(){const c=current();ensurePublicSteps(c);const days=dayList();if(!days.some(d=>d.key===activeDay))activeDay=days[0]?.key||'';const day=(c?.days||[]).find(d=>d.key===activeDay);const events=state.events.filter(e=>e.celebrationId===c?.id&&e.dayKey===activeDay&&audienceOk(e.audience)).sort((a,b)=>(Number(a.sortOrder??999)-Number(b.sortOrder??999))||String(a.time||'').localeCompare(String(b.time||'')));program.innerHTML=days.length?`<div class="days" style="scroll-padding-inline:24px">${days.map(d=>`<button class="chip day ${d.key===activeDay?'active':''}" data-day="${esc(d.key)}">${esc(d.label)}${d.short?`<span class="sub">${esc(d.short)}</span>`:''}</button>`).join('')}</div>${day?dayIntro(day):''}<div class="agenda">${events.length?events.map(eventHtml).join(''):'<div class="notice">Aucun rendez-vous pour ce jour.</div>'}</div>`:'<div class="notice">Le programme sera publié prochainement.</div>';program.querySelectorAll('[data-day]').forEach(b=>b.onclick=()=>{activeDay=b.dataset.day;renderProgram();keepActiveDayVisible(true)});hydrateDynamic(program);keepActiveDayVisible(false)};
const contentTitleStyle=document.createElement('style');contentTitleStyle.textContent='.public-content-title{appearance:none;border:0;background:none;padding:0;margin:0;color:inherit;font:inherit;font-weight:700;text-align:left;cursor:pointer;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px}.public-content-title:hover,.public-content-title:focus-visible{opacity:.72}.public-content-title-static{font-weight:700}';document.head.appendChild(contentTitleStyle);
renderHero();renderProgram();