// M16 — verification only: absolutely no deployment, rollback, D1 or R2 writes.
// Release files must be private ephemeral attestations, never committed fixtures.
import {readFileSync} from 'node:fs';
import {checkReleaseEvidence,activeDeployment} from '../migration/cloudflare/app/release/editor-release-policy.mjs';
import {captureActiveWorker} from './mission16_capture_worker_readonly.mjs';
function read(path){return JSON.parse(readFileSync(path,'utf8'))}
export async function verifyLivePreflight(evidence,{account,token,fetcher=fetch,now=Date.now()}={}){
 const reported=await captureActiveWorker({account,token,fetcher,
  now:()=>new Date(now).toISOString()});
 return checkReleaseEvidence(evidence,reported,{now});
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{
  if(process.argv.length!==3||!process.argv[2]||
   process.env.M16_RELEASE_CHECK_MODE!=='read-only')
   throw new Error('M16_BLOCK: explicit read-only mode + private evidence path required');
  const evidence=read(process.argv[2]);
  const result=await verifyLivePreflight(evidence,{
   account:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN});
  console.log('M16_PRECONDITIONS_AUDITED_NOT_DEPLOYED '+JSON.stringify(result));
 }catch(e){
  // Never print private evidence, URLs, secrets or remote exception details.
  console.error('M16_RELEASE_BLOCKED category='+(e instanceof Error?'Preflight':'Unknown'));
  process.exitCode=1;
 }
}
