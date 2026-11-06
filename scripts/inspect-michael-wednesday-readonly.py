#!/usr/bin/env python3
"""Read-only structural inventory of published Michaël Wednesday, and only a
SHA equality check against the private working draft. Never exposes drafts."""
import os,json,hashlib,collections,urllib.parse,boto3
from botocore.config import Config
e=os.environ
assert e["STAGING_R2_BUCKET"]=="celebrations-exit-staging"
s=boto3.client("s3",region_name="auto",endpoint_url=e["R2_ENDPOINT"],
 aws_access_key_id=e["STAGING_R2_ACCESS_KEY_ID"],
 aws_secret_access_key=e["STAGING_R2_SECRET_ACCESS_KEY"],
 config=Config(retries={"max_attempts":2,"mode":"standard"}))
blob=s.get_object(Bucket=e["STAGING_R2_BUCKET"],
 Key="editor-trials/server-drafts-v1.json")["Body"].read()
state=json.loads(blob)
CID="101";PID="mercredi-101"
def find(container):
 return next((p for p in container.get("pages",[]) if p.get("id")==PID),None)
published=find(state["published"]["drafts"][CID])
draft=find(state["drafts"][CID])
assert published is not None, "Page publique mercredi-101 introuvable"
assert draft is not None, "Brouillon mercredi-101 introuvable"
def flatten(blocks):
 for x in blocks:
  if x.get("kind")=="section":
   for col in x.get("columns",[]):yield from flatten(col)
  else:yield x
def describe(b):
 kind=b.get("kind","?");id=b.get("id","?")
 title=" ".join(str(b.get("text") or b.get("name") or "").split())
 if len(title)>260:title=title[:260]+"…"
 u=str(b.get("href") or b.get("src") or b.get("cover") or "")
 host=urllib.parse.urlsplit(u).netloc if u else ""
 typepath=urllib.parse.urlsplit(u).path if u else ""
 ext=typepath.rsplit(".",1)[-1].lower() if "." in typepath[-7:] else ""
 attrs={k:b[k] for k in ("widthPct","align","displayAsButton","hideOnSite","atTime","remoteKey")
         if k in b and k!="remoteKey"}
 return {"id":id,"type":kind,"title":title,"host":host,"ext":ext,"attrs":attrs}
print("WEDNESDAY_AUDIT_META "+json.dumps({
 "page_id":PID,"page_name":published.get("name"),"visibility":published.get("visibility"),
 "published_root_blocks":len(published["blocks"]),"draft_root_blocks":len(draft["blocks"]),
 "draft_identical_to_public":draft["blocks"]==published["blocks"],
 "version":state.get("version"),"snapshot_sha256":hashlib.sha256(blob).hexdigest()[:16],
 "page_sha256":hashlib.sha256(json.dumps(published,sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:16]
},ensure_ascii=False))
kinds=collections.Counter()
for idx,b in enumerate(published["blocks"]):
 if b.get("kind")=="section":
  print("WEDNESDAY_SECTION "+json.dumps({
   "index":idx,"id":b.get("id"),"layout":b.get("layout"),
   "presentation":b.get("presentation"),"style":b.get("style"),
   "alignments":b.get("columnAlignments"),
   "buttonLayouts":b.get("columnButtonLayouts"),"columns":[len(x) for x in b.get("columns",[])]
  },ensure_ascii=False))
  for side,col in enumerate(b.get("columns",[])):
   for j,x in enumerate(col):
    if x.get("kind")=="section":
     print("WEDNESDAY_NESTED "+json.dumps({"i":idx,"side":side,"j":j,"kind":"section"},ensure_ascii=False))
    for leaf in flatten([x]):
     kinds[leaf.get("kind")]+=1
     print("WEDNESDAY_ITEM "+json.dumps({"root":idx,"side":side,"order":j,**describe(leaf)},ensure_ascii=False))
 else:
  for leaf in flatten([b]):
   kinds[leaf.get("kind")]+=1
   print("WEDNESDAY_ITEM "+json.dumps({"root":idx,"side":"root","order":0,**describe(leaf)},ensure_ascii=False))
print("WEDNESDAY_TYPES "+json.dumps(kinds,ensure_ascii=False))
