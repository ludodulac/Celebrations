// M4: check public media and actual historical emailed PDF links by HOST,
// without ever emitting slugs, media paths, data, email addresses or token.
// The technical production workers.dev has been deliberately disabled by M2.
// This is a read-only inventory of which public URLs still work, NOT a
// request to re-enable a private admin or publish other unpublished files.
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
 {name:'official',url:domain,required:true},
 {name:'official-www',url:www,required:true},
 {name:'historic-legacy',url:'https://celebrations.rondes.workers.dev',required:true},
 {name:'former-technical-workersdev',url:'https://celebrations-exit-production.rondes.workers.dev',required:false}
];
const result={};
for(const h of hosts){
 let pdf200=0,pdf404=0,other=0,redirect=0;
 for(const row of invitations){
  assert.ok(typeof row.slug==='string'&&row.slug.length>=8);
  const r=await head(h.url+'/?lettre='+encodeURIComponent(row.slug));
  if(r.status===200 && /application\/pdf/i.test(r.type)&&!r.redirect)pdf200++;
  else if(r.status===404)pdf404++;
  else {other++;if(r.redirect)redirect++}
 }
 result[h.name]={pdf200,pdf404,other,redirect,required:h.required};
 console.log('M04_REAL_PDF_HOST_COUNTS '+JSON.stringify({host:h.name,...result[h.name],
   slugsNotLogged:true}));
}
for(const x of hosts.filter(h=>h.required)){
 assert.equal(result[x.name].pdf200,9,'Historic PDF links broken on '+x.name);
}
const off=result['former-technical-workersdev'];
if(off.pdf200!==9)console.log('M04_RETIREMENT_WARNING '+JSON.stringify({
 techHostPreviouslyProbedForEmailedPdf:true,
 status:'some_old_technical_PDF_links_unavailable',
 requiredAction:'M5 decide restore historic link compatibility while denying admin',
 safeToReenableWithoutNewCode:false,
 }));
const unknown=await head(domain+'/?lettre=not-a-real-invitation');
assert.equal(unknown.status,404,'Unpublished PDF slug unexpectedly accepted');
console.log('M04_MEDIA_PDF_REAL_READONLY_PASS '+JSON.stringify({
 publishedMediaAvailable:goodMedia,mediaExpected:113,
 historicApprovedPdfCount:invitations.length,hostCounts:result,
 unknownPdfSlugDenied:true,remoteWrites:0,d1SelectOnly:true,
 technicalWorkersDevStillDisabled:off.pdf200===0,
 legacyCompatibilityFullyProven:off.pdf200===9
}));
