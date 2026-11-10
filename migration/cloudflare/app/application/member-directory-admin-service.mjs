// M009-B — route-ready ADMIN ONLY adapter for the ONE existing M007-B UI.
// Deliberately not imported by production/staging Worker entrypoints.
// Never trust role/type/person assertions from a browser for authorization.
import {authorize} from '../../auth-api.mjs';
import {createContactDirectoryD1,toD1CelebrationId}
  from '../persistence/contact-directory-d1.mjs';
import {isDirectoryPersonId} from '../domain/contact-directory.mjs';
import {isMemberTypeId} from '../domain/member-access.mjs';
import {
  listPendingIdentityClaims,reviewIdentityClaim,unlinkIdentity,
  submitVerifiedIdentityClaim
} from '../security/member-identity-links.mjs';

const query = (db,sql,...args) => db.prepare(sql).bind(...args);
const safe = response => {
  const headers=new Headers({'content-type':'application/json; charset=utf-8',
    'cache-control':'private, no-store, max-age=0',
    'vary':'Authorization, Cookie',
    'x-content-type-options':'nosniff',
    'x-robots-tag':'noindex, nofollow, noarchive'});
  return new Response(JSON.stringify(response.body),{status:response.status,headers});
};
const ok = body => safe({status:200,body:{ok:true,...body}});
const error = (status,message) => safe({status,body:{ok:false,error:message}});
const invalidId = id => {
  if(!isDirectoryPersonId(id)) throw new TypeError('Invalid permanent person ID');
  return id;
};
const own = (o,key) => Object.prototype.hasOwnProperty.call(o,key);

async function audit(db,actor,action,target) {
  if(typeof actor!=='string' || !actor.trim() || actor.length>254)
    throw new TypeError('Invalid verified admin account');
  await query(db,'INSERT INTO celebrations_directory_admin_audit ' +
    '(id,actor_email,action,target_id) VALUES(?,?,?,?)',
    'audit:'+crypto.randomUUID(),actor,action,target).run();
}

// The initial view is populated with real D1 IDs; it uses the M007-B model,
// not a second catalogue or parallel administration. Bounded page for D1 cost.
async function snapshot(db,directory) {
  const rows=await query(db,
    "SELECT id,email_normalized AS emailNormalized," +
    "COALESCE(NULLIF(display_name,'')," +
    "NULLIF(trim(COALESCE(given_name,'') || ' ' || COALESCE(family_name,'')),'')," +
    "email_normalized) AS name FROM celebrations_directory_people " +
    'ORDER BY email_normalized LIMIT 100').all();
  if(!Array.isArray(rows?.results)) throw new Error('Invalid people list');
  const members=rows.results;
  let memberships=[];
  if(members.length) {
    const placeholders=members.map(()=>'?').join(',');
    const found=await query(db,
      'SELECT person_id AS memberId,type_id AS typeId ' +
      'FROM celebrations_directory_person_types WHERE person_id IN (' +
      placeholders + ') ORDER BY person_id,type_id',...members.map(p=>p.id)).all();
    if(!Array.isArray(found?.results)) throw new Error('Invalid membership list');
    memberships=found.results;
  }
  return {types:await directory.getMemberTypes(),members,memberships,
    pages:[],spaces:[],enrollments:[],
    hasMorePeople:members.length===100, // UI must not imply full-corpus coverage
    pagePolicyWritesEnabled:false};
}

async function personDetail(directory,personId) {
  const id=invalidId(personId),person=await directory.getPerson(id);
  if(!person) throw new RangeError('Unknown person');
  const [types,celebrations,enrollments]=await Promise.all([
    directory.getPersonMemberTypes(id),
    directory.getPersonCelebrations(id),
    directory.getPrivateEnrollments(id)
  ]);
  return {person,types,celebrations:celebrations.map(link=>({
    ...link,celebrationId:String(toD1CelebrationId(link.celebrationId))
  })),enrollments:enrollments.map(link=>({
    ...link,celebrationId:String(toD1CelebrationId(link.celebrationId))
  }))};
}
async function edit(directory,db,actor,b) {
  if(!b || typeof b!=='object' || Array.isArray(b) ||
      typeof b.action!=='string') throw new TypeError('Invalid operation');
  let target, result;
  switch(b.action) {
    case 'create_person':
      result=await directory.createPerson({
        id:'person:'+crypto.randomUUID(),email:b.email,
        givenName:b.givenName,familyName:b.familyName,displayName:b.displayName});
      target=result.id; break;
    case 'update_person':
      target=invalidId(b.personId);
      result=await directory.updatePerson(target,b.changes); break;
    case 'create_type':
      result=await directory.createMemberType({id:b.typeId,name:b.name});
      target=result.id; break;
    case 'rename_type':
      if(!isMemberTypeId(b.typeId)) throw new TypeError('Invalid type');
      result=await directory.renameMemberType(b.typeId,b.name);
      target=result.id; break;
    case 'disable_type':
      if(!isMemberTypeId(b.typeId) || typeof b.disabled!=='boolean')
        throw new TypeError('Invalid type/disabled flag');
      await directory.setMemberTypeDisabled(b.typeId,b.disabled);
      target=b.typeId; result={disabled:b.disabled}; break;
    case 'set_person_types':
      target=invalidId(b.personId);
      if(!Array.isArray(b.typeIds) || b.typeIds.length>100 ||
         b.typeIds.some(type=>!isMemberTypeId(type)))
        throw new TypeError('Invalid type list');
      result={memberships:await directory.replacePersonMemberTypes(target,b.typeIds)};
      break;
    case 'add_celebration':
      target=invalidId(b.personId);
      result=await directory.addPersonCelebration(target,b.celebrationId); break;
    case 'remove_celebration':
      target=invalidId(b.personId);
      await directory.removePersonCelebration(target,b.celebrationId);
      result={removed:true}; break;
    case 'enroll_space':
      target=invalidId(b.personId);
      // The M008-B adapter resolves M005 canonical spaces from a trusted SERVER
      // callback. Browser-provided space objects are explicitly ignored.
      result=await directory.enrollPersonInPrivateSpace(target,b.spaceId); break;
    case 'remove_enrollment':
      target=invalidId(b.personId);
      await directory.removePrivateEnrollment(target,b.spaceId);
      result={removed:true}; break;
    case 'review_claim':
      // This is NOT identity matching by email: a separately authenticated
      // participant submitted the claim and the admin independently verifies it.
      if(b.approve!==true && b.approve!==false) throw new TypeError('Invalid review');
      return {result:await reviewIdentityClaim(db,{
        id:b.claimId,approve:b.approve,actorEmail:actor,
        verificationMethod:b.verificationMethod}),audited:true};
    case 'unlink_identity':
      target=invalidId(b.personId);
      return {result:await unlinkIdentity(db,{personId:target,actorEmail:actor}),
        audited:true};
    default: throw new TypeError('Unknown admin operation');
  }
  // Prepared audit sink; current M008-B writer controls its own transactions.
  // Before production, audit + each write must share one transaction, see docs.
  await audit(db,actor,b.action,target);
  return {result,audited:true};
}

function sameOrigin(request) {
  const origin=request.headers.get('origin');
  return !origin || origin===new URL(request.url).origin;
}
async function readBody(request) {
  const type=request.headers.get('content-type')||'';
  if(!/^application\/json(?:\s*;|$)/i.test(type))
    throw new TypeError('JSON required');
  const body=await request.text();
  if(body.length>16384) throw new TypeError('Request exceeds allowed size');
  return JSON.parse(body);
}

export async function handleMemberDirectoryAdmin(request,env,{
  resolveCanonicalSpace
}={}) {
  if(!env?.DB || typeof env.DB.prepare!=='function' ||
     typeof env.DB.batch!=='function') return error(503,'Service indisponible');
  if(!['GET','POST'].includes(request.method)) return error(405,'Méthode interdite');
  // Existing ADMIN session only; a participant Bearer NEVER grants admin access.
  let actor;
  try { actor=await authorize(request,env,true); }
  catch { return error(503,'Service indisponible'); }
  if(!actor) return error(401,'Administrateur requis');
  if(request.method==='POST' && !sameOrigin(request))
    return error(403,'Origine refusée');
  try {
    const directory=createContactDirectoryD1(env.DB,{resolveCanonicalSpace});
    if(request.method==='GET') {
      const url=new URL(request.url);
      const action=url.searchParams.get('action')||'snapshot';
      if(action==='snapshot') return ok({data:await snapshot(env.DB,directory)});
      if(action==='person_detail') return ok({data:await personDetail(directory,
        url.searchParams.get('personId'))});
      if(action==='pending_claims') return ok({data:await listPendingIdentityClaims(env.DB)});
      return error(400,'Opération inconnue');
    }
    const command=await readBody(request);
    const updated=await edit(directory,env.DB,actor,command);
    return ok(updated);
  } catch(e) {
    if(e instanceof SyntaxError || e instanceof TypeError)
      return error(400,'Requête invalide');
    if(e instanceof RangeError) return error(404,'Élément inexistant');
    // No SQL details, personal data, grant names, or stack in HTTP response.
    return error(409,'Opération refusée ou données momentanément indisponibles');
  }
}

// Separate participant-only claim handler, likewise NOT enabled on any Worker.
// It can create a PENDING claim, never approve a link or assign membership.
export async function handleMemberIdentityClaim(request,env) {
  if(request.method!=='POST') return error(405,'Méthode interdite');
  if(!env?.DB || !sameOrigin(request)) return error(403,'Requête refusée');
  try {
    const command=await readBody(request);
    if(!command || !own(command,'personId'))
      throw new TypeError('Missing person');
    const result=await submitVerifiedIdentityClaim(request,env,command.personId);
    return ok(result);
  } catch {
    return error(403,'Demande non acceptée');
  }
}
