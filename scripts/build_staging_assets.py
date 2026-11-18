#!/usr/bin/env python3
"""Build isolated staging static assets; no credentials and no deployment."""
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"staging-public"
ALLOWED={".html",".css",".js",".png",".jpg",".jpeg",".webp",".svg",".ico",".gif",".woff",".woff2",".mp3",".ogg",".wav"}
SKIP={".git",".github","migration","tests","scripts","docs","node_modules","staging-public","production-public",".venv",
      "private-members","private-member","member-private","members-private","private-media"}
def main(output_dir=None):
 out = Path(output_dir) if output_dir is not None else OUT
 if out.exists():shutil.rmtree(out)
 out.mkdir()
 count=0
 for path in ROOT.rglob("*"):
  # Never copy protected future media into a public assets bundle.
  if not path.is_file() or any(p.lower() in SKIP or p.startswith(".") for p in path.relative_to(ROOT).parts):continue
  if path.suffix.lower() not in ALLOWED:continue
  if path.name.startswith(".") or path.name in {"package-lock.json","package.json"}:continue
  target=out/path.relative_to(ROOT)
  target.parent.mkdir(parents=True,exist_ok=True)
  shutil.copy2(path,target);count+=1
 # Isolated Cloudflare pages must never boot the legacy Supabase CDN SDK.
 sdk='<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
 for name in ("index.html","admin.html"):
  target=out/name
  html=target.read_text(encoding="utf-8")
  assert html.count(sdk)==1, f"Unexpected Supabase script tag in {name}"
  html=html.replace(sdk,"")
  if name=="index.html":
   original="https://jwyayfkssyagvnablttg.supabase.co/storage/v1/object/public/celebrations-media/media/1791723108110/file-1791723109615-1000040461.jpg"
   destination="/media/media/celebrations-staging-welcome-autumn-2026.jpg"
   assert html.count(original)==1, "Unexpected staging homepage illustration source"
   html=html.replace(original,destination)
  target.write_text(html,encoding="utf-8")
 bridge=out/"migration/cloudflare/preview-client.js"
 bridge.parent.mkdir(parents=True,exist_ok=True)
 shutil.copy2(ROOT/"migration/cloudflare/preview-client.js",bridge)
 # Same-origin Web Worker for WAV-to-MP3; encoder library is added separately
 # by scripts/bundle_staging_audio_encoder.mjs after npm installation.
 audio=out/"migration/cloudflare/editor-trial-audio-encoder-worker.js"
 audio.parent.mkdir(parents=True,exist_ok=True)
 shutil.copy2(ROOT/"migration/cloudflare/editor-trial-audio-encoder-worker.js",audio)

 assert (out/"index.html").exists() and (out/"admin.html").exists()
 print(f"Prepared {count+1} staging assets in {out}")
if __name__=="__main__":main()
