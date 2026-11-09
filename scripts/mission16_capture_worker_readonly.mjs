// M16 — read-only Cloudflare Worker deployment identity (no PUT/POST/DELETE).
// Use only with read-only Workers metadata permission. Never output tokens.
import {activeDeployment,OFFICIAL_WORKER} from '../migration/cloudflare/app/release/editor-release-policy.mjs';
export const endpoint=account=>
 'https://api.cloudflare.com/client/v4/accounts/'+account+
 '/workers/scripts/'+OFFICIAL_WORKER+'/deployments?per_page=2';
export async function captureActiveWorker({account,token,fetcher=fetch,now=()=>new Date().toISOString()}={}){
 if(!/^[a-f0-9]{32}$/i.test(account||'')||!token)
  throw new Error('M16_BLOCK: read-only Cloudflare identity credentials unavailable');
 const response=await fetcher(endpoint(account),{
  method:'GET',redirect:'error',cache:'no-store',
  headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  signal:AbortSignal.timeout(15000)
 });
 if(!response.ok)throw new Error('M16_BLOCK: Cloudflare Worker deployment GET failed');
 const live=activeDeployment(await response.json());
 return Object.freeze({...live,observedAt:now(),
  source:'Cloudflare Workers GET deployments; read-only'});
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{
  const item=await captureActiveWorker({
   account:process.env.CLOUDFLARE_ACCOUNT_ID,
   token:process.env.CLOUDFLARE_API_TOKEN
  });
  console.log('M16_WORKER_IDENTITY_READONLY '+JSON.stringify(item));
 }catch(e){
  console.error('M16_WORKER_IDENTITY_STOP category='+(e instanceof Error?'Error':'Unknown'));
  process.exitCode=1;
 }
}
