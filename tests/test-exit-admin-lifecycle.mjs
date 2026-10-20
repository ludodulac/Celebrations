// CÉLÉBRATIONS - Full administration acceptance, fully offline SQLite + R2 mock.
// No Cloudflare API, worker endpoint, Supabase, production or network access.
import {test} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import worker from "../migration/cloudflare/staging-worker.mjs";
const schema=await readFile(new URL("../migration/cloudflare/celebrations-schema.sql",import.meta.url),"utf8");
const acl=await readFile(new URL("../migration/cloudflare/media-acl.sql",import.meta.url),"utf8");
const token="b".repeat(64);
function fixture(){
 const db=new DatabaseSync(":memory:");
 db.exec(schema);db.exec(acl);
 db.prepare("INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES (?,?,?)")
  .run(createHash("sha256").update(token).digest("hex"),"admin@isolated.invalid","2999-01-01T00:00:00Z");
 const methods={reads:0,writes:0,statements:0};
 function prepare(sql,args=[]){
  return {
   sql,args,
   bind(...v){return prepare(sql,v)},
   async first(){methods.reads++;return db.prepare(sql).get(...args)||null},
   async all(){methods.reads++;return {results:db.prepare(sql).all(...args)}},
   async run(){methods.writes++;const res=db.prepare(sql).run(...args);return {meta:{changes:Number(res.changes)}}}
  };
 }
 const database={
  prepare,
  async batch(statements){
   methods.writes+=statements.length;
   methods.statements+=statements.length;
   db.exec("BEGIN");
   try{for(const item of statements)db.prepare(item.sql).run(...item.args);db.exec("COMMIT")}
   catch(err){db.exec("ROLLBACK");throw err}
  }
 };
 const objects=new Map();
 const MEDIA_BUCKET={
  async head(key){const r=objects.get(key);return r?{size:r.bytes.length,httpMetadata:{contentType:r.type}}:null},
  async put(key,data,opts){if(objects.has(key))throw Error("Overwrite refused");objects.set(key,{bytes:Buffer.from(data),type:opts?.httpMetadata?.contentType})},
  async delete(key){objects.delete(key)},
  async get(key){const r=objects.get(key);if(!r)return null;return {body:r.bytes,size:r.bytes.length,httpEtag:'"synthetic"',writeHttpMetadata(headers){headers.set("content-type",r.type)}}}
 };
 const env={DB:database,MEDIA_ACL:database,MEDIA_BUCKET};
 const call=async(path,body={},auth=true)=>{
  const r=await worker.fetch(new Request("https://isolated.invalid"+path,{
   method:"POST",headers:{"content-type":"application/json",...(auth?{authorization:"Bearer "+token}:{})},
   body:JSON.stringify(body)
  }),env);
  return {status:r.status,body:await r.json()};
 };
 async function upload(key,mime,data,auth=true){
  const bytes=Buffer.from(data);
  const r=await worker.fetch(new Request("https://isolated.invalid/api/media-admin?action=upload&key="+encodeURIComponent(key),{
   method:"POST",headers:{"content-type":mime,"content-length":String(bytes.length),...(auth?{authorization:"Bearer "+token}:{})},
   body:bytes
  }),env);
  return {status:r.status,body:await r.json()};
 }
 const query=(sql,...args)=>db.prepare(sql).all(...args);
 return {db,env,objects,methods,call,upload,query,close:()=>db.close()};
}
test("admin can add/edit/list linked events, content, media and links, then remove only chosen data",async()=>{
 const f=fixture();try{
  const snap={
   action:"safe_merge",
   groups:[{id:"all",name:"Public"}],
   celebrations:[{id:50,archangel:"Gabriel",year:"2026",status:"active",
    days:[{key:"opening",label:"Ouverture",startDate:"2026-10-20",endDate:"2026-10-20",
     text:"Texte jour",contentIds:["content-alpha"],links:[{label:"Site",url:"https://example.org/a"}]}]}],
   events:[{id:"event-uuid-alpha",celebrationId:50,dayKey:"opening",
    title:"Rencontre",time:"10:00",description:"Description",audience:"all",
    contentIds:["content-alpha"],links:[{label:"Info",url:"https://example.org/info"}]}],
   contents:[{id:"content-alpha",name:"Document",type:"PDF",sourceType:"file",
    audience:"all",storagePath:"media/local-guide.pdf",fileName:"guide.pdf"}]
  };
  assert.equal((await f.call("/api/safe-save",snap,false)).status,401);
  const before=await f.call("/api/safe-save",{...snap,action:"safe_merge_preview"});
  assert.equal(before.status,200);assert.equal(before.body.dry_run,true);
  assert.equal(f.methods.writes,0);
  assert.equal((await f.call("/api/safe-save",snap)).status,200);
  assert.equal(f.query("SELECT * FROM celebrations_celebrations").length,1);
  assert.equal(f.query("SELECT * FROM celebrations_events").length,1);
  assert.equal(f.query("SELECT * FROM celebrations_contents").length,1);
  assert.equal(f.query("SELECT * FROM celebrations_links").length,2);
  assert.equal(f.query("SELECT * FROM celebrations_event_contents").length,1);
  assert.equal(f.query("SELECT * FROM celebrations_step_contents").length,1);
  assert.equal((await f.call("/api/admin",{action:"list",table:"celebrations_events"})).body.items[0].id,"event-uuid-alpha");
  snap.events[0].time="11:30";snap.events[0].title="Rencontre modifiée";
  snap.celebrations[0].days[0].startDate="2026-10-21";
  snap.celebrations[0].days[0].links=[];
  snap.events[0].links=[];
  snap.events[0].contentIds=[];
  snap.celebrations[0].days[0].contentIds=[];
  assert.equal((await f.call("/api/safe-save",snap)).status,200);
  assert.equal(f.query("SELECT title,event_time FROM celebrations_events")[0].title,"Rencontre modifiée");
  assert.equal(f.query("SELECT start_date FROM celebrations_steps")[0].start_date,"2026-10-21");
  assert.equal(f.query("SELECT * FROM celebrations_event_contents").length,0);
  assert.equal(f.query("SELECT * FROM celebrations_step_contents").length,0);
  assert.equal(f.query("SELECT * FROM celebrations_links").length,0);
  assert.equal(f.query("SELECT * FROM celebrations_contents").length,1,"Unlink must retain library document");
  assert.equal((await f.call("/api/safe-save",{action:"delete_event",event_id:"event-uuid-alpha"})).status,200);
  assert.equal(f.query("SELECT * FROM celebrations_events").length,0);
  assert.equal((await f.call("/api/safe-save",{action:"delete_content",content_id:"content-alpha"})).status,200);
  assert.equal(f.query("SELECT * FROM celebrations_contents").length,0);
  assert.equal(f.query("SELECT * FROM celebrations_celebrations").length,1,"Deleting content must never delete a celebration");
 }finally{f.close()}
});
test("admin-only and private lifecycle: generic participant/committee modifications prohibited",async()=>{
 const f=fixture();try{
  for(const table of ["celebrations_participants","celebrations_committee_letters"]){
   for(const action of ["create","update","delete"]){
    const r=await f.call("/api/admin",{action,table,data:{email:"someone@invalid.example"},key:{email:"someone@invalid.example"}});
    assert.equal(r.status,403,table+" "+action+" must use specialized safe endpoint");
   }
  }
  assert.equal((await f.call("/api/admin",{action:"list",table:"celebrations_participants"},false)).status,401);
  assert.equal((await f.call("/api/admin",{action:"create",table:"not_allowed",data:{id:"danger"}})).status,403);
  assert.equal((await f.call("/api/admin",{action:"create",table:"celebrations_contents",data:{id:"ok",name:"ok",content_type:"PDF",password_hash:"should-never-be-allowed"}})).status,400);
  const signup=await f.call("/api/participants-admin",{action:"admin_add_participant",email:"one@invalid.example"});
  assert.equal(signup.status,200);
  const listing=await f.call("/api/participants-admin",{action:"admin_list_participants"});
  assert.equal(listing.status,200);
  assert.equal(listing.body.participants.length,1);
  assert.ok(listing.body.participants.every(x=>Object.keys(x).every(k=>["email","registered_at"].includes(k))));
  const assign=await f.call("/api/participants-admin",{action:"admin_set",email:"one@invalid.example",audience:"angel"});
  assert.equal(assign.status,200);
  const listed=await f.call("/api/admin",{action:"list",table:"celebrations_participants"});
  assert.deepEqual(listed.body.items,[{email:"one@invalid.example",audience:"angel"}]);
  assert.equal((await f.call("/api/participants-admin",{action:"admin_remove_participant",email:"one@invalid.example"})).status,200);
  assert.equal(f.query("SELECT * FROM celebrations_participants").length,0);
 }finally{f.close()}
});
test("private legal draft can be saved but never published while placeholders remain",async()=>{
 const f=fixture();try{
  const publish=await f.call("/api/footer-admin",{action:"admin_publish_footer",
   slug:"cookies",draft_number:1,title:"Cookies",content:"\n[Compléter la politique de cookies.]\n"});
  assert.equal(publish.status,200);
  const drafts=await f.call("/api/footer-admin",{action:"admin_footer_drafts"});
  assert.equal(drafts.body.drafts.length,1);
  assert.equal((await f.call("/api/footer-admin",{action:"admin_set_footer_public",slug:"cookies",is_public:true})).status,409);
  const page=await worker.fetch(new Request("https://isolated.invalid/api/public-data?table=celebrations_footer_page&slug=cookies"),f.env);
  assert.deepEqual(await page.json(),[]);
  assert.equal((await f.call("/api/footer-admin",{action:"admin_set_footer_public",slug:"cookies",is_public:true},false)).status,401);
 }finally{f.close()}
});
test("admin can upload and revoke committee PDF without exposing raw R2 path",async()=>{
 const f=fixture();try{
  const key="committee/only-synthetic-doc.pdf",slug="private-synthetic-sharing";
  assert.equal((await f.upload(key,"application/pdf",Buffer.from("%PDF-local synthetic"))).status,200);
  const done=await worker.fetch(new Request("https://isolated.invalid/api/media-admin?action=committee-finish&id=doc1&slug="+slug+"&key="+encodeURIComponent(key)+"&name=synthetic.pdf",{
   method:"POST",headers:{authorization:"Bearer "+token}
  }),f.env);
  assert.equal(done.status,200,await done.text());
  const list=await f.call("/api/admin",{action:"list",table:"celebrations_committee_letters"});
  assert.equal(list.body.items.length,1);
  const direct=await worker.fetch(new Request("https://isolated.invalid/media/"+key),f.env);
  assert.equal(direct.status,404,"Committee private PDF cannot be enumerated by R2 path");
  const link=await worker.fetch(new Request("https://isolated.invalid/letter/"+slug),f.env);
  assert.equal(link.status,200,"Committee slug should serve authorized private PDF");
  const revoked=await worker.fetch(new Request("https://isolated.invalid/api/media-admin?action=revoke-committee&slug="+slug,{
   method:"POST",headers:{authorization:"Bearer "+token}
  }),f.env);
  assert.equal(revoked.status,200);
  const after=await worker.fetch(new Request("https://isolated.invalid/letter/"+slug),f.env);
  assert.equal(after.status,404,"Revoked committee sharing URL must stop working");
  assert.ok(f.objects.has(key),"Revocation must never delete historical committee PDF bytes");
 }finally{f.close()}
});
