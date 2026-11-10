#!/usr/bin/env python3
"""Precise read-only public content audit ahead of title/caption clean-up.
Only fetches the public-page objects from the existing editor R2 snapshot.
No administrator private drafts or media bytes are logged; no writes.
"""
import json,os,urllib.parse
import boto3
from botocore.config import Config
e=os.environ
assert e["STAGING_R2_BUCKET"]=="celebrations-exit-staging"
s=boto3.client("s3",region_name="auto",endpoint_url=e["R2_ENDPOINT"],
 aws_access_key_id=e["STAGING_R2_ACCESS_KEY_ID"],aws_secret_access_key=e["STAGING_R2_SECRET_ACCESS_KEY"],
 config=Config(retries={"max_attempts":2,"mode":"standard"}))
obj=s.get_object(Bucket=e["STAGING_R2_BUCKET"],Key="editor-trials/server-drafts-v1.json")
state=json.loads(obj["Body"].read())
print("MICHAEL_CLEANUP_META",json.dumps({"revision":state["version"],"publishedAt":state.get("publishedAt")},ensure_ascii=False))
for day in ("jeudi","vendredi","samedi","dimanche"):
 id=day+"-101"
 ps=[x for x in state["published"]["drafts"]["101"]["pages"] if x["id"]==id]
 ds=[x for x in state["drafts"]["101"]["pages"] if x["id"]==id]
 assert len(ps)==len(ds)==1
 p,d=ps[0],ds[0]
 def flatten(blocks,section):
  for b in blocks:
   if b.get("kind")=="section":
    for col in b.get("columns",[]):
     yield from flatten(col,section)
   else:yield section,b
 leaves=[(section,leaf) for idx,root in enumerate(p["blocks"])
         for section,leaf in flatten([root],idx)]
 print("MICHAEL_CLEANUP_DAY",json.dumps({"day":day,"root":len(p["blocks"]),
   "leaves":len(leaves),"draft_published_equal":p["blocks"]==d["blocks"],
   "already_hidden":sum(b.get("hideOnSite") is True for _,b in leaves)},ensure_ascii=False))
 for section,b in leaves:
  text=str(b.get("text") or "")
  if b.get("kind") not in ("heading","text","button","video","audio"):continue
  href=str(b.get("href") or "")
  report={"day":day,"section":section,"id":b.get("id"),"kind":b.get("kind"),
      "text":text[:310],"rich":str(b.get("rich") or "")[:380],
      "hasRich":bool(b.get("rich")),"hideOnSite":bool(b.get("hideOnSite")),
      "displayAsButton":b.get("displayAsButton"),"host":urllib.parse.urlsplit(href).hostname or "",
      "hasAssetId":bool(b.get("assetId"))}
  print("MICHAEL_CLEANUP_ITEM",json.dumps(report,ensure_ascii=False))
