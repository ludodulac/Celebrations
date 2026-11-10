// M007-A — Pure, portable contact-directory preparation.
// No D1 binding, account, session, browser or HTTP integration here.
// Person IDs are allocated by a future trusted server, NEVER derived from email.
// Reuse M002 membership/enrollment identity and authorization contracts.
import {
  isMemberTypeId, assignMemberTypes, enrollInSpace, SPACE_VISIBILITIES
} from './member-access.mjs';

const PERSON_ID = /^person:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
export const isDirectoryPersonId = id => typeof id === 'string' && PERSON_ID.test(id);

export function normalizeDirectoryEmail(input) {
  if (typeof input !== 'string') throw new TypeError('Email must be text');
  const email = input.trim().toLowerCase();
  const [local, domain] = email.split('@');
  if (email.length > 254 || !EMAIL.test(email) ||
      local.length > 64 || local.startsWith('.') || local.endsWith('.') ||
      local.includes('..') ||
      domain.split('.').some(label => label.length > 63 ||
        label.startsWith('-') || label.endsWith('-')))
    throw new TypeError('Invalid email address for directory');
  // Deliberately do NOT collapse Gmail dots/plus tags or merge different accounts.
  // ASCII-only for now; IDNA/unicode mailboxes need an explicit future policy.
  return email;
}

function optionalName(value, label) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new TypeError(label + ' must be text');
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) throw new TypeError('Invalid ' + label);
  return trimmed;
}

export function createDirectoryPerson({
  id, email, givenName = null, familyName = null, displayName = null
} = {}) {
  if (!isDirectoryPersonId(id)) throw new TypeError('Permanent person UUID required');
  return {
    id, emailNormalized: normalizeDirectoryEmail(email),
    givenName: optionalName(givenName, 'givenName'),
    familyName: optionalName(familyName, 'familyName'),
    displayName: optionalName(displayName, 'displayName')
  };
}

// M002 returns {memberId,typeId}; these map 1:1 to D1 person_type keys.
export function planDirectoryMemberTypes(personId, typeIds, catalogue) {
  if (!isDirectoryPersonId(personId)) throw new TypeError('Permanent person ID required');
  return assignMemberTypes(personId, typeIds, catalogue);
}

export function planDirectoryCelebration(personId, celebrationId) {
  if (!isDirectoryPersonId(personId) ||
      !Number.isSafeInteger(celebrationId) || celebrationId < 1)
    throw new TypeError('Person ID and existing D1 celebration integer required');
  return {personId, celebrationId};
}

// A space enrollment is an individual invitation. It never implies a type,
// authentication, publication, or grant for another celebration.
export function planDirectoryPrivateEnrollment(personId, space) {
  if (!isDirectoryPersonId(personId) || !space ||
      space.visibility !== SPACE_VISIBILITIES.PRIVATE ||
      typeof space.id !== 'string' || !space.id.trim() ||
      space.id !== space.id.trim() || space.id.length > 254 ||
      !Number.isSafeInteger(space.celebrationId) || space.celebrationId < 1)
    throw new TypeError('Canonical private space and verified person required');
  const link = enrollInSpace(personId, space.id);
  return {personId: link.memberId, celebrationId: space.celebrationId,
    spaceId: link.spaceId};
}

function csvRows(text, separator) {
  const rows = [];
  let row = [], cell = '', quoted = false, afterQuote = false, line = 1, rowLine = 1;
  function endCell() { row.push(cell); cell = ''; afterQuote = false; }
  function endRow() {
    endCell();
    if (row.some(field => field !== '')) rows.push({line: rowLine, cells: row});
    row = []; rowLine = line;
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { quoted = false; afterQuote = true; }
      } else {
        if (c === '\n') line++;
        cell += c;
      }
    } else if (afterQuote) {
      if (c === separator) endCell();
      else if (c === '\r' || c === '\n') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        line++; endRow();
      } else if (c !== ' ' && c !== '\t') {
        throw new TypeError('Malformed CSV after closing quote, line ' + line);
      }
    } else if (c === '"') {
      if (cell !== '') throw new TypeError('Malformed CSV quote, line ' + line);
      quoted = true;
    } else if (c === separator) endCell();
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      line++; endRow();
    } else cell += c;
  }
  if (quoted) throw new TypeError('Unclosed CSV quoted value');
  if (cell !== '' || row.length > 0 || afterQuote) endRow();
  return rows;
}

function key(value) {
  return value.trim().toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
const ALIASES = new Map([
  ['email','email'], ['e_mail','email'], ['mail','email'],
  ['courriel','email'], ['adresse_email','email'],
  ['prenom','givenName'], ['first_name','givenName'], ['given_name','givenName'],
  ['nom','familyName'], ['last_name','familyName'], ['family_name','familyName'],
  ['nom_affiche','displayName'], ['display_name','displayName']
]);

// Future CSV import STAGING ONLY: receives text, returns a preview of candidates,
// duplicates and rejected row numbers. No ID allocation, no writes, no ACL import.
// Existing emails must come from an authorized server-side D1 read, not the client.
export function previewDirectoryCsv(input, {existingEmails = []} = {}) {
  if (typeof input !== 'string' || input.length > 5_000_000 ||
      !Array.isArray(existingEmails))
    throw new TypeError('Valid CSV text and known emails required');
  const text = input.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0];
  const separator = firstLine.includes(';') ? ';' : ',';
  const rows = csvRows(text, separator);
  if (!rows.length) throw new TypeError('Empty CSV');
  const header = rows[0].cells.map(x => ALIASES.get(key(x)) ?? null);
  if (header.filter(x => x === 'email').length !== 1)
    throw new TypeError('Exactly one email column required');
  if (header.some((h, i) => h !== null && header.indexOf(h) !== i))
    throw new TypeError('Duplicate canonical CSV headers');
  const existing = new Set(existingEmails.map(normalizeDirectoryEmail));
  const seen = new Set();
  const candidates = [], duplicates = [], rejected = [];
  for (const row of rows.slice(1)) {
    if (row.cells.length !== header.length) {
      rejected.push({line: row.line, reason: 'column-count'});
      continue;
    }
    try {
      const contact = {};
      for (let i = 0; i < header.length; i++)
        if (header[i]) contact[header[i]] = row.cells[i];
      const emailNormalized = normalizeDirectoryEmail(contact.email);
      const record = {emailNormalized,
        givenName: optionalName(contact.givenName, 'givenName'),
        familyName: optionalName(contact.familyName, 'familyName'),
        displayName: optionalName(contact.displayName, 'displayName')};
      if (existing.has(emailNormalized) || seen.has(emailNormalized)) {
        duplicates.push({line: row.line, emailNormalized,
          reason: existing.has(emailNormalized) ? 'existing' : 'in-file'});
      } else {
        seen.add(emailNormalized);
        candidates.push({line: row.line, ...record});
      }
    } catch {
      rejected.push({line: row.line, reason: 'invalid-contact'});
    }
  }
  return {candidates, duplicates, rejected};
}

export {isMemberTypeId};
