#!/usr/bin/env python3
"""Read-only D1 programme PDF provenance check. No substitution, no writes."""
import os,json,requests
account=os.environ["CLOUDFLARE_ACCOUNT_ID"];token=os.environ["CLOUDFLARE_API_TOKEN"];db=os.environ["STAGING_D1_ID"]
root="https://api.cloudflare.com/client/v4"
headers={"Authorization":"Bearer "+token}
r=requests.get(f"{root}/accounts/{account}/d1/database/{db}",headers=headers,timeout=30);r.raise_for_status()
meta=r.json()
if not meta.get("success") or meta["result"].get("name")!="celebrations-exit-staging" or meta["result"].get("uuid")!=db:raise RuntimeError("Unexpected database")
sql="""SELECT id,name,content_type,source_type,storage_path,external_url,file_name,mime_type,description
FROM celebrations_contents WHERE lower(name) LIKE '%pardon%' OR lower(file_name) LIKE '%pardon%' OR lower(storage_path) LIKE '%pardon%' ORDER BY id"""
r=requests.post(f"{root}/accounts/{account}/d1/database/{db}/query",headers=headers,json={"sql":sql},timeout=30);r.raise_for_status()
result=r.json()
if not result.get("success"):raise RuntimeError("D1 query failed")
rows=result["result"][0]["results"]
# This prints names and storage paths only for the known public title; never participant data.
for row in rows:
 print("PARDON_PDF_CANDIDATE "+json.dumps(row,ensure_ascii=False),flush=True)
print("PARDON_PDF_PROVENANCE "+json.dumps({"matching_records":len(rows),"verified_replacement":False,"remote_writes":0}),flush=True)
