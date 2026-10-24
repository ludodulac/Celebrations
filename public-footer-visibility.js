(async function(){
  const links=[...document.querySelectorAll('.public-footer-legal a[data-footer-slug]')];
  links.forEach(a=>a.hidden=true);
  try{
    // Public visibility comes exclusively from Cloudflare D1.
    if(typeof window.celebrationsStagingData!=='function')return;
    const rows=await window.celebrationsStagingData('celebrations_footer_drafts');
    if(!Array.isArray(rows))return;
    const visible=new Set(rows.map(x=>x.slug));
    links.forEach(a=>a.hidden=!visible.has(a.dataset.footerSlug));
  }catch(e){}
})();
