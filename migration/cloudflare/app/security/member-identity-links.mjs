// M009-B — explicit account/person links; no equality-of-email identity fallback.
// Server-only. The existing participant login and password hashes remain untouched.
// NOT routed from a production/staging Worker. M008-C must adopt this resolver
// before any private-member endpoint is enabled (its legacy email join is unsafe).
import {authorize} from '../../auth-api.mjs';
import {isDirectoryPersonId,normalizeDirectoryEmail} from '../domain/contact-directory.mjs';

const q = (db,query,...args) => db.prepare(query).bind(...args);
const methods = new Set(['in_person','independent_records','video_verified']);
const claimId = value => typeof value === 'string' &&
  /^claim:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const newId = prefix => prefix + crypto.randomUUID();
const invalid = () => new TypeError('Verified account and valid permanent person required');

export async function resolveExplicitMemberIdentity(request,env) {
  if (!env?.DB) throw new Error('D1 binding missing');
  const email = await authorize(request,env,false);
  if (!email) return null;
  try { normalizeDirectoryEmail(email); } catch { return null; }
  const row = await q(env.DB,
    'SELECT l.person_id AS id FROM celebrations_directory_identity_links l ' +
    'JOIN celebrations_participants p ON p.email=l.participant_email ' +
    'JOIN celebrations_directory_people d ON d.id=l.person_id ' +
    'WHERE l.participant_email=? AND p.password_hash IS NOT NULL LIMIT 1',email).first();
  return isDirectoryPersonId(row?.id) ?
    Object.freeze({id:row.id,authenticated:true}) : null;
}

export async function submitVerifiedIdentityClaim(request,env,personId) {
  if (!env?.DB) throw new Error('D1 binding missing');
  if (!isDirectoryPersonId(personId)) throw invalid();
  // Only authorize(...,false) establishes the historical account. The browser
  // may suggest a candidate person, but it gains NO rights by making a claim.
  const email = await authorize(request,env,false);
  if (!email) throw invalid();
  try { normalizeDirectoryEmail(email); } catch { throw invalid(); }
  const active = await q(env.DB,
    'SELECT 1 AS ok FROM celebrations_participants WHERE email=? ' +
    'AND password_hash IS NOT NULL',email).first();
  const person = await q(env.DB,
    'SELECT 1 AS ok FROM celebrations_directory_people WHERE id=?',personId).first();
  if (!active || !person) throw invalid();
  const id = newId('claim:');
  await q(env.DB,
    'INSERT INTO celebrations_directory_identity_claims ' +
    '(claim_id,participant_email,person_id) VALUES(?,?,?)',
    id,email,personId).run();
  // A claim is NOT a link and does NOT confer membership or access.
  return Object.freeze({claimId:id,status:'pending'});
}

export async function listPendingIdentityClaims(db) {
  const data = await q(db,
    'SELECT c.claim_id AS claimId,c.participant_email AS participantEmail,' +
    'c.person_id AS personId,c.created_at AS createdAt,' +
    'd.email_normalized AS directoryEmail,d.display_name AS displayName ' +
    'FROM celebrations_directory_identity_claims c ' +
    'JOIN celebrations_directory_people d ON d.id=c.person_id ' +
    "WHERE c.status='pending' ORDER BY c.created_at,c.claim_id LIMIT 100"
  ).all();
  if (!Array.isArray(data?.results)) throw new Error('Invalid D1 claim list');
  return data.results;
}

export async function reviewIdentityClaim(db,{id,approve,verificationMethod,actorEmail}={}) {
  if (!claimId(id) || typeof approve !== 'boolean' ||
      typeof actorEmail !== 'string' || actorEmail.length > 254 ||
      !actorEmail.trim() || (approve && !methods.has(verificationMethod)))
    throw new TypeError('Invalid verified identity review');
  // This MUST be invoked by a separately verified administrator session.
  // Approval requires a real, independently checked identity (operator attest).
  // No email match, legacy audience or participant session can approve itself.
  const auditId = newId('audit:');
  const statements = approve ? [
    q(db,'UPDATE celebrations_directory_identity_claims SET status=?, ' +
      "reviewed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),reviewed_by=?,verification_method=? " +
      "WHERE claim_id=? AND status='pending' AND EXISTS (" +
      'SELECT 1 FROM celebrations_participants p WHERE p.email=' +
      'celebrations_directory_identity_claims.participant_email AND p.password_hash IS NOT NULL)',
      'approved',actorEmail,verificationMethod,id),
    q(db,'INSERT INTO celebrations_directory_identity_links ' +
      '(participant_email,person_id,approved_claim_id) ' +
      'SELECT participant_email,person_id,claim_id ' +
      "FROM celebrations_directory_identity_claims WHERE claim_id=? AND status='approved'",id),
    q(db,'INSERT INTO celebrations_directory_admin_audit(id,actor_email,action,target_id) ' +
      "SELECT ?,?,'identity-approved',person_id FROM celebrations_directory_identity_links " +
      'WHERE approved_claim_id=?',auditId,actorEmail,id)
  ] : [
    q(db,'UPDATE celebrations_directory_identity_claims SET status=?, ' +
      "reviewed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),reviewed_by=? " +
      "WHERE claim_id=? AND status='pending'",'rejected',actorEmail,id),
    q(db,'INSERT INTO celebrations_directory_admin_audit(id,actor_email,action,target_id) ' +
      "SELECT ?,?,'identity-rejected',person_id FROM celebrations_directory_identity_claims " +
      "WHERE claim_id=? AND status='rejected' AND reviewed_by=? AND changes()=1",
      auditId,actorEmail,id,actorEmail)
  ];
  // D1.batch is atomic; uniqueness, foreign keys, and failures roll back all.
  const result = await db.batch(statements);
  if (!Array.isArray(result) || result.some(row => Number(row?.meta?.changes) !== 1))
    throw new Error('Identity claim was not newly reviewed');
  return {status:approve?'approved':'rejected'};
}

export async function unlinkIdentity(db,{personId,actorEmail}={}) {
  if (!isDirectoryPersonId(personId) || !actorEmail ||
      typeof actorEmail !== 'string') throw new TypeError('Invalid unlink request');
  const id=newId('audit:');
  const results=await db.batch([
    q(db,'DELETE FROM celebrations_directory_identity_links WHERE person_id=?',personId),
    q(db,'INSERT INTO celebrations_directory_admin_audit(id,actor_email,action,target_id) ' +
      "SELECT ?,?,'identity-unlinked',? WHERE changes()=1",id,actorEmail,personId)
  ]);
  if (Number(results?.[0]?.meta?.changes) !== 1) throw new RangeError('No linked identity');
  // Re-link requires a new, independently reviewed claim; approved claim
  // remains as historical record, not a reusable credential.
  return {unlinked:true};
}
