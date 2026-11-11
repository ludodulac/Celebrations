// M018 pure local release acceptance gate. No Cloudflare calls or writes.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const receipt=JSON.parse(read('scripts/m018_official_backup_receipt.json'));
assert.equal(receipt.private_offcloud_copy,true,'Require verified private off-Cloudflare backup');
assert.equal(receipt.file_count_in_private_folder,10);
assert.equal(receipt.source_backup_verified_offline_restore,true);
assert.equal(receipt.encrypted_outer_zip_bytes,841491475);
assert.equal(receipt.source_sha256,
 'c76ebed0ae87a88e6eba520757ff502194f8e3e3afbbcdb71cb1b858c09a508e');
assert.equal(receipt.pieces,9);
assert.equal(receipt.pieces_bytes.reduce((a,b)=>a+b,0),receipt.encrypted_outer_zip_bytes);
const path='migration/cloudflare/wrangler.m018.official.toml';
const conf=read(path);
assert.match(conf,/^name = "celebrations-exit-production"$/m);
assert.match(conf,/^keep_vars = true$/m);
assert.match(conf,/^run_worker_first = true$/m);
assert.equal((conf.match(/^database_id = "28736d2a-479b-472b-bf82-703ad0affe10"$/gm)||[]).length,2);
assert.match(conf,/^bucket_name = "celebrations-exit-production"$/m);
assert.match(conf,/^bucket_name = "celebrations-exit-staging"$/m);
assert.ok(!/^(route|routes|custom_domain|zone_id)\s*=/m.test(conf),
 'Do not create or change official DNS/custom-domain routes');
assert.ok(!/PRIVATE_MEMBER_BUCKET\s*=/.test(conf),
 'Do not enable private-media bucket');
for(const flag of [
 'MEMBER_DIRECTORY_API_ENABLED','MEMBER_DIRECTORY_OFFICIAL_ENABLED',
 'EDITOR_D1_SESSION_API_ENABLED','EDITOR_PIN_D1_BRIDGE_ENABLED',
 'MEMBER_PAGE_READ_API_ENABLED'
])assert.match(conf,new RegExp('^'+flag+' = "true"$','m'));
const files=[
 '20261110_007a_contact_directory.sql',
 '20261110_008b_directory_integrity.sql',
 '20261110_009b_explicit_identity_links.sql',
 '20261111_010b_member_admin_revisions.sql',
 '20261111_012a_editor_admin_challenges.sql',
 '20261111_012c_private_release_fences.sql'
];
for(const file of files){
 const sql=read('migration/cloudflare/d1-migrations/'+file);
 assert.match(sql,/CREATE (TABLE|TRIGGER|(?:UNIQUE )?INDEX)/);
 assert.doesNotMatch(sql,/\b(DROP\s+(TABLE|INDEX|TRIGGER)|DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+celebrations_|ALTER\s+TABLE|REPLACE\s+INTO|TRUNCATE)\b/i,
  'Only additive schema SQL permitted in '+file);
 assert.doesNotMatch(sql,/ON DELETE CASCADE/i);
}
console.log('M018_LOCAL_GATES_PASS existing_credentials=true existing_buckets=true offcloud_backup=true only_additive_D1=true');
