// M030: strictly read-only inventory of *existing* official celebration identities.
// No personal records, text content, credentials or R2 object URLs printed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ACCOUNT='60a7b17758a93fe6681ce998e72ddff0';
const DB='28736d2a-479b-472b-bf82-703ad0affe10';
const WORKER='celebrations-exit-production';
assert.equal(process.env.M030_READONLY,'YES');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,ACCOUNT);
assert.ok((process.env.CLOUDFLARE_API_TOKEN||'').length>20);
assert.equal(process.env.GITHUB_REF,'refs/heads/feat/m030-canonical-celebration-cycles-20261113');
const auth={'authorization':'Bearer '+process.env.CLOUDFLARE_API_TOKEN};
async function api(path,post){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+path,{
  method:post?'POST':'GET',
  headers:{...auth,...(post?{'content-type':'application/json'}:{})},
  ...(post?{body:JSON.stringify(post)}:{}),signal:AbortSignal.timeout(35000)});
 assert.equal(r.status,200,'READ ONLY CF '+path+' HTTP '+r.status);
 const result=await r.json();assert.equal(result.success,true,'READ ONLY CF '+path);return result.result;
}
const deploy=await api('/workers/scripts/'+WORKER+'/deployments');
const versions=deploy.deployments?.[0]?.versions||[];
assert.equal(versions.length,1);
assert.equal(versions[0].percentage,100);
const workerVersion=versions[0].version_id;
// Do not mistake this inventory for approval to change an unexpected newer production.
assert.match(workerVersion,/^[0-9a-f-]{36}$/);
const raw=await api('/d1/database/'+DB+'/query',{
 sql:'SELECT id,archangel,year,status FROM celebrations_celebrations ORDER BY id'});
const rows=raw?.[0]?.results;
assert.ok(Array.isArray(rows),'D1 celebration catalogue unavailable');
const snap=JSON.parse(readFileSync('/tmp/m030-editor-readonly.json','utf8'));
assert.ok(Number.isSafeInteger(snap.version)&&snap.drafts&&snap.published,'Editor snapshot invalid');
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const allowed=new Set(['michael','gabriel','raphael','ouriel']);
const numbers=new Map(),duplicates=[];
const output=rows.map(r=>{
 const id=String(r.id),archangel=String(r.archangel),year=String(r.year||'');
 const key=norm(archangel)+'|'+year;
 const prior=numbers.get(key);
 if(prior)duplicates.push({key,ids:[prior,id]});else numbers.set(key,id);
 const draft=snap.drafts[id],published=snap.published.drafts?.[id];
 const count=r=>({pages:Array.isArray(r?.pages)?r.pages.length:0,
  spaces:Array.isArray(r?.spaces)?r.spaces.length:0,
  spacePages:(r?.spaces||[]).reduce((n,s)=>n+(s?.pages?.length||0),0)});
 const ownPages=new Set([...(draft?.pages||[]).map(p=>p.id),...(draft?.spaces||[]).flatMap(s=>(s?.pages||[]).map(p=>p.id))]);
 const translations=Object.entries(snap.localization?.pages||{}).filter(([k])=>ownPages.has(k))
  .reduce((n,[,v])=>n+Object.keys(v||{}).length,0);
 return {id,archangel,year,status:r.status,identityKey:key,expectedCycle:allowed.has(norm(archangel))&&/^20\d{2}$/.test(year),
  isMichael2026:key==='michael|2026',
  draft:count(draft),published:count(published),publicTranslations:translations,
  visibility:snap.published.celebrationVisibility?.[id]||snap.shared?.celebrationVisibility?.[id]||'unset',
  access:snap.published.celebrationAccessPolicies?.[id]?.mode||'PUBLIC',
  hasMetadata:!!snap.celebrationMetadata?.[id]};
});
const dangling=Object.keys(snap.drafts||{}).filter(id=>!rows.some(r=>String(r.id)===id));
const planned=Array.isArray(snap.plans)?snap.plans:[];
console.log('M030_READONLY_OFFICIAL_INVENTORY '+JSON.stringify({
 workerVersion,editorRevision:snap.version,totalD1:rows.length,
 expectedMichael2026:output.filter(x=>x.isMichael2026).length,
 duplicateGroups:duplicates,
 canonicalCandidates:output.filter(x=>x.isMichael2026),
 otherCelebrations:output.filter(x=>!x.isMichael2026),
 danglingR2DraftCount:dangling.length,danglingR2DraftIds:dangling.slice(0,60),
 existingPlanEntries:planned.length,
 publicGlobalPageCount:snap.shared?.pages?.length||0,
 publishedPublicPageCount:snap.published?.shared?.pages?.length||0,
 privateReleaseCount:Object.keys(snap.published?.privatePageReleases||{}).length
}));
console.log('M030_READONLY_NO_D1_OR_R2_WRITE_PASS');
