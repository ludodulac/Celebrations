import {sha256} from "./auth-api.mjs";
const respond=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
async function identity(env,raw){
 if(typeof raw!=="string"||raw.length<32)return null;
 const row=await env.DB.prepare("SELECT p.email,p.audience FROM celebrations_participant_sessions s JOIN celebrations_participants p ON p.email=s.participant_email WHERE s.token_hash=? AND s.expires_at>?").bind(await sha256(raw),new Date().toISOString()).first();
 return row||null;
}
export async function handleAudience(request,env){
 if(request.method!=="POST")return respond({ok:false,error:"Method not allowed"},405);
 if(!env.DB)return respond({ok:false,error:"Unavailable"},503);
 let b;try{b=await request.json()}catch{return respond({ok:false,error:"Invalid JSON"},400)}
 const action=String(b.action||"");
 if(action!=="participant_get")return respond({ok:false,error:"Not implemented"},501);
 const row=await identity(env,b.participant_token);
 return row?respond({ok:true,audience:row.audience,email:row.email}):respond({ok:false,error:"Unauthorized"},401);
}
export {identity as participantIdentity};
