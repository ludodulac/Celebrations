const FIXED_STEPS=['Préparation','Mercredi','Jeudi','Vendredi','Samedi','Dimanche','Après célébration'];
function fixedStepKey(label){return String(label||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-')}
function isAfterCelebrationLabel(label){return ['apres-celebration','celebration','celebration-principale'].includes(fixedStepKey(label))}
function ensureFixedSteps(c){
  const old=c.days||[],used=new Set();
  c.days=FIXED_STEPS.map(label=>{
    const wanted=fixedStepKey(label);
    let d=old.find(x=>!used.has(x)&&fixedStepKey(x.label)===wanted);
    if(!d&&label==='Après célébration')d=old.find(x=>!used.has(x)&&isAfterCelebrationLabel(x.label));
    if(d){used.add(d);d.label=label;d.contentIds=Array.isArray(d.contentIds)?d.contentIds:[];return d}
    return {key:`${wanted}-${c.id}`,label,startDate:'',endDate:'',text:'',links:[],contentIds:[]};
  });
}
state.celebrations.forEach(ensureFixedSteps);saveState(state);

function fixedDateLabel(d){
  if(d.label==='Après célébration')return '';
  if(d.label==='Préparation'){
    if(d.startDate&&d.endDate&&d.startDate!==d.endDate)return `${formatDate(d.startDate)} → ${formatDate(d.endDate)}`;
    return d.startDate?formatDate(d.startDate):'Sans date';
  }
  return d.startDate?formatDate(d.startDate):'Sans date';
}

function dayContentAssociations(d){
  if(!state.contents.length)return '<div class="notice">Aucun contenu dans la bibliothèque.</div>';
  const ids=new Set(d.contentIds||[]);
  return `<div class="list">${state.contents.map(c=>{const linked=ids.has(c.id);return `<div class="admin-row"><div><strong>${icon(c.type)} ${esc(c.name)}</strong><div class="meta">${esc(c.type)}${linked?' · associé à cette étape':''}</div></div><button type="button" class="btn ${linked?'':'primary'}" onclick="toggleDayContent('${d.key}',${c.id})">${linked?'Retirer':'Associer'}</button></div>`}).join('')}</div>`;
}
function toggleDayContent(dayKey,contentId){
  const c=selected(),d=c.days.find(x=>x.key===dayKey);if(!d)return;
  const ids=new Set(d.contentIds||[]),wasLinked=ids.has(contentId);
  if(wasLinked)ids.delete(contentId);else ids.add(contentId);
  d.contentIds=[...ids];saveState(state);editDay(dayKey);toast(wasLinked?'Association retirée':'Contenu associé');
}

renderProgram=function(){
  const c=selected();ensureFixedSteps(c);
  panel.innerHTML=`${context()}<div class="card"><div class="eyebrow">Programme</div><h2>Étapes</h2><div class="list">${c.days.map(dayCard).join('')}</div></div>`;
};

dayCard=function(d){
  const c=selected(),events=state.events.filter(e=>e.celebrationId===c.id&&e.dayKey===d.key),date=fixedDateLabel(d);
  return `<button class="admin-row" style="width:100%;text-align:left;background:#fff;cursor:pointer" onclick="editDay('${d.key}')"><div><strong>${esc(d.label)}</strong>${date?`<div class="meta">${esc(date)} · ${events.length} rendez-vous</div>`:`<div class="meta">${events.length} rendez-vous</div>`}</div><span class="btn primary">Gérer</span></button>`;
};

editDay=function(key){
  const c=selected(),d=c.days.find(x=>x.key===key);if(!d)return renderProgram();
  const events=state.events.filter(e=>e.celebrationId===c.id&&e.dayKey===key).sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
  const dateFields=d.label==='Préparation'
    ? `<label class="field"><span>Date de début</span><input id="dStart" type="date" value="${esc(d.startDate||'')}"></label><label class="field"><span>Date de fin</span><input id="dEnd" type="date" value="${esc(d.endDate||'')}"></label>`
    : d.label==='Après célébration'
      ? ''
      : `<label class="field"><span>Date</span><input id="dStart" type="date" value="${esc(d.startDate||'')}"></label>`;
  panel.innerHTML=`${context()}<div class="card"><div class="eyebrow">${esc(d.label)}</div><h2>${esc(d.label)}</h2><div class="form-grid">${dateFields}<label class="field full"><span>Texte</span><textarea id="dText">${esc(d.text||'')}</textarea></label></div><h3>Liens</h3><div id="dayLinks">${(d.links||[]).map((l,i)=>linkRow(l,i)).join('')}</div><button class="btn small" id="addLink">+ Ajouter un lien</button><h3>Contenus</h3>${dayContentAssociations(d)}<div class="actions" style="margin-top:10px"><button class="btn small" id="createDayContent">+ Créer un contenu</button></div><div id="dayInlineContent"></div><div class="actions" style="margin-top:18px"><button class="btn primary" id="saveDay">Enregistrer</button><button class="btn" onclick="renderProgram()">Retour</button></div></div><div class="card section"><div class="section-head"><h2 style="margin:0">Rendez-vous</h2><button class="btn primary" onclick="showDayEventForm('${key}')">+ Ajouter un rendez-vous</button></div><div id="dayEventForm"></div><div class="list">${events.length?events.map(eventRow).join(''):'<div class="notice">Aucun rendez-vous.</div>'}</div></div>`;
  addLink.onclick=()=>dayLinks.insertAdjacentHTML('beforeend',linkRow({label:'',url:''},dayLinks.children.length));
  createDayContent.onclick=()=>renderInlineContentCreator('dayInlineContent',id=>{d.contentIds=[...new Set([...(d.contentIds||[]),id])];saveState(state);editDay(key)});
  saveDay.onclick=()=>{
    if(d.label==='Préparation'){
      const s=document.getElementById('dStart').value,e=document.getElementById('dEnd').value||s;
      if(s&&e&&e<s)return toast('La date de fin doit suivre la date de début');d.startDate=s;d.endDate=e;
    }else if(d.label==='Après célébration'){d.startDate='';d.endDate='';}
    else{const s=document.getElementById('dStart').value;d.startDate=s;d.endDate=s;}
    d.text=dText.value;
    d.links=[...dayLinks.querySelectorAll('[data-link-row]')].map(r=>({label:r.querySelector('[data-link-label]').value.trim(),url:r.querySelector('[data-link-url]').value.trim()})).filter(x=>x.url);
    saveState(state);editDay(key);toast('Enregistré');
  };
};
// Cloudflare preview loads D1 state only after the admin session is validated.
if(!window.CELEBRATIONS_STAGING_BACKEND)renderProgram();
