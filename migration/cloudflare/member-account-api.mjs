// M020-D: invitations explicites, activation et réinitialisation Brevo.
// Aucun mot de passe, jeton brut ou secret n'est conservé dans D1.
import {authorize,sha256} from './auth-api.mjs';
import {isDirectoryPersonId,normalizeDirectoryEmail} from './app/domain/contact-directory.mjs';

const COOKIE='__Host-celebrations_member';
const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'private, no-store, max-age=0','x-content-type-options':'nosniff','referrer-policy':'no-referrer','vary':'Cookie, Authorization, Origin','x-robots-tag':'noindex, nofollow, noarchive'};
const reply=(body,status=200,extra={})=>Response.json(body,{status,headers:{...HEADERS,...extra}});
const query=(db,sql,...args)=>db.prepare(sql).bind(...args);
const now=()=>new Date().toISOString();
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const email=value=>{try{return normalizeDirectoryEmail(value)}catch{return null}};
const tokenOk=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const saltOk=value=>typeof value==='string'&&/^[a-f0-9]{32,128}$/.test(value);
const typeOk=value=>value==='activate'||value==='reset';
const langOk=value=>{const base=String(value||'fr').toLowerCase().split('-')[0];return ['fr','en','es','de','pt','it','ar','zh'].includes(base)?base:'fr'};
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const copy={
 fr:{activate:'Activez votre compte',reset:'Réinitialisez votre mot de passe',intro:'Pour choisir votre mot de passe, ouvrez ce lien personnel :',resetIntro:'Pour choisir un nouveau mot de passe, ouvrez ce lien personnel :',foot:'Ce lien est temporaire et utilisable une seule fois. Si vous n’avez rien demandé, ignorez ce message.'},
 en:{activate:'Activate your account',reset:'Reset your password',intro:'To choose your password, open this private link:',resetIntro:'To choose a new password, open this private link:',foot:'This link is temporary and can be used once. If you did not request it, ignore this email.'},
 es:{activate:'Active su cuenta',reset:'Restablezca su contraseña',intro:'Para elegir su contraseña, abra este enlace personal:',resetIntro:'Para elegir una nueva contraseña, abra este enlace personal:',foot:'Este enlace es temporal y de un solo uso. Si no lo solicitó, ignore este mensaje.'},
 de:{activate:'Aktivieren Sie Ihr Konto',reset:'Passwort zurücksetzen',intro:'Legen Sie Ihr Passwort über diesen persönlichen Link fest:',resetIntro:'Legen Sie ein neues Passwort über diesen persönlichen Link fest:',foot:'Dieser Link ist zeitlich begrenzt und einmalig verwendbar. Falls Sie ihn nicht angefordert haben, ignorieren Sie diese E-Mail.'},
 pt:{activate:'Ative sua conta',reset:'Redefina sua senha',intro:'Para escolher sua senha, abra este link pessoal:',resetIntro:'Para escolher uma nova senha, abra este link pessoal:',foot:'Este link é temporário e de uso único. Se não solicitou, ignore esta mensagem.'},
 it:{activate:'Attiva il tuo account',reset:'Reimposta la password',intro:'Per scegliere la password, apri questo link personale:',resetIntro:'Per scegliere una nuova password, apri questo link personale:',foot:'Questo link è temporaneo e utilizzabile una sola volta. Se non lo hai richiesto, ignora questo messaggio.'},
 ar:{activate:'تفعيل حسابك',reset:'إعادة تعيين كلمة المرور',intro:'لاختيار كلمة المرور افتح هذا الرابط الشخصي:',resetIntro:'لاختيار كلمة مرور جديدة افتح هذا الرابط الشخصي:',foot:'الرابط مؤقت ويستخدم مرة واحدة فقط. إذا لم تطلب ذلك فتجاهل هذه الرسالة.'},
 zh:{activate:'激活您的账户',reset:'重置密码',intro:'请打开以下专属链接设置密码：',resetIntro:'请打开以下专属链接设置新密码：',foot:'此链接有时效且仅可使用一次。如非本人操作，请忽略此邮件。'}
};
const allowedOrigin=(request,env)=>{
 const origin=new URL(request.url).origin;
 return request.headers.get('origin')===origin &&
  request.headers.get('sec-fetch-site')!=='cross-site' &&
  new URL(request.url).protocol==='https:' &&
  (env.MEMBER_PUBLIC_ORIGIN||origin)===origin;
};
const configured=env=>typeof env.BREVO_API_KEY==='string'&&env.BREVO_API_KEY.length>=12&&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.BREVO_SENDER_EMAIL||'') &&
  typeof env.MEMBER_PUBLIC_ORIGIN==='string'&&/^https:\/\/[^/?#]+$/.test(env.MEMBER_PUBLIC_ORIGIN);
const activeBinding=async(db,e,purpose)=>{
 const row=await query(db,
  'SELECT b.person_id,b.status,p.password_hash,d.email_normalized FROM celebrations_member_invitation_bindings b '+
  'JOIN celebrations_directory_people d ON d.id=b.person_id AND d.email_normalized=b.participant_email '+
  'JOIN celebrations_participants p ON p.email=b.participant_email '+
  'JOIN celebrations_directory_identity_links l ON l.person_id=b.person_id AND l.participant_email=b.participant_email '+
  'JOIN celebrations_directory_identity_claims c ON c.claim_id=l.approved_claim_id AND c.status=\'approved\' '+
  'WHERE b.participant_email=? LIMIT 1',e).first();
 if(!row)return null;
 if(purpose==='activate'&&row.status==='invited'&&!row.password_hash)return row;
 if(purpose==='reset'&&row.status==='active'&&!!row.password_hash)return row;
 return null;
};
const cookieValue=request=>{
 const found=(request.headers.get('cookie')||'').split(';').map(x=>x.trim())
  .find(x=>x.startsWith(COOKIE+'='));
 const value=found?.slice(COOKIE.length+1);
 return tokenOk(value)?value:null;
};
const setCookie=(token,maxAge)=>COOKIE+'='+token+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge;
const deleteCookie=()=>setCookie('',0);
export async function getMemberAccessStatus(db,personId){
 if(!isDirectoryPersonId(personId))throw new TypeError('Invalid member');
 let row;
 try{row=await query(db,'SELECT status,participant_email AS email,updated_at FROM celebrations_member_invitation_bindings WHERE person_id=?',personId).first();}
 catch(err){if(!/no such table: celebrations_member_invitation_bindings/.test(String(err?.message||'')))throw err;}
 if(!row)return {status:'not_invited'};
 return {status:row.status,updatedAt:row.updated_at};
}
const audit=(db,actor,action,id)=>query(db,
 'INSERT INTO celebrations_directory_admin_audit(id,actor_email,action,target_id) VALUES(?,?,?,?)',
 'audit:'+crypto.randomUUID(),actor,action,id);
export async function inviteMember(db,env,personId,actor,{send=true,language='fr'}={}){
 if(!isDirectoryPersonId(personId)||!actor)throw new TypeError('Invalid invitation');
 const person=await query(db,'SELECT email_normalized AS email FROM celebrations_directory_people WHERE id=?',personId).first();
 if(!person)throw new RangeError('Membre inconnu');
 const assigned=await query(db,'SELECT 1 AS yes FROM celebrations_directory_person_celebrations WHERE person_id=? LIMIT 1',personId).first();
 if(!assigned)throw new RangeError('Inscrivez d’abord ce membre à une célébration');
 const e=person.email;
 const participant=await query(db,'SELECT password_hash FROM celebrations_participants WHERE email=?',e).first();
 const linked=await query(db,'SELECT person_id,participant_email FROM celebrations_directory_identity_links WHERE participant_email=? OR person_id=? LIMIT 1',e,personId).first();
 const binding=await query(db,'SELECT status,participant_email FROM celebrations_member_invitation_bindings WHERE person_id=?',personId).first();
 // A pending invitation can be activated only through its mailed one-time token.
 if(binding?.status==='invited'&&participant?.password_hash)
  throw new RangeError('Invitation à vérifier : un mot de passe existe déjà sans activation');
 // Never silently attach an EXISTING password-protected historical account.
 if(participant?.password_hash&&!linked)throw new RangeError('Compte historique : validez d’abord le rapprochement d’identité dans Membres');
 if(linked&&(linked.person_id!==personId||linked.participant_email!==e))throw new RangeError('Compte déjà associé à une autre identité : vérification indépendante nécessaire');
 if(binding&&binding.participant_email!==e)throw new RangeError('Adresse modifiée : vérification administrative nécessaire');
 const claimId='claim:'+crypto.randomUUID();
 const changes=[
  ...(participant?[]:[query(db,'INSERT INTO celebrations_participants(email) VALUES(?)',e)]),
  ...(linked?[]:[
   query(db,'INSERT INTO celebrations_directory_identity_claims '+
    '(claim_id,participant_email,person_id,status,reviewed_at,reviewed_by,verification_method) VALUES(?,?,?,\'approved\',?,?,\'independent_records\')',
    claimId,e,personId,now(),actor),
   query(db,'INSERT INTO celebrations_directory_identity_links(participant_email,person_id,approved_claim_id) VALUES(?,?,?)',e,personId,claimId)
  ]),
  query(db,'INSERT INTO celebrations_member_invitation_bindings(person_id,participant_email,status,reviewed_by) '+
   'VALUES(?,?,?,?) ON CONFLICT(person_id) DO UPDATE SET status=excluded.status,reviewed_by=excluded.reviewed_by,updated_at=strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\')',
   personId,e,participant?.password_hash?'active':'invited',actor),
  audit(db,actor,'member-invited',personId)
 ];
 await db.batch(changes);
 if(!send)return {status:participant?.password_hash?'active':'invited',mail:'not_requested'};
 if(participant?.password_hash)return {status:'active',mail:'not_required'};
 if(!configured(env))return {status:'invited',mail:'unconfigured'};
 const delivered=await sendOneTimeLink(env,e,'activate',langOk(language));
 return {status:'invited',mail:delivered?'sent':'failed'};
}
export async function revokeMember(db,personId,actor){
 if(!isDirectoryPersonId(personId)||!actor)throw new TypeError('Invalid revocation');
 const row=await query(db,'SELECT participant_email FROM celebrations_member_invitation_bindings WHERE person_id=?',personId).first();
 if(!row)throw new RangeError('Accès inexistant');
 await db.batch([
  query(db,'UPDATE celebrations_member_invitation_bindings SET status=\'revoked\',updated_at=? WHERE person_id=?',now(),personId),
  query(db,'DELETE FROM celebrations_participant_sessions WHERE participant_email=?',row.participant_email),
  query(db,'DELETE FROM celebrations_member_email_tokens WHERE person_id=?',personId),
  audit(db,actor,'member-revoked',personId)
 ]);
 return {status:'revoked'};
}
async function rateLimited(db,e){
 const key=await sha256(e);
 const hour=new Date(Date.now()-3600000).toISOString();
 const row=await query(db,'SELECT COUNT(*) AS n FROM celebrations_member_mail_events WHERE identity_hash=? AND created_at>?',key,hour).first();
 if(Number(row?.n||0)>=3)return true;
 await query(db,'INSERT INTO celebrations_member_mail_events(id,identity_hash,outcome) VALUES(?,?,\'attempt\')',
  crypto.randomUUID(),key).run();
 return false;
}
async function sendOneTimeLink(env,e,purpose,language){
 if(!configured(env))return false;
 const db=env.DB,person=await activeBinding(db,e,purpose);
 if(!person)return false;
 const today=new Date(Date.now()-86400000).toISOString();
 const count=await query(db,'SELECT COUNT(*) AS n FROM celebrations_member_mail_events WHERE outcome=\'sent\' AND created_at>?',today).first();
 if(Number(count?.n||0)>=300)return false;
 const day=new Date().toISOString().slice(0,10);
 await query(db,'INSERT INTO celebrations_member_mail_quota(utc_day,reserved) VALUES(?,0) ON CONFLICT(utc_day) DO NOTHING',day).run();
 const reserved=await query(db,'UPDATE celebrations_member_mail_quota SET reserved=reserved+1 WHERE utc_day=? AND reserved<300',day).run();
 if(Number(reserved?.meta?.changes)!==1)return false;
 const raw=random(),hash=await sha256(raw);
 await db.batch([
  query(db,'DELETE FROM celebrations_member_email_tokens WHERE participant_email=? AND purpose=?',e,purpose),
  query(db,'INSERT INTO celebrations_member_email_tokens(token_hash,participant_email,person_id,purpose,expires_at) VALUES(?,?,?,?,?)',
   hash,e,person.person_id,purpose,new Date(Date.now()+30*60000).toISOString())
 ]);
 const t=copy[language];
 const subject=purpose==='activate'?t.activate:t.reset;
 const intro=purpose==='activate'?t.intro:t.resetIntro;
 // Token is a fragment: it is not transmitted in HTTP requests or server logs.
 const link=env.MEMBER_PUBLIC_ORIGIN+'/?page=member-area#'+purpose+'='+raw+'&email='+encodeURIComponent(e);
 let delivered=false;
 try{
  const res=await fetch('https://api.brevo.com/v3/smtp/email',{
   method:'POST',headers:{'content-type':'application/json','api-key':env.BREVO_API_KEY},
   body:JSON.stringify({sender:{email:env.BREVO_SENDER_EMAIL,name:env.BREVO_SENDER_NAME||'Célébrations'},
    to:[{email:e}],subject,htmlContent:'<!doctype html><html lang="'+language+'"><body><main style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px"><h1>'+subject+'</h1><p>'+intro+'</p><p><a href="'+link+'">'+subject+'</a></p><p>'+t.foot+'</p></main></body></html>',
    textContent:subject+'\n\n'+intro+'\n'+link+'\n\n'+t.foot})
  });
  delivered=res.ok;
 }catch{/* Fail closed; never log provider payload or secrets. */}
 if(delivered)await query(db,'INSERT INTO celebrations_member_mail_events(id,identity_hash,outcome,purpose) VALUES(?,?,\'sent\',?)',crypto.randomUUID(),await sha256(e),purpose).run();
 else {
  await db.batch([
   query(db,'DELETE FROM celebrations_member_email_tokens WHERE token_hash=?',hash),
   query(db,'UPDATE celebrations_member_mail_quota SET reserved=reserved-1 WHERE utc_day=? AND reserved>0',day)
  ]);
 }
 return delivered;
}
async function applyPassword(db,b,purpose){
 const e=email(b.email),proof=b.password_proof,salt=b.password_salt,raw=b.token;
 if(!e||!tokenOk(raw)||!tokenOk(proof)||!saltOk(salt))return false;
 const hash=await sha256(raw);
 const matching=await query(db,'SELECT t.person_id FROM celebrations_member_email_tokens t '+
  'JOIN celebrations_member_invitation_bindings b ON b.person_id=t.person_id AND b.participant_email=t.participant_email '+
  'WHERE t.token_hash=? AND t.participant_email=? AND t.purpose=? AND t.used_at IS NULL AND t.expires_at>? '+
  'AND b.status=? LIMIT 1',hash,e,purpose,now(),purpose==='activate'?'invited':'active').first();
 if(!matching||!await activeBinding(db,e,purpose))return false;
 // Consumption is a conditional atomic single-row write, protecting against replay.
 const claimed=await query(db,'UPDATE celebrations_member_email_tokens SET used_at=? WHERE token_hash=? AND used_at IS NULL AND expires_at>?',now(),hash,now()).run();
 if(Number(claimed?.meta?.changes)!==1)return false;
 const passwordHash=await sha256(proof);
 const updated=await query(db,'UPDATE celebrations_participants SET password_salt=?,password_hash=?,updated_at=? WHERE email=? '+
  (purpose==='activate'?'AND password_hash IS NULL':'AND password_hash IS NOT NULL'),
  'client180:'+salt,passwordHash,now(),e).run();
 if(Number(updated?.meta?.changes)!==1)return false;
 await db.batch([
  ...(purpose==='activate'?[query(db,'UPDATE celebrations_member_invitation_bindings SET status=\'active\',updated_at=? WHERE person_id=? AND status=\'invited\'',now(),matching.person_id)]:[]),
  query(db,'DELETE FROM celebrations_participant_sessions WHERE participant_email=?',e)
 ]);
 return true;
}
async function sessionStatus(request,env){
 const raw=cookieValue(request);
 if(!raw)return null;
 const row=await query(env.DB,'SELECT participant_email AS email,expires_at FROM celebrations_participant_sessions WHERE token_hash=? AND expires_at>?',await sha256(raw),now()).first();
 if(!row)return null;
 return row;
}
export async function handleMemberAccount(request,env){
 if(request.method!=='POST')return reply({ok:false,error:'Méthode interdite'},405);
 if(!env?.DB||typeof env.DB.batch!=='function')return reply({ok:false,error:'Service indisponible'},503);
 if(!allowedOrigin(request,env))return reply({ok:false,error:'Origine refusée'},403);
 let b;
 try{
  const body=await request.text();
  if(body.length>4096)throw Error('size');
  b=JSON.parse(body);
  if(!b||Array.isArray(b)||typeof b!=='object')throw Error('shape');
 }catch{return reply({ok:false,error:'Requête invalide'},400)}
 const action=b.action;
 try{
  if(action==='session'){
   const s=await sessionStatus(request,env);
   return s?reply({ok:true,email:s.email,expires_at:s.expires_at}):reply({ok:false,error:'Session expirée'},401);
  }
  if(action==='adopt_session'){
   if(!tokenOk(b.participant_token))return reply({ok:false,error:'Session invalide'},401);
   const r=new Request(request.url,{headers:{authorization:'Bearer '+b.participant_token}});
   const e=await authorize(r,env,false);
   if(!e)return reply({ok:false,error:'Session expirée'},401);
   const row=await query(env.DB,'SELECT expires_at FROM celebrations_participant_sessions WHERE token_hash=?',await sha256(b.participant_token)).first();
   const seconds=Math.min(30*86400,Math.floor((Date.parse(row?.expires_at||'')-Date.now())/1000));
   if(seconds<=0)return reply({ok:false,error:'Session expirée'},401);
   return reply({ok:true,expires_at:row.expires_at},200,{'set-cookie':setCookie(b.participant_token,seconds)});
  }
  if(action==='logout'){
   const raw=cookieValue(request);
   if(raw)await query(env.DB,'DELETE FROM celebrations_participant_sessions WHERE token_hash=?',await sha256(raw)).run();
   return reply({ok:true},200,{'set-cookie':deleteCookie()});
  }
  if(action==='request_activation'||action==='request_reset'){
   const e=email(b.email),purpose=action==='request_activation'?'activate':'reset';
   if(!e)return reply({ok:false,error:'Adresse invalide'},400);
   // Configuration failures are explicit and identical for known/unknown users.
   if(!configured(env))return reply({ok:false,error:'Service e-mail non configuré : aucun message envoyé.'},503);
   if(await rateLimited(env.DB,e))return reply({ok:false,error:'Réessayez plus tard'},429);
   const known=await activeBinding(env.DB,e,purpose);
   if(known)await sendOneTimeLink(env,e,purpose,langOk(b.language));
   // Exactly the same public result for existing, unknown or failed delivery.
   // Do not pretend delivery was confirmed, including after a Brevo failure.
   return reply({ok:true,message:'Si cette adresse est autorisée, une demande d’e-mail a été traitée. La livraison n’est pas confirmée.'});
  }
  if(action==='finish_activation'||action==='finish_reset'){
   const done=await applyPassword(env.DB,b,action==='finish_activation'?'activate':'reset');
   return done?reply({ok:true}):reply({ok:false,error:'Lien invalide, expiré ou déjà utilisé'},400);
  }
  return reply({ok:false,error:'Action inconnue'},400);
 }catch{
  return reply({ok:false,error:'Service momentanément indisponible'},503);
 }
}
