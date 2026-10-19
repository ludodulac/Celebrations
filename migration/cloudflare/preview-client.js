// Only loaded by explicitly isolated preview pages, never by production.
(function(){
 const endpoint=window.CELEBRATIONS_STAGING_BACKEND;
 if(!endpoint)return;
 const base=String(endpoint).replace(/\/$/,"");
 const adminToken=()=>localStorage.getItem("celebrations-admin-token")||"";
 const post=async(path,body,admin=false)=>{
  try{
   const headers={"content-type":"application/json"};
   if(admin)headers.authorization="Bearer "+adminToken();
   const response=await fetch(base+path,{method:"POST",headers,body:JSON.stringify(body),credentials:"omit"});
   const data=await response.json();
   // Preserve the backend error body even when the HTTP status is non-2xx.
   return {data,error:null};
  }catch{return {data:{ok:false,error:"Connexion au serveur de test indisponible."},error:null}}
 };
 // Original Supabase passwords use 180,000 PBKDF2 iterations, exceeding
 // Cloudflare Workers Free's 100,000-iteration limit. The browser performs
 // the full original derivation and transmits only a derived proof over TLS.
 // The Worker stores an additional SHA-256 verifier, not this replayable proof.
 const hexProof=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("");
 const saltHex=()=>hexProof(crypto.getRandomValues(new Uint8Array(32)));
 const normalizeAnswer=v=>String(v||"").trim().toLocaleLowerCase("fr-FR").normalize("NFKC");
 const deriveProof=async(value,salt)=>{
  const enc=new TextEncoder();
  const key=await crypto.subtle.importKey("raw",enc.encode(String(value)),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({
   name:"PBKDF2",hash:"SHA-256",salt:enc.encode(String(salt)),iterations:180000
  },key,256);
  return hexProof(bits);
 };
 const invoke=async(name,{body={}}={})=>{
  if(name==="celebrations-access"){
   if(body.action==="admin_login"){
    const salt=await post("/api/auth",{action:"admin_salt"});
    if(!salt.data?.ok)return salt;
    const password_proof=await deriveProof(body.password,salt.data.salt);
    return post("/api/auth",{action:"admin_login_derived",email:body.email,password_proof});
   }
   if(body.action==="participant_login"){
    const begin=await post("/api/auth",{action:"participant_begin",email:body.email});
    if(!begin.data?.ok)return begin;
    const password_proof=await deriveProof(body.password,begin.data.salt);
    return post("/api/auth",{action:"participant_login_derived",email:body.email,password_proof});
   }
   if(body.action==="participant_register"){
    if(String(body.password||"").length<8)return {data:{ok:false,error:"Mot de passe trop court."},error:null};
    const password_salt=saltHex(),answer_1_salt=saltHex(),answer_2_salt=saltHex();
    const [password_proof,answer_1_proof,answer_2_proof]=await Promise.all([
     deriveProof(body.password,password_salt),
     deriveProof(normalizeAnswer(body.answer_1),answer_1_salt),
     deriveProof(normalizeAnswer(body.answer_2),answer_2_salt)
    ]);
    return post("/api/auth",{action:"participant_register_derived",
     email:body.email,question_1:body.question_1,question_2:body.question_2,
     password_salt,password_proof,answer_1_salt,answer_1_proof,answer_2_salt,answer_2_proof});
   }
   if(body.action==="recover_password"){
    const questions=await post("/api/auth",{action:"recovery_questions",email:body.email});
    if(!questions.data?.ok)return questions;
    const password_salt=saltHex();
    const [password_proof,answer_1_proof,answer_2_proof]=await Promise.all([
     deriveProof(body.new_password,password_salt),
     deriveProof(normalizeAnswer(body.answer_1),questions.data.answer_1_salt),
     deriveProof(normalizeAnswer(body.answer_2),questions.data.answer_2_salt)
    ]);
    return post("/api/auth",{action:"recover_password_derived",email:body.email,
     password_salt,password_proof,answer_1_proof,answer_2_proof});
   }
   if(["admin_footer_drafts","admin_publish_footer","admin_set_footer_public"].includes(body.action))
    return post("/api/footer-admin",body,true);
   if(["admin_list_participants","admin_add_participant","admin_remove_participant"].includes(body.action))
    return post("/api/participants-admin",body,true);
   return post("/api/auth",body);
  }
  if(name==="celebrations-audience"){
   if(["admin_list","admin_set"].includes(body.action))
    return post("/api/participants-admin",body,true);
   return post("/api/audience",body);
  }
  if(name==="celebrations-admin-safe-save")return post("/api/safe-save",body,true);
  if(name==="celebrations-visibility"&&body.action==="get"){
   try{
    const response=await fetch(base+"/api/public-data?table=celebrations_public_settings",{credentials:"omit"});
    if(!response.ok)return {data:{ok:false,error:"Réglage indisponible."},error:null};
    const rows=await response.json();
    if(!Array.isArray(rows))return {data:{ok:false,error:"Réponse de réglage invalide."},error:null};
    return {data:{ok:true,show_other_celebrations:Number(rows[0]?.show_other_celebrations)===1},error:null};
   }catch{return {data:{ok:false,error:"Connexion au réglage indisponible."},error:null}}
  }
  if(name==="celebrations-admin-data"){
   if(body.action==="committee_list")return post("/api/admin",{action:"list",table:"celebrations_committee_letters"},true).then(r=>({data:{...r.data,items:r.data.items||[]},error:r.error}));
   return {data:{ok:false,error:"Operation not yet supported by staging"},error:null};
  }
  return {data:{ok:false,error:"Staging operation not implemented"},error:null};
 };
 window.celebrationsSupabase={functions:{invoke},storage:{from(){return {uploadToSignedUrl:async()=>({error:new Error("Use R2 staging uploader")})}}}};
 const hex=a=>[...a].map(x=>x.toString(16).padStart(2,"0")).join("");
 const random=()=>hex(crypto.getRandomValues(new Uint8Array(16)));
 window.celebrationsStagingUpload=async file=>{
  if(!file||!file.size||file.size>20*1024*1024)throw new Error("Fichier invalide ou trop volumineux");
  const key="media/"+random();
  const type=file.type||"application/octet-stream";
  const response=await fetch(base+"/api/media-admin?action=upload&key="+encodeURIComponent(key),{method:"POST",headers:{authorization:"Bearer "+adminToken(),"content-type":type},body:file});
  const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||"Upload impossible");
  return key;
 };
 // Explicit one-record D1 deletion. Returns an error without changing browser
 // state on any failed authorization, relation or DB operation.
 window.celebrationsDeleteStagingRecord=async(action,id)=>{
  if(!["delete_content","delete_event"].includes(action))return {ok:false,error:"Action invalide."};
  const body={action};
  body[action==="delete_event"?"event_id":"content_id"]=String(id);
  const result=await post("/api/safe-save",body,true);
  return result.data||{ok:false,error:"Suppression indisponible."};
 };
 window.celebrationsStagingDelete=async key=>{
  const result=await post("/api/media-admin?action=delete&key="+encodeURIComponent(key),{},true);
  if(!result.data?.ok)throw new Error(result.data?.error||"Suppression impossible");
  return result.data;
 };
 window.celebrationsStagingCommitteeUpload=async file=>{
  if(file.size<=0||file.size>20*1024*1024||!file.name.toLowerCase().endsWith(".pdf"))throw new Error("PDF invalide ou trop volumineux");
  const id=random(),slug=random(),key="committee/"+random()+".pdf";
  const r=await fetch(base+"/api/media-admin?action=upload&key="+encodeURIComponent(key),{method:"POST",headers:{authorization:"Bearer "+adminToken(),"content-type":"application/pdf"},body:file.slice(0,file.size,"application/pdf")});
  const uploaded=await r.json();if(!r.ok||!uploaded.ok)throw new Error(uploaded.error||"Upload R2 impossible");
  const finish=await post("/api/media-admin?action=committee-finish&id="+encodeURIComponent(id)+"&slug="+encodeURIComponent(slug)+"&key="+encodeURIComponent(key)+"&name="+encodeURIComponent(file.name),{},true);
  if(!finish.data?.ok)throw new Error(finish.data?.error||"Publication impossible");
  return finish.data;
 };
 window.celebrationsStagingCommitteeRevoke=async id=>{
  const rows=await post("/api/admin",{action:"list",table:"celebrations_committee_letters"},true);
  const row=rows.data?.items?.find(x=>String(x.id)===String(id));
  if(!row?.slug)throw new Error("Document introuvable");
  const result=await post("/api/media-admin?action=revoke-committee&slug="+encodeURIComponent(row.slug),{},true);
  if(!result.data?.ok)throw new Error(result.data?.error||"Révocation impossible");
  return result.data;
 };
 window.celebrationsStagingData=async table=>{
  // Admin must read the full D1 dataset, including restricted programme content.
  // Public visitors use the audience-filtered endpoint, never admin credentials.
  const adminTables=new Set([
   "celebrations_celebrations","celebrations_steps","celebrations_events",
   "celebrations_contents","celebrations_event_contents",
   "celebrations_step_contents","celebrations_links","celebrations_groups"
  ]);
  const isAdminPage=typeof document!=="undefined"&&document.body?.classList?.contains("admin-app");
  if(isAdminPage&&adminTables.has(table)){
   const result=await post("/api/admin",{action:"list",table},true);
   if(!result.data?.ok||!Array.isArray(result.data.items))
    throw new Error("Lecture des données administrateur D1 impossible.");
   return result.data.items;
  }
  const token=localStorage.getItem("celebrations-participant-token")||"";
  const r=await fetch(base+"/api/public-data?table="+encodeURIComponent(table),{headers:token?{authorization:"Bearer "+token}:{}});
  if(!r.ok)throw new Error("Staging data unavailable");
  return r.json();
 };
 window.celebrationsStagingMedia=path=>{
  const value=String(path||"");
  // Public external URLs (such as Drive) are not private R2 keys.
  if(value.startsWith("https://")||value.startsWith("http://"))return value;
  return base+"/media/"+value.split("/").map(encodeURIComponent).join("/");
};
})();
