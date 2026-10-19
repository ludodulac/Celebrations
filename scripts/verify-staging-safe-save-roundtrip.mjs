// Real, reversible Cloudflare D1 save test. Uses ONLY randomly named staging
// fixtures. Never touches existing celebration/media/participant rows or prod.
import assert from "node:assert/strict";
const origin="https://celebrations-exit-staging.rondes.workers.dev";
const bearer=process.env.STAGING_TEMP_ADMIN_BEARER;
const celebrationId=Number(process.env.STAGING_SYNTHETIC_CELEBRATION_ID);
const contentId=process.env.STAGING_SYNTHETIC_CONTENT_ID;
const eventId=process.env.STAGING_SYNTHETIC_EVENT_ID;
const dayKey=process.env.STAGING_SYNTHETIC_STEP_KEY;
assert.match(bearer||"",/^[0-9a-f]{64}$/);
assert.ok(Number.isSafeInteger(celebrationId)&&celebrationId>=8000000000000&&celebrationId<9000000000000);
for(const id of [contentId,eventId,dayKey])
 assert.match(id||"",/^migration-check-[0-9a-f-]{36}$/);
assert.equal(process.env.STAGING_R2_BUCKET,"celebrations-exit-staging");

async function call(path,body){
 const r=await fetch(origin+path,{
  method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+bearer},
  body:JSON.stringify(body),signal:AbortSignal.timeout(30000)
 });
 const data=await r.json();return {status:r.status,...data};
}
async function table(name){
 const r=await call("/api/admin",{action:"list",table:name});
 assert.equal(r.status,200,"D1 staging list failed for "+name);
 assert.ok(Array.isArray(r.items));
 return r.items;
}
const prior=await Promise.all([
 table("celebrations_celebrations"),table("celebrations_events"),table("celebrations_contents")
]);
assert.ok(!prior[0].some(x=>Number(x.id)===celebrationId));
assert.ok(!prior[1].some(x=>x.id===eventId));
assert.ok(!prior[2].some(x=>x.id===contentId));
const getPayload=(name,title)=>({
 action:"safe_merge",
 groups:[], // Never alter production or existing staging groups.
 celebrations:[{
  id:celebrationId,archangel:"Michaël",year:"3026",status:"planned",
  days:[{key:dayKey,label:"Étape temporaire",contentIds:[contentId],links:[]}]
 }],
 contents:[{
  id:contentId,name,type:"Texte",sourceType:"text",text:"Test isolé de migration.",
  audience:"angel",category:"Textes",description:"Entrée éphémère (non publique)"
 }],
 events:[{
  id:eventId,celebrationId,dayKey,title,
  audience:"angel",contentIds:[contentId],links:[]
 }]
});
async function check(name,title){
 const [cels,events,contents,relations,steps]=await Promise.all([
  table("celebrations_celebrations"),table("celebrations_events"),
  table("celebrations_contents"),table("celebrations_event_contents"),
  table("celebrations_steps")
 ]);
 assert.equal(cels.filter(x=>Number(x.id)===celebrationId).length,1);
 assert.equal(events.find(x=>x.id===eventId)?.title,title);
 assert.equal(contents.find(x=>x.id===contentId)?.name,name);
 assert.equal(steps.filter(x=>Number(x.celebration_id)===celebrationId).length,1);
 assert.equal(relations.filter(x=>x.event_id===eventId&&x.content_id===contentId).length,1);
 assert.equal(cels.length,prior[0].length+1);
 assert.equal(events.length,prior[1].length+1);
 assert.equal(contents.length,prior[2].length+1);
}
const first=await call("/api/safe-save",getPayload("Migration isolée","Événement temporaire"));
assert.equal(first.status,200,"New programme save failed "+JSON.stringify(first));
assert.equal(first.ok,true);
assert.ok(first.rows<=48);
await check("Migration isolée","Événement temporaire");
const second=await call("/api/safe-save",getPayload("Migration modifiée","Événement modifié"));
assert.equal(second.status,200,"Program edit failed "+JSON.stringify(second));
assert.equal(second.ok,true);
assert.ok(second.rows<=48);
await check("Migration modifiée","Événement modifié");
console.log("STAGING_SAFE_SAVE_ROUNDTRIP created=true modified=true atomic=true existing_records_untouched=true");
// The staging-only Python harness ALWAYS deletes these exact random IDs,
// including if this process crashes or throws before reaching this line.
