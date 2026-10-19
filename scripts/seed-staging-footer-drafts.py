"""Keep existing legal page templates as hidden editable staging drafts."""
import os,re,requests
from pathlib import Path
account=os.environ["CLOUDFLARE_ACCOUNT_ID"]
database=os.environ["STAGING_D1_ID"]
assert re.fullmatch(r"[a-fA-F0-9]{32}",account)
assert re.fullmatch(r"[a-fA-F0-9-]{36}",database)
assert os.environ["STAGING_R2_BUCKET"]=="celebrations-exit-staging"
url=f"https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{database}"
headers={"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"]}
info=requests.get(url,headers=headers,timeout=30).json()
assert info.get("success") and info["result"]["name"]=="celebrations-exit-staging"
def query(sql,params=()):
 r=requests.post(url+"/query",headers=headers,json={"sql":sql,"params":list(params)},timeout=30)
 r.raise_for_status();b=r.json();assert b.get("success") and b["result"][0].get("success") is not False
 return b["result"][0].get("results",[])
source=Path("footer-pages-data.js").read_text()
spec={"mentions-legales":"Mentions légales","confidentialite":"Déclaration de confidentialité","cookies":"Politique de cookies"}
created=0
for slug,title in spec.items():
 match=re.search(r"(?<![\w-])(?:'"+re.escape(slug)+r"'|"+re.escape(slug)+r"):\{title:'[^']+',template:`(.*?)`\}",source,re.S)
 assert match, "Missing canonical legal template"
 content=match.group(1)
 assert len(content)>200 and "[" in content
 existing=query("SELECT id FROM celebrations_footer_drafts WHERE slug=? LIMIT 1",(slug,))
 if not existing:
  query("INSERT INTO celebrations_footer_drafts(slug,draft_number,title,content,is_active,is_public) VALUES(?,?,?,?,1,0)",(slug,1,title,content))
  created+=1
  after=query("SELECT content,is_public FROM celebrations_footer_drafts WHERE slug=?",(slug,))
  assert len(after)==1 and after[0]["content"]==content and int(after[0]["is_public"])==0
  public=requests.get("https://celebrations-exit-staging.rondes.workers.dev/api/public-data",params={"table":"celebrations_footer_page","slug":slug},timeout=30)
  assert public.status_code==200 and public.json()==[],"Hidden legal draft became public"
print("STAGING_LEGAL_PRIVATE_DRAFTS verified=3 created="+str(created)+" published=0 overwritten=0")
