#!/usr/bin/env python3
"""005B: anonymous read-only HTTP probes. No credentials, writes, or full media downloads."""
import json, os, sys, ssl, time, urllib.request, urllib.error
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
TARGETS = json.loads((ROOT / "tests/fixtures/celebrations-http-005b-targets.json").read_text())
OUT = ROOT / "http-005b-results"
OUT.mkdir(exist_ok=True)
ROWS = []
def stamp():
    return datetime.now(timezone.utc).isoformat()
def media(key, staging=False):
    base = TARGETS["staging"] + "/media/" if staging else (TARGETS["supabase_origin"] + "/storage/v1/object/public/" + TARGETS["bucket"] + "/")
    return base + "/".join(quote(part, safe="") for part in key.split("/"))
class LimitedRedirect(urllib.request.HTTPRedirectHandler):
    def __init__(self):
        super().__init__(); self.redirects=[]
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        self.redirects.append({"code":code,"url":newurl})
        if len(self.redirects)>5: raise urllib.error.URLError("Too many redirects")
        if not newurl.startswith("https://"): raise urllib.error.URLError("Non-HTTPS redirect blocked")
        return super().redirect_request(req,fp,code,msg,headers,newurl)
def try_http(url, method):
    redirects=LimitedRedirect()
    opener=urllib.request.build_opener(redirects)
    headers={"User-Agent":"Celebrations-HTTP-005B-anonymous-audit/1.0",
             "Accept":"*/*"}
    if method=="GET": headers["Range"]="bytes=0-2047"
    req=urllib.request.Request(url,headers=headers,method=method)
    sample=b""; code=None; outhead={}; final=url; error=""
    try:
        with opener.open(req,timeout=14) as resp:
            code=resp.status; final=resp.url
            outhead=dict(resp.headers.items())
            if method=="GET": sample=resp.read(2048)
    except urllib.error.HTTPError as ex:
        code=ex.code; final=ex.url
        outhead=dict(ex.headers.items()) if ex.headers else {}
        try: ex.close()
        except: pass
    except Exception as ex:
        error=type(ex).__name__ + ": " + str(ex)[:200]
    mime=outhead.get("Content-Type",outhead.get("content-type","")).split(";")[0].lower().strip()
    length=outhead.get("Content-Length",outhead.get("content-length",""))
    magic_image=(sample.startswith(b"\xff\xd8\xff") or sample.startswith(b"\x89PNG\r\n\x1a\n")
        or sample.startswith(b"GIF87a") or sample.startswith(b"GIF89a")
        or (sample.startswith(b"RIFF") and sample[8:12]==b"WEBP"))
    magic_pdf=sample.startswith(b"%PDF-")
    return {"utc":stamp(),"url":url,"method":method,"http_code":code,
            "final_url":final,"redirects":redirects.redirects,"content_type":mime,
            "content_length":length,"error":error,"sample_bytes_read":len(sample),
            "image_signature":magic_image if sample else None,
            "pdf_signature":magic_pdf if sample else None,
            "html_observed":(b"<html" in sample[:300].lower() or b"<!doctype html" in sample[:300].lower()) if sample else None,
            "login_redirect":("accounts.google.com" in final or "ServiceLogin" in final)}
def probe(kind, ident, url, validate=None):
    head=try_http(url,"HEAD")
    ROWS.append({"target_kind":kind,"target_id":ident,**head})
    # GET with a small Range verifies actual media, and acts as HEAD fallback on errors.
    if validate or head["http_code"] is None or head["http_code"] in (403,405,501):
        get=try_http(url,"GET")
        ROWS.append({"target_kind":kind,"target_id":ident,**get})
        return get
    return head
def write():
    (OUT/"http-results.json").write_text(json.dumps({
        "mission":"CELEBRATIONS-PUBLIC-MEDIA-HTTP-005B","utc":stamp(),
        "anonymous":True,"mutations":0,"rows":ROWS},indent=2,ensure_ascii=False))
print("005B_HTTP_START",flush=True)
home=probe("production_site","homepage",TARGETS["site"],"html")
staging=probe("staging_site","homepage",TARGETS["staging"],"html")
pdf=TARGETS["pdf"]
probe("pdf_original",pdf["id"],media(pdf["key"]), "pdf")
probe("pdf_candidate",pdf["id"],media(pdf["candidate"]), "pdf")
for img in TARGETS["images"]:
    probe("image_original",img["id"],media(img["key"]),"image")
    # R2 is private; public URL is currently Supabase (not raw R2).
    for key in img["candidates"]:
        probe("image_candidate",img["id"],media(key),"image")
drive=TARGETS["drive"]
probe("google_drive",drive["id"],drive["url"],"drive")
# Check publicly reachable Cloudflare gateway without auth; no assumption that 404 => missing from R2.
probe("staging_pdf_original",pdf["id"],media(pdf["key"],staging=True),"pdf")
probe("staging_pdf_candidate",pdf["id"],media(pdf["candidate"],staging=True),"pdf")
write()
summ={}
for t in ROWS:
    if t["method"]=="GET":
        group=t["target_kind"]
        summ.setdefault(group,{})[str(t["http_code"])]=summ.setdefault(group,{}).get(str(t["http_code"]),0)+1
print("005B_HTTP_SUMMARY",json.dumps(summ,ensure_ascii=False,sort_keys=True),flush=True)
if home["http_code"] is None and staging["http_code"] is None:
    print("005B_HTTP_BLOCKED: neither production nor staging yielded HTTP response",flush=True)
    sys.exit(2)
print("005B_HTTP_COMPLETE",flush=True)
