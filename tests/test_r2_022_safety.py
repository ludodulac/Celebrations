import unittest
from scripts.r2_022_classify import classify,report
from scripts.r2_022_safe_sync_plan import compare,safe_summary
class TestSafety(unittest.TestCase):
 def test_unreferenced_never_public(self):
  self.assertEqual(classify({"path":"committee/a.pdf","references":[]})[0],"UNREFERENCED")
 def test_global_audience_not_public_authorization(self):
  self.assertEqual(classify({"path":"media/a.mp3","references":[{"audience":"all"}]})[0],"UNCERTAIN")
 def test_restricted_audience(self):
  self.assertEqual(classify({"path":"media/a.mp3","references":[{"audience":"angel"}]})[0],"RESTRICTED_CONFIRMED")
 def test_http_success_not_authorization(self):
  self.assertEqual(classify({"path":"media/a.mp3","references":[],"unauthenticated_direct_access":{"status":206}})[0],"UNREFERENCED")
 def test_idempotent_and_conflict(self):
  x=compare({"a":"hash1","b":"hash2"},{"a":"hash1","b":"different","orphan":"hash3"})
  self.assertEqual(safe_summary(x),{"CONFLICT_STOP":1,"ORPHAN_REVIEW_NO_DELETE":1,"SKIP_IDENTICAL":1})
 def test_no_delete_when_missing_source(self):
  self.assertEqual(compare({},{"sensitive":"hash"})[0]["action"],"ORPHAN_REVIEW_NO_DELETE")
 def test_report_total(self):
  x=report({"files":[{"path":"committee/secret.pdf","references":[]}]})
  self.assertEqual(x["counts"]["PUBLIC_CONFIRMED"],0)
  self.assertEqual(x["counts"]["UNREFERENCED"],1)
if __name__=="__main__":unittest.main()
