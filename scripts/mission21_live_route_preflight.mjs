// M21 — ONLY GET/HEAD, never store or print response bodies or cookies.
import {captureActiveWorker} from './mission16_capture_worker_readonly.mjs';
const hosts = {
  official: 'https://ronde-des-archanges-universelle.eu',
  officialWww: 'https://www.ronde-des-archanges-universelle.eu',
  legacyStaging: 'https://celebrations-exit-staging.rondes.workers.dev',
  candidate: 'https://celebrations-visual-candidate.rondes.workers.dev',
};
async function check(url) {
  const response = await fetch(url, {
    method: 'GET', redirect: 'manual', cache: 'no-store',
    headers: {Accept:'application/json, text/html;q=0.5'},
    signal:AbortSignal.timeout(18000),
  });
  const status=response.status;
  await response.body?.cancel().catch(()=>{});
  return status;
}
let fatal = false;
try {
  const publicStatuses={};
  for(const name of ['official','officialWww']) {
    publicStatuses[name]=await check(hosts[name]+'/');
    if(publicStatuses[name]!==200)fatal=true;
  }
  const routes={};
  for(const name of ['official','officialWww','legacyStaging','candidate']) {
    routes[name]=await check(hosts[name]+'/api/editor-open-draft');
  }
  const officialProtected = [routes.official,routes.officialWww].every(n=>n===401||n===403||n===404);
  const stagingProtected = routes.legacyStaging===401||routes.legacyStaging===403||routes.legacyStaging===404;
  const candidateProtected = routes.candidate===401||routes.candidate===403||routes.candidate===404;
  console.log('M21_PUBLIC_AND_PRIVATE_ROUTES_READONLY '+JSON.stringify({
    publicStatus:publicStatuses,
    privateGetUnauthenticatedStatus:routes,
    officialProtected,legacyStagingProtected:stagingProtected,candidateProtected,
    confidentialResponseBodyPrinted:false,
    noWrites:true
  }));
  if(!officialProtected||!stagingProtected||!candidateProtected) {
    console.log('M21_CONFIDENTIALITY_RELEASE_BLOCKED staging_or_preview_route_accessible');
  }
  const w=await captureActiveWorker({
    account:process.env.CLOUDFLARE_ACCOUNT_ID,
    token:process.env.CLOUDFLARE_API_TOKEN
  });
  console.log('M21_LIVE_WORKER_ID_READONLY '+JSON.stringify(w));
  console.log('M21_WORKER_RECOVERY_LIMIT '+JSON.stringify({
    bundleAndAssetsArchived:false,
    exactRollbackRehearsed:false,
    versionObservedOnly:true,
  }));
  if(fatal)process.exitCode=1;
}catch(e) {
  console.error('M21_LIVE_PREFLIGHT_STOP category='+(e instanceof Error?'NetworkOrPolicy':'Unknown'));
  process.exitCode=1;
}
