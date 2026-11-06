#!/usr/bin/env python3
"""Read-only diagnostics of editor pages and media blocks, without disclosing
private page titles, texts, links, IDs, or media. No data mutations."""
import os,json,collections,datetime,urllib.parse,boto3
from botocore.config import Config
env=os.environ
assert env["STAGING_R2_BUCKET"]=="celebrations-exit-staging"
s=boto3.client("s3",region_name="auto",endpoint_url=env["R2_ENDPOINT"],
 aws_access_key_id=env["STAGING_R2_ACCESS_KEY_ID"],
 aws_secret_access_key=env["STAGING_R2_SECRET_ACCESS_KEY"],
 config=Config(retries={"max_attempts":2,"mode":"standard"}))
j=json.loads(s.get_object(Bucket=env["STAGING_R2_BUCKET"],
 Key="editor-trials/server-drafts-v1.json")["Body"].read())
def flatten(items):
 for b in items:
  if b.get("kind")=="section":
   for col in b.get("columns",[]):yield from flatten(col)
  else:yield b
def summarize(p,published):
 blocks=list(flatten(p.get("blocks",[])))
 kinds=collections.Counter(x.get("kind") for x in blocks)
 links=[b for b in blocks if b.get("kind")=="button"]
 videos=[b for b in blocks if b.get("kind")=="video"]
 def target(b):
  url=b.get("href") or ""
  if any(z in url.lower() for z in ("youtu","vimeo")):return "video-link"
  if url.startswith("https://"):return "external"
  if url.startswith("/"):return "local-file"
  if b.get("assetId"):return "local-asset-only"
  return "missing"
 return {
  "visibility":p.get("visibility","unset"),
  "inPublishedSnapshot":published,
  "roots":len(p.get("blocks",[])),"leaves":len(blocks),
  "types":dict(kinds),
  "videoElements":[{"has_title":bool(str(x.get("text") or "").strip()),
    "target_kind":target(x),"cover":bool(x.get("cover") or x.get("coverAssetId"))}
    for x in videos],
  "videoLinksAsButtons":[{"has_title":bool(str(x.get("text") or "").strip()),
    "explicit_button":x.get("displayAsButton",False),
    "has_custom_cover":bool(x.get("cover") or x.get("coverAssetId"))}
    for x in links if target(x)=="video-link"],
  "buttonsMissingTarget":sum(target(x)=="missing" for x in links),
  "buttonsLocalOnly":sum(target(x)=="local-asset-only" for x in links)
 }
for cid,record in sorted(j.get("drafts",{}).items()):
 pages=record.get("pages",[])
 if cid!="101":continue
 public=j.get("published",{}).get("drafts",{}).get(cid,{}).get("pages",[])
 publicIds={p.get("id") for p in public}
 new=[p for p in pages if str(p.get("id","")).startswith("extra-")]
 print("EDITOR_AUDIT_GENERAL",json.dumps({
  "revision":j.get("version"),
  "draft_page_count":len(pages),
  "published_page_count":len(public),
  "additional_draft_page_count":len(new),
  "additional_published_page_count":sum(p.get("id") in publicIds for p in new),
  "additional_unpublished_page_count":sum(p.get("id") not in publicIds for p in new),
  "updated_at":j.get("updatedAt"),
  "published_at":j.get("publishedAt")
 },ensure_ascii=False))
 for i,p in enumerate(new[-8:]):
  print("EDITOR_AUDIT_ADDITIONAL_PAGE",json.dumps({
   "ordinal_last_eight":i+1,**summarize(p,p.get("id") in publicIds)
  },ensure_ascii=False))
 print("EDITOR_AUDIT_WEDNESDAY",json.dumps(summarize(
  next(p for p in pages if p.get("id")=="mercredi-"+cid),
  "mercredi-"+cid in publicIds),ensure_ascii=False))
