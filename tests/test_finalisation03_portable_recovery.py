"""Offline tests of portable encrypted media manifest and disaster recovery."""
import os
import pathlib
import sys
import tempfile
import unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/"scripts"))
from finalisation03_portable_recovery import Portable

class TestPortable(unittest.TestCase):
    def build(self, root):
        return Portable(root, b"x"*48)
    def test_same_bytes_deduplicate(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=self.build(tmp)
            p.store_bytes("staging/a.jpg",b"the same data"*1500)
            p.store_bytes("production/a.jpg",b"the same data"*1500)
            p.store_bytes("staging/b.txt",b"entirely different")
            data=p.finalize()
            self.assertEqual(len(data["r2"]),3)
            self.assertEqual(data["r2"][0]["stored_index"],data["r2"][1]["stored_index"])
            result=p.restore_verify()
            self.assertEqual(result["originals_verified"],3)
            self.assertEqual(result["distinct_contents_verified"],2)
    def test_corruption_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=self.build(tmp)
            p.store_bytes("staging/test.mp3",os.urandom(8192))
            data=p.finalize()
            self.assertTrue(p.restore_verify()["all_sha256_equal"])
            path=pathlib.Path(tmp)/data["r2"][0]["parts"][0]["name"]
            damaged=bytearray(path.read_bytes());damaged[-1]^=1
            path.write_bytes(damaged)
            with self.assertRaises(ValueError):
                p.restore_verify()
    def test_wrong_passphrase_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=self.build(tmp)
            p.store_bytes("staging/editor",b'{"version":12}')
            p.finalize()
            wrong=Portable(tmp,b"y"*48,salt=p.salt)
            with self.assertRaises(Exception):
                wrong.restore_verify()
    def test_tampered_manifest_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=self.build(tmp)
            p.store_bytes("sample",b"abc")
            p.finalize()
            path=pathlib.Path(tmp)/"manifest.cbackup"
            damaged=bytearray(path.read_bytes());damaged[-3]^=4
            path.write_bytes(damaged)
            with self.assertRaises(Exception):
                p.restore_verify()
if __name__=="__main__":unittest.main()
