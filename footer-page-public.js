function footerPageEsc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function footerPageHtml(text){return String(text||'').split(/\n/).map(line=>{const s=line.trim();if(!s)return '<div class="legal-space"></div>';if(s.startsWith('## '))return `<h2>${footerPageEsc(s.slice(3))}</h2>`;if(s.startsWith('# '))return `<h1>${footerPageEsc(s.slice(2))}</h1>`;const isHint=s.startsWith('[')&&s.endsWith(']');return `<p${isHint?' class="legal-hint"':''}>${footerPageEsc(s)}</p>`}).join('')}
(async function(){
 const slug=document.body.dataset.legalPage,def=FOOTER_PAGE_DEFS[slug];
 document.title=`${def?.title||'Informations'} — Célébrations des Archanges`;
 const title=document.getElementById('legalTitle');if(title)title.textContent=def?.title||'Informations';
 const target=document.getElementById('legalContent');if(!target)return;
 try{
  let rows;
  // Legal links may omit ?staging=1; the isolated staging hostname is authoritative.
  if(location.hostname==='celebrations-exit-staging.rondes.workers.dev'){
    const res=await fetch(location.origin+'/api/public-data?table=celebrations_footer_page&slug='+encodeURIComponent(slug),{credentials:'omit'});
    if(!res.ok)throw new Error('Cloudflare D1 '+res.status);
    rows=await res.json();
  }else{
    const url=`https://jwyayfkssyagvnablttg.supabase.co/rest/v1/celebrations_footer_drafts?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=content,title,updated_at&limit=1`;
    const res=await fetch(url,{headers:{apikey:'sb_publishable_qm8yJyH_5LfP-oZ1sz4QLg_r9J5VdnA'}});
    if(!res.ok)throw new Error('Supabase '+res.status);
    rows=await res.json();
  }
  const published=rows?.[0]||null;
  target.innerHTML=published?.content?footerPageHtml(published.content):'<div class="legal-empty"><h2>Page en préparation</h2><p>Cette page sera publiée dès qu’un brouillon aura été validé dans l’administration.</p></div>';
 }catch(e){target.innerHTML='<div class="legal-empty"><h2>Page momentanément indisponible</h2><p>Impossible de charger cette page depuis le serveur.</p></div>'}
})();
