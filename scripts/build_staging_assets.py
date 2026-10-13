#!/usr/bin/env python3
"""Build isolated staging static assets; no credentials and no deployment."""
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"staging-public"
ALLOWED={".html",".css",".js",".png",".jpg",".jpeg",".webp",".svg",".ico",".gif",".woff",".woff2",".mp3",".ogg",".wav"}
SKIP={".git",".github","migration","tests","scripts","docs","node_modules","staging-public",".venv"}
def main():
 if OUT.exists():shutil.rmtree(OUT)
 OUT.mkdir()
 count=0
 for path in ROOT.rglob("*"):
  if not path.is_file() or any(p in SKIP or p.startswith(".") for p in path.relative_to(ROOT).parts):continue
  if path.suffix.lower() not in ALLOWED:continue
  if path.name.startswith(".") or path.name in {"package-lock.json","package.json"}:continue
  target=OUT/path.relative_to(ROOT)
  target.parent.mkdir(parents=True,exist_ok=True)
  shutil.copy2(path,target);count+=1
 bridge=OUT/"migration/cloudflare/preview-client.js"
 bridge.parent.mkdir(parents=True,exist_ok=True)
 shutil.copy2(ROOT/"migration/cloudflare/preview-client.js",bridge)
 assert (OUT/"index.html").exists() and (OUT/"admin.html").exists()
 print(f"Prepared {count+1} staging assets in {OUT}")
if __name__=="__main__":main()
