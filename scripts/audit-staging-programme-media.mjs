// Read-only live staging audit: programme references -> public D1 -> R2 HTTP gateway.
// No credentials, writes, ACL mutations or deletions. Node 22+.
import {writeFileSync,mkdirSync} from 'node:fs';
const base=(process.env.CELEBRATIONS_STAGING_URL||'https://celebrations-exit-staging.rondes.workers.dev').replace(/\/$/,'');
const timeout=Number(process.env.AUDIT_TIMEOUT_MS||12000);
async function get(url,method='GET'){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
 try{return await fetch(url,{method,redirect:'manual',signal:controller.signal,headers:{'cache-control':'no-cache'}})}
 finally{clearTimeout(timer)}
}
const tables=['celebrations_celebrations','celebrations_steps','celebrations_events','celebrations_contents','celebrations_event_contents','celebrations_step_contents'];
const data={};const issues=[];
for(const table of tables){
 try{const r=await get(base+'/api/public-data?table='+encodeURIComponent(table));
  if(!r.ok)throw Error('HTTP '+r.status);
  const rows=await r.json();if(!Array.isArray(rows))throw Error('Not an array');
  data[table]=rows;
 }catch(e){issues.push({stage:'public-data',table,error:String(e.message)});data[table]=[]}
}
// Empty staging tables are not proof that media migration succeeded.
if(!issues.length&&(!data.celebrations_celebrations.length||!data.celebrations_contents.length||!data.celebrations_events.length||!data.celebrations_event_contents.length)){
 issues.push({stage:'inventory',error:'Staging public API returned an empty/incomplete programme; cannot certify R2 access'});
}
const byId=(rows)=>new Map(rows.map(r=>[String(r.id),r]));
const cels=byId(data.celebrations_celebrations),events=byId(data.celebrations_events),contents=byId(data.celebrations_contents);
const eventIds=new Set(),linkedIds=new Set(),refs=[];
for(const e of events.values())if(cels.has(String(e.celebration_id)))eventIds.add(String(e.id));
for(const r of data.celebrations_event_contents){
 if(eventIds.has(String(r.event_id)))linkedIds.add(String(r.content_id));
 else issues.push({stage:'relation',kind:'event',id:String(r.event_id)});
}
for(const r of data.celebrations_step_contents){
 if(cels.has(String(r.celebration_id)))linkedIds.add(String(r.content_id));
 else issues.push({stage:'relation',kind:'step',id:String(r.celebration_id)});
}
const keys=new Map();
for(const id of linkedIds){
 const c=contents.get(id);
 if(!c){issues.push({stage:'content',id,error:'Missing visible content'});continue}
 for(const field of ['storage_path','cover_storage_path']){
  const key=c[field];if(!key||/^(https?:\/\/|data:)/i.test(key))continue;
  if(!keys.has(key))keys.set(key,{key,contentIds:[],fields:[],audiences:[]});
  const entry=keys.get(key);entry.contentIds.push(id);entry.fields.push(field);entry.audiences.push(c.audience||'all');
 }
}
const checks=[...keys.values()];let cursor=0;
const publicChecks=checks.filter(c=>c.audiences.includes('all'));
const restrictedChecks=checks.filter(c=>!c.audiences.includes('all'));
console.log('AUDIT_AUDIENCE_SCOPE '+JSON.stringify({publicPaths:publicChecks.length,restrictedPaths:restrictedChecks.length}));
async function worker(){
 while(cursor<publicChecks.length){
  const entry=publicChecks[cursor++];
  try{
   const url=base+'/media/'+entry.key.split('/').map(encodeURIComponent).join('/');
   const r=await get(url,'HEAD');
   entry.status=r.status;entry.mime=r.headers.get('content-type');
   entry.result=r.status===200||r.status===206?'ACCESSIBLE':r.status===404?'NOT_FOUND_OR_NOT_AUTHORIZED':'HTTP_'+r.status;
  }catch(e){entry.result='NETWORK_ERROR';entry.error=String(e.message)}
 }
}
await Promise.all(Array.from({length:Math.min(6,publicChecks.length)},worker));
const counts={};for(const e of publicChecks)counts[e.result]=(counts[e.result]||0)+1;
const report={generatedAt:new Date().toISOString(),endpoint:base,readOnly:true,tables:Object.fromEntries(tables.map(t=>[t,data[t].length])),celebrations:cels.size,visibleProgrammeContents:linkedIds.size,distinctMediaPaths:checks.length,publicMediaPaths:publicChecks.length,restrictedMediaPaths:restrictedChecks.length,results:counts,issues,checks};
mkdirSync('audit-output',{recursive:true});
writeFileSync('audit-output/staging-programme-media.json',JSON.stringify(report,null,2));
console.log('AUDIT_SUMMARY '+JSON.stringify({tables:report.tables,linked:linkedIds.size,paths:checks.length,publicPaths:publicChecks.length,restrictedPaths:restrictedChecks.length,results:counts,issues:issues.length}));
if(issues.some(x=>x.stage==='public-data'||x.stage==='inventory')){console.error('BLOCKED: staging public-data API unavailable; no real R2 inventory can be certified');process.exitCode=2}
else if(publicChecks.some(x=>x.result!=='ACCESSIBLE')){console.error('BLOCKED: some referenced media not accessible; report distinguishes HTTP from missing/ACL ambiguity');process.exitCode=1}
