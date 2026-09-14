(function(){
  function escStats(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
  async function loadStats(){
    const box=document.getElementById('clickStatsBox');if(!box)return;
    box.innerHTML='<div class="muted">Chargement des statistiques…</div>';
    const sb=window.celebrationsSupabase;if(!sb){box.innerHTML='<div class="notice">Connexion indisponible.</div>';return}
    const {data,error}=await sb.from('celebrations_clicks').select('clicked_at,celebration_id,content_id,target_kind,target_label,target_url,page_path,step_key,event_id').order('clicked_at',{ascending:false}).limit(5000);
    if(error){box.innerHTML='<div class="notice">Les statistiques ne sont pas accessibles avec cette session.</div>';return}
    const rows=data||[],map=new Map();
    rows.forEach(r=>{const key=r.content_id?`c:${r.content_id}`:`u:${r.target_url||r.target_label||'Lien'}`;const x=map.get(key)||{label:r.target_label||r.content_id||r.target_url||'Lien',kind:r.target_kind||'link',count:0,last:r.clicked_at};x.count++;if(r.clicked_at>x.last)x.last=r.clicked_at;map.set(key,x)});
    const list=[...map.values()].sort((a,b)=>b.count-a.count);
    box.innerHTML=`<div class="click-stats-summary"><strong>${rows.length}</strong> clic${rows.length>1?'s':''} enregistré${rows.length>1?'s':''} · <strong>${list.length}</strong> lien${list.length>1?'s':''} utilisé${list.length>1?'s':''}</div>${list.length?`<div class="list">${list.map(x=>`<div class="admin-row"><div><strong>${escStats(x.label)}</strong><div class="meta">${escStats(x.kind)} · dernier clic ${new Date(x.last).toLocaleString('fr-FR')}</div></div><div style="font-size:1.25rem;font-weight:700">${x.count}</div></div>`).join('')}</div>`:'<div class="notice">Aucun clic enregistré pour le moment.</div>'}`;
  }
  const nav=document.querySelector('.admin-nav');if(nav&&!nav.querySelector('[data-admin="stats"]')){const b=document.createElement('button');b.className='btn';b.dataset.admin='stats';b.textContent='Statistiques';nav.appendChild(b);b.onclick=()=>{document.querySelectorAll('[data-admin]').forEach(x=>x.classList.toggle('active',x===b));panel.innerHTML='<div class="card"><div class="eyebrow">Statistiques</div><h2>Clics sur les liens du site</h2><p class="muted">Comptage anonyme des ouvertures de contenus et liens publics. Aucune identité, adresse e-mail ou adresse IP n’est enregistrée dans ce tableau.</p><div id="clickStatsBox"></div></div>';loadStats()}}
})();
