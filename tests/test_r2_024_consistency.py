import unittest
from scripts.r2_024_consistency import certify_snapshot,SourceChanged,classify_destination
class Test024(unittest.TestCase):
 def test_consistent_snapshot(self):
  x=certify_snapshot({"etag":"v1"},b"abc",{"etag":"v1"},b"abc")
  self.assertTrue(x["certified_snapshot"])
 def test_concurrent_change(self):
  with self.assertRaises(SourceChanged):certify_snapshot({"etag":"v1"},b"abc",{"etag":"v2"},b"abc")
 def test_concurrent_delete(self):
  with self.assertRaises(SourceChanged):certify_snapshot({"etag":"v1"},b"abc",None,b"abc")
 def test_changed_bytes(self):
  with self.assertRaises(SourceChanged):certify_snapshot({"etag":"v1"},b"abc",{"etag":"v1"},b"abd")
 def test_missing_version(self):
  with self.assertRaises(SourceChanged):certify_snapshot({},b"abc",{},b"abc")
 def test_interruption_no_final_proof(self):
  with self.assertRaises(SourceChanged):certify_snapshot({"etag":"v1"},b"abc",{"etag":"v1"})
 def test_r2_conflict(self):
  with self.assertRaises(SourceChanged):classify_destination("a","b",True)
 def test_resume_identical(self):
  self.assertEqual(classify_destination("a","a",True),"SKIP_IDENTICAL")
if __name__=="__main__":unittest.main()
