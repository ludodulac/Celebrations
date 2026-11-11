// M020-E: rehearsal on an isolated, in-memory SQLite database with fictitious members only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const sql = name => readFileSync(new URL('../migration/cloudflare/'+name, import.meta.url),'utf8');
function database(){
 const db=new DatabaseSync(':memory:');
 db.exec('PRAGMA foreign_keys=ON');
 for(const f of ['celebrations-schema.sql',
   'd1-migrations/20261110_007a_contact_directory.sql',
   'd1-migrations/20261110_008b_directory_integrity.sql',
   'd1-migrations/20261110_009b_explicit_identity_links.sql',
   'd1-migrations/20261111_010b_member_admin_revisions.sql']) db.exec(sql(f));
 return db;
}
test('M020-E: category abbreviation and member access migrations coexist without altering legacy identities',()=>{
 const db=database();
 db.prepare('INSERT INTO celebrations_celebrations(id,archangel) VALUES(?,?)').run(41,'Michaël');
 db.prepare('INSERT INTO celebrations_directory_member_types(id,name) VALUES(?,?)').run('member-type:pda','PDA');
 db.prepare('INSERT INTO celebrations_participants(email,password_hash,audience) VALUES(?,?,?)')
   .run('fictional@example.invalid','previous-hash-preserved','angel');
 const original=db.prepare('SELECT password_hash FROM celebrations_participants WHERE email=?').get('fictional@example.invalid');
 db.exec(sql('d1-migrations/20261111_020b_category_abbreviation.sql'));
 db.exec(sql('d1-migrations/20261111_020d_member_brevo.sql'));
 db.prepare('UPDATE celebrations_directory_member_types SET abbreviation=? WHERE id=?').run('PDA','member-type:pda');
 assert.equal(db.prepare('SELECT abbreviation FROM celebrations_directory_member_types WHERE id=?').get('member-type:pda').abbreviation,'PDA');
 assert.deepEqual(db.prepare('SELECT password_hash FROM celebrations_participants WHERE email=?').get('fictional@example.invalid'),original);
 assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='celebrations_member_invitation_bindings'").get());
 assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='celebrations_member_email_tokens'").get());
 assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='celebrations_member_mail_quota'").get());
 db.close();
});
test('M020-E: invitation rows cannot link to unknown participants or unknown directory people',()=>{
 const db=database();
 db.exec(sql('d1-migrations/20261111_020b_category_abbreviation.sql'));
 db.exec(sql('d1-migrations/20261111_020d_member_brevo.sql'));
 const insert=db.prepare('INSERT INTO celebrations_member_invitation_bindings(person_id,participant_email,status,reviewed_by) VALUES(?,?,?,?)');
 assert.throws(()=>insert.run('person:550e8400-e29b-41d4-a716-446655440000','unknown@example.invalid','invited','fictional-admin'));
 db.close();
});
