// Cloudflare bootstrap guard: never fall back to a retired backend.
(function(){
  if(!window.CELEBRATIONS_STAGING_BACKEND){
    throw new Error('Cloudflare backend bootstrap is missing.');
  }
})();
