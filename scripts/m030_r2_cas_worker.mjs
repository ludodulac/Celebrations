// M030 — temporary ONLY, short-lived R2 compare-and-swap bridge.
// Deployed with a UNIQUE isolated name; never added to the official hostname.
// Only the exact nominated object key and committed SHA-256 are accepted.
const hex=bytes=>Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
async function sha(v){return hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))}
const constant=(a,b)=>{
 a=String(a||'');b=String(b||'');
 if(a.length!==b.length)return false;
 let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;
};
const reject=(msg,status)=>new Response(msg,{status,headers:{'cache-control':'no-store'}});
export default {async fetch(request,env){
 try{
  const url=new URL(request.url);
  if(request.method!=='POST'||url.pathname!=='/m030-r2-cas')return reject('Not found',404);
  if(!constant(request.headers.get('x-m030-release-token'),env.M030_RELEASE_TOKEN))
   return reject('Unauthorized',401);
  if(request.headers.get('content-type')!=='application/json')
   return reject('Unsupported media type',415);
  const length=Number(request.headers.get('content-length')||0);
  if(length>8000000)return reject('Request too large',413);
  const data=await request.json();
  if(Object.keys(data).sort().join(',')!=='expectedSha256,nextPayload,nextSha256')return reject('Invalid data',400);
  for(const name of ['expectedSha256','nextSha256'])
   if(!/^[a-f0-9]{64}$/.test(data[name]))return reject('Invalid checksum',400);
  if(typeof data.nextPayload!=='string'||data.nextPayload.length>6000000)
   return reject('Invalid object',400);
  if(await sha(data.nextPayload)!==data.nextSha256)return reject('New body checksum mismatch',400);
  const old=await env.BUCKET.get(env.M030_TARGET_KEY);
  if(!old)return reject('Missing source object',404);
  const previousText=await old.text();
  if(await sha(previousText)!==data.expectedSha256)return reject('Source object changed',409);
  let source;
  let next;
  try{source=JSON.parse(previousText);next=JSON.parse(data.nextPayload)}
  catch{return reject('Invalid source or destination JSON',400)}
  if(!Number.isSafeInteger(source.version)||!Number.isSafeInteger(next.version)||
     next.version!==source.version+1)return reject('Revision mismatch',409);
  if(!source.drafts?.['101']||!next.drafts?.['101']||!next.published?.drafts?.['101'])
   return reject('Michaël 101 must be preserved',409);
  // Atomic CAS: rejects a concurrent editor save *at commit time*.
  const committed=await env.BUCKET.put(env.M030_TARGET_KEY,data.nextPayload,{
    httpMetadata:{contentType:'application/json'},
    onlyIf:{etagMatches:old.etag}
  });
  if(!committed)return reject('Another save changed the object',409);
  return Response.json({ok:true,version:next.version,digest:data.nextSha256},{headers:{'cache-control':'no-store'}});
 }catch{return reject('Migration operation failed',500)}
}};
