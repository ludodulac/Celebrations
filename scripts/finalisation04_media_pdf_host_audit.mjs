// M4: check ONLY the two valid official-domain PDF hosts, as confirmed by
// the site owner on 2026-11-09. Previous workers.dev emailed PDF URLs are
// retired intentionally and MUST NOT be restored, tested or treated as blockers.
// No file names, private slugs, visitor data, emails or credentials are logged.
// Query D1 exclusively with SELECT and HEAD the official media/PDF URLs.
import assert from 'node:assert/strict';
const domain='https://ronde-des-archanges-universelle.eu';
const www='https://www.ronde-des-archanges-universelle.eu';
const account=process.env.CLOUDFLARE_ACCOUNT_ID||'';
const token=process.env.CLOUDFLARE_API_TOKEN||'';
const db=process.env.PROD_D1_ID||'';
assert.match(account,/^[a-f0-9]{32}$/i);
assert.equal(db,'28736d2a-479b-472b-bf82-703ad0affe10');
assert.ok(token.length>=15);
async function select(sql){
 assert.ok(sql.startsWith('SELECT '),'No writing SQL allowed');
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+
   '/d1/database/'+db+'/query',{
   method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},
   body:JSON.stringify({sql}),signal:AbortSignal.timeout(25000)});
 assert.equal(r.status,200,'D1 read not available');
 const p=await r.json();
 assert.equal(p.success,true);
 assert.equal(p.result?.length,1);
 assert.equal(p.result[0].success,true);
 assert.equal(p.result[0].meta?.rows_written,0);
 return p.result[0].results;
}
async function head(url){
 const r=await fetch(url,{method:'HEAD',redirect:'manual',cache:'no-store',
   signal:AbortSignal.timeout(22000)});
 const result={status:r.status,type:r.headers.get('content-type')||'',
    redirect:!!r.headers.get('location')};
 await r.body?.cancel().catch(()=>{});
 return result;
}
const media=await select('SELECT storage_path FROM public_media WHERE approved=1 AND revoked_at IS NULL ORDER BY storage_path');
const invitations=await select('SELECT slug FROM committee_media WHERE published=1 AND revoked_at IS NULL ORDER BY slug');
assert.equal(media.length,113,'Public media count drift');
assert.equal(invitations.length,9,'Published PDF count drift');
let goodMedia=0;
for(let at=0;at<media.length;at+=5){
 const batch=await Promise.all(media.slice(at,at+5).map(async row=>{
  assert.ok(typeof row.storage_path==='string'&&row.storage_path.length>5);
  const result=await head(domain+'/media/'+row.storage_path.split('/').map(encodeURIComponent).join('/'));
  return result.status===200;
 }));
 goodMedia+=batch.filter(Boolean).length;
}
assert.equal(goodMedia,113,'Published public media unavailable');
const hosts=[
 {name:'official',url:domain},
 {name:'official-www',url:www}
];
const counts={};
for(const h of hosts){
 let pdf200=0;
 for(const row of invitations){
  assert.ok(typeof row.slug==='string'&&row.slug.length>=8);
  const res=await head(h.url+'/?lettre='+encodeURIComponent(row.slug));
  assert.equal(res.status,200,'Approved PDF unavailable on '+h.name);
  assert.match(res.type,/application\\/pdf/i,'PDF content-type missing on '+h.name);
  assert.equal(res.redirect,false,'Approved PDF unexpectedly redirects on '+h.name);
  pdf200++;
 }
 assert.equal(pdf200,9,'Missing approved PDF on '+h.name);
 counts[h.name]=pdf200;
 console.log('M04_OFFICIAL_PDF_HOST_PASS '+JSON.stringify({
   host:h.name,pdfsChecked:pdf200,allAvailable:true,privateSlugsLogged:false
 }));
}
const unknown=await head(domain+'/?lettre=not-a-real-invitation');
assert.equal(unknown.status,404,'Unpublished PDF slug unexpectedly accepted');
console.log('M04_MEDIA_PDF_REAL_READONLY_PASS '+JSON.stringify({
 publishedMediaAvailable:goodMedia,mediaExpected:113,
 approvedPdfCount:invitations.length,officialHostCounts:counts,
 retiredWorkersDevLinksExcludedByOwnerDecision:true,
 unknownPdfSlugDenied:true,remoteWrites:0,d1SelectOnly:true
}));
