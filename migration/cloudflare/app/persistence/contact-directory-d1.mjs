// M008-B — D1 storage adapter for the existing M007-A directory only.
// No authentication, HTTP, public renderer, migration execution, or deploy.
import {
  createDirectoryPerson, isDirectoryPersonId, normalizeDirectoryEmail,
  planDirectoryMemberTypes, planDirectoryCelebration, planDirectoryPrivateEnrollment
} from '../domain/contact-directory.mjs';
import {createMemberType, isMemberTypeId, SPACE_VISIBILITIES}
  from '../domain/member-access.mjs';
import {createCelebrationSpace} from '../domain/celebration-spaces.mjs';

const T = Object.freeze({
  people: 'celebrations_directory_people',
  types: 'celebrations_directory_member_types',
  links: 'celebrations_directory_person_types',
  celebrations: 'celebrations_directory_person_celebrations',
  spaces: 'celebrations_directory_private_spaces',
  enrollments: 'celebrations_directory_private_space_enrollments'
});
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const requirePersonId = id => {
  if (!isDirectoryPersonId(id)) throw new TypeError('Permanent personId required');
  return id;
};
const requireSpaceId = id => {
  if (typeof id !== 'string' || !id.trim() || id !== id.trim() || id.length > 254)
    throw new TypeError('Permanent spaceId required');
  return id;
};
// Domain M005: canonical decimal text. Existing D1 schema: INTEGER FK.
export function toD1CelebrationId(id) {
  if (typeof id === 'string') {
    if (!/^[1-9]\d*$/.test(id)) throw new TypeError('Noncanonical celebration ID');
    id = Number(id);
  }
  if (!Number.isSafeInteger(id) || id < 1)
    throw new TypeError('Positive safe celebration integer required');
  return id;
}
export const toDomainCelebrationId = id => String(toD1CelebrationId(id));
// M002 uses memberId as the person's stable ID: there is no second directory.
export const memberIdForPersonId = requirePersonId;
export const personIdForMemberId = requirePersonId;

const fromPerson = r => r && ({
  id:r.id,emailNormalized:r.email_normalized,givenName:r.given_name,
  familyName:r.family_name,displayName:r.display_name,
  createdAt:r.created_at,updatedAt:r.updated_at
});
const fromType = r => ({id:r.id,name:r.name,disabled:r.disabled===1});
const sql = (db,query,...args) => db.prepare(query).bind(...args);
const first = (db,query,...args) => sql(db,query,...args).first();
async function all(db,query,...args) {
  const result = await sql(db,query,...args).all();
  if (!Array.isArray(result?.results)) throw new Error('Invalid D1 result');
  return result.results;
}

export function createContactDirectoryD1(db,{resolveCanonicalSpace}={}) {
  if (!db || typeof db.prepare !== 'function' || typeof db.batch !== 'function')
    throw new TypeError('Cloudflare D1 database with prepare/batch required');
  // Trusted server callback only. Never accept client/browse-provided space JSON.
  async function canonicalPrivateSpace(spaceId) {
    requireSpaceId(spaceId);
    if (typeof resolveCanonicalSpace !== 'function')
      throw new Error('Trusted canonical M005 space resolver is required');
    const raw = await resolveCanonicalSpace(spaceId);
    if (!raw || raw.id !== spaceId) throw new TypeError('Unknown canonical private space');
    const space = createCelebrationSpace(raw); // Canonical M005 validation.
    if (space.visibility !== SPACE_VISIBILITIES.PRIVATE)
      throw new TypeError('Only canonical PRIVATE spaces can be registered');
    return {...space,celebrationId:toD1CelebrationId(space.celebrationId)};
  }
  const getPerson = async personId => fromPerson(await first(db,
    `SELECT * FROM ${T.people} WHERE id=?`,requirePersonId(personId)));
  const getMemberTypes = async () => (await all(db,
    `SELECT id,name,disabled FROM ${T.types} ORDER BY id`)).map(fromType);
  const getPersonMemberTypes = async personId => all(db,
    `SELECT person_id AS memberId,type_id AS typeId
     FROM ${T.links} WHERE person_id=? ORDER BY type_id`,requirePersonId(personId));
  const getPersonCelebrations = async personId => (await all(db,
    `SELECT celebration_id FROM ${T.celebrations} WHERE person_id=? ORDER BY celebration_id`,
    requirePersonId(personId))).map(r=>({personId,celebrationId:toD1CelebrationId(r.celebration_id)}));
  const getPrivateEnrollments = async personId => (await all(db,
    `SELECT person_id AS memberId,space_id AS spaceId,celebration_id AS celebrationId
     FROM ${T.enrollments} WHERE person_id=? ORDER BY space_id`,
    requirePersonId(personId))).map(r=>({...r,celebrationId:toD1CelebrationId(r.celebrationId)}));
  return Object.freeze({
    getPerson,
    async getPersonByEmail(email) {
      return fromPerson(await first(db,`SELECT * FROM ${T.people} WHERE email_normalized=?`,
        normalizeDirectoryEmail(email)));
    },
    // Read-only compatibility probe. Email equality is NOT an identity link.
    async hasHistoricalParticipantEmail(email) {
      return !!(await first(db,
        `SELECT 1 AS matched FROM celebrations_participants
         WHERE lower(trim(email))=? LIMIT 1`,normalizeDirectoryEmail(email)));
    },
    async createPerson(input) {
      const p = createDirectoryPerson(input); // Caller supplies trusted UUID.
      await sql(db,`INSERT INTO ${T.people}
         (id,email_normalized,given_name,family_name,display_name)
         VALUES(?,?,?,?,?)`,p.id,p.emailNormalized,p.givenName,p.familyName,
         p.displayName).run();
      return getPerson(p.id);
    },
    async updatePerson(personId,changes) {
      requirePersonId(personId);
      if (!changes || typeof changes !== 'object' || Array.isArray(changes) ||
          own(changes,'id') || own(changes,'personId') || own(changes,'memberId'))
        throw new TypeError('Only editable contact fields allowed');
      const allowed=new Set(['email','givenName','familyName','displayName']);
      const entries=Object.entries(changes);
      if (!entries.length || entries.some(([key])=>!allowed.has(key)))
        throw new TypeError('Non-empty contact patch with known fields required');
      const previous=await getPerson(personId);
      if (!previous) throw new RangeError('Unknown personId');
      const next=createDirectoryPerson({
        id:personId,
        email:own(changes,'email')?changes.email:previous.emailNormalized,
        givenName:own(changes,'givenName')?changes.givenName:previous.givenName,
        familyName:own(changes,'familyName')?changes.familyName:previous.familyName,
        displayName:own(changes,'displayName')?changes.displayName:previous.displayName
      });
      // Compare old values (NULL-safe IS) to avoid lost updates in the same ms.
      const result=await sql(db,`UPDATE ${T.people}
         SET email_normalized=?,given_name=?,family_name=?,display_name=?,
         updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id=? AND email_normalized=? AND given_name IS ?
         AND family_name IS ? AND display_name IS ?`,
        next.emailNormalized,next.givenName,next.familyName,next.displayName,
        personId,previous.emailNormalized,previous.givenName,
        previous.familyName,previous.displayName).run();
      if (Number(result?.meta?.changes??0)!==1)
        throw new Error('Contact changed concurrently; reload required');
      return getPerson(personId);
    },
    getMemberTypes,
    async createMemberType(input) {
      const type=createMemberType(input);
      await sql(db,`INSERT INTO ${T.types}(id,name) VALUES(?,?)`,
        type.id,type.name).run();
      return {...type,disabled:false};
    },
    async renameMemberType(typeId,name) {
      const type=createMemberType({id:typeId,name});
      const r=await sql(db,`UPDATE ${T.types} SET name=? WHERE id=?`,
        type.name,type.id).run();
      if (Number(r?.meta?.changes??0)!==1) throw new RangeError('Unknown typeId');
      return fromType(await first(db,
        `SELECT id,name,disabled FROM ${T.types} WHERE id=?`,typeId));
    },
    async setMemberTypeDisabled(typeId,disabled) {
      if (!isMemberTypeId(typeId) || typeof disabled!=='boolean')
        throw new TypeError('Member type ID and boolean required');
      const r=await sql(db,`UPDATE ${T.types} SET disabled=? WHERE id=?`,
        Number(disabled),typeId).run();
      if (Number(r?.meta?.changes??0)!==1) throw new RangeError('Unknown typeId');
    },
    getPersonMemberTypes,
    async replacePersonMemberTypes(personId,typeIds) {
      requirePersonId(personId);
      if (!Array.isArray(typeIds)) throw new TypeError('Type IDs array required');
      if (!(await getPerson(personId))) throw new RangeError('Unknown personId');
      const catalogue=await getMemberTypes();
      const old=await getPersonMemberTypes(personId);
      const previous=new Set(old.map(l=>l.typeId));
      const byId=new Map(catalogue.map(t=>[t.id,t]));
      const plan=planDirectoryMemberTypes(personId,typeIds,catalogue); // M002.
      for (const {typeId} of plan) {
        const type=byId.get(typeId);
        if (!type || (type.disabled && !previous.has(typeId)))
          throw new TypeError('Cannot newly grant an unknown or disabled type');
      }
      const active=plan.filter(l=>!byId.get(l.typeId).disabled);
      // A single atomic D1 batch; disabled historic memberships survive.
      const batch=[sql(db,`DELETE FROM ${T.links} WHERE person_id=?
          AND type_id IN (SELECT id FROM ${T.types} WHERE disabled=0)`,personId),
        ...active.map(l=>sql(db,`INSERT INTO ${T.links}(person_id,type_id)
          VALUES(?,?)`,l.memberId,l.typeId))];
      await db.batch(batch);
      return getPersonMemberTypes(personId);
    },
    getPersonCelebrations,
    async addPersonCelebration(personId,celebrationId) {
      const link=planDirectoryCelebration(requirePersonId(personId),
        toD1CelebrationId(celebrationId));
      await sql(db,`INSERT INTO ${T.celebrations}(person_id,celebration_id)
        VALUES(?,?)`,link.personId,link.celebrationId).run();
      return link;
    },
    async removePersonCelebration(personId,celebrationId) {
      await sql(db,`DELETE FROM ${T.celebrations}
        WHERE person_id=? AND celebration_id=?`,
        requirePersonId(personId),toD1CelebrationId(celebrationId)).run();
    },
    getPrivateEnrollments,
    async enrollPersonInPrivateSpace(personId,spaceId) {
      requirePersonId(personId);
      const space=await canonicalPrivateSpace(spaceId);
      const link=planDirectoryPrivateEnrollment(personId,space); // M007-A.
      // FK-composite requires existing participation in that SAME celebration.
      await db.batch([
        sql(db,`INSERT INTO ${T.spaces}(space_id,celebration_id) VALUES(?,?)
          ON CONFLICT(space_id) DO NOTHING`,link.spaceId,link.celebrationId),
        sql(db,`INSERT INTO ${T.enrollments}(person_id,celebration_id,space_id)
          VALUES(?,?,?)`,link.personId,link.celebrationId,link.spaceId)
      ]);
      return {memberId:link.personId,celebrationId:link.celebrationId,spaceId:link.spaceId};
    },
    async removePrivateEnrollment(personId,spaceId) {
      await sql(db,`DELETE FROM ${T.enrollments} WHERE person_id=? AND space_id=?`,
        requirePersonId(personId),requireSpaceId(spaceId)).run();
    },
    async readTrustedAssignments(personId) {
      requirePersonId(personId);
      if (!(await getPerson(personId))) throw new RangeError('Unknown personId');
      const [types,memberships,enrollments]=await Promise.all([
        getMemberTypes(),getPersonMemberTypes(personId),getPrivateEnrollments(personId)
      ]);
      // Never invent an authenticated principal; only external server auth can.
      return {types,memberships,enrollments:enrollments.map(({memberId,spaceId})=>
        ({memberId,spaceId}))};
    }
  });
}
