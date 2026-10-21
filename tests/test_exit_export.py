import unittest,tempfile,pathlib,json,sqlite3
from unittest.mock import Mock
from migration.export_celebrations_readonly import fetch_table,export,TABLES,PRIMARY_KEYS
from migration.stage_export_sqlite import stage
from migration.import_relational_sqlite import import_relational
from migration.encrypted_backup import encrypt_export, verify_encrypted_file
from migration.verify_real_backup_restore import restore_ciphertext_into_ram
from scripts.audit_celebrations_media_dual_copy_readonly import source_inventory, compare_manifests
from scripts.audit_historic_participant_verifier_parity import compare_user
from scripts.audit_preproduction_resources_and_dns import encrypt_snapshot, verify_snapshot, paged_cloudflare
from scripts.provision_separate_production_free_resources import parse_d1_inventory, parse_r2_inventory, enforce_safe_inventory
from scripts.verify_production_database_schema import expected_tables, verify_account_list
from scripts.audit_public_only_media import asset_audit
from scripts.copy_selected_public_media_to_production import select_visible_paths
from scripts.copy_selected_media_via_cloudflare_rest import rest_objects, object_url
from scripts.copy_selected_with_scoped_production_key import credentials_for
from scripts.import_public_programme_production_d1 import (PUBLIC_TABLES, COUNTS, canonical, signatures, insert_rows, column_names)
from scripts.import_private_r2_public_media_acl_d1 import canonical as canonical_acl, insert_selected as insert_acl
from scripts.import_private_admin_accounts_production_d1 import converted_participant, EXPECTED as EXPECTED_PRIVATE
from scripts.recover_one_missing_public_pdf_to_private_production import (get_file_from_public_drive, EXPECTED_BYTES as DRIVE_PDF_EXPECTED_BYTES)
from scripts.import_historic_stats_production_d1 import equal_row,source_snapshot,insert_clicks
def mocked_rows(rows,range_header=None):
 r=Mock()
 r.json.return_value=rows
 r.headers={"Content-Range": range_header or ("0-"+str(len(rows)-1)+"/"+str(len(rows)) if rows else "*/0")}
 return r

class TestExport(unittest.TestCase):
 def test_pagination(self):
  s=Mock();a=mocked_rows([{"id":1},{"id":2}],"0-1/3");b=mocked_rows([{"id":3}],"2-2/3")
  s.get.side_effect=[a,b]
  self.assertEqual(list(fetch_table(s,"https://example","celebrations_contents",2)),[{"id":1},{"id":2},{"id":3}])
  self.assertEqual(s.get.call_count,2)
  self.assertEqual(s.get.call_args_list[0].kwargs["params"]["order"],"id.asc")
 def test_pagination_rejects_changed_source_count(self):
  s=Mock()
  s.get.side_effect=[mocked_rows([{"id":1},{"id":2}],"0-1/3"),mocked_rows([{"id":3}],"2-2/4")]
  with self.assertRaisesRegex(RuntimeError,"Source row count changed"):
   list(fetch_table(s,"https://example","celebrations_contents",2))
 def test_pagination_rejects_duplicate_primary_key(self):
  s=Mock()
  s.get.side_effect=[mocked_rows([{"id":1},{"id":2}],"0-1/3"),mocked_rows([{"id":2}],"2-2/3")]
  with self.assertRaisesRegex(RuntimeError,"Duplicate source row"):
   list(fetch_table(s,"https://example","celebrations_contents",2))
 def test_pagination_rejects_missing_count_or_primary_key(self):
  s=Mock();r=mocked_rows([{"id":1}]);r.headers={}
  s.get.return_value=r
  with self.assertRaisesRegex(RuntimeError,"Exact source row count missing"):
   list(fetch_table(s,"https://example","celebrations_contents"))
  s.get.return_value=mocked_rows([{"content_type":"pdf"}])
  with self.assertRaisesRegex(RuntimeError,"Backup primary key missing"):
   list(fetch_table(s,"https://example","celebrations_contents"))
 def test_composite_key_ordering(self):
  s=Mock();s.get.return_value=mocked_rows([{"event_id":"event-1","content_id":"content-1"}])
  self.assertEqual(len(list(fetch_table(s,"https://example","celebrations_event_contents"))),1)
  self.assertEqual(s.get.call_args.kwargs["params"]["order"],"event_id.asc,content_id.asc")
 def test_all_tables_included(self):
  self.assertEqual(len(TABLES),16)
  self.assertIn("celebrations_committee_letters",TABLES)
  self.assertIn("celebrations_participants",TABLES)
 def test_private_output_and_no_overwrite(self):
  s=Mock();s.get.return_value=mocked_rows([])
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/"private"
   m=export(s,"https://example",p)
   self.assertTrue(m["complete"])
   self.assertEqual(len(m["tables"]),16)
   self.assertEqual((p/"manifest.json").stat().st_mode & 0o777,0o600)
   with self.assertRaises(RuntimeError):export(s,"https://example",p)
 def test_offline_staging_import(self):
  s=Mock()
  def get(url,**kwargs):
   table=url.rsplit("/",1)[-1]
   row={k: ("synthetic" if k in ("email","token_hash","user_id","event_id","content_id","step_key") else 1) for k in PRIMARY_KEYS[table]}
   row["value"]="été"
   return mocked_rows([row])
  s.get.side_effect=get
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/"private"
   export(s,"https://example",p)
   result=stage(p,pathlib.Path(d)/"staging.sqlite")
   self.assertEqual(result["tables"],16)
   self.assertEqual(result["rows"],16)
   db=sqlite3.connect(pathlib.Path(d)/"staging.sqlite")
   self.assertEqual(db.execute("SELECT COUNT(*) FROM staging_rows").fetchone()[0],16)
 def test_staging_detects_tampering(self):
  s=Mock();s.get.return_value=mocked_rows([])
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/"private"
   export(s,"https://example",p)
   (p/"celebrations_contents.json").write_text("[1]")
   with self.assertRaises(RuntimeError):stage(p,pathlib.Path(d)/"bad.sqlite")
 def test_real_relational_schema_import_and_integrity(self):
  s=Mock();s.get.return_value=mocked_rows([])
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/"private";export(s,"https://example",p)
   target=pathlib.Path(d)/"relational.sqlite"
   result=import_relational(p,target,"migration/cloudflare/celebrations-schema.sql")
   self.assertEqual(result["tables"],16)
   db=sqlite3.connect(target)
   self.assertEqual(db.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name LIKE 'celebrations_%'").fetchone()[0],17)
   self.assertEqual(db.execute("PRAGMA foreign_key_check").fetchall(),[])
   db.execute("PRAGMA foreign_keys=ON")
   with self.assertRaises(sqlite3.IntegrityError):
    db.execute("INSERT INTO celebrations_events(id,celebration_id,step_key,title) VALUES ('orphan',999,'x','Test')")
 def test_acl_schema_deny_by_default(self):
  sql=pathlib.Path("migration/cloudflare/media-acl.sql").read_text()
  db=sqlite3.connect(":memory:");db.executescript(sql)
  db.execute("INSERT INTO public_media(storage_path) VALUES (?)",("media/example",))
  db.execute("INSERT INTO committee_media(slug,storage_path) VALUES (?,?)",("slug","committee/example"))
  self.assertEqual(db.execute("SELECT approved FROM public_media").fetchone()[0],0)
  self.assertEqual(db.execute("SELECT published FROM committee_media").fetchone()[0],0)

 def test_relational_restore_with_synthetic_linked_data(self):
  # Fictitious records only. Exercises dependencies across the real 16-table schema;
  # never contacts Supabase, D1, R2, or an external service.
  rows={
   "celebrations_celebrations":[{"id":1,"archangel":"Michaël","year":"2026"}],
   "celebrations_steps":[{"id":1,"celebration_id":1,"step_key":"day-1","label":"Synthetic day"}],
   "celebrations_events":[{"id":"event-test","celebration_id":1,"step_key":"day-1","title":"Synthetic event"}],
   "celebrations_contents":[{"id":"content-test","name":"Synthetic PDF","content_type":"pdf","storage_path":"media/test.pdf","has_cover":False}],
   "celebrations_event_contents":[{"event_id":"event-test","content_id":"content-test","sort_order":0}],
   "celebrations_step_contents":[{"celebration_id":1,"step_key":"day-1","content_id":"content-test","sort_order":0}],
   "celebrations_links":[{"id":1,"celebration_id":1,"event_id":"event-test","url":"https://example.invalid/test"}],
   "celebrations_groups":[{"id":"group-test","name":"Fictional group"}],
   "celebrations_public_settings":[{"id":1,"show_other_celebrations":True}],
   "celebrations_footer_drafts":[{"id":1,"slug":"mentions-legales","draft_number":1,"title":"Synthetic legal draft","content":"Not for publication"}],
   "celebrations_user_profiles":[{"user_id":"synthetic-user","audience":"all"}],
   "celebrations_participants":[{"email":"synthetic@example.invalid","password_hash":"synthetic-not-a-real-hash","password_salt":"synthetic-salt"}],
   "celebrations_participant_sessions":[{"token_hash":"synthetic-participant-token","participant_email":"synthetic@example.invalid","expires_at":"2030-01-01T00:00:00Z"}],
   "celebrations_admin_sessions":[{"token_hash":"synthetic-admin-token","expires_at":"2030-01-01T00:00:00Z"}],
   "celebrations_committee_letters":[{"id":"letter-test","title":"Synthetic letter","file_name":"test.pdf","storage_path":"committee/test.pdf","slug":"test-link"}],
   "celebrations_clicks":[{"id":200,"celebration_id":1,"content_id":"content-test","target_kind":"page-view","page_path":"/"}]
  }
  self.assertEqual(set(rows),set(TABLES))
  session=Mock()
  def response(url,**kwargs):
   return mocked_rows(rows[url.rsplit("/",1)[-1]])
  session.get.side_effect=response
  with tempfile.TemporaryDirectory() as tmp:
   root=pathlib.Path(tmp)
   private=root/"private-export"
   report=export(session,"https://synthetic.invalid",private)
   self.assertTrue(report["complete"])
   self.assertEqual(sum(meta["rows"] for meta in report["tables"].values()),16)
   self.assertEqual((private/"manifest.json").stat().st_mode & 0o777,0o600)
   self.assertEqual((private/"celebrations_participants.json").stat().st_mode & 0o777,0o600)
   archive=stage(private,root/"lossless.sqlite")
   self.assertEqual(archive["tables"],16)
   self.assertEqual(archive["rows"],16)
   restored=root/"relational.sqlite"
   outcome=import_relational(private,restored,"migration/cloudflare/celebrations-schema.sql")
   self.assertEqual(outcome,{"tables":16,"rows":16,"foreign_key_violations":0})
   with sqlite3.connect(restored) as db:
    db.execute("PRAGMA foreign_keys=ON")
    self.assertEqual(db.execute("PRAGMA foreign_key_check").fetchall(),[])
    self.assertEqual(db.execute("SELECT COUNT(*) FROM celebrations_event_contents").fetchone()[0],1)
    self.assertEqual(db.execute("SELECT COUNT(*) FROM celebrations_step_contents").fetchone()[0],1)
    self.assertEqual(db.execute("SELECT COUNT(*) FROM celebrations_committee_letters").fetchone()[0],1)
    self.assertEqual(db.execute("SELECT show_other_celebrations FROM celebrations_public_settings").fetchone()[0],1)
    self.assertEqual(db.execute("SELECT email FROM celebrations_participants").fetchone()[0],"synthetic@example.invalid")
    self.assertEqual(db.execute("SELECT COUNT(*) FROM celebrations_clicks").fetchone()[0],1)
   with self.assertRaises(ValueError):
    import_relational(private,restored,"migration/cloudflare/celebrations-schema.sql")

 def test_encrypted_backup_roundtrip_is_private(self):
  # No real Supabase rows or credentials. Only locally generated dummy data.
  session=Mock();session.get.return_value=mocked_rows([])
  with tempfile.TemporaryDirectory() as root:
   root=pathlib.Path(root)
   plaintext=root/"private"
   export(session,"https://synthetic.invalid",plaintext)
   output=root/"source.cbackup"
   password=b"synthetic-only-random-entropy-test-phrase-0001"
   encrypt_export(plaintext,output,password)
   self.assertTrue(output.exists())
   self.assertEqual(output.stat().st_mode & 0o777,0o600)
   self.assertEqual(verify_encrypted_file(output,password),16)
   self.assertNotIn(b"manifest.json",output.read_bytes())
   with self.assertRaises(FileExistsError):
    encrypt_export(plaintext,output,password)
   with self.assertRaises(Exception):
    verify_encrypted_file(output,b"wrong-password-32-characters-or-longer")
   corrupted=bytearray(output.read_bytes())
   corrupted[-1]^=1
   (root/"corrupted.cbackup").write_bytes(corrupted)
   with self.assertRaises(Exception):
    verify_encrypted_file(root/"corrupted.cbackup",password)


 def test_restoring_encrypted_real_schema_in_private_ram_synthetic(self):
  # Uses only fake 2-row data but exercises the exact encrypted archive +
  # real relational schema route used for the private real-data rehearsal.
  rows={
   "celebrations_celebrations":[{"id":5,"archangel":"Synthetic","year":"2026"}],
   "celebrations_contents":[{"id":"synthetic-attachment","name":"Fictional file","content_type":"pdf"}],
  }
  session=Mock()
  session.get.side_effect=lambda url,**kw: mocked_rows(rows.get(url.rsplit("/",1)[-1],[]))
  with tempfile.TemporaryDirectory() as tmp:
   root=pathlib.Path(tmp)
   source=root/"source"
   export(session,"https://synthetic.invalid",source)
   pw=b"random-synthetic-passphrase-for-testing-0123456"
   archive=root/"private.cbackup"
   encrypt_export(source,archive,pw)
   scratch=root/"scratch"
   scratch.mkdir()
   result=restore_ciphertext_into_ram(archive.read_bytes(),pw,scratch)
   self.assertEqual(result,{"tables":16,"rows":2,"fk_violations":0})
   with self.assertRaises(Exception):
    restore_ciphertext_into_ram(archive.read_bytes(),b"bad-key-of-32-characters-for-testing",root/"other")

 def test_private_backup_workflow_is_strictly_opt_in(self):
  workflow=pathlib.Path(".github/workflows/celebrations-private-backup-once.yml").read_text()
  self.assertIn("branches:\n      - feat/celebrations-supabase-exit-001",workflow)
  self.assertIn("contains(github.event.head_commit.message, '[BACKUP_ENCRYPTED_ONCE]')",workflow)
  self.assertIn("github.ref == 'refs/heads/feat/celebrations-supabase-exit-001'",workflow)
  self.assertIn("environment: celebrations-staging",workflow)
  self.assertIn("secrets.CELEBRATIONS_BACKUP_PASSPHRASE",workflow)
  self.assertIn("secrets.SUPABASE_SERVICE_ROLE_KEY",workflow)
  self.assertIn("python -m migration.encrypted_backup --verify",workflow)
  self.assertIn("path: /tmp/celebrations-source-only.cbackup".replace("path: ","BACKUP_FILE: "),workflow)
  self.assertIn('assert os.environ["STAGING_R2_BUCKET"] == "celebrations-exit-staging"',workflow)
  self.assertIn('name="private-backups/source-"',workflow)
  self.assertIn("PRIVATE_R2_CIPHERTEXT_VERIFIED",workflow)
  self.assertIn("[PARTICIPANT_PARITY_ONLY_ONCE]",workflow)
  self.assertIn("node scripts/check-staging-d1-free-budget.mjs pre",workflow)
  self.assertIn("python scripts/audit_historic_participant_verifier_parity.py",workflow)
  self.assertNotIn("actions/upload-artifact@",workflow)
  self.assertNotIn("CLOUDFLARE_API_TOKEN",workflow.split("  isolated-restore-audit:",1)[0])
  self.assertNotIn("wrangler",workflow.split("  isolated-restore-audit:",1)[0])
  self.assertNotIn("workflow_dispatch",workflow.split("on:",1)[1].split("permissions:",1)[0])


 def test_158_media_dual_copy_manifest(self):
  # No network calls and no real filenames or media bytes. The R2 "extra"
  # backup is intentionally excluded rather than deleted or reclassified.
  import datetime
  source={"media/test%03d.jpg"%i:5_000_000 for i in range(157)}
  source["committee/test.pdf"]=45_312_417
  stable=datetime.datetime(2026,10,19,18,tzinfo=datetime.timezone.utc)
  target={k:(v,stable) for k,v in source.items()}
  target["private-backups/dummy.cbackup"]=(380825,stable)
  result=compare_manifests(source,target)
  self.assertEqual(result["r2_original_keys_and_sizes_verified"],158)
  self.assertEqual(result["source_bytes"],830312417)
  self.assertEqual(result["staging_only_objects_preserved"],1)
  self.assertEqual(result["d1_queries"],0)
  self.assertFalse(result["sha256_content_rechecked_this_run"])
  with self.assertRaisesRegex(RuntimeError,"parity conflict"):
   compare_manifests(source,{**target,"committee/test.pdf":(45_312_416,stable)})
  with self.assertRaisesRegex(RuntimeError,"parity conflict"):
   compare_manifests(source,{k:v for k,v in target.items() if k!="committee/test.pdf"})
  latest=datetime.datetime(2026,10,20,12,tzinfo=datetime.timezone.utc)
  with self.assertRaisesRegex(RuntimeError,"parity conflict"):
   compare_manifests(source,{**target,"committee/test.pdf":(45_312_417,latest)})

 def test_158_media_source_listing_date_guard(self):
  # A source media update after the known SHA proof must stop migration.
  s=Mock()
  def response(url,**kwargs):
   out=Mock()
   out.json.return_value=[{
    "name":"source.pdf","id":"synthetic-id",
    "metadata":{"size":400},
    "updated_at":"2026-10-11T12:51:50Z"
   }]
   return out
  s.post.side_effect=response
  results=source_inventory(s,"https://synthetic.invalid")
  self.assertEqual(results,{"source.pdf":400})
  self.assertEqual(s.post.call_count,1)
  self.assertIn("/storage/v1/object/list/",s.post.call_args.args[0])
  def changed(url,**kwargs):
   out=Mock()
   out.json.return_value=[{
    "name":"source.pdf","id":"synthetic-id",
    "metadata":{"size":400},
    "updated_at":"2026-10-20T12:00:00Z"
   }]
   return out
  s.post.side_effect=changed
  with self.assertRaisesRegex(RuntimeError,"changed after SHA256"):
   source_inventory(s,"https://synthetic.invalid")



 def test_historic_participant_verifier_compatibility_without_password(self):
  # Fictitious original credentials: verify the exact source -> D1 mapping
  # without knowing any real participant email, password, salt, or answers.
  import hashlib
  legacy={
   "email":"fictitious@example.invalid",
   "password_salt":"0123456789abcdef0123456789abcdef",
   "password_hash":"a"*64,
   "question_1":"first_school","answer_1_salt":"deadbeef"*8,
   "answer_1_hash":"b"*64,
   "question_2":"childhood_book","answer_2_salt":"01234567"*8,
   "answer_2_hash":"c"*64,
   "recovery_failed_count":0,"recovery_locked_until":None,
   "audience":"all","updated_at":"2026-09-07T01:36:12.952+00:00"
  }
  wrapped={
   **{k:v for k,v in legacy.items() if k!="updated_at"},
   "password_salt":"client180:"+legacy["password_salt"]
  }
  for key in ("password_hash","answer_1_hash","answer_2_hash"):
   wrapped[key]=hashlib.sha256(legacy[key].encode("ascii")).hexdigest()
  result=compare_user(legacy,wrapped)
  self.assertEqual(result["staging_historical_accounts_matched"],1)
  self.assertEqual(result["real_password_login_by_original_participant"],"PENDING")
  self.assertEqual(result["cloudflare_d1_rows_written"],0)
  with self.assertRaisesRegex(ValueError,"differs"):
   compare_user(legacy,{**wrapped,"password_hash":"0"*64})
  with self.assertRaisesRegex(ValueError,"differs"):
   compare_user(legacy,{**wrapped,"answer_2_hash":"0"*64})
  with self.assertRaisesRegex(ValueError,"changed"):
   compare_user({**legacy,"updated_at":"2026-10-20T12:00:00Z"},wrapped)
  with self.assertRaisesRegex(ValueError,"Invalid source email"):
   compare_user({**legacy,"email":"bad-email"},wrapped)


 def test_production_candidate_uses_separate_resources(self):
  # No Cloudflare requests, no credentials; configuration is created only
  # on a local test filesystem with synthetic identifiers.
  from scripts.prepare_production_wrangler import generate
  with tempfile.TemporaryDirectory() as tmp:
   path=pathlib.Path(tmp)/"wrangler.production.toml"
   conf=generate("00000000-0000-4000-8000-000000000002",
     "celebrations-exit-production",
     "00000000-0000-4000-8000-000000000001",
     "celebrations-exit-staging",path)
   self.assertIn('main = "production-worker.mjs"',conf)
   self.assertIn('bucket_name = "celebrations-exit-production"',conf)
   self.assertNotIn('bucket_name = "celebrations-exit-staging"',conf)
   self.assertIn('directory = "../../production-public"',conf)
   with self.assertRaisesRegex(ValueError,"cannot be identical"):
    generate("00000000-0000-4000-8000-000000000001",
      "celebrations-exit-production",
      "00000000-0000-4000-8000-000000000001",
      "celebrations-exit-staging",pathlib.Path(tmp)/"invalid.toml")
   with self.assertRaisesRegex(ValueError,"bucket identity mismatch"):
    generate("00000000-0000-4000-8000-000000000002",
      "celebrations-exit-staging",
      "00000000-0000-4000-8000-000000000001",
      "celebrations-exit-staging",pathlib.Path(tmp)/"invalid.toml")
   with self.assertRaisesRegex(ValueError,"overwrite"):
    generate("00000000-0000-4000-8000-000000000002",
      "celebrations-exit-production",
      "00000000-0000-4000-8000-000000000001",
      "celebrations-exit-staging",path)


 def test_dns_rollback_snapshot_is_encrypted_and_authenticated(self):
  data=json.dumps({"domain":"ronde-des-archanges-universelle.eu",
   "dns_records":[{"name":"example.invalid","type":"CNAME","content":"secret"}],
   "worker_routes":[]}).encode()
  key="synthetic-only-testing-passphrase-at-least-32-chars-001"
  encoded=encrypt_snapshot(data,key)
  self.assertNotIn(b"secret",encoded)
  self.assertEqual(verify_snapshot(encoded,key),1)
  self.assertRaises(Exception,verify_snapshot,encoded,
       "different-synthetic-passphrase-min-32-characters")
  corrupted=bytearray(encoded);corrupted[-1]^=1
  self.assertRaises(Exception,verify_snapshot,bytes(corrupted),key)

 def test_dns_records_pagination_never_calls_mutating_http(self):
  from unittest.mock import Mock
  session=Mock()
  def get(url,params=None,timeout=None):
   page=int(params["page"])
   n=100 if page==1 else 2
   ans=Mock()
   ans.status_code=200
   ans.json.return_value={"success":True,
    "result":[{"type":"TXT","content":"synthetic","index":i} for i in range(n)],
    "result_info":{"total_pages":2}}
   return ans
  session.get.side_effect=get
  rows=paged_cloudflare(session,"https://api.cloudflare.com/client/v4/zones/example/dns_records")
  self.assertEqual(len(rows),102)
  self.assertEqual(session.get.call_count,2)
  session.post.assert_not_called()
  session.get.return_value.status_code=403
  session.get.side_effect=None
  self.assertIsNone(paged_cloudflare(session,"https://api.cloudflare.com/client/v4/zones/example/dns_records"))


 def test_free_production_resource_provision_does_not_reuse_staging(self):
  import copy
  db={"uuid":"00000000-0000-4000-8000-000000000001","name":"celebrations-exit-staging"}
  r2={"name":"celebrations-exit-staging","storage_class":"Standard"}
  original_d1=parse_d1_inventory({"success":True,"result":[db],
                                "result_info":{"total_count":1}})
  original_r2=parse_r2_inventory({"success":True,"result":{"buckets":[r2]}})
  prod1,prod2=enforce_safe_inventory(original_d1,original_r2)
  self.assertIsNone(prod1)
  self.assertIsNone(prod2)
  with self.assertRaisesRegex(ValueError,"Partial"):
   parse_d1_inventory({"success":True,"result":[db],
                       "result_info":{"total_count":2}})
  with self.assertRaisesRegex(ValueError,"cursor"):
   parse_r2_inventory({"success":True,"result":{"buckets":[r2],"cursor":"next"}})
  with self.assertRaisesRegex(ValueError,"D1 maximum"):
   enforce_safe_inventory([db]+[
    {"name":"other-"+str(i),"uuid":"00000000-0000-4000-8000-000000000001"}
     for i in range(9)],original_r2)
  with self.assertRaisesRegex(ValueError,"nonstandard"):
   enforce_safe_inventory(original_d1,[r2,
    {"name":"celebrations-exit-production","storage_class":"InfrequentAccess"}])
  with self.assertRaisesRegex(ValueError,"protected staging"):
   enforce_safe_inventory([],original_r2)
  prod_db={"name":"celebrations-exit-production",
           "uuid":"00000000-0000-4000-8000-000000000002"}
  prod_r2={"name":"celebrations-exit-production","storage_class":"Standard"}
  self.assertEqual(enforce_safe_inventory([db,prod_db],[r2,prod_r2]),(prod_db,prod_r2))


 def test_production_schema_requires_exact_isolated_eu_database(self):
  names=expected_tables()
  self.assertEqual(len(names),19)
  self.assertIn("celebrations_participants",names)
  self.assertIn("public_media",names)
  self.assertEqual(
   verify_account_list({"success":True,
    "result":[{"name":"celebrations-exit-production","uuid":"00000000-0000-4000-8000-000000000002"}]},
    "celebrations-exit-production","00000000-0000-4000-8000-000000000001"),
   "00000000-0000-4000-8000-000000000002")
  with self.assertRaisesRegex(RuntimeError,"Unexpected production D1 UUID"):
   verify_account_list({"success":True,
    "result":[{"name":"celebrations-exit-production","uuid":"00000000-0000-4000-8000-000000000001"}]},
    "celebrations-exit-production","00000000-0000-4000-8000-000000000001")
  with self.assertRaisesRegex(RuntimeError,"exactly one"):
   verify_account_list({"success":True,"result":[]},
                       "celebrations-exit-production","00000000-0000-4000-8000-000000000001")


 def test_public_only_media_classification_preserves_image_gallery_and_invitation_links(self):
  # All identifiers/files are fabricated, no user data or actual Storage reads.
  contents=[
    {"id":"event","content_type":"PDF","storage_path":"media/visible.pdf"},
    {"id":"home","content_type":"Texte","category":"Accueil","storage_path":"media/home.pdf"},
    {"id":"gallery","content_type":"Image","source_type":"file","storage_path":"media/picture.png"},
    {"id":"cover","content_type":"PDF","has_cover":True,"cover_storage_path":"media/cover.png"},
    {"id":"illustration","content_type":"Image","source_type":"link","storage_path":"media/manual.png"},
    {"id":"unplaced","content_type":"PDF","storage_path":"media/admin-only.pdf"}
  ]
  events=[{"id":"event-1"}]
  event_links=[{"event_id":"event-1","content_id":"event"}]
  links=[{"link_type":"event-illustration","url":"content:illustration"}]
  letters=[{"storage_path":"committee/letter.pdf"}]
  files={name:5 for name in ["media/visible.pdf","media/home.pdf","media/picture.png",
     "media/cover.png","media/manual.png","media/admin-only.pdf",
     "committee/letter.pdf","media/hero.jpg"]}
  result=asset_audit(contents,event_links,[],events,links,letters,files,{"media/hero.jpg"})
  self.assertEqual(result["definitely_public_cards"],5)
  self.assertEqual(result["program_linked_cards"],1)
  self.assertEqual(result["accueil_cards"],1)
  self.assertEqual(result["gallery_candidate_cards"],2)
  self.assertEqual(result["physically_present_protected_objects"],7)
  self.assertEqual(result["storage_objects_needing_manual_review"],1)
  self.assertEqual(result["destructive_deletions"],0)
  self.assertFalse(result["review_candidates_are_safe_to_delete_automatically"])
  with self.assertRaisesRegex(ValueError,"missing content card"):
   asset_audit(contents,[{"event_id":"event-1","content_id":"unknown"}],[],
               events,links,letters,files)


 def test_selected_private_r2_paths_are_disjoint_from_review_only(self):
  cards=[
   {"id":"one","content_type":"PDF","storage_path":"media/event.pdf"},
   {"id":"two","content_type":"Image","source_type":"file","storage_path":"media/gallery.jpg"},
   {"id":"home","category":"Accueil","storage_path":"media/welcome.jpg"},
   {"id":"admin","content_type":"PDF","storage_path":"media/admin-only.pdf"}
  ]
  inv={k:5 for k in ("media/event.pdf","media/gallery.jpg","media/welcome.jpg",
                     "media/admin-only.pdf","committee/private.pdf")}
  summary, partition=asset_audit(cards,[{"event_id":"e","content_id":"one"}],
       [],[{"id":"e"}],[],[{"storage_path":"committee/private.pdf"}],
       inv,return_sets=True)
  self.assertEqual(partition["selected"],
                   {"media/event.pdf","media/gallery.jpg","media/welcome.jpg","committee/private.pdf"})
  self.assertEqual(partition["review"],{"media/admin-only.pdf"})
  self.assertEqual(len(partition["missing"]),0)
  self.assertEqual(summary["destructive_deletions"],0)


 def test_r2_rest_list_reads_all_pages_and_preserves_slashes_in_object_paths(self):
  from unittest.mock import Mock
  fake=Mock()
  def answer(url,params=None,timeout=None):
   obj=Mock()
   obj.status_code=200
   if params:
    obj.json.return_value={"success":True,"result":[{"key":"media/photo.jpg","size":42}],
      "result_info":{"is_truncated":False}}
   else:
    obj.json.return_value={"success":True,"result":[{"key":"committee/one.pdf","size":24}],
      "result_info":{"is_truncated":True,"cursor":"synthetic-next"}}
   return obj
  fake.get.side_effect=answer
  result=rest_objects(fake,"00000000000000000000000000000001")
  self.assertEqual(result,{"committee/one.pdf":24,"media/photo.jpg":42})
  self.assertEqual(fake.get.call_count,2)
  fake.put.assert_not_called()
  self.assertTrue(object_url("00000000000000000000000000000001","media/path with spaces.pdf").endswith(
    "/media/path%20with%20spaces.pdf"))
  fake.get.side_effect=lambda *args,**kwargs:Mock(status_code=403)
  with self.assertRaisesRegex(RuntimeError,"LIST_DENIED"):
    rest_objects(fake,"00000000000000000000000000000001")


 def test_scoped_prod_r2_credential_guard_prevents_reusing_staging_access(self):
  import os
  from unittest.mock import patch
  with patch.dict(os.environ,{"STAGING_R2_ACCESS_KEY_ID":"staging-key",
      "STAGING_R2_SECRET_ACCESS_KEY":"staging-secret",
      "CELEBRATIONS_PROD_R2_ACCESS_KEY_ID":"production-only-key",
      "CELEBRATIONS_PROD_R2_SECRET_ACCESS_KEY":"production-only-secret"}):
   self.assertEqual(credentials_for("STAGING"),("staging-key","staging-secret"))
   self.assertEqual(credentials_for("PROD"),("production-only-key","production-only-secret"))
   with self.assertRaisesRegex(ValueError,"Unexpected"):
    credentials_for("OTHER")
  with patch.dict(os.environ,{"STAGING_R2_ACCESS_KEY_ID":"staging-key",
      "STAGING_R2_SECRET_ACCESS_KEY":"staging-secret",
      "CELEBRATIONS_PROD_R2_ACCESS_KEY_ID":"staging-key",
      "CELEBRATIONS_PROD_R2_SECRET_ACCESS_KEY":"staging-secret"}):
   with self.assertRaisesRegex(ValueError,"improperly reused"):
    credentials_for("PROD")


 def test_production_public_core_whitelist_and_order_are_safe(self):
  self.assertEqual(len(PUBLIC_TABLES),9)
  self.assertEqual(sum(COUNTS.values()),456)
  self.assertEqual(PUBLIC_TABLES[0],"celebrations_celebrations")
  self.assertEqual(PUBLIC_TABLES[-1],"celebrations_step_contents")
  self.assertEqual(canonical({"has_cover":True,"text":"C'est l'été"}),{"has_cover":1,"text":"C'est l'été"})
  with self.assertRaisesRegex(ValueError,"Duplicate"):
   signatures("celebrations_contents",[{"id":"a"},{"id":"a"}])
  with self.assertRaisesRegex(ValueError,"nested"):
   canonical({"name":{"x":1}})
  with self.assertRaisesRegex(ValueError,"NUL"):
   canonical({"name":"unsafe"+chr(0)+"value"})
  with self.assertRaisesRegex(ValueError,"Inconsistent"):
   column_names([{"id":"a"},{"id":"b","bad":"c"}])

 def test_production_public_core_json_batch_can_roundtrip_unicode_quotes_and_booleans(self):
  from unittest.mock import Mock
  conn=sqlite3.connect(":memory:")
  conn.execute('CREATE TABLE celebrations_groups("id" TEXT PRIMARY KEY, "name" TEXT, "sort_order" INTEGER, "is_system" INTEGER)')
  class FakeCF:
   def post(self,endpoint,json=None,timeout=None):
    self_obj=Mock()
    self_obj.raise_for_status.return_value=None
    sql=json["sql"]
    before=conn.total_changes
    conn.execute(sql,json.get("params",[]))
    written=conn.total_changes-before
    self_obj.json.return_value={"success":True,"result":[{
     "success":True,"results":[],"meta":{"rows_read":0,"rows_written":written}
    }]}
    return self_obj
  values=[
   {"id":"a","name":"L'été d'aujourd'hui","sort_order":1,"is_system":True},
   {"id":"b","name":"Préparation — 守護","sort_order":2,"is_system":False}
  ]
  count,writes=insert_rows(FakeCF(),"https://cloudflare.invalid/query","celebrations_groups",values)
  self.assertEqual((count,writes),(2,2))
  self.assertEqual(conn.execute('SELECT id,name,sort_order,is_system FROM celebrations_groups ORDER BY sort_order').fetchall(),
   [("a","L'été d'aujourd'hui",1,1),("b","Préparation — 守護",2,0)])
  conn.close()


 def test_private_media_allowlist_keeps_slugged_committee_pdfs_separate(self):
  # Missing composite key fields fail closed with a scrubbed ValueError.
  a={"storage_path":"media/sample.jpg","approved":1,"approved_at":None,"revoked_at":None}
  b={"slug":"sample-invitation-uuid","storage_path":"committee/private.pdf",
     "published":1,"created_at":"2026-10-21T00:00:00Z","revoked_at":None}
  self.assertEqual(len(canonical_acl("public_media",[a])),1)
  self.assertEqual(len(canonical_acl("committee_media",[b])),1)
  with self.assertRaisesRegex(ValueError,"Duplicate"):
   canonical_acl("committee_media",[b,b])
  with self.assertRaisesRegex(ValueError,"Duplicate"):
   canonical_acl("public_media",[{"approved":1}])
  with self.assertRaisesRegex(ValueError,"Unapproved"):
   insert_acl(Mock(),"https://cloudflare.invalid","celebrations_clicks",[a])
  conn=sqlite3.connect(":memory:")
  conn.execute('CREATE TABLE public_media(storage_path TEXT PRIMARY KEY, approved INTEGER, approved_at TEXT, revoked_at TEXT)')
  class SafeFakeCF:
   def post(self,endpoint,json=None,timeout=None):
    response=Mock()
    response.raise_for_status.return_value=None
    before=conn.total_changes
    conn.execute(json["sql"],json["params"])
    response.json.return_value={"success":True,"result":[
      {"success":True,"results":[],"meta":{"rows_read":0,"rows_written":conn.total_changes-before}}
    ]}
    return response
  self.assertEqual(insert_acl(SafeFakeCF(),"https://cloudflare.invalid","public_media",[a]),1)
  self.assertEqual(conn.execute('SELECT storage_path,approved FROM public_media').fetchall(),
    [("media/sample.jpg",1)])
  conn.close()


 def test_account_hashes_are_not_replayable_and_sessions_excluded(self):
  import hashlib
  src={
   "email":"example@invalid.test","password_salt":"0123456789abcdef0123456789abcdef",
   "password_hash":"a"*64,"answer_1_hash":"b"*64,"answer_2_hash":"c"*64,
   "question_1":"first_school","question_2":"fictional_character",
   "answer_1_salt":"z"*32,"answer_2_salt":"x"*32,
   "recovery_failed_count":0,"recovery_locked_until":None,
   "created_at":"2026-09-01T00:00:00Z","registered_at":"2026-09-01T00:00:00Z",
   "updated_at":"2026-09-01T00:00:00Z","audience":"all"
  }
  dst=converted_participant(src)
  self.assertEqual(dst["password_salt"],"client180:"+src["password_salt"])
  for name in ("password_hash","answer_1_hash","answer_2_hash"):
   self.assertEqual(dst[name],hashlib.sha256(src[name].encode("ascii")).hexdigest())
   self.assertNotEqual(dst[name],src[name])
  self.assertEqual(src["password_hash"],"a"*64)
  self.assertEqual(EXPECTED_PRIVATE,{"celebrations_participants":1,
                                    "celebrations_footer_drafts":0,
                                    "celebrations_user_profiles":0})
  with self.assertRaisesRegex(ValueError,"Unexpected"):
   converted_participant({**src,"password_salt":"client180:another-salt"})
  with self.assertRaisesRegex(ValueError,"Unexpected"):
   converted_participant({**src,"answer_2_hash":"not-a-hash"})

 def test_stats_preserve_all_fields_and_timestamp_instant(self):
  from scripts.import_historic_stats_production_d1 import COLUMNS
  row={c:None for c in COLUMNS}
  row.update({"id":-3,"clicked_at":"2026-10-21T16:00:00+00:00","target_kind":"page-view"})
  same={**row,"clicked_at":"2026-10-21T18:00:00+02:00"}
  self.assertTrue(equal_row(row,same))
  self.assertFalse(equal_row(row,{**same,"visitor_id":"changed"}))
  self.assertFalse(equal_row(row,{**same,"clicked_at":"not a date"}))
  self.assertFalse(equal_row(row,{**same,"id":-4}))

 def test_private_stats_sql_write_only_whitelisted_table_and_json_params(self):
  from scripts.import_historic_stats_production_d1 import COLUMNS
  from unittest.mock import Mock
  conn=sqlite3.connect(":memory:")
  conn.execute('CREATE TABLE celebrations_clicks ("id" INTEGER PRIMARY KEY,'+
      ','.join('"'+c+'" TEXT' for c in COLUMNS if c!="id")+')')
  class CF:
   def post(self,endpoint,json=None,timeout=None):
    x=Mock()
    x.raise_for_status.return_value=None
    before=conn.total_changes
    conn.execute(json["sql"],json["params"])
    x.json.return_value={"success":True,"result":[
        {"success":True,"results":[],"meta":{"rows_read":0,"rows_written":conn.total_changes-before}}
    ]}
    return x
  click={c:None for c in COLUMNS}
  click.update({"id":-7,"clicked_at":"2026-10-21T00:00:00Z",
                "target_kind":"page-view","visitor_id":"synthetic-visitor"})
  self.assertEqual(insert_clicks(CF(),"https://cloudflare.invalid/query",[click]),1)
  self.assertEqual(conn.execute('SELECT id,visitor_id FROM celebrations_clicks').fetchall(),[(-7,"synthetic-visitor")])
  conn.close()


 def test_public_drive_pdf_recovery_refuses_html_or_size_mismatch(self):
  from unittest.mock import patch,Mock
  good=(b"%PDF-1.7\\n"+b"0"*(DRIVE_PDF_EXPECTED_BYTES-len(b"%PDF-1.7\\n")-len(b"\\n%%EOF"))+b"\\n%%EOF")
  self.assertEqual(len(good),DRIVE_PDF_EXPECTED_BYTES)
  response=Mock()
  response.url="https://drive.usercontent.google.com/download?id=synthetic"
  response.content=good
  response.raise_for_status.return_value=None
  session=Mock()
  session.get.return_value=response
  with patch("scripts.recover_one_missing_public_pdf_to_private_production.requests.Session",return_value=session):
   self.assertEqual(get_file_from_public_drive(),good)
   response.content=b"<html>"+b"X"*(DRIVE_PDF_EXPECTED_BYTES-6)
   with self.assertRaisesRegex(ValueError,"not a complete PDF"):
    get_file_from_public_drive()
   response.content=good[:-1]
   with self.assertRaisesRegex(ValueError,"length"):
    get_file_from_public_drive()
   response.content=good
   response.url="https://unapproved.invalid"
   with self.assertRaisesRegex(ValueError,"Unrecognized"):
    get_file_from_public_drive()

if __name__=="__main__":unittest.main()
