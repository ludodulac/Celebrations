// Read-only Cloudflare D1 diagnostic. Requires staging-scoped token, prints counts only.
const account=process.env.CLOUDFLARE_ACCOUNT_ID,token=process.env.CLOUDFLARE_API_TOKEN,db=process.env.STAGING_D1_ID;
if(!account||!token||!db)throw Error('Missing staging configuration');
const root='https://api.cloudflare.com/client/v4';
async function cf(path,init={}){
 const r=await fetch(root+path,{...init,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(init.headers||{})}});
 const j=await r.json();if(!r.ok||!j.success)throw Error('Cloudflare HTTP '+r.status+' at '+path);
 return j.result;
}
const database=await cf('/accounts/'+account+'/d1/database/'+db);
if(database.name!=='celebrations-exit-staging'||database.uuid!==db)throw Error('Unexpected D1 target');
const settings=await cf('/accounts/'+account+'/workers/scripts/celebrations-exit-staging/settings');
const bindings=settings.bindings||[];
const dbBindings=bindings.filter(x=>x.type==='d1').map(x=>({name:x.name,id:x.id||x.database_id}));
const matched=dbBindings.filter(x=>x.id===db).map(x=>x.name).sort();
if(JSON.stringify(matched)!==JSON.stringify(['DB','MEDIA_ACL']))throw Error('Worker D1 bindings mismatch: '+JSON.stringify(dbBindings.map(x=>x.name)));
const tables=['celebrations_celebrations','celebrations_steps','celebrations_events','celebrations_contents','celebrations_event_contents','celebrations_step_contents','public_media'];
const counts={};
for(const table of tables){
 const r=await cf('/accounts/'+account+'/d1/database/'+db+'/query',{method:'POST',body:JSON.stringify({sql:'SELECT COUNT(*) AS n FROM "'+table+'"',params:[]})});
 counts[table]=r?.[0]?.results?.[0]?.n??null;
}
console.log('D1_DIAGNOSTIC '+JSON.stringify({database:database.name,bindings:matched,counts}));
if(counts.celebrations_celebrations===0||counts.celebrations_contents===0)throw Error('STAGING_D1_EMPTY: database has no programme; an import is required before HTTP media audit');
if(publicCounts.celebrations_celebrations!==counts.celebrations_celebrations)throw Error('D1_API_MISMATCH: celebrations count differs');
if(publicCounts.celebrations_steps!==counts.celebrations_steps)throw Error('D1_API_MISMATCH: steps count differs');
