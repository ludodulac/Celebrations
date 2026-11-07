#!/usr/bin/env python3
"""Read-only public Michael preparation layout audit from the shared editor snapshot.
Never prints private draft text, private URLs or credentials.
"""
import os,json,hashlib,collections,urllib.parse,boto3
from botocore.config import Config
e=os.environ
assert e["STAGING_R2_BUCKET"]=="celebrations-exit-staging"
s=boto3.client("s3",region_name="auto",endpoint_url=e["R2_ENDPOINT"],
  aws_access_key_id=e["STAGING_R2_ACCESS_KEY_ID"],
  aws_secret_access_key=e["STAGING_R2_SECRET_ACCESS_KEY"],
  config=Config(retries={"max_attempts":2,"mode":"standard"}))
blob=s.get_object(Bucket=e["STAGING_R2_BUCKET"],Key="editor-trials/server-drafts-v1.json")["Body"].read()
state=json.loads(blob)
def page(area):
 return next((p for p in area.get("pages",[]) if p.get("id")=="preparation-101"),None)
published=page(state.get("published",{}).get("drafts",{}).get("101",{}))
draft=page(state.get("drafts",{}).get("101",{}))
assert published and draft, "Michael preparation must exist in BOTH draft and public"
def flatten(items):
 for x in items:
  if x.get("kind")=="section":
   for i,col in enumerate(x.get("columns",[])):
    for item in flatten(col):
     yield ("col"+str(i),item)
  else:yield ("root",x)
def descriptor(x):
 kind=x.get("kind","unknown")
 name=str(x.get("text") or x.get("name") or "").replace("\n"," ").strip()
 name=" ".join(name.split())[:145]
 asset=x.get("src") or x.get("href") or x.get("cover") or ""
 ext=urllib.parse.urlsplit(str(asset)).path.split("/")[-1].lower()
 if len(ext)>40:ext=ext[-40:]
 suffix=(" -> "+(ext or "(aucune)")) if asset else ""
 return f"{kind} [{x.get('id')}] {name}{suffix}"
print("MICHAEL_PUBLIC_PREPARATION_SNAPSHOT",json.dumps({
 "version":state.get("version"),"published_at":state.get("publishedAt"),
 "snapshot_digest":hashlib.sha256(blob).hexdigest()[:12],
 "published_root_blocks":len(published["blocks"]),"draft_root_blocks":len(draft["blocks"]),
 "draft_identical_to_published":draft["blocks"]==published["blocks"]},ensure_ascii=False))
total=collections.Counter()
for i,b in enumerate(published["blocks"]):
 if b.get("kind")=="section":
  print(f"GROUP {i}: section {b.get('layout')} id={b.get('id')}, children={list(map(len,b.get('columns',[])))}")
  for j,col in enumerate(b.get("columns",[])):
   for child in col:
    total[child.get("kind")]+=1
    print("   ",j,descriptor(child))
 else:
  total[b.get("kind")]+=1
  print(f"ITEM {i}: {descriptor(b)}")
print("MICHAEL_PUBLIC_KINDS",json.dumps(total,ensure_ascii=False))
