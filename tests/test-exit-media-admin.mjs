import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {readFile} from "node:fs/promises";
import {handleMediaAdmin} from "../migration/cloudflare/media-admin-api.mjs";
const schema=await readFile(new URL("../migration/cloudflare/celebrations-schema.sql",import.meta.url),"utf8");
const acl=await readFile(new URL("../migration/cloudflare/media-acl.sql",import.meta.url),"utf8");
const token="a".repeat(64);
function setup(){
 const db=new DatabaseSync(":memory:");db.exec(schema);db.exec(acl);
 db.prepare("INSERT INTO celebrations_admin_sessions(token_hash,admin_email,expires_at) VALUES(?,?,?)")
 .run(createHash("sha256").update(token).digest("hex"),"temp@invalid.example","2999-01-01T00:00:00Z");
 const files=new Map();
 const env={DB:{prepare(sql){return {bind(...values){return {async first(){return db.prepare(sql).get(...values)||null},async run(){return {meta:db.prepare(sql).run(...values)}}}}}}},MEDIA_BUCKET:{
  async head(key){const o=files.get(key);return o?{size:o.body.byteLength,httpMetadata:{contentType:o.mime}}:null},
  async put(key,buffer,options){assert.ok(!files.has(key));files.set(key,{body:new Uint8Array(buffer),mime:options.httpMetadata.contentType})},
  async delete(key){files.delete(key)}
 }};
 async function upload(key,mime,body,auth=true){
  const bytes=Buffer.from(body);
  const r=await handleMediaAdmin(new Request("https://staging.invalid/api/media-admin?action=upload&key="+key,{
   method:"POST",headers:{"content-type":mime,"content-length":String(bytes.length),
    ...(auth?{authorization:"Bearer "+token}:{})},body:bytes
  }),env);
  return {status:r.status,...await r.json()};
 }
 return {db,files,env,upload,close:()=>db.close()};
}
test("real D1-authorized uploads accept images PDF audio and documents, store bytes unchanged",async()=>{
 const f=setup();try{
  for(const [key,mime,body] of [
   ["media/x.jpg","image/jpeg",Buffer.from([0xff,0xd8,0xff,0xd9])],
   ["media/x.pdf","application/pdf",Buffer.from("%PDF-1.7\nsynthetic test")],
   ["media/x.mp3","audio/mpeg",Buffer.from("ID3synthetic")],
   ["media/x.docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document",Buffer.from("PK synthetic")],
   ["media/x.txt","text/plain",Buffer.from("Sample utf8 note")]
  ]){
   const r=await f.upload(key,mime,body);
   assert.equal(r.status,200,key+": "+JSON.stringify(r));
   assert.equal(r.size,body.length);
   assert.deepEqual(Buffer.from(f.files.get(key).body),body);
   assert.equal((await f.upload(key,mime,body)).status,409,"Overwrites must be rejected");
  }
 }finally{f.close()}
});
test("unauthenticated uploads, SVG, HTML, invalid PDF and oversized objects are rejected",async()=>{
 const f=setup();try{
  assert.equal((await f.upload("media/unauthorized.pdf","application/pdf","%PDF-x",false)).status,401);
  assert.equal((await f.upload("media/script.svg","image/svg+xml","<svg onload=alert(1)>")).status,400);
  assert.equal((await f.upload("media/script.html","text/html","<script></script>")).status,400);
  assert.equal((await f.upload("media/bad.pdf","application/pdf","invalid header")).status,400);
  assert.equal((await f.upload("committee/not-pdf.txt","text/plain","test")).status,400);
  assert.equal(f.files.size,0);
 }finally{f.close()}
});
test("R2 deletion refuses any referenced content until it has been unlinked",async()=>{
 const f=setup();try{
  const key="media/ephemeral.pdf";assert.equal((await f.upload(key,"application/pdf","%PDF-test")).status,200);
  f.db.prepare("INSERT INTO celebrations_contents(id,name,content_type,source_type,audience,storage_path) VALUES(?,?,?,?,?,?)")
   .run("temp","Temp","PDF","file","angel",key);
  async function remove(){
   const r=await handleMediaAdmin(new Request("https://staging.invalid/api/media-admin?action=delete&key="+key,{
    method:"POST",headers:{authorization:"Bearer "+token}
   }),f.env);
   return {status:r.status,...await r.json()}
  }
  assert.equal((await remove()).status,409);
  f.db.prepare("DELETE FROM celebrations_contents WHERE id='temp'").run();
  assert.equal((await remove()).status,200);
  assert.equal(f.files.has(key),false);
 }finally{f.close()}
});
