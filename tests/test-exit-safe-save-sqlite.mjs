import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {readFile} from "node:fs/promises";
import {handleSafeSave} from "../migration/cloudflare/safe-save-api.mjs";
const schema=await readFile(new URL("../migration/cloudflare/celebrations-schema.sql",import.meta.url),"utf8");
const token="a".repeat(64);
function fixture(){
 const db=new DatabaseSync(":memory:");
 db.exec(schema);
 db.prepare("INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)")
   .run(createHash("sha256").update(token).digest("hex"),"admin@isolated.invalid","2999-01-01T00:00:00Z");
 const metrics={statements:0,batchCalls:0};
 const prepared=(sql,args=[])=>({
  sql,args,
  bind(...a){return prepared(sql,a)},
  async first(){return db.prepare(sql).get(...args)||null},
  async run(){return {meta:{changes:db.prepare(sql).run(...args).changes}}}
 });
 const env={DB:{
  prepare(sql){return prepared(sql)},
  async batch(items){
   metrics.batchCalls++;metrics.statements+=items.length;
   db.exec("BEGIN");
   try{
    for(const item of items)db.prepare(item.sql).run(...item.args);
    db.exec("COMMIT");
    return items.map(()=>({success:true}));
   }catch(e){db.exec("ROLLBACK");throw e}
  }
 }};
 const request=b=>new Request("https://staging.invalid/api/safe-save",{
  method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+token},
  body:JSON.stringify(b)
 });
 const save=async b=>{
  const r=await handleSafeSave(request(b),env);
  return {status:r.status,body:await r.json()};
 };
 return {db,env,save,metrics,close:()=>db.close()};
}
function snapshot(){
 return {
  action:"safe_merge",
  groups:[{id:"all",name:"Tout le monde"},{id:"angel",name:"Porteur"}],
  celebrations:[{id:100,archangel:"Michaël",year:"2026",status:"active",
   days:[{key:"day1",label:"Premier jour",startDate:"2026-10-19",endDate:"2026-10-19",
    contentIds:["doc1"],links:[{label:"Premier lien",url:"https://example.org/a"}]}]}],
  contents:[
   {id:"doc1",name:"Document",type:"PDF",sourceType:"file",audience:"all",storagePath:"media/doc1.pdf"},
   {id:"doc2",name:"Audio privé",type:"Audio",sourceType:"file",audience:"angel",storagePath:"media/doc2.mp3"}
  ],
  events:[{id:"event1",celebrationId:100,dayKey:"day1",title:"Cérémonie",
   time:"10:30",audience:"all",contentIds:["doc1","doc2"],
   links:[{label:"Détails",url:"https://example.org/event"}]}]
 };
}
function count(db,table){return db.prepare('SELECT count(*) AS n FROM "'+table+'"').get().n}

test("isolated SQLite roundtrip writes and updates programme and relations atomically",async()=>{
 const f=fixture();try{
  let s=snapshot();
  let x=await f.save(s);
  assert.equal(x.status,200,JSON.stringify(x));
  assert.equal(count(f.db,"celebrations_celebrations"),1);
  assert.equal(count(f.db,"celebrations_steps"),1);
  assert.equal(count(f.db,"celebrations_contents"),2);
  assert.equal(count(f.db,"celebrations_events"),1);
  assert.equal(count(f.db,"celebrations_step_contents"),1);
  assert.equal(count(f.db,"celebrations_event_contents"),2);
  assert.equal(count(f.db,"celebrations_links"),2);
  s.contents[0].name="Document modifié";
  s.events[0].title="Rendez-vous modifié";
  s.celebrations[0].days[0].links=[{label:"Lien mis à jour",url:"https://example.org/updated"}];
  x=await f.save(s);
  assert.equal(x.status,200,JSON.stringify(x));
  assert.equal(f.db.prepare("SELECT name FROM celebrations_contents WHERE id='doc1'").get().name,"Document modifié");
  assert.equal(f.db.prepare("SELECT title FROM celebrations_events WHERE id='event1'").get().title,"Rendez-vous modifié");
  assert.equal(count(f.db,"celebrations_links"),2,"Old link row must be replaced, not duplicated");
  assert.equal(f.db.prepare("SELECT url FROM celebrations_links WHERE event_id IS NULL").get().url,"https://example.org/updated");
  assert.equal(f.metrics.batchCalls,2);
 }finally{f.close()}
});

test("invalid foreign key rolls back an otherwise valid whole save",async()=>{
 const f=fixture();try{
  const s=snapshot();
  s.events[0].contentIds=["nonexistent"];
  const x=await f.save(s);
  assert.equal(x.status,409,JSON.stringify(x));
  assert.equal(count(f.db,"celebrations_contents"),0,"No partial content inserts");
  assert.equal(count(f.db,"celebrations_celebrations"),0,"No partial celebrations");
  assert.equal(count(f.db,"celebrations_links"),0,"No partial links");
 }finally{f.close()}
});

test("large canonical-shaped 211-content snapshot fits under Cloudflare free-tier limit",async()=>{
 const f=fixture();try{
  const s=snapshot();
  s.contents=Array.from({length:211},(_,i)=>({
   id:"content"+i,name:"Public document "+i,type:"PDF",audience:"all",
   sourceType:"file",storagePath:"media/document-"+i+".pdf"
  }));
  s.celebrations=Array.from({length:4},(_,i)=>({
   id:100+i,archangel:["Michaël","Gabriel","Raphaël","Ouriel"][i],
   year:"2026",status:i===0?"active":"planned",
   days:Array.from({length:7},(_,j)=>({
    key:"day"+j,label:"Étape "+j,startDate:"2026-10-19",endDate:"2026-10-19",
    contentIds:[],links:[]
   }))
  }));
  s.events=Array.from({length:62},(_,i)=>({
   id:"event"+i,celebrationId:100+i%4,dayKey:"day"+(i%7),
   title:"Rendez-vous "+i,audience:"all",contentIds:["content"+(i*2),"content"+(i*2+1)],links:[]
  }));
  const result=await f.save(s);
  assert.equal(result.status,200,JSON.stringify(result));
  assert.ok(result.body.rows<=48,"Free-tier D1 statement budget exceeded: "+result.body.rows);
  assert.equal(f.metrics.statements,result.body.rows);
  assert.equal(count(f.db,"celebrations_contents"),211);
  assert.equal(count(f.db,"celebrations_events"),62);
  assert.equal(count(f.db,"celebrations_event_contents"),124);
  assert.equal(count(f.db,"celebrations_steps"),28);
  console.log("STAGING_SAFE_SAVE_SQLITE_BUDGET "+JSON.stringify({contents:211,events:62,queries:result.body.rows}));
 }finally{f.close()}
});

test("editing programme leaves isolated participants and their password hashes untouched",async()=>{
 const f=fixture();try{
  f.db.prepare("INSERT INTO celebrations_participants(email,password_hash,audience) VALUES(?,?,?)")
   .run("kept@isolated.invalid","HASH-MUST-REMAIN","angel");
  const result=await f.save(snapshot());
  assert.equal(result.status,200);
  assert.equal(f.db.prepare("SELECT password_hash FROM celebrations_participants WHERE email=?")
   .get("kept@isolated.invalid").password_hash,"HASH-MUST-REMAIN");
 }finally{f.close()}
});

test("incomplete snapshots fail closed before any database mutation",async()=>{
 const f=fixture();try{
  const s=snapshot();
  delete s.events[0].links;
  const result=await f.save(s);
  assert.equal(result.status,409);
  assert.equal(count(f.db,"celebrations_celebrations"),0);
  assert.equal(f.metrics.batchCalls,0);
 }finally{f.close()}
});
