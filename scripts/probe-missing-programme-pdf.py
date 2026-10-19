#!/usr/bin/env python3
"""Read-only check for one missing programme PDF; no replacement by filename alone."""
import os,json,requests
from urllib.parse import quote
url=os.environ["SUPABASE_URL"].rstrip("/")
key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
path="media/pdf-1789466878259-22-9vktt/file-1789466879911-Pardon-des-Offenses-version-raccourcie.pdf"
session=requests.Session();session.headers.update({"apikey":key,"Authorization":"Bearer "+key})
checks={}
for label,endpoint in {
 "authenticated_storage":f"{url}/storage/v1/object/authenticated/celebrations-media/{quote(path,safe='/')}",
 "public_storage":f"{url}/storage/v1/object/public/celebrations-media/{quote(path,safe='/')}"
}.items():
 try:
  r=session.get(endpoint,headers={"Range":"bytes=0-0"},timeout=30,stream=True)
  checks[label]={"status":r.status_code,"content_type":r.headers.get("content-type"),"content_range":r.headers.get("content-range")}
  r.close()
 except requests.RequestException as e:checks[label]={"error_type":type(e).__name__}
print("MISSING_PDF_SOURCE_PROBE "+json.dumps({"path":path,"checks":checks,"read_only":True,"replacement_verified":False},ensure_ascii=False))
if any(v.get("status") in (200,206) for v in checks.values()):print("PDF_RECOVERABLE_FROM_SUPABASE")
else:print("PDF_NOT_ACCESSIBLE_AT_CANONICAL_PATH: do not substitute homonym without hash or content verification")
