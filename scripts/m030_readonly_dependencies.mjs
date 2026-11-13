// M030 dependency mapping before any deletion. Strictly SELECT/PRAGMA, no personal data.
import assert from 'node:assert/strict';
const ACC='60a7b17758a93fe6681ce998e72ddff0';
const DB='28736d2a-479b-472b-bf82-703ad0affe10';
assert.equal(process.env.M030_READONLY,'YES');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,ACC);
const call=async sql=>{
 if(!/^\s*(SELECT|PRAGMA)\b/i.test(sql))throw Error('READ ONLY SQL required');
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+ACC+'/d1/database/'+DB+'/query',{
  method:'POST',headers:{authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,
   'content-type':'application/json'},
  body:JSON.stringify({sql}),signal:AbortSignal.timeout(30000)});
 assert.equal(r.status,200,sql+' HTTP '+r.status);
 const data=await r.json();assert.equal(data.success,true,sql);
 return data.result?.[0]?.results||[];
};
const names=(await call("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'celebrations_%' ORDER BY name"))
 .map(x=>x.name).filter(x=>/^celebrations_[a-z_]+$/.test(x));
const sensitiveKeys=new Set(['person_id','member_id','participant_id','email','token','password','user_id','identity_id']);
const result=[];
for(const name of names){
 const info=await call('PRAGMA table_info("'+name+'")');
 const cols=info.map(x=>x.name).filter(x=>/^(celebration_id|celebrationId|target_celebration_id|source_celebration_id)$/.test(x));
 if(!cols.length)continue;
 const fks=await call('PRAGMA foreign_key_list("'+name+'")');
 const counts={};
 for(const col of cols){
  if(sensitiveKeys.has(col))throw Error('Sensitive column');
  const q='SELECT "'+col+'" as cid, count(*) as total FROM "'+name+'" GROUP BY "'+col+'"';
  counts[col]=(await call(q)).map(x=>({cid:x.cid===null?null:String(x.cid),count:x.total}))
   .filter(x=>x.cid!==null&&x.count>0);
 }
 result.push({table:name,counts,fks:fks.filter(x=>x.table==='celebrations_celebrations')
  .map(x=>({from:x.from,to:x.to,on_delete:x.on_delete}))});
}
console.log('M030_READONLY_FOREIGN_REFERENCES '+JSON.stringify({tablesInspected:names.length,
 refs:result.filter(x=>Object.values(x.counts).some(a=>a.length)),noDataPrinted:true}));
console.log('M030_DEPENDENCY_READONLY_PASS');
