// Only loaded by explicitly isolated preview pages, never by production.
(function(){
 const endpoint=window.CELEBRATIONS_STAGING_BACKEND;
 if(!endpoint)return;
 const base=String(endpoint).replace(/\/$/,"");
 const invoke=async(name,{body={}}={})=>{
  const path=name==="celebrations-access"?"/api/auth":name==="celebrations-audience"?"/api/audience":null;
  if(!path)return {data:{ok:false,error:"Staging operation not implemented"},error:null};
  try{
   const response=await fetch(base+path,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body),credentials:"omit"});
   return {data:await response.json(),error:null};
  }catch{return {data:{ok:false,error:"Staging API unavailable"},error:null}}
 };
 window.celebrationsSupabase={functions:{invoke},storage:{from(){return {uploadToSignedUrl:async()=>({error:new Error("Upload not yet implemented in staging")})}}}};
 window.celebrationsStagingData=async table=>{
  const token=localStorage.getItem("celebrations-participant-token")||"";
  const r=await fetch(base+"/api/public-data?table="+encodeURIComponent(table),{headers:token?{authorization:"Bearer "+token}:{}});
  if(!r.ok)throw new Error("Staging data unavailable");
  return r.json();
 };
 window.celebrationsStagingMedia=path=>base+"/media/"+String(path).split("/").map(encodeURIComponent).join("/");
})();
