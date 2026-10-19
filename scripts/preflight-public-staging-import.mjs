// Fail-closed staging-only preflight for a one-time programme import.
// Read-only Cloudflare API; requires completely empty programme and isolated bindings.
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,db=process.env.STAGING_D1_ID,bucket=process.env.STAGING_R2_BUCKET;
if(!account||!token||!db||bucket!=='celebrations-exit-staging')throw Error('Missing or unsafe staging configuration');
const root='https://api.cloudflare.com/client/v4';
async function cf(path,init={}){
 const r=await fetch(root+path,{...init,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(init.headers||{})}});
 const j=await r.json();if(!r.ok||!j.success)throw Error('Cloudflare API failed: HTTP '+r.status);
 return j.result;
}
const database=await cf('/accounts/'+account+'/d1/database/'+db);
if(database.name!=='celebrations-exit-staging'||database.uuid!==db)throw Error('D1 identity mismatch');
const settings=await cf('/accounts/'+account+'/workers/scripts/celebrations-exit-staging/settings');
const bindings=settings.bindings||[];
for(const name of ['DB','MEDIA_ACL']){
 if(!bindings.some(b=>b.type==='d1'&&b.name===name&&(b.id||b.database_id)===db))throw Error('Worker binding mismatch '+name);
}
if(!bindings.some(b=>b.type==='r2_bucket'&&b.name==='MEDIA_BUCKET'&&b.bucket_name===bucket))throw Error('Worker R2 binding mismatch');
const tables=['celebrations_celebrations','celebrations_steps','celebrations_events','celebrations_contents','celebrations_event_contents','celebrations_step_contents','celebrations_links','celebrations_groups','celebrations_participants','celebrations_participant_sessions','celebrations_admin_sessions','celebrations_user_profiles','celebrations_clicks','celebrations_committee_letters','public_media','committee_media'];
const counts={};
for(const t of tables){
 const result=await cf('/accounts/'+account+'/d1/database/'+db+'/query',{method:'POST',body:JSON.stringify({sql:'SELECT COUNT(*) AS n FROM "'+t+'"',params:[]})});
 counts[t]=Number(result?.[0]?.results?.[0]?.n);
 if(!Number.isSafeInteger(counts[t])||counts[t]!==0)throw Error('STAGING_NOT_EMPTY: '+t+' has '+counts[t]+' rows; refusing import');
}
console.log('IMPORT_PREFLIGHT_PASS '+JSON.stringify({database:database.name,workerBindings:['DB','MEDIA_ACL','MEDIA_BUCKET'],emptyTables:tables.length}));
