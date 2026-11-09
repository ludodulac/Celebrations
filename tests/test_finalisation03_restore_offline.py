"""Offline disk restoration regression — never touches remote services."""
import pathlib,sys,tempfile,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/"scripts"))
from finalisation03_portable_recovery import Portable
from finalisation03_restore_offline import restore
class Tests(unittest.TestCase):
 def test_exact_disk_bytes_and_no_overwrite(self):
  with tempfile.TemporaryDirectory() as root:
   backup=pathlib.Path(root)/"encrypted"
   target=pathlib.Path(root)/"restored"
   p=Portable(backup,b"y"*48)
   for i in range(124):
    name="celebrations-exit-staging/media/pièce-%03d.jpg"%i
    p.store_bytes(name,("contenu%03d"%i).encode()*90)
   p.finalize()
   n=restore(backup,target,b"y"*48,check_d1=False)
   self.assertEqual(n,124)
   self.assertEqual((target/"celebrations-exit-staging/media/pièce-012.jpg").read_bytes(),
      ("contenu012").encode()*90)
   with self.assertRaises(FileExistsError):
    restore(backup,target,b"y"*48,check_d1=False)
 def test_source_path_traversal(self):
  from finalisation03_restore_offline import destination
  with tempfile.TemporaryDirectory() as root:
   for bad in ["../unsafe","/absolute","r2/../../private","bucket/../file","a\\b/c"]:
    with self.assertRaises(ValueError):
     destination(pathlib.Path(root),bad)
if __name__=="__main__":unittest.main()
