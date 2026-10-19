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
 const invoke=async(name,{body={}}={})=>{
  if(name==="celebrations-access"){
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
