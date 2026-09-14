(async function(){
  const links=[...document.querySelectorAll('.public-footer-legal a[data-footer-slug]')];
  links.forEach(a=>a.hidden=true);
  try{
    const url='https://jwyayfkssyagvnablttg.supabase.co/rest/v1/celebrations_footer_drafts?is_active=eq.true&is_public=eq.true&select=slug';
    const r=await fetch(url,{headers:{apikey:'sb_publishable_qm8yJyH_5LfP-oZ1sz4QLg_r9J5VdnA'}});
    if(!r.ok)return;
    const visible=new Set((await r.json()).map(x=>x.slug));
    links.forEach(a=>a.hidden=!visible.has(a.dataset.footerSlug));
  }catch(e){}
})();