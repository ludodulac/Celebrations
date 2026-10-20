import unittest,tempfile,pathlib,json,sqlite3
from unittest.mock import Mock
from migration.export_celebrations_readonly import fetch_table,export,TABLES,PRIMARY_KEYS
from migration.stage_export_sqlite import stage
from migration.import_relational_sqlite import import_relational
from migration.encrypted_backup import encrypt_export, verify_encrypted_file
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
  self.assertNotIn("actions/upload-artifact@",workflow)
  self.assertNotIn("CLOUDFLARE_API_TOKEN",workflow)
  self.assertNotIn("wrangler",workflow)
  self.assertNotIn("workflow_dispatch",workflow.split("on:",1)[1].split("permissions:",1)[0])

if __name__=="__main__":unittest.main()
