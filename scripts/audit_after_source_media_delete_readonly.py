#!/usr/bin/env python3
"""Read-only final evidence for owner-approved removal of 158 legacy files.
No private keys, paths, names, user records or source content in logs.
"""
import json,os,sys
import requests
ROOT="https://jwyayfkssyagvnablttg.supabase.co"
assert os.environ.get("GITHUB_REF")=="refs/heads/feat/celebrations-supabase-exit-001"
assert os.environ["SUPABASE_URL"].rstrip("/")==ROOT
s=requests.Session()
key=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
s.headers.update({"apikey":key,"Authorization":"Bearer "+key})
b=s.get(ROOT+"/storage/v1/bucket/celebrations-media",timeout=25)
all_buckets=s.get(ROOT+"/storage/v1/bucket",timeout=25)
all_buckets.raise_for_status()
data=all_buckets.json()
if isinstance(data,dict):
 data=data.get("buckets",data.get("data",[]))
assert isinstance(data,list)
ids={x.get("id") for x in data if isinstance(x,dict)}
remaining_preserved={"audios","studio-sounds","studio-projects","wikignose-pdfs","blog-images","images","rebulo-image-inbox"}
if not remaining_preserved.issubset(ids):raise RuntimeError("Non-Celebrations bucket disappeared")
c=s.post(ROOT+"/storage/v1/object/list/celebrations-media",json={"prefix":"","limit":100},timeout=25)
print("CELEBRATIONS_POST_SOURCE_STORAGE_READONLY "+json.dumps({
 "bucket_metadata_http":b.status_code,
 "bucket_in_storage_list":"celebrations-media" in ids,
 "non_celebrations_buckets_all_present":True,
 "retained_non_celebrations_buckets":len(remaining_preserved),
 "empty_or_removed_bucket_list_http":c.status_code,
 "zero_source_writes":True
},sort_keys=True))
if "celebrations-media" in ids:raise RuntimeError("Old bucket still exists; metadata cleanup incomplete")
