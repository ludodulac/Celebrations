(function(){
  function escStats(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
  async function loadStats(){
    const box=document.getElementById('clickStatsBox');if(!box)return;
    box.innerHTML='<div class="muted">Chargement des statistiques…</div>';
    const sb=window.celebrationsSupabase;if(!sb){box.innerHTML='<div class="notice">Connexion indisponible.</div>';return}
    const token=window.getCelebrationsAdminToken?.()||'';
    const {data,error}=await sb.rpc('celebrations_click_stats',{admin_token:token});
    if(error){box.innerHTML='<div class="notice">Impossible de charger les statistiques.</div>';return}
    const list=data||[],total=list.reduce((n,x)=>n+Number(x.click_count||0),0);
    box.innerHTML=`<div class="click-stats-summary"><strong>${total}</strong> clic${total>1?'s':''} enregistré${total>1?'s':''} · <strong>${list.length}</strong> lien${list.length>1?'s':''} utilisé${list.length>1?'s':''}</div>${list.length?`<div class="list">${list.map(x=>`<div class="admin-row"><div><strong>${escStats(x.target_label)}</strong><div class="meta">${escStats(x.target_kind)} · dernier clic ${new Date(x.last_clicked_at).toLocaleString('fr-FR')}</div></div><div style="font-size:1.25rem;font-weight:700">${Number(x.click_count||0)}</div></div>`).join('')}</div>`:'<div class="notice">Aucun clic enregistré pour le moment.</div>'}`;
  }
  const nav=document.querySelector('.admin-nav');if(nav&&!nav.querySelector('[data-admin="stats"]')){const b=document.createElement('button');b.className='btn';b.dataset.admin='stats';b.textContent='Statistiques';nav.appendChild(b);b.onclick=()=>{document.querySelectorAll('[data-admin]').forEach(x=>x.classList.toggle('active',x===b));panel.innerHTML='<div class="card"><div class="eyebrow">Statistiques</div><h2>Clics sur les liens du site</h2><p class="muted">Comptage anonyme des ouvertures de contenus et liens publics. Aucune identité, adresse e-mail ou adresse IP n’est enregistrée dans ce tableau.</p><div id="clickStatsBox"></div></div>';loadStats()}}
})();
