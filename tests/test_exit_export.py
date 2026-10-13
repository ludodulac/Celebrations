import unittest,tempfile,pathlib,json,sqlite3
from unittest.mock import Mock
from migration.export_celebrations_readonly import fetch_table,export,TABLES
class TestExport(unittest.TestCase):
 def test_pagination(self):
  s=Mock();a=Mock();a.json.return_value=[{"id":1},{"id":2}];b=Mock();b.json.return_value=[{"id":3}]
  s.get.side_effect=[a,b]
  self.assertEqual(list(fetch_table(s,"https://example","celebrations_contents",2)),[{"id":1},{"id":2},{"id":3}])
  self.assertEqual(s.get.call_count,2)
 def test_all_tables_included(self):
  self.assertEqual(len(TABLES),16)
  self.assertIn("celebrations_committee_letters",TABLES)
  self.assertIn("celebrations_participants",TABLES)
 def test_private_output_and_no_overwrite(self):
  s=Mock();r=Mock();r.json.return_value=[];s.get.return_value=r
  with tempfile.TemporaryDirectory() as d:
   p=pathlib.Path(d)/"private"
   m=export(s,"https://example",p)
   self.assertTrue(m["complete"])
   self.assertEqual(len(m["tables"]),16)
   self.assertEqual((p/"manifest.json").stat().st_mode & 0o777,0o600)
   with self.assertRaises(RuntimeError):export(s,"https://example",p)
 def test_acl_schema_deny_by_default(self):
  sql=pathlib.Path("migration/cloudflare/media-acl.sql").read_text()
  db=sqlite3.connect(":memory:");db.executescript(sql)
  db.execute("INSERT INTO public_media(storage_path) VALUES (?)",("media/example",))
  db.execute("INSERT INTO committee_media(slug,storage_path) VALUES (?,?)",("slug","committee/example"))
  self.assertEqual(db.execute("SELECT approved FROM public_media").fetchone()[0],0)
  self.assertEqual(db.execute("SELECT published FROM committee_media").fetchone()[0],0)
if __name__=="__main__":unittest.main()
