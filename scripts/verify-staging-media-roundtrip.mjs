// Real Cloudflare staging media exercise: 4 authentic uploads, private
// previews, metadata updates and exact-id deletion. Strictly synthetic IDs.
// The Python harness guarantees a second cleanup pass if this test throws.
import assert from "node:assert/strict";
const origin="https://celebrations-exit-staging.rondes.workers.dev";
assert.equal(process.env.STAGING_R2_BUCKET,"celebrations-exit-staging");
const token=process.env.STAGING_TEMP_ADMIN_BEARER||"";
assert.match(token,/^[a-f0-9]{64}$/);
const prefix=process.env.STAGING_SYNTHETIC_CONTENT_ID||"";
assert.match(prefix,/^migration-check-[0-9a-f-]{36}$/);
const formats=[
 ["pdf","application/pdf",Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n"),"PDF"],
 ["image","image/png",Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y/kLFYAAAAASUVORK5CYII=","base64"),"Image"],
 ["audio","audio/wav",makeWav(),"Audio"],
 ["texte","text/plain",Buffer.from("Texte de test isolé UTF-8\n"),"Texte"]
];
function makeWav(){
 const length=8000,bytes=Buffer.alloc(44+length);
 bytes.write("RIFF",0);bytes.writeUInt32LE(36+length,4);
 bytes.write("WAVEfmt ",8);bytes.writeUInt32LE(16,16);
 bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);
 bytes.writeUInt32LE(8000,24);bytes.writeUInt32LE(8000,28);
 bytes.writeUInt16LE(1,32);bytes.writeUInt16LE(8,34);
 bytes.write("data",36);bytes.writeUInt32LE(length,40);bytes.fill(128,44);
 return bytes;
}
async function admin(action,table,fields={}){
 const r=await fetch(origin+"/api/admin",{method:"POST",headers:{
  "content-type":"application/json",authorization:"Bearer "+token},
  body:JSON.stringify({action,table,...fields}),signal:AbortSignal.timeout(25000)});
 const data=await r.json();return {status:r.status,...data};
}
async function media(action,key,data=null,mime=""){
 const r=await fetch(origin+"/api/media-admin?action="+action+"&key="+encodeURIComponent(key),{
  method:"POST",headers:{authorization:"Bearer "+token,
   ...(data?{"content-type":mime}:{} )},
  ...(data?{body:data}:{}),signal:AbortSignal.timeout(30000)});
 return {status:r.status,...await r.json()};
}
async function get(key,auth=false){
 return fetch(origin+"/media/"+encodeURIComponent(key).replaceAll("%2F","/"),
 {headers:auth?{authorization:"Bearer "+token}:{},signal:AbortSignal.timeout(30000)});
}
const created=[],uploaded=[];
try{
 for(const [suffix,mime,bytes,type] of formats){
  const id=prefix+"-"+suffix,key="media/"+id;
  const before=await get(key,true);
  assert.equal(before.status,404,"Unknown R2 key unexpectedly accessible");
  const put=await media("upload",key,bytes,mime);
  assert.equal(put.status,200,"Cloudflare upload failed "+suffix+": "+JSON.stringify(put));
  uploaded.push(key);
  assert.equal(put.size,bytes.length);
  assert.equal((await get(key,true)).status,404,"Unlinked uploaded file must not be accessible");
  const add=await admin("create","celebrations_contents",{
   data:{id,name:"Test temporaire "+suffix,content_type:type,source_type:"file",
    audience:"angel",storage_path:key,mime_type:mime,file_name:"test."+suffix}
  });
  assert.equal(add.status,200,"D1 media content creation failed: "+JSON.stringify(add));
  created.push(id);
  const denied=await get(key);
  assert.equal(denied.status,404,"Private media leaked to anonymous visitor");
  const permitted=await get(key,true);
  assert.equal(permitted.status,200,"Admin cannot preview protected R2 media: "+suffix);
  assert.deepEqual(Buffer.from(await permitted.arrayBuffer()),bytes,"R2 bytes differ from upload");
  const edit=await admin("update","celebrations_contents",{key:{id},data:{name:"Modification vérifiée "+suffix}});
  assert.equal(edit.status,200,"Content modification failed");
 }
 const rows=(await admin("list","celebrations_contents")).items||[];
 for(const [suffix] of formats){
  const item=rows.find(x=>x.id===prefix+"-"+suffix);
  assert.equal(item?.name,"Modification vérifiée "+suffix);
 }
 const link=await admin("create","celebrations_contents",{
  data:{id:prefix+"-video",name:"Vidéo de test",content_type:"Vidéo",
   source_type:"url",audience:"angel",external_url:"https://example.org/video-test"}
 });
 assert.equal(link.status,200);created.push(prefix+"-video");
 const note=await admin("create","celebrations_contents",{
  data:{id:prefix+"-note",name:"Texte direct",content_type:"Texte",
   source_type:"text",audience:"angel",inline_text:"Contenu modifiable"}
 });
 assert.equal(note.status,200);created.push(prefix+"-note");
 console.log("STAGING_MEDIA_UPLOAD_ROUNDTRIP uploaded=4 private_preview=4 bytes_verified=4 metadata_updates=4 video_link=1 inline_text=1");
}finally{
 let failures=0;
 for(const id of created.reverse()){
  const deleted=await admin("delete","celebrations_contents",{key:{id}});
  if(deleted.status!==200)failures++;
 }
 for(const key of uploaded.reverse()){
  const deleted=await media("delete",key);
  if(deleted.status!==200)failures++;
  const after=await get(key,true);
  if(after.status!==404)failures++;
 }
 console.log("STAGING_MEDIA_ROUNDTRIP_CLEANUP files="+uploaded.length+" rows="+created.length+" failures="+failures);
 assert.equal(failures,0,"Synthetic media cleanup incomplete");
}
