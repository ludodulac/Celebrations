// M19 — Cloudflare D1 metadata only. No SQL export on the live database.
// Cloudflare's D1 export endpoint can temporarily make the DB unavailable;
// this script never calls it. This is NOT a D1 backup.
const account=process.env.CLOUDFLARE_ACCOUNT_ID||'';
const token=process.env.CLOUDFLARE_API_TOKEN||'';
const database=process.env.PROD_D1_ID||'';
const expected='28736d2a-479b-472b-bf82-703ad0affe10';
if(!/^[a-f0-9]{32}$/i.test(account)||!token||database!==expected){
 console.error('M19_D1_METADATA_STOP category=MissingOrUnexpectedIdentity');
 process.exit(1);
}
const endpoint='https://api.cloudflare.com/client/v4/accounts/'+account+'/d1/database/'+database;
try{
 const response=await fetch(endpoint,{method:'GET',redirect:'error',cache:'no-store',
  headers:{Authorization:'Bearer '+token,Accept:'application/json'},
  signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('GET database refused');
 const data=await response.json();
 if(data.success!==true||!data.result||data.result.uuid!==expected)
  throw new Error('Unexpected database metadata');
 const info=data.result;
 console.log('M19_D1_METADATA_READONLY_PASS '+JSON.stringify({
  database_identity_verified:true,
  file_size_bytes:Number.isFinite(info.file_size)?info.file_size:null,
  num_tables:Number.isFinite(info.num_tables)?info.num_tables:null,
  database_readonly_get:true,
  full_dump_exists:false,
  production_export_attempted:false,
  d1_writes:0
 }));
}catch(e){
 console.error('M19_D1_METADATA_STOP category='+(e instanceof Error?'RemoteOrFormatError':'Unknown'));
 process.exitCode=1;
}
