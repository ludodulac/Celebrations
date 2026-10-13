import unittest,io,sys,types
from unittest.mock import Mock
try:
 import requests,boto3
except ImportError:
 requests=types.ModuleType("requests");boto3=types.ModuleType("boto3")
 sys.modules["requests"]=requests;sys.modules["boto3"]=boto3
 from types import ModuleType
 b=ModuleType("botocore");e=ModuleType("botocore.exceptions");e.ClientError=type("ClientError",(Exception,),{});c=ModuleType("botocore.config");c.Config=lambda **kw:None
 sys.modules.update({"botocore":b,"botocore.exceptions":e,"botocore.config":c})
from scripts.r2_023_sync import sync_one,Conflict,execute
class Response:
 def __enter__(self):return self
 def __exit__(self,*a):pass
 def raise_for_status(self):pass
 def iter_content(self,chunk_size):yield b"hello"
class Body:
 def iter_chunks(self,chunk_size):yield b"hello"
 def close(self):pass
class Tests(unittest.TestCase):
 def setUp(self):
  self.s=Mock();self.s.get.return_value=Response()
  self.r=Mock();self.r.get_object.return_value={"Body":Body()}
  self.sha="2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
 def test_dry_run_no_copy(self):
  self.assertEqual(sync_one(self.s,self.r,"https://x","a.mp3",5,{},False),"WOULD_COPY")
  self.r.put_object.assert_not_called()
 def test_real_copy_requires_opt_in_at_entrypoint(self):
  import inspect
  from scripts import r2_023_sync as m
  self.assertIn('CONFIRM_COPY',inspect.getsource(m.main))
 def test_new_copy_and_verification(self):
  self.assertEqual(sync_one(self.s,self.r,"https://x","a.mp3",5,{},True),"COPIED_VERIFIED")
  self.assertEqual(self.r.put_object.call_args.kwargs["IfNoneMatch"],"*")
  self.r.get_object.assert_called_once()
 def test_identical_idempotent(self):
  self.assertEqual(sync_one(self.s,self.r,"https://x","a.mp3",5,{"a.mp3":5},True),"IDENTICAL")
  self.r.put_object.assert_not_called()
 def test_size_conflict(self):
  with self.assertRaises(Conflict):sync_one(self.s,self.r,"https://x","a.mp3",5,{"a.mp3":4},True)
 def test_download_failure(self):
  self.s.get.side_effect=RuntimeError("download")
  with self.assertRaises(RuntimeError):sync_one(self.s,self.r,"https://x","a.mp3",5,{},True)
  self.r.put_object.assert_not_called()
 def test_upload_failure(self):
  self.r.put_object.side_effect=RuntimeError("upload")
  with self.assertRaises(RuntimeError):sync_one(self.s,self.r,"https://x","a.mp3",5,{},True)
 def test_hash_failure(self):
  self.r.get_object.return_value={"Body":Mock(iter_chunks=lambda chunk_size:iter([b"wrong"]),close=lambda:None)}
  with self.assertRaises(Conflict):sync_one(self.s,self.r,"https://x","a.mp3",5,{},True)
 def test_retry_after_copy(self):
  self.assertEqual(sync_one(self.s,self.r,"https://x","a.mp3",5,{"a.mp3":5},True),"IDENTICAL")
 def test_no_delete_apis(self):
  import inspect
  from scripts import r2_023_sync as m
  source=inspect.getsource(m)
  self.assertNotIn("delete_object(",source)
  self.assertNotIn("delete_objects(",source)
if __name__=="__main__":unittest.main()
