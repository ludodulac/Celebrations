// Fictional-only fixture for EXISTING M016 isolated D1. NEVER for official D1.
// No secrets from GitHub; all generated emails are non-deliverable example.test.
import assert from 'node:assert/strict';
import {pbkdf2Sync,createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const file=process.argv[2];
assert.ok(file?.startsWith('/tmp/m018-')&&file.endsWith('.sql'));
assert.equal(process.env.M018_ISOLATED_ONLY,'YES');
const q=s=>"'"+String(s).replaceAll("'","''")+"'";
const p='fictional-M018-password-never-for-live-users';
const salt='1234567890abcdeffedcba9876543210';
const derived=pbkdf2Sync(p,salt,180000,32,'sha256').toString('hex');
const hash=createHash('sha256').update(derived).digest('hex');
const lines=[
'PRAGMA foreign_keys=ON;',
"INSERT OR IGNORE INTO celebrations_celebrations(id,archangel,year,status) VALUES(90000002,'Gabriel','2026','published');",
"INSERT OR IGNORE INTO celebrations_steps(id,celebration_id,step_key,label,body_text,sort_order) VALUES(90000021,90000002,'preparation-90000002','Préparation','DONNEES FICTIVES M018',1);",
"INSERT OR IGNORE INTO celebrations_directory_member_types(id,name,disabled) VALUES ('member-type:m018-cat1','Catégorie 1 — fictive',0);",
"INSERT OR IGNORE INTO celebrations_directory_member_types(id,name,disabled) VALUES ('member-type:m018-cat2','Catégorie 2 — fictive',0);"
];
for(let i=1;i<=3;i++){
 const last=String(i).padStart(12,'0');
 const person='person:77777777-7777-4777-8777-'+last;
 const claim='claim:77777777-7777-4777-8777-'+last;
 const email='m018-cat'+i+'@example.test';
 const type=i===2?'member-type:m018-cat2':'member-type:m018-cat1';
 lines.push(
 'INSERT OR IGNORE INTO celebrations_participants(email,password_salt,password_hash,audience) VALUES ('+
 [q(email),q('client180:'+salt),q(hash),q('angel')].join(',')+');',
 'INSERT OR IGNORE INTO celebrations_directory_people(id,email_normalized,display_name) VALUES ('+
 [q(person),q(email),q('Personne fictive M018 '+i)].join(',')+');',
 'INSERT OR IGNORE INTO celebrations_directory_person_types(person_id,type_id) VALUES ('+
 [q(person),q(type)].join(',')+');',
 'INSERT OR IGNORE INTO celebrations_directory_identity_claims(claim_id,participant_email,person_id,status,reviewed_at,reviewed_by,verification_method) VALUES ('+
 [q(claim),q(email),q(person),q('approved'),q('2026-11-11T00:00:00.000Z'),q('admin@celebrations.local'),q('independent_records')].join(',')+');',
 'INSERT OR IGNORE INTO celebrations_directory_identity_links(participant_email,person_id,approved_claim_id) VALUES ('+
 [q(email),q(person),q(claim)].join(',')+');'
 );
 if(i!==3)lines.push('INSERT OR IGNORE INTO celebrations_directory_person_celebrations(person_id,celebration_id) VALUES ('+
 [q(person),90000002].join(',')+');');
}
writeFileSync(file,lines.join('\n')+'\n',{mode:0o600});
console.log('M018_ISOLATED_FICTION_ONLY one_celebration=true two_types=true three_fake_accounts=true no_real_contacts=true');
