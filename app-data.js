const ARCHANGELS={Michaël:'#b42318',Gabriel:'#173b70',Raphaël:'#16803c',Ouriel:'#d39e00'};
const DEFAULTS={version:7,currentCelebrationId:null,adminCelebrationId:null,profile:'all',groups:[{id:'all',name:'Tous'},{id:'angel',name:"Porteurs d’Ange"},{id:'nonangel',name:"Non-porteurs d’Ange"}],categories:['Audio','Textes','Vidéos','PDF','Images','Liens'],celebrations:[],contents:[],events:[]};
function clone(v){return JSON.parse(JSON.stringify(v))}
function dateKey(){return 'day-'+Date.now()+'-'+Math.random().toString(36).slice(2,7)}
function daysBetween(start,end){if(!start||!end)return[];const out=[];let d=new Date(start+'T12:00:00'),e=new Date(end+'T12:00:00');while(d<=e){const key=d.toISOString().slice(0,10);out.push({key,date:key,label:d.toLocaleDateString('fr-FR',{weekday:'long'}),short:d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})});d.setDate(d.getDate()+1)}return out}
function normalizeDay(d){const oldDate=d?.date||'';return{...d,key:d?.key||oldDate||dateKey(),label:d?.label||'Jour',startDate:d?.startDate||oldDate||'',endDate:d?.endDate||d?.startDate||oldDate||'',text:d?.text||'',links:Array.isArray(d?.links)?d.links.filter(x=>x&&x.url).map(x=>({label:x.label||x.url,url:x.url,kind:x.kind||'link'})):[],contentIds:Array.isArray(d?.contentIds)?d.contentIds.map(v=>/^\d+$/.test(String(v??''))?Number(v):String(v??'')).filter(v=>String(v)!==''):[]}}
// État transitoire uniquement en mémoire. Supabase est la source canonique.
function loadState(){return clone(DEFAULTS)}
function saveState(){/* remplacé côté administration par admin-supabase-core.js ; aucune donnée métier locale */}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function groupName(s,id){return s.groups.find(g=>g.id===id)?.name||'Tous'}
function formatDate(v,opts={day:'numeric',month:'long',year:'numeric'}){if(!v)return'';return new Date(v+'T12:00:00').toLocaleDateString('fr-FR',opts)}
function dayDateLabel(d){if(!d)return'';if(d.startDate&&d.endDate&&d.startDate!==d.endDate)return `${formatDate(d.startDate)} → ${formatDate(d.endDate)}`;if(d.startDate)return formatDate(d.startDate);return'Sans date'}
function celebrationRange(c){const starts=(c?.days||[]).map(d=>d.startDate).filter(Boolean).sort(),ends=(c?.days||[]).map(d=>d.endDate||d.startDate).filter(Boolean).sort();return starts.length?{start:starts[0],end:ends[ends.length-1]||starts[0]}:{start:'',end:''}}
function dayForEvent(c,e){return (c?.days||[]).find(d=>d.key===e.dayKey)||null}
function contentIcon(t){return t==='PDF'?'📄':t==='Audio'?'♫':t==='Vidéo'?'▶':t==='Texte'?'¶':t==='Image'?'🖼️':'↗'}
