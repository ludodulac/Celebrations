// Historical regression fixture only; never used by the live visual editor.
export function createMemberDirectoryTransport({
  fetchImpl=globalThis.fetch,tokenProvider=()=>'',
  origin=globalThis.location?.origin
}={}) {
  if(typeof fetchImpl!=='function'||!origin)throw new TypeError('Same-origin admin transport required');
  const base=new URL('/api/admin/member-directory',origin);
  if(base.origin!==origin)throw new TypeError('Cross-origin API forbidden');
  return async command=>{
    if(!['GET','POST'].includes(command?.method))throw new TypeError('Invalid method');
    const token=tokenProvider();
    if(typeof token!=='string'||!token) return {ok:false,error:'Session administrateur absente'};
    const url=new URL(base);
    const options={method:command.method,credentials:'same-origin',cache:'no-store',
      redirect:'error',headers:{authorization:'Bearer '+token,accept:'application/json'}};
    if(command.method==='GET'){
      for(const key of ['action','search','cursor','limit','personId']){
        if(command[key]!==undefined && command[key]!==null && command[key]!=='')
          url.searchParams.set(key,String(command[key]));
      }
    }else{
      options.headers['content-type']='application/json';
      options.body=JSON.stringify(Object.fromEntries(Object.entries(command)
        .filter(([key])=>key!=='method')));
    }
    try {
      const response=await fetchImpl(url.toString(),options);
      if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))
        throw new Error('Route administrative indisponible');
      const result=await response.json();
      if(!response.ok||!result?.ok)
        return {ok:false,error:result?.error||('Accès refusé ('+response.status+')')};
      return result;
    }catch(error){
      return {ok:false,error:'Route administrateur non activée ou indisponible : '+
        (error?.message||'échec réseau')};
    }
  };
}

