// Legacy filename retained temporarily because the original HTML load order
// depends on this path. Production and staging now use Cloudflare exclusively.
// A missing Cloudflare bootstrap must fail closed rather than contact Supabase.
(function(){
  if(!window.CELEBRATIONS_STAGING_BACKEND){
    throw new Error('Cloudflare backend bootstrap is missing.');
  }
})();
