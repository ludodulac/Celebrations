// Observe the current official Worker once; M019 never writes to its services.
import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
assert.equal(process.env.GITHUB_REF,'refs/heads/feat/m019-admin-simplification-20261111');
assert.equal(process.env.M018_ISOLATED_ONLY,'YES');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,'60a7b17758a93fe6681ce998e72ddff0');
const response=await fetch('https://api.cloudflare.com/client/v4/accounts/'+process.env.CLOUDFLARE_ACCOUNT_ID+'/workers/scripts/celebrations-exit-production/deployments',{
 headers:{authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN},signal:AbortSignal.timeout(25000)});
assert.equal(response.status,200);const result=await response.json();assert.equal(result.success,true);
const versions=result.result.deployments[0].versions;
assert.equal(versions.length,1);assert.equal(versions[0].percentage,100);
const snapshot=JSON.stringify(versions),file='/tmp/m019-official-version.json';
if(existsSync(file))assert.equal(snapshot,readFileSync(file,'utf8'),'Official Worker changed during M019');
else writeFileSync(file,snapshot);
console.log('M019_OFFICIAL_UNCHANGED production_writes=0');
