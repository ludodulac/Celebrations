import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isAllowedEditorPageHost,isOfficialEditorHost,isReadonlyCandidateHost}
 from '../migration/cloudflare/app/security/editor-route-policy.mjs';
import {handlePreparationDemo} from '../migration/cloudflare/editor-demo-preparation-page.mjs';
import {handleTrialSite} from '../migration/cloudflare/editor-trial-site-page.mjs';
import production from '../migration/cloudflare/production-worker.mjs';

const official=['ronde-des-archanges-universelle.eu',
 'www.ronde-des-archanges-universelle.eu'];
const legacy='celebrations-exit-staging.rondes.workers.dev';
const candidate='celebrations-visual-candidate.rondes.workers.dev';
const disallowed=['celebrations-exit-production.rondes.workers.dev',
 'untrusted.invalid','www.ronde-des-archanges-universelle.eu.attacker.invalid'];
test('M02: exact historical visitor/editor hosts remain allowed, no technical production hostname',()=>{
 for(const host of [...official,legacy,candidate])assert.equal(isAllowedEditorPageHost(host),true,host);
 for(const host of disallowed)assert.equal(isAllowedEditorPageHost(host),false,host);
 for(const host of official)assert.equal(isOfficialEditorHost(host),true);
 assert.equal(isReadonlyCandidateHost(candidate),true);
 assert.equal(isReadonlyCandidateHost(legacy),false);
});
test('M02: actual editor handler host routing still refuses spoofing before any database access',async()=>{
 for(const host of disallowed){
  const response=await handlePreparationDemo(new Request('https://'+host+'/admin.html'),{});
  assert.equal(response.status,404,host);
 }
 for(const host of [...official,legacy,candidate]){
  const response=await handlePreparationDemo(new Request('https://'+host+'/admin.html'),{});
  assert.equal(response.status,503,host); // allowed host, absent DB
 }
});
test('M02: actual visitor handler host routing unchanged with no DB',async()=>{
 for(const host of disallowed){
  const response=await handleTrialSite(new Request('https://'+host+'/'),{});
  assert.equal(response.status,404,host);
 }
 for(const host of [...official,legacy,candidate]){
  const response=await handleTrialSite(new Request('https://'+host+'/'),{});
  assert.equal(response.status,503,host);
 }
});
test('M02: official Worker still checks once and preserves anonymous private gates',async()=>{
 const source=readFileSync('migration/cloudflare/production-worker.mjs','utf8');
 assert.equal(source.split('isOfficialEditorHost(url.hostname)').length-1,1);
 assert.match(source,/if\(\(officialHost\|\|visualCandidate\)\&\&env\.DB\)/);
 for(const host of official){
  const denied=await production.fetch(new Request('https://'+host+
   '/api/editor-open-draft?celebration=101'),{});
  assert.equal(denied.status,401,host);
 }
 const preview=await production.fetch(new Request(
   'https://'+candidate+'/api/editor-open-draft?celebration=101'),{});
 assert.equal(preview.status,404);
});
test('M02: only one allowed-host definition, no obsolete duplicate SITE set',()=>{
 for(const path of ['migration/cloudflare/editor-demo-preparation-page.mjs',
  'migration/cloudflare/editor-trial-site-page.mjs',
  'migration/cloudflare/editor-publication-api.mjs']){
  const text=readFileSync(path,'utf8');
  assert.ok(text.includes('isAllowedEditorPageHost('),path);
  assert.ok(!text.includes("new Set(['www.ronde-des-archanges-universelle.eu'"),path);
 }
});
