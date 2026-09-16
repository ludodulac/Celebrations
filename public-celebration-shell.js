let publicCelebrationOpen=false;
let publicShowOtherCelebrations=false;
let publicShellReady=false;

function celebrationPublicLabel(c){return `Archange ${c.archangel} ${c.year}`}
async function loadPublicCelebrationVisibility(){
  const sb=window.celebrationsSupabase||null;
  if(!sb)return false;
  try{const {data,error}=await sb.functions.invoke('celebrations-visibility',{body:{action:'get'}});if(!error&&data?.ok)publicShowOtherCelebrations=!!data.show_other_celebrations}catch(e){}
  return publicShowOtherCelebrations;
}
function publicCelebrationChoices(){
  const all=[...state.celebrations].sort((a,b)=>String(a.year).localeCompare(String(b.year)));
  const list=publicShowOtherCelebrations?all:all.filter(c=>c.id===state.currentCelebrationId);
  return `<div class="celebration-home"><div class="public-page-title"><div class="eyebrow">Bienvenue</div><p>Choisissez une célébration</p></div><div class="celebration-choice-grid">${list.map(c=>`<button class="celebration-choice" data-open-celebration="${c.id}" style="--celebration-color:${ARCHANGELS[c.archangel]||'#172033'}"><strong>${esc(celebrationPublicLabel(c))}</strong></button>`).join('')}</div></div>`;
}
function publicFlameContent(){return (state.contents||[]).find(c=>c.type==='Image'&&c.sourceType==='file'&&[c.name,c.fileName].some(v=>String(v||'').trim().toLowerCase()==='shin.png'))||null}
function publicFlameUrl(c){if(!c?.storagePath)return '';const path=String(c.storagePath).split('/').map(encodeURIComponent).join('/');return `${CELEBRATIONS_SUPABASE_URL}/storage/v1/object/public/${CELEBRATIONS_MEDIA_BUCKET}/${path}`}
function showCelebrationHome(updateHistory=false){
  if(!publicShowOtherCelebrations){const c=current();if(c){openPublicCelebration(c.id,updateHistory);return}}
  publicCelebrationOpen=false;hero.innerHTML=publicCelebrationChoices();program.classList.add('hidden');library.classList.add('hidden');info.classList.add('hidden');document.querySelectorAll('[data-tab]').forEach(b=>b.classList.remove('active'));hero.querySelectorAll('[data-open-celebration]').forEach(b=>b.onclick=()=>openPublicCelebration(Number(b.dataset.openCelebration),true));if(updateHistory)history.pushState({screen:'home'},'',location.pathname+location.search)
}
function goPublicHome(){if(!publicShowOtherCelebrations){const c=current();if(c)openPublicCelebration(c.id,false);return}if(publicCelebrationOpen&&history.state?.screen==='celebration')history.back();else showCelebrationHome(false)}
function setPublicSectionUrl(tab){const path=tab==='program'?'/programme':tab==='library'?'/bibliotheque':'/';if(location.pathname!==path)history.pushState({...(history.state||{}),screen:'celebration',tab},'',path+location.search)}
function openPublicCelebration(id,pushHistory=false){
  let c=state.celebrations.find(x=>x.id===id);if(!c)return;if(!publicShowOtherCelebrations&&c.id!==state.currentCelebrationId){c=state.celebrations.find(x=>x.id===state.currentCelebrationId);if(!c)return;id=c.id}
  state.currentCelebrationId=id;state.profile='all';saveState(state);publicCelebrationOpen=true;setAccent();if(pushHistory)history.pushState({screen:'celebration',id},'',`#celebration-${id}`);
  const r=celebrationRange(c),flameContent=publicFlameContent(),flameUrl=publicFlameUrl(flameContent),flame=flameUrl?`<img class="celebration-flame" src="${esc(flameUrl)}" alt="" aria-hidden="true" onerror="this.style.display='none'">`:'';
  hero.innerHTML=`<div class="celebration-page-head"><div class="celebration-title-block"><div class="celebration-identity">${flame}<div class="celebration-title-copy"><h1>${esc(celebrationPublicLabel(c))}</h1></div>${flame}</div>${r.start?`<div class="date-range">${formatDate(r.start)} → ${formatDate(r.end)}</div>`:''}<nav class="nav celebration-inner-nav" aria-label="Navigation de la célébration"><button class="nav-btn active" data-tab="info">Accueil</button><button class="nav-btn" data-tab="program">Programme</button><button class="nav-btn" data-tab="library">Médiathèque</button></nav></div></div>`;
  hero.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{setPublicSectionUrl(b.dataset.tab);showTab(b.dataset.tab)});program.classList.add('hidden');library.classList.add('hidden');info.classList.remove('hidden');renderInfo()
}
const baseShowTab=showTab;
showTab=function(tab){if(!publicCelebrationOpen){const c=current();if(c)openPublicCelebration(c.id,false);else return}baseShowTab(tab)};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));document.getElementById('brandHome')?.addEventListener('click',goPublicHome);
function restorePublicRoute(){
  const days=typeof dayList==='function'?dayList():[],urlDay=typeof dayFromLocation==='function'?dayFromLocation(days):null,slug=decodeURIComponent(location.pathname.split('/').filter(Boolean).pop()||'').toLowerCase();
  if(urlDay){activeDay=urlDay.key;showTab('program');return true}
  if(slug==='programme'){showTab('program');return true}
  if(slug==='bibliotheque'||slug==='mediatheque'){showTab('library');return true}
  if(slug==='apres-celebration'||slug==='apres-la-ronde'){showTab('info');return true}
  return false
}
window.restorePublicRoute=restorePublicRoute;
window.addEventListener('popstate',e=>{if(restorePublicRoute())return;const s=e.state;if(publicShowOtherCelebrations&&s?.screen==='celebration'&&state.celebrations.some(c=>c.id===Number(s.id)))openPublicCelebration(Number(s.id),false);else showCelebrationHome(false)});
(async()=>{
  await loadPublicCelebrationVisibility();
  const initialMatch=location.hash.match(/^#celebration-(\d+)$/),routeSlug=decodeURIComponent(location.pathname.split('/').filter(Boolean).pop()||'').toLowerCase(),hasPublicRoute=!!routeSlug&&routeSlug!=='index.html';
  if(publicShowOtherCelebrations&&initialMatch&&state.celebrations.some(c=>c.id===Number(initialMatch[1]))){const id=Number(initialMatch[1]);history.replaceState({screen:'celebration',id},'',location.href);openPublicCelebration(id,false)}
  else if(publicShowOtherCelebrations&&!hasPublicRoute){history.replaceState({screen:'home'},'',location.pathname+location.search);showCelebrationHome(false)}
  else{const c=current();history.replaceState({screen:'celebration',id:c?.id||null},'',location.pathname+location.search);if(c)openPublicCelebration(c.id,false);else showCelebrationHome(false);restorePublicRoute()}
  publicShellReady=true;window.publicShellReady=true;window.dispatchEvent(new Event('public-shell-ready'));
})();