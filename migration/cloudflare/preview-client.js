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
   return {data:await response.json(),error:null};
  }catch{return {data:{ok:false,error:"Staging API unavailable"},error:null}}
 };
 const invoke=async(name,{body={}}={})=>{
  if(name==="celebrations-access")return post("/api/auth",body);
  if(name==="celebrations-audience")return post("/api/audience",body);
  if(name==="celebrations-admin-safe-save")return post("/api/safe-save",body,true);
  if(name==="celebrations-admin-data"){
   if(body.action==="committee_list")return post("/api/admin",{action:"list",table:"celebrations_committee_letters"},true).then(r=>({data:{...r.data,items:r.data.items||[]},error:r.error}));
   return {data:{ok:false,error:"Operation not yet supported by staging"},error:null};
  }
  return {data:{ok:false,error:"Staging operation not implemented"},error:null};
 };
 window.celebrationsSupabase={functions:{invoke},storage:{from(){return {uploadToSignedUrl:async()=>({error:new Error("Use R2 staging uploader")})}}}};
 window.celebrationsStagingData=async table=>{
  const token=localStorage.getItem("celebrations-participant-token")||"";
  const r=await fetch(base+"/api/public-data?table="+encodeURIComponent(table),{headers:token?{authorization:"Bearer "+token}:{}});
  if(!r.ok)throw new Error("Staging data unavailable");
  return r.json();
 };
 window.celebrationsStagingMedia=path=>base+"/media/"+String(path).split("/").map(encodeURIComponent).join("/");
})();
