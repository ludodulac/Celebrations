/* R2-019: inert media source selector. No public URL changes until explicitly wired in a separate approved PR. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.CelebrationsMediaSource=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SUPABASE='SUPABASE',R2='R2';
  let source=SUPABASE;
  let r2Origin='';
  function configure(options){
    const next=options&&options.source;
    if(next!==undefined&&next!==SUPABASE&&next!==R2)throw new Error('Invalid media source');
    if(options&&options.r2Origin!==undefined){
      if(options.r2Origin!==''&&(!/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(options.r2Origin)||options.r2Origin.includes('..')))
        throw new Error('R2 origin must be HTTPS hostname only');
      r2Origin=options.r2Origin.replace(/\/$/,'');
    }
    if(next===R2&&!r2Origin)throw new Error('R2 origin not configured');
    if(next!==undefined)source=next;
    return source;
  }
  function encodePath(path){
    const value=String(path||'');
    if(!value||value.startsWith('/')||value.includes('\\')||value.split('/').some(p=>p==='.'||p==='..'||p===''))throw new Error('Invalid storage path');
    return value.split('/').map(encodeURIComponent).join('/');
  }
  function url(path,supabaseUrl){
    if(!path)return '';
    const value=String(path);
    if(value.startsWith('data:')||/^https?:\/\//i.test(value))return value;
    if(source===R2)return r2Origin+'/'+encodePath(value);
    return supabaseUrl(value);
  }
  function rollback(){source=SUPABASE;return source}
  function current(){return source}
  return Object.freeze({SUPABASE,R2,configure,url,rollback,current});
});
