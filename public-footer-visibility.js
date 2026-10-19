(async function(){
  const links=[...document.querySelectorAll('.public-footer-legal a[data-footer-slug]')];
  links.forEach(a=>a.hidden=true);
  try{
    let rows;
    if(window.celebrationsStagingData){
      // Isolated preview reads only published slugs from Cloudflare D1.
      rows=await window.celebrationsStagingData('celebrations_footer_drafts');
    }else{
      const url='https://jwyayfkssyagvnablttg.supabase.co/rest/v1/celebrations_footer_drafts?is_active=eq.true&is_public=eq.true&select=slug';
      const r=await fetch(url,{headers:{apikey:'sb_publishable_qm8yJyH_5LfP-oZ1sz4QLg_r9J5VdnA'}});
      if(!r.ok)return;
      rows=await r.json();
    }
    const visible=new Set(rows.map(x=>x.slug));
    links.forEach(a=>a.hidden=!visible.has(a.dataset.footerSlug));
  }catch(e){}
})();