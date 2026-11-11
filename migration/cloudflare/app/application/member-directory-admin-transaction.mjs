// M010-B: transactional coordinator for the EXISTING M008-B directory.
// Only invoked after the existing server-side admin authorize() succeeds.
// No new account, access-policy engine, dashboard, Worker route or deployment.
import {
  createDirectoryPerson, isDirectoryPersonId, planDirectoryMemberTypes,
  planDirectoryPrivateEnrollment
} from '../domain/contact-directory.mjs';
import {createMemberType, isMemberTypeId, SPACE_VISIBILITIES}
  from '../domain/member-access.mjs';
import {createCelebrationSpace} from '../domain/celebration-spaces.mjs';
import {toD1CelebrationId} from '../persistence/contact-directory-d1.mjs';

const abbreviation=value=>{if(typeof value!=='string'||!/^[A-Z0-9][A-Z0-9.-]{0,15}$/.test(value))throw new TypeError('Sigle invalide (1 à 16 lettres ou chiffres)');return value;};
const P='celebrations_directory_people';
const T='celebrations_directory_member_types';
const L='celebrations_directory_person_types';
const C='celebrations_directory_person_celebrations';
const S='celebrations_directory_private_spaces';
const E='celebrations_directory_private_space_enrollments';
const V='celebrations_directory_admin_revisions';
const A='celebrations_directory_admin_audit';
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
export class DirectoryDuplicateEmailError extends Error {}
export class DirectoryConflictError extends Error {
  constructor() {super('Changes detected; reload the directory before retrying');}
}
const requirePerson=id=>{
  if(!isDirectoryPersonId(id))throw new TypeError('Invalid permanent person ID');
  return id;
};
const requireType=id=>{
  if(!isMemberTypeId(id))throw new TypeError('Invalid permanent member type ID');
  return id;
};
const requireSpace=id=>{
  if(typeof id!=='string'||!id.trim()||id!==id.trim()||id.length>254)
    throw new TypeError('Invalid permanent space ID');
  return id;
};
const requireActor=actor=>{
  if(typeof actor!=='string'||!actor.trim()||actor.length>254)
    throw new TypeError('Verified admin session required');
};
const requireRevision=value=>{
  if(!Number.isSafeInteger(value)||value<0)throw new TypeError('Expected revision required');
  return value;
};
const marker=(resource,nonce)=>`EXISTS (SELECT 1 FROM ${V} WHERE resource_key=? AND mutation_id=?)`;
const marked=(db,sql,args,resource,nonce)=>
  stmt(db,sql.replaceAll('/*GUARD*/',marker(resource,nonce)),...args,resource,nonce);

async function auditedBatch(db,actor,action,resource,existsTable,expected,
  operations,guardExpression='1=1',guardParams=[]) {
  requireActor(actor);
  const revision=requireRevision(expected);
  const nonce=crypto.randomUUID(),auditId='audit:'+crypto.randomUUID();
  const tx=[
    // Lazy initialization also permits records created via the M008-B adapter.
    stmt(db,`INSERT INTO ${V}(resource_key,revision,mutation_id)
      SELECT ?,0,'' WHERE EXISTS(SELECT 1 FROM ${existsTable} WHERE id=?)
      ON CONFLICT(resource_key) DO NOTHING`,resource,resource),
    stmt(db,`UPDATE ${V} SET revision=revision+1,mutation_id=?
      WHERE resource_key=? AND revision=? AND (${guardExpression})`,
      nonce,resource,revision,...guardParams),
    ...operations(nonce).map(({sql,args})=>
      stmt(db,sql,...args)),
    stmt(db,`INSERT INTO ${A}(id,actor_email,action,target_id)
      SELECT ?,?,?,? WHERE ${marker(resource,nonce)}`,
      auditId,actor,action,resource,resource,nonce)
  ];
  // D1.batch is one transaction: SQL errors (including audit trigger errors)
  // roll back ALL writes, even multi-row membership and private-space changes.
  const results=await db.batch(tx);
  if(Number(results?.[1]?.meta?.changes)!==1 ||
     Number(results?.at(-1)?.meta?.changes)!==1)
    throw new DirectoryConflictError();
  return revision+1;
}
async function created(db,actor,action,target,insert) {
  requireActor(actor);
  await db.batch([insert,stmt(db,
    `INSERT INTO ${A}(id,actor_email,action,target_id) VALUES(?,?,?,?)`,
    'audit:'+crypto.randomUUID(),actor,action,target)]);
}
const op=(sql,...args)=>({sql,args});
function requireObject(o) {
  if(!o||typeof o!=='object'||Array.isArray(o)||typeof o.action!=='string')
    throw new TypeError('Invalid admin mutation');
  // Untrusted browser fields are never authorization evidence.
  for(const key of ['principal','role','isAdmin','actor','actorEmail','permissions','verified'])
    if(own(o,key))throw new TypeError('Client cannot assert authorization');
}
function personPatch(previous,changes) {
  if(!changes||typeof changes!=='object'||Array.isArray(changes)||
      Object.keys(changes).length===0 ||
      Object.keys(changes).some(k=>!['email','givenName','familyName','displayName'].includes(k)))
    throw new TypeError('Invalid editable contact patch');
  return createDirectoryPerson({
    id:previous.id,
    email:own(changes,'email')?changes.email:previous.emailNormalized,
    givenName:own(changes,'givenName')?changes.givenName:previous.givenName,
    familyName:own(changes,'familyName')?changes.familyName:previous.familyName,
    displayName:own(changes,'displayName')?changes.displayName:previous.displayName
  });
}
const exists=(sql,...args)=>({sql,args});
export async function commitAuditedDirectoryAdmin(db,directory,actor,b,
  {resolveCanonicalSpace}={}) {
  requireObject(b);requireActor(actor);
  let target,result,revision;
  if(b.action==='create_person') {
    // Browser-supplied permanent ID is ignored; it must be allocated here.
    const p=createDirectoryPerson({id:'person:'+crypto.randomUUID(),
      email:b.email,givenName:b.givenName,familyName:b.familyName,
      displayName:b.displayName});
    if(await directory.getPersonByEmail(p.emailNormalized))throw new DirectoryDuplicateEmailError();
    const typeIds=b.typeIds??[];
    if(!Array.isArray(typeIds)||typeIds.length>100)throw new TypeError('Invalid categories');
    const catalogue=await directory.getMemberTypes();
    const links=planDirectoryMemberTypes(p.id,typeIds,catalogue);
    if(links.some(l=>catalogue.find(t=>t.id===l.typeId)?.disabled))throw new TypeError('Inactive category');
    const celebrationId=b.celebrationId?toD1CelebrationId(b.celebrationId):null;
    // Creation and initial access assignments succeed or roll back together.
    await db.batch([
      stmt(db,`INSERT INTO ${P}(id,email_normalized,given_name,family_name,display_name)
        VALUES(?,?,?,?,?)`,p.id,p.emailNormalized,p.givenName,p.familyName,p.displayName),
      ...links.map(l=>stmt(db,`INSERT INTO ${L}(person_id,type_id) VALUES(?,?)`,p.id,l.typeId)),
      ...(celebrationId?[stmt(db,`INSERT INTO ${C}(person_id,celebration_id) VALUES(?,?)`,p.id,celebrationId)]:[]),
      stmt(db,`INSERT INTO ${A}(id,actor_email,action,target_id) VALUES(?,?,?,?)`,
        'audit:'+crypto.randomUUID(),actor,b.action,p.id)
    ]);
    return {result:await directory.getPerson(p.id),audited:true};
  }
  if(b.action==='create_type') {
    const t=createMemberType({id:b.typeId||'member-type:'+crypto.randomUUID(),name:b.name});
    await created(db,actor,b.action,t.id,
      b.abbreviation!==undefined?stmt(db,`INSERT INTO ${T}(id,name,abbreviation) VALUES(?,?,?)`,t.id,t.name,abbreviation(b.abbreviation)):stmt(db,`INSERT INTO ${T}(id,name) VALUES(?,?)`,t.id,t.name));
    return {result:{...t,disabled:false},audited:true};
  }
  target=b.action==='rename_type'||b.action==='disable_type'?
    requireType(b.typeId):requirePerson(b.personId);
  // Every update includes an optimistic revision obtained via an admin GET.
  // Revisions are per PERSON or TYPE, not per browser tab.
  const expected=requireRevision(b.expectedRevision);
  const guard=(table,checks,checkArgs,operations)=>
    auditedBatch(db,actor,b.action,target,table,expected,operations,checks,checkArgs);
  switch(b.action) {
    case 'update_person': {
      const old=await directory.getPerson(target);
      if(!old)throw new RangeError('Unknown person');
      const next=personPatch(old,b.changes);
      const existing=await directory.getPersonByEmail(next.emailNormalized);
      if(existing&&existing.id!==target)throw new DirectoryDuplicateEmailError();
      revision=await guard(P,`EXISTS (SELECT 1 FROM ${P} WHERE id=?
        AND email_normalized=? AND given_name IS ?
        AND family_name IS ? AND display_name IS ?)`,
        [target,old.emailNormalized,old.givenName,old.familyName,old.displayName],
        nonce=>[op(`UPDATE ${P} SET email_normalized=?,given_name=?,
          family_name=?,display_name=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id=? AND ${marker(target,nonce)}`,
          next.emailNormalized,next.givenName,next.familyName,next.displayName,
          target,target,nonce)]);
      result=await directory.getPerson(target);break;
    }
    case 'rename_type':
    case 'disable_type': {
      const old=(await directory.getMemberTypes()).find(t=>t.id===target);
      if(!old)throw new RangeError('Unknown type');
      const updated=b.action==='rename_type'?
        createMemberType({id:target,name:b.name}):null;
      if(b.action==='disable_type'&&typeof b.disabled!=='boolean')
        throw new TypeError('Disabled must be boolean');
      revision=await guard(T,`EXISTS (SELECT 1 FROM ${T}
        WHERE id=? AND name=? AND disabled=?)`,
        [target,old.name,Number(old.disabled)],
        nonce=>b.action==='rename_type'?
          [b.abbreviation!==undefined?op(`UPDATE ${T} SET name=?,abbreviation=? WHERE id=? AND ${marker(target,nonce)}`,updated.name,abbreviation(b.abbreviation),target,target,nonce):op(`UPDATE ${T} SET name=? WHERE id=? AND ${marker(target,nonce)}`,updated.name,target,target,nonce)]:
          [op(`UPDATE ${T} SET disabled=? WHERE id=? AND ${marker(target,nonce)}`,
            Number(b.disabled),target,target,nonce)]);
      result=(await directory.getMemberTypes()).find(t=>t.id===target);break;
    }
    case 'set_person_types': {
      if(!Array.isArray(b.typeIds)||b.typeIds.length>100||
          b.typeIds.some(t=>!isMemberTypeId(t)))
        throw new TypeError('Invalid or repeated member types');
      if(!await directory.getPerson(target))throw new RangeError('Unknown person');
      const old=await directory.getPersonMemberTypes(target);
      const catalogue=await directory.getMemberTypes();
      const historic=new Set(old.map(l=>l.typeId));
      const desired=planDirectoryMemberTypes(target,[...new Set(b.typeIds)],catalogue);
      for(const l of desired) {
        const type=catalogue.find(t=>t.id===l.typeId);
        if(!type||(type.disabled&&!historic.has(l.typeId)))
          throw new TypeError('Cannot grant a disabled or unknown type');
      }
      const active=desired.filter(l=>!catalogue.find(t=>t.id===l.typeId).disabled);
      const oldJSON=JSON.stringify(old.map(l=>l.typeId));
      revision=await guard(P,`EXISTS(SELECT 1 FROM ${P} WHERE id=?)
        AND COALESCE((SELECT json_group_array(type_id) FROM
          (SELECT type_id FROM ${L} WHERE person_id=? ORDER BY type_id)),'[]')=?`,
        [target,target,oldJSON],nonce=>[
          op(`DELETE FROM ${L} WHERE person_id=?
             AND type_id IN (SELECT id FROM ${T} WHERE disabled=0)
             AND ${marker(target,nonce)}`,target,target,nonce),
          ...active.map(l=>op(`INSERT INTO ${L}(person_id,type_id)
            SELECT ?,? WHERE ${marker(target,nonce)}`,target,l.typeId,target,nonce))
        ]);
      result={memberships:await directory.getPersonMemberTypes(target)};break;
    }
    case 'add_celebration':
    case 'remove_celebration': {
      const celebrationId=toD1CelebrationId(b.celebrationId);
      const add=b.action==='add_celebration';
      revision=await guard(P,
        `EXISTS(SELECT 1 FROM ${P} WHERE id=?) AND ${add?'NOT ':''}EXISTS
          (SELECT 1 FROM ${C} WHERE person_id=? AND celebration_id=?)`,
        [target,target,celebrationId],nonce=>add?
          [op(`INSERT INTO ${C}(person_id,celebration_id)
            SELECT ?,? WHERE ${marker(target,nonce)}`,
          target,celebrationId,target,nonce)]:
          [op(`DELETE FROM ${C} WHERE person_id=? AND celebration_id=?
            AND ${marker(target,nonce)}`,
          target,celebrationId,target,nonce)]);
      result=add?{personId:target,celebrationId}:{removed:true};break;
    }
    case 'enroll_space': {
      // The canonical published object is resolved only on the server.
      if(Object.keys(b).some(key=>!['action','personId','spaceId','expectedRevision'].includes(key)))
        throw new TypeError('Invalid enrollment command');
      const spaceId=requireSpace(b.spaceId);
      if(typeof resolveCanonicalSpace!=='function')
        throw new TypeError('Trusted canonical M005 resolver required');
      const raw=await resolveCanonicalSpace(spaceId);
      if(!raw||raw.id!==spaceId)throw new TypeError('Unknown canonical space');
      const space=createCelebrationSpace(raw);
      if(space.visibility!==SPACE_VISIBILITIES.PRIVATE)
        throw new TypeError('Canonical space is not private');
      const link=planDirectoryPrivateEnrollment(target,{
        ...space,celebrationId:toD1CelebrationId(space.celebrationId)});
      revision=await guard(P,
        `EXISTS(SELECT 1 FROM ${C} WHERE person_id=? AND celebration_id=?)
        AND NOT EXISTS(SELECT 1 FROM ${E} WHERE person_id=? AND space_id=?)`,
        [target,link.celebrationId,target,spaceId],nonce=>[
          op(`INSERT INTO ${S}(space_id,celebration_id)
            SELECT ?,? WHERE ${marker(target,nonce)}
            ON CONFLICT(space_id) DO NOTHING`,
            spaceId,link.celebrationId,target,nonce),
          op(`INSERT INTO ${E}(person_id,celebration_id,space_id)
            SELECT ?,?,? WHERE ${marker(target,nonce)}`,
            target,link.celebrationId,spaceId,target,nonce)
        ]);
      result={memberId:target,celebrationId:link.celebrationId,spaceId};break;
    }
    case 'remove_enrollment': {
      const spaceId=requireSpace(b.spaceId);
      revision=await guard(P,`EXISTS(SELECT 1 FROM ${E}
        WHERE person_id=? AND space_id=?)`,[target,spaceId],nonce=>[
          op(`DELETE FROM ${E} WHERE person_id=? AND space_id=?
            AND ${marker(target,nonce)}`,target,spaceId,target,nonce)
        ]);
      result={removed:true};break;
    }
    default:throw new TypeError('Unknown admin operation');
  }
  return {result,revision,audited:true};
}
