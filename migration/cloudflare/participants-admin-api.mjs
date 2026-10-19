// Isolated staging participant administration. Never exposes credentials,
// password questions or hashes, and requires a valid admin bearer session.
import {authorize} from "./auth-api.mjs";
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});
const emailOf=value=>{
 const s=typeof value==="string"?value.trim().toLowerCase():"";
 return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)&&s.length<=254?s:null;
};
export async function handleParticipantsAdmin(request,env){
 if(request.method!=="POST")return json({ok:false,error:"Method not allowed"},405);
 if(!env.DB||!await authorize(request,env,true))return json({ok:false,error:"Unauthorized"},401);
 let b;try{b=await request.json()}catch{return json({ok:false,error:"Invalid JSON"},400)}
 const action=b?.action;
 try{
  if(action==="admin_list_participants"){
   const result=await env.DB.prepare("SELECT email,registered_at FROM celebrations_participants ORDER BY email LIMIT 1000").all();
   return json({ok:true,participants:result.results||[]});
  }
  if(action==="admin_list"){
   const result=await env.DB.prepare("SELECT email,audience FROM celebrations_participants ORDER BY email LIMIT 1000").all();
   return json({ok:true,participants:result.results||[]});
  }
  const email=emailOf(b?.email);
  if(!email)return json({ok:false,error:"Invalid email"},400);
  if(action==="admin_add_participant"){
   await env.DB.prepare(
    "INSERT INTO celebrations_participants(email,audience) VALUES(?,NULL) ON CONFLICT(email) DO NOTHING"
   ).bind(email).run();
   return json({ok:true});
  }
  if(action==="admin_set"){
   if(!["angel","nonangel"].includes(b.audience))return json({ok:false,error:"Invalid audience"},400);
   const result=await env.DB.prepare(
    "UPDATE celebrations_participants SET audience=?,updated_at=? WHERE email=?"
   ).bind(b.audience,new Date().toISOString(),email).run();
   if(!result.meta?.changes)return json({ok:false,error:"Participant not found"},404);
   return json({ok:true,audience:b.audience});
  }
  if(action==="admin_remove_participant"){
   // Deleting the participant revokes sessions and password recovery secrets.
   // D1 batch is transactional; unrelated participants are never touched.
   const row=await env.DB.prepare("SELECT email FROM celebrations_participants WHERE email=?").bind(email).first();
   if(!row)return json({ok:false,error:"Participant not found"},404);
   await env.DB.batch([
    env.DB.prepare("DELETE FROM celebrations_participant_sessions WHERE participant_email=?").bind(email),
    env.DB.prepare("DELETE FROM celebrations_participants WHERE email=?").bind(email)
   ]);
   return json({ok:true});
  }
  return json({ok:false,error:"Unknown action"},400);
 }catch{return json({ok:false,error:"Participant operation unavailable"},503)}
}
