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
 # Source HTML already uses the Cloudflare-only client and bootstrap.
 for name in ("index.html","admin.html"):
  html=(out/name).read_text(encoding="utf-8")
  assert "cdn.jsdelivr.net/npm/@supabase/supabase-js" not in html, f"Legacy SDK in {name}"
  assert "CELEBRATIONS_CLOUDFLARE_BACKEND" in html, f"Missing Cloudflare bootstrap in {name}"
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
