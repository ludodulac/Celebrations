#!/usr/bin/env python3
"""Read-only inventory of Supabase remnants in generated Cloudflare assets.

Never scans user data, secrets, Git history, D1 or R2. This does not claim
that a textual reference is a live network request.
"""
from collections import defaultdict
from pathlib import Path
import re

root=Path(__file__).resolve().parents[1]
built=root/"production-public"
if not (built/"admin.html").is_file() or not (built/"index.html").is_file():
    raise SystemExit("MISSING_PRODUCTION_ASSET_BUILD")
needles={
    "supabase_host":re.compile(r"(?:supabase\\.co|storage\\.supabase\\.co)",re.I),
    "supabase_sdk":re.compile(r"@supabase/supabase-js|supabase-js@",re.I),
    "tus_sdk":re.compile(r"tus-js-client|tus\\.min\\.js",re.I),
}
hits=defaultdict(list)
for f in sorted(built.rglob("*")):
    if not f.is_file() or f.suffix not in {".html",".js",".css",".json"}:
        continue
    rel=str(f.relative_to(built))
    data=f.read_text(encoding="utf-8")
    for label,pattern in needles.items():
        count=len(pattern.findall(data))
        if count:
            hits[label].append((rel,count))
print("CLOUDFLARE_PRODUCTION_ASSETS_LEGACY_SOURCE_AUDIT")
for label in needles:
    files=hits[label]
    print(label,"files",len(files),"occurrences",sum(n for _,n in files))
    for path,count in files[:60]:
        print(" ",path,"count",count)
print("CLOUDFLARE_PRODUCTION_ASSETS_LEGACY_SOURCE_AUDIT_COMPLETE no_network=1 no_deploy=1")
