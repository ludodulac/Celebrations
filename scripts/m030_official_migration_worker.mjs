// M030 — DISPOSABLE OFFICIAL MIGRATION WORKER. It has no website routes.
// Requires one high-entropy release-only token, exact D1/R2 bindings, and
// source/checksum preconditions. Deleted immediately after the release.
// D1 batch guarantees rollback on any statement failure (Cloudflare D1).
const SRC_IDS=['101','102','103','104','105','106','107'];
const DELETE_IDS=[102,103,104,105,106,107];
const R2_KEY='editor-trials/server-drafts-v1.json';
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const safeEquals=(x,y)=>{x=String(x||'');y=String(y||'');if(x.length!==y.length)return false;let diff=0;for(let i=0;i<x.length;i++)diff|=x.charCodeAt(i)^y.charCodeAt(i);return diff===0};
const response=(status,msg)=>Response.json({ok:false,error:msg},{status,headers:{'cache-control':'no-store'}});
export default {async fetch(request,env){
 if(request.method!=='POST'||new URL(request.url).pathname!=='/m030-commit')return response(404,'No route');
 if(env.M030_RELEASE_APPROVED!=='YES'||env.M030_TARGET_KEY!==R2_KEY||
    !safeEquals(request.headers.get('x-m030-release-token'),env.M030_RELEASE_TOKEN))
  return response(401,'Unauthorized');
 if(request.headers.get('content-type')!=='application/json')return response(415,'JSON required');
 let req;
 try{req=await request.json()}catch{return response(400,'Invalid JSON')}
 if(!req||Object.keys(req).sort().join(',')!=='cleanPayload,manifest,rollbackPayload')
  return response(400,'Invalid release input');
 const {manifest,cleanPayload,rollbackPayload}=req;
 if(!manifest||!Array.isArray(manifest.expectedD1Ids)||
    JSON.stringify(manifest.expectedD1Ids)!==JSON.stringify(SRC_IDS)||
    JSON.stringify(manifest.deleteIds)!==JSON.stringify(DELETE_IDS.map(String))||
    manifest.expectedWorker!=='76f31003-53b1-436f-ab6d-3217b05c91c3'||
    manifest.keepId!=='101'||manifest.deleteStepCount!==21||
    manifest.newRevision!==manifest.oldRevision+1||
    manifest.rollbackRevision!==manifest.oldRevision+2||
    typeof cleanPayload!=='string'||cleanPayload.length>9500000||
    typeof rollbackPayload!=='string'||rollbackPayload.length>9500000)
  return response(400,'Invalid release contract');
 if(await digest(cleanPayload)!==manifest.newSha256||
    await digest(rollbackPayload)!==manifest.rollbackSha256)
  return response(400,'Unmatched payload hash');
 let cleaned,rollback;
 try{cleaned=JSON.parse(cleanPayload);rollback=JSON.parse(rollbackPayload)}
 catch{return response(400,'Invalid release snapshots')}
 if(cleaned.version!==manifest.newRevision||rollback.version!==manifest.rollbackRevision||
    !cleaned.drafts?.['101']||!cleaned.published?.drafts?.['101']||
    Object.keys(cleaned.drafts).sort().join(',')!=='101'||
    Object.keys(cleaned.published.drafts).sort().join(',')!=='101')
  return response(409,'Owner content or publication missing from candidate');
 // No D1 writes and no R2 writes before every source integrity check passes.
 let ids,steps,existingIndex,source,oldText;
 try{
  ids=(await env.DB.prepare('SELECT id,archangel,year FROM celebrations_celebrations ORDER BY id').all()).results;
  steps=(await env.DB.prepare('SELECT celebration_id,COUNT(*) total FROM celebrations_steps GROUP BY celebration_id').all()).results;
  existingIndex=await env.DB.prepare(
   "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_celebrations_archangel_year_unique'").first();
  source=await env.BUCKET.get(R2_KEY);
  oldText=source?await source.text():'';
 }catch{return response(503,'Read-only source preflight failed')}
 if(!source||await digest(oldText)!==manifest.oldSha256||
    !Number.isSafeInteger(JSON.parse(oldText).version)||
    JSON.parse(oldText).version!==manifest.oldRevision)
  return response(409,'Editor changed since verified encrypted backup: no write');
 if(existingIndex||JSON.stringify(ids.map(x=>String(x.id)))!==JSON.stringify(SRC_IDS)||
    ids.find(x=>String(x.id)==='101')?.year!=='2026'||
    ids.find(x=>String(x.id)==='101')?.archangel!=='Michaël'||
    steps.filter(x=>DELETE_IDS.includes(Number(x.celebration_id)))
      .reduce((a,x)=>a+Number(x.total),0)!==21)
  return response(409,'D1 identities changed since verified backup: no write');
 // Atomic CAS protects a concurrently edited R2 page at COMMIT TIME.
 const stored=await env.BUCKET.put(R2_KEY,cleanPayload,{
  httpMetadata:{contentType:'application/json'},
  onlyIf:{etagMatches:source.etag}
 });
 if(!stored)return response(409,'Concurrent editor write: nothing was overwritten');
 let changes,done=false;
 try{
  const sqlIndex="CREATE UNIQUE INDEX IF NOT EXISTS idx_celebrations_archangel_year_unique ON celebrations_celebrations(lower(trim(archangel)),trim(year))";
  const results=await env.DB.batch([
   env.DB.prepare('DELETE FROM celebrations_steps WHERE celebration_id IN (102,103,104,105,106,107)'),
   env.DB.prepare('DELETE FROM celebrations_celebrations WHERE id IN (102,103,104,105,106,107)'),
   env.DB.prepare(sqlIndex)
  ]);
  changes=results.map(x=>Number(x?.meta?.changes??-1));
  // If D1 did commit but returned unexpected counts, we must NOT
  // restore R2 automatically: the cleaned 101 site is consistent.
  done=true;
 }catch{
  // D1 batch rolled back atomically. Roll R2 back via CAS, never an
  // unconditional PUT that could erase a concurrent admin edit.
  const current=await env.BUCKET.get(R2_KEY).catch(()=>null);
  if(current&&await digest(await current.text())===manifest.newSha256){
   const back=await env.BUCKET.put(R2_KEY,rollbackPayload,{
     httpMetadata:{contentType:'application/json'},onlyIf:{etagMatches:current.etag}
   }).catch(()=>null);
   return response(500,back?'D1 transaction failed; R2 restored safely':'D1 failed; R2 rollback refused due concurrent edit');
  }
  return response(500,'D1 transaction failed; R2 changed concurrently and was not overwritten');
 }
 let after,idx;
 try{
  after=(await env.DB.prepare('SELECT id FROM celebrations_celebrations ORDER BY id').all()).results;
  idx=await env.DB.prepare(
   "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_celebrations_archangel_year_unique'").first();
 }catch{return response(500,'D1 cleanup committed; verification read unavailable')}
 if(!done||JSON.stringify(after.map(x=>String(x.id)))!=='["101"]'||!idx||
     changes[0]!==21||changes[1]!==6)
  return response(500,'D1 cleanup committed but unexpected result; snapshot preserved for diagnosis');
 return Response.json({ok:true,removedIdentities:6,removedSteps:21,
  retainedCelebration:'101',newEditorRevision:cleaned.version,
  indexCreated:true,mediaObjectsDeleted:0},
  {headers:{'cache-control':'no-store'}});
}};
