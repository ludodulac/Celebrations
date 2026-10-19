(function(){
  const url='https://jwyayfkssyagvnablttg.supabase.co';
  const key='sb_publishable_qm8yJyH_5LfP-oZ1sz4QLg_r9J5VdnA';
  window.CELEBRATIONS_SUPABASE_URL=url;
  window.CELEBRATIONS_SUPABASE_KEY=key;
  // Staging runs against Cloudflare D1/R2, never instantiate a Supabase client.
  if(new URLSearchParams(location.search).get('staging')==='1')return;
  if(window.supabase?.createClient){
    window.celebrationsSupabase=window.supabase.createClient(url,key,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
  }
})();