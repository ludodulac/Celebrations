#!/usr/bin/env python3
"""Build a SAFE historic site asset tree from pinned main: HTML/JS/CSS/media only.

Never deploy the Git checkout itself as a static directory: .git, workflows,
private maintenance scripts/tests and repository internals must not be served.
"""
from pathlib import Path
from shutil import copy2
import subprocess,sys
PIN="4b5edd9c19ce989af2eae33445017dd30fcbbe92"
SOURCE=Path("legacy-main")
DEST=Path("legacy-assets")
PUBLIC_DIRS={
 "apres-celebration","apres-la-ronde","bibliotheque","dimanche",
 "jeudi","mercredi","programme","samedi","vendredi"
}
WEB_EXT={".html",".css",".js",".jpg",".jpeg",".png",".webp",".gif",".svg",".ico",".pdf",".woff",".woff2",".mp3",".mp4",".wav"}
def main():
 if subprocess.check_output(["git","-C",str(SOURCE),"rev-parse","HEAD"],text=True).strip()!=PIN:
  raise ValueError("Unexpected public snapshot")
 if DEST.exists():raise ValueError("Refusing dirty public assets output")
 copied=0
 for p in SOURCE.rglob("*"):
  if not p.is_file():continue
  rel=p.relative_to(SOURCE)
  if p.is_symlink():raise ValueError("Public assets source contains symlink")
  if any(x.startswith(".") for x in rel.parts):continue
  if len(rel.parts)>1 and rel.parts[0] not in PUBLIC_DIRS:continue
  if p.suffix.lower() not in WEB_EXT:continue
  q=DEST/rel;q.parent.mkdir(parents=True,exist_ok=True)
  copy2(p,q);copied+=1
 for required in ["index.html","admin.html","styles.css","admin-committee-links.js",
                  "programme/index.html","mercredi/index.html",
                  "jeudi/index.html","vendredi/index.html","samedi/index.html",
                  "dimanche/index.html","apres-celebration/index.html"]:
  if not (DEST/required).is_file():raise ValueError("Missing required historic page")
 if copied<65 or copied>300:raise ValueError("Unexpected original public asset count")
 assert not any((DEST/x).exists() for x in [".git",".github","scripts","tests","migration"])
 print("MISSION06_SAFE_STATIC_ASSETS_READY pages_and_assets="+str(copied)+
       " original_main_pinned=YES git_metadata_excluded=YES")
if __name__=="__main__":
 try:main()
 except BaseException as e:
  print("MISSION06_SAFE_STATIC_ASSETS_STOP category="+type(e).__name__,file=sys.stderr)
  sys.exit(1)
