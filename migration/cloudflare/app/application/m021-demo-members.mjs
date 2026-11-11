// M021-A: disposable identities ONLY on the isolated M016 testing database.
// Password "poule" is never a universal login and never a production override.
import {pbkdf,sha256} from '../../auth-api.mjs';
import {inviteMember} from '../../member-account-api.mjs';
import {commitAuditedDirectoryAdmin} from './member-directory-admin-transaction.mjs';
import {toD1CelebrationId} from '../persistence/contact-directory-d1.mjs';
const HOST='celebrations-m016-admin-preprod.rondes.workers.dev';
const sql=(db,query,...args)=>db.prepare(query).bind(...args);
export function m021DemoAllowed(request,env){
 const u=new URL(request.url);
 return u.protocol==='https:'&&u.hostname===HOST&&
  env?.M016_ADMIN_PREPROD_HOST===HOST&&env?.M016_PREPROD_WRITE_ENABLED==='true'&&
  env?.MEMBER_DIRECTORY_API_HOST===HOST&&env?.M021_DEMO_MEMBERS_ENABLED==='true'&&
  env?.M021_DEMO_D1_ISOLATED==='true';
}
export async function m021DemoList(db){
 const rows=await sql(db,'SELECT m.person_id AS personId,m.participant_email AS email,'+
  'p.given_name AS givenName,p.family_name AS familyName '+
  'FROM celebrations_m021_demo_members m JOIN celebrations_directory_people p ON p.id=m.person_id '+
  'ORDER BY m.created_at DESC LIMIT 100').all();
 const list=[];
 for(const entry of rows.results||[]){
  const [categories,celebrations]=await Promise.all([
   sql(db,'SELECT type_id AS id FROM celebrations_directory_person_types WHERE person_id=?',entry.personId).all(),
   sql(db,'SELECT celebration_id AS id FROM celebrations_directory_person_celebrations WHERE person_id=?',entry.personId).all()
  ]);
  list.push({...entry,categories:(categories.results||[]).map(x=>x.id),
   celebrations:(celebrations.results||[]).map(x=>x.id)});
 }
 return list;
}
export async function m021DemoCreate(db,env,directory,actor,body){
 const givenName=String(body.givenName||'').trim(),familyName=String(body.familyName||'').trim();
 const typeId=String(body.typeId||''),cids=body.celebrationIds;
 if(!givenName||givenName.length>80||!familyName||familyName.length>80||
    !/^member-type:[A-Za-z0-9._:-]{1,120}$/.test(typeId)||
    !Array.isArray(cids)||!cids.length||cids.length>12)
  throw new TypeError('Champs invalides');
 const ids=[...new Set(cids.map(toD1CelebrationId))];
 if(ids.length!==cids.length)throw new TypeError('Célébration répétée');
 if(!(await directory.getMemberTypes()).some(t=>t.id===typeId&&!t.disabled))
  throw new RangeError('Catégorie inconnue');
 for(const id of ids)if(!await sql(db,'SELECT id FROM celebrations_celebrations WHERE id=?',id).first())
   throw new RangeError('Célébration inconnue');
 const email='m021-'+crypto.randomUUID().replaceAll('-','')+'@test.invalid';
 const created=await commitAuditedDirectoryAdmin(db,directory,actor,{
  action:'create_person',givenName,familyName,email,displayName:'',
  typeIds:[typeId],celebrationId:String(ids[0])
 });
 const personId=created.result.id;
 // Marker is created before activation: only records with this marker can be deleted.
 await db.batch([
  sql(db,'INSERT INTO celebrations_m021_demo_members(person_id,participant_email) VALUES(?,?)',personId,email),
  ...ids.slice(1).map(id=>sql(db,
   'INSERT INTO celebrations_directory_person_celebrations(person_id,celebration_id) VALUES(?,?)',personId,id))
 ]);
 await inviteMember(db,env,personId,actor,{send:false}); // No Brevo email.
 const salt=Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('');
 const hashed=await sha256(await pbkdf('poule',salt));
 const updated=await db.batch([
  sql(db,'UPDATE celebrations_participants SET password_salt=?,password_hash=?,registered_at=? WHERE email=? AND password_hash IS NULL',
   'client180:'+salt,hashed,new Date().toISOString(),email),
  sql(db,"UPDATE celebrations_member_invitation_bindings SET status='active',updated_at=? WHERE person_id=? AND status='invited'",
   new Date().toISOString(),personId)
 ]);
 if(updated.some(r=>Number(r?.meta?.changes)!==1))
  throw new Error('Activation incomplète');
 return {personId,email,givenName,familyName,celebrations:ids,categories:[typeId]};
}
export async function m021DemoDelete(db,actor,personId){
 if(typeof personId!=='string'||!/^person:[0-9a-f-]{36}$/.test(personId))
  throw new TypeError('Identité invalide');
 const marker=await sql(db,
  'SELECT participant_email AS email FROM celebrations_m021_demo_members WHERE person_id=?',personId).first();
 if(!marker||!/^m021-[0-9a-f]{32}@test[.]invalid$/.test(marker.email))
  throw new RangeError('Compte démo inconnu');
 const e=marker.email;
 // D1.batch is atomic. RESTRICT dependencies are removed in FK order.
 // Retain the pseudonymous security audit without identity or email.
 await db.batch([
  sql(db,'DELETE FROM celebrations_member_email_tokens WHERE person_id=?',personId),
  sql(db,'DELETE FROM celebrations_participant_sessions WHERE participant_email=?',e),
  sql(db,'DELETE FROM celebrations_member_invitation_bindings WHERE person_id=?',personId),
  sql(db,'DELETE FROM celebrations_directory_identity_links WHERE person_id=?',personId),
  sql(db,'DELETE FROM celebrations_directory_identity_claims WHERE person_id=?',personId),
  sql(db,'DELETE FROM celebrations_directory_private_space_enrollments WHERE person_id=?',personId),
  sql(db,'DELETE FROM celebrations_directory_person_types WHERE person_id=?',personId),
  sql(db,'DELETE FROM celebrations_directory_person_celebrations WHERE person_id=?',personId),
  sql(db,'DELETE FROM celebrations_directory_admin_revisions WHERE resource_key=?',personId),
  sql(db,'DELETE FROM celebrations_participants WHERE email=?',e),
  sql(db,'DELETE FROM celebrations_directory_people WHERE id=?',personId),
  sql(db,'DELETE FROM celebrations_m021_demo_members WHERE person_id=?',personId),
  sql(db,'INSERT INTO celebrations_directory_admin_audit(id,actor_email,action,target_id) VALUES(?,?,?,?)',
   'audit:'+crypto.randomUUID(),actor,'m021-demo-deleted',personId)
 ]);
 return {deleted:true};
}
