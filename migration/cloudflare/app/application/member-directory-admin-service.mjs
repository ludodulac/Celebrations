// M009-B — route-ready ADMIN ONLY adapter for the ONE existing M007-B UI.
// Deliberately not imported by production/staging Worker entrypoints.
// Never trust role/type/person assertions from a browser for authorization.
import {authorize} from '../../auth-api.mjs';
import {createContactDirectoryD1,toD1CelebrationId}
  from '../persistence/contact-directory-d1.mjs';
import {isDirectoryPersonId} from '../domain/contact-directory.mjs';
import {commitAuditedDirectoryAdmin,DirectoryConflictError,DirectoryDuplicateEmailError}
  from './member-directory-admin-transaction.mjs';
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

// Keyset pagination keeps every contact reachable without offset scans or
// a misleading first-100 cutoff. Search checks email and names, not identity.
async function snapshot(db,directory,url) {
  const params=url.searchParams;
  const search=(params.get('search')||'').trim().toLowerCase();
  const cursor=params.get('cursor')||'';
  const limitRaw=params.get('limit')||'50';
  if(search.length>120||cursor.length>254||
      !/^(?:[1-9][0-9]?|100)$/.test(limitRaw))
    throw new TypeError('Invalid directory pagination');
  const limit=Number(limitRaw);
  const celebration=params.get('celebrationId')||'';
  const category=params.get('typeId')||'';
  if(celebration)toD1CelebrationId(celebration);
  if(category&&!/^member-type:[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(category))throw new TypeError('Invalid category');
  const rows=await query(db,
    `SELECT p.id,p.email_normalized AS emailNormalized,
     COALESCE(NULLIF(p.display_name,''),
       NULLIF(trim(COALESCE(p.given_name,'')||' '||
         COALESCE(p.family_name,'')),''),p.email_normalized) AS name,
     COALESCE(v.revision,0) AS revision
     FROM celebrations_directory_people p
     LEFT JOIN celebrations_directory_admin_revisions v ON v.resource_key=p.id
     WHERE p.email_normalized > ? COLLATE NOCASE AND
       (?='' OR instr(p.email_normalized,?)>0 OR
       instr(lower(COALESCE(p.display_name,'')||' '||
         COALESCE(p.given_name,'')||' '||COALESCE(p.family_name,'')),?)>0)
     AND (?='' OR EXISTS(SELECT 1 FROM celebrations_directory_person_celebrations c WHERE c.person_id=p.id AND c.celebration_id=?))
     AND (?='' OR EXISTS(SELECT 1 FROM celebrations_directory_person_types t WHERE t.person_id=p.id AND t.type_id=?))
     ORDER BY p.email_normalized COLLATE NOCASE,p.id LIMIT ?`,
    cursor,search,search,search,celebration,celebration,category,category,limit+1).all();
  if(!Array.isArray(rows?.results)) throw new Error('Invalid people list');
  const hasMorePeople=rows.results.length>limit;
  const members=rows.results.slice(0,limit);
  let memberships=[];
  if(members.length) {
    const placeholders=members.map(()=>'?').join(',');
    const found=await query(db,`SELECT person_id AS memberId,type_id AS typeId
      FROM celebrations_directory_person_types WHERE person_id IN (${placeholders})
      ORDER BY person_id,type_id`,...members.map(p=>p.id)).all();
    if(!Array.isArray(found?.results))throw new Error('Invalid memberships');
    memberships=found.results;
  }
  const typeRows=await query(db,`SELECT t.id,COALESCE(v.revision,0) AS revision
    FROM celebrations_directory_member_types t
    LEFT JOIN celebrations_directory_admin_revisions v
      ON v.resource_key=t.id`).all();
  if(!Array.isArray(typeRows?.results))throw new Error('Invalid type revisions');
  const revisions=new Map(typeRows.results.map(r=>[r.id,r.revision]));
  return {types:(await directory.getMemberTypes()).map(t=>({
      ...t,revision:revisions.get(t.id)??0})),
    members,memberships,pages:[],spaces:[],enrollments:[],
    hasMorePeople,nextCursor:hasMorePeople?members.at(-1).emailNormalized:null,
    search,cursor,limit,pagePolicyWritesEnabled:false};
}

async function personDetail(db,directory,personId) {
  const id=invalidId(personId),person=await directory.getPerson(id);
  if(!person)throw new RangeError('Unknown person');
  const [types,celebrations,enrollments,revisionRow]=await Promise.all([
    directory.getPersonMemberTypes(id),
    directory.getPersonCelebrations(id),
    directory.getPrivateEnrollments(id),
    query(db,`SELECT revision FROM celebrations_directory_admin_revisions
      WHERE resource_key=?`,id).first()
  ]);
  return {person:{...person,revision:revisionRow?.revision??0},types,
    celebrations:celebrations.map(link=>({
      ...link,celebrationId:String(toD1CelebrationId(link.celebrationId))
    })),enrollments:enrollments.map(link=>({
      ...link,celebrationId:String(toD1CelebrationId(link.celebrationId))
    }))};
}
async function edit(directory,db,actor,b,{resolveCanonicalSpace}={}) {
  if(!b || typeof b!=='object'||Array.isArray(b)||
      typeof b.action!=='string')throw new TypeError('Invalid operation');
  if(b.action==='review_claim') {
    if(b.approve!==true&&b.approve!==false)throw new TypeError('Invalid review');
    return {result:await reviewIdentityClaim(db,{
      id:b.claimId,approve:b.approve,actorEmail:actor,
      verificationMethod:b.verificationMethod}),audited:true};
  }
  if(b.action==='unlink_identity') {
    const personId=invalidId(b.personId);
    return {result:await unlinkIdentity(db,{personId,actorEmail:actor}),
      audited:true};
  }
  return commitAuditedDirectoryAdmin(db,directory,actor,b,{resolveCanonicalSpace});
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
      if(action==='snapshot') return ok({data:await snapshot(env.DB,directory,url)});
      if(action==='person_detail') return ok({data:await personDetail(env.DB,directory,
        url.searchParams.get('personId'))});
      if(action==='pending_claims') return ok({data:await listPendingIdentityClaims(env.DB)});
      return error(400,'Opération inconnue');
    }
    const command=await readBody(request);
    const updated=await edit(directory,env.DB,actor,command,{resolveCanonicalSpace});
    return ok(updated);
  } catch(e) {
    if(e instanceof SyntaxError || e instanceof TypeError)
      return error(400,'Requête invalide');
    if(e instanceof RangeError) return error(404,'Élément inexistant');
    if(e instanceof DirectoryDuplicateEmailError)return error(409,'Cet e-mail existe déjà. Recherchez ce membre pour modifier sa fiche.');
    if(e instanceof DirectoryConflictError) return error(409,'Conflit de version : rechargez les données.');
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
