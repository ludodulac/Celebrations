#!/usr/bin/env python3
"""One-time, safe, tiny legal-draft enrichment in ISOLATED Cloudflare staging.

No production writes and no auto publication. Only upgrades untouched original
templates; refuses to overwrite user edits, previously published pages, or
nonstaging D1. All legal identity/GDPR decisions remain explicitly unresolved.
"""
import json
import os
import re
from pathlib import Path
import requests

account=os.environ["CLOUDFLARE_ACCOUNT_ID"]
database=os.environ["STAGING_D1_ID"]
assert re.fullmatch(r"[a-f0-9]{32}",account,re.I)
assert re.fullmatch(r"[a-f0-9-]{36}",database,re.I)
assert os.environ["STAGING_R2_BUCKET"]=="celebrations-exit-staging"
root=f"https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{database}"
headers={"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"]}
resp=requests.get(root,headers=headers,timeout=25)
resp.raise_for_status()
info=resp.json()
assert info.get("success") and info["result"]["name"]=="celebrations-exit-staging", "Refusing a non-staging database"
legal=json.loads(Path("migration/cloudflare/legal-drafts-v2.json").read_text())
assert set(legal["drafts"])=={"mentions-legales","confidentialite","cookies"}
source=Path("footer-pages-data.js").read_text()
def old_template(slug):
 match=re.search(r"(?<![\w-])(?:'"+re.escape(slug)+r"'|"+re.escape(slug)+r"):\{title:'[^']+',template:`(.*?)`\}",source,re.S)
 assert match, "Original legal template could not be audited"
 return match.group(1)
def query(sql,params=()):
 response=requests.post(root+"/query",headers=headers,
                        json={"sql":sql,"params":list(params)},timeout=30)
 response.raise_for_status()
 body=response.json()
 assert body.get("success") and body["result"][0].get("success") is True, "D1 refused isolated query"
 return body["result"][0].get("results",[])
report={"enriched":0,"created":0,"kept_previously_customized":0,
        "already_enriched":0,"published":0,"other_records_changed":0}
for slug,entry in legal["drafts"].items():
 text=entry["content"]
 assert len(text)>750 and "[À " in text and "nation-essenienne.eu" in text, "Legal review barriers missing"
 assert len(text)<100000
 current=query("SELECT id,content,is_public,is_active FROM celebrations_footer_drafts WHERE slug=? ORDER BY id DESC LIMIT 5",(slug,))
 if not current:
  query("INSERT INTO celebrations_footer_drafts(slug,draft_number,title,content,is_active,is_public) VALUES(?,?,?,?,1,0)",
        (slug,1,entry["title"],text))
  report["created"]+=1
  continue
 active=[x for x in current if int(x["is_active"])==1]
 assert len(active)==1,"Multiple or missing active legal drafts: require manual review, never guess"
 row=active[0]
 if int(row["is_public"])!=0:
  # Never change a published page, even if its content looks like template.
  raise AssertionError("A legal page is public; refusing automatic upgrade for "+slug)
 if row["content"]==text:
  report["already_enriched"]+=1
 elif row["content"]==old_template(slug):
  result=query("UPDATE celebrations_footer_drafts SET content=? WHERE id=? AND content=? AND is_public=0 AND is_active=1 RETURNING id",
               (text,row["id"],row["content"]))
  assert len(result)==1, "Concurrent edit: refusing overwrite"
  report["enriched"]+=1
 else:
  # Respect manual editorial changes; do not overwrite actual user legal text.
  report["kept_previously_customized"]+=1
 check=query("SELECT is_public,content FROM celebrations_footer_drafts WHERE id=?",(row["id"],))
 assert len(check)==1 and int(check[0]["is_public"])==0, "Legal publication happened unexpectedly"
 assert "[" in check[0]["content"],"Unfinished legal draft incorrectly marked complete"
print("STAGING_LEGAL_2026_SAFE_ENRICHMENT "+json.dumps(report,ensure_ascii=False,sort_keys=True))
