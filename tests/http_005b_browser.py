#!/usr/bin/env python3
"""005B: anonymous Chromium observation of the public gallery. Browser read-only."""
import json, html, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote
ROOT=Path(__file__).resolve().parents[1]
T=json.loads((ROOT/"tests/fixtures/celebrations-http-005b-targets.json").read_text())
OUT=ROOT/"http-005b-results";OUT.mkdir(exist_ok=True)
def utc(): return datetime.now(timezone.utc).isoformat()
result={"utc":utc(),"site":T["site"],"browser_started":False,"gallery_opened":False,
 "gallery_observed":False,"visible_cards":None,"gallery_items":None,
 "network_failures":[],"storage_responses":[],"errors":[],"candidate_images":[]}
def save(): (OUT/"chromium-gallery.json").write_text(json.dumps(result,indent=2,ensure_ascii=False))
save()
try:
 from playwright.sync_api import sync_playwright
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
  result["browser_started"]=True
  context=browser.new_context(locale="fr-FR",viewport={"width":1366,"height":960},
                              java_script_enabled=True,accept_downloads=False)
  page=context.new_page()
  page.set_default_timeout(12000)
  def block_writes(route):
   if route.request.method.upper() not in ("GET","HEAD","OPTIONS"):
    route.abort("blockedbyclient")
   else: route.continue_()
  page.route("**/*",block_writes)
  def onfailed(req):
   if len(result["network_failures"])<80:
    result["network_failures"].append({"method":req.method,"url":req.url,
        "failure":req.failure})
  def onresponse(resp):
   if len(result["storage_responses"])<100 and ("/storage/v1/object/" in resp.url or "/media/" in resp.url):
    result["storage_responses"].append({"url":resp.url,"status":resp.status,
     "content_type":resp.headers.get("content-type","")})
  page.on("requestfailed",onfailed);page.on("response",onresponse)
  try:
   response=page.goto(T["site"],wait_until="domcontentloaded",timeout=30000)
   result["homepage_status"]=response.status if response else None
   result["page_title"]=page.title()
   page.wait_for_timeout(4000)
  except Exception as e: result["errors"].append("initial navigation: "+type(e).__name__+": "+str(e)[:240])
  if result.get("homepage_status") and result["homepage_status"]<400:
   try:
    available=page.evaluate("() => typeof window.openContentFamily === 'function'")
    if available:
     # Calls the same public UI action as the site's "Images" category button.
     page.evaluate("() => window.openContentFamily('Images')")
     result["gallery_opened"]=True
    else:
     for label in ("Bibliothèque","Bibliotheque","Contenus","Images"):
      try:
       b=page.get_by_role("button",name=label,exact=True).first
       if b.count()>0 and b.is_visible(): b.click(timeout=3000)
      except: continue
     b=page.locator('[data-library-family="image"]').first
     if b.count() and b.is_visible():
      b.click(timeout=5000);result["gallery_opened"]=True
    if result["gallery_opened"]:
     page.wait_for_timeout(18000)
     result["visible_cards"]=page.locator(".image-gallery-card:visible").count()
     result["gallery_dom_cards"]=page.locator(".image-gallery-card").count()
     result["gallery_observed"]=True
     try:
      result["gallery_items"]=page.evaluate("() => typeof imageGalleryItems === 'function' ? imageGalleryItems().map(x=>({id:x.content.id,source:x.source,kind:x.kind})) : null")
     except Exception as e:result["errors"].append("gallery item enumeration: "+str(e)[:140])
     result["gallery_notices"]=page.locator('[data-image-gallery-grid] .notice').all_text_contents()
     page.screenshot(path=str(OUT/"gallery-public.png"),full_page=True,timeout=10000)
   except Exception as e: result["errors"].append("gallery: "+type(e).__name__+": "+str(e)[:300])
  # Candidate URL image display check, not R2's private endpoint; names/dimensions only.
  pairs=[]
  base=T["supabase_origin"]+"/storage/v1/object/public/"+T["bucket"]+"/"
  for item in T["images"]:
   for key in item["candidates"]:
    pairs.append({"id":item["id"],"key":key,"url":base+"/".join(quote(x,safe="") for x in key.split("/"))})
  try:
   # <img> captures dimensions without download through the agent or privileged auth.
   dimensions=page.evaluate("""async arr=>await Promise.all(arr.map(async entry=>{
      const im=new Image();im.referrerPolicy='no-referrer';
      return await new Promise(resolve=>{
        const timer=setTimeout(()=>{im.src='';resolve({...entry,loaded:false,error:'timeout'})},10000);
        im.onload=()=>{clearTimeout(timer);resolve({...entry,loaded:true,width:im.naturalWidth,height:im.naturalHeight})};
        im.onerror=()=>{clearTimeout(timer);resolve({...entry,loaded:false,error:'image load failure'})};
        im.src=entry.url;
      });
    }))""",pairs)
   result["candidate_images"]=dimensions
   visible=[x for x in dimensions if x.get("loaded")]
   if visible:
    cards="".join('<div class="card"><div class="caption">'+html.escape(x["key"].split("/")[-1])+
         '<br>'+str(x["width"])+' × '+str(x["height"])+'</div><img src="'+html.escape(x["url"],quote=True)+'"></div>' for x in visible)
    showcase=context.new_page()
    showcase.set_content('<html><head><style>body{font:14px system-ui;margin:15px;background:#eef2f7}h1{font-size:22px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.card{background:white;border:1px solid #d2d8e3;padding:10px;overflow:hidden}.card img{width:100%;height:240px;object-fit:contain}.caption{font-size:12px;min-height:44px;overflow-wrap:anywhere}</style></head><body><h1>005B — candidats publics visibles (originaux historiques absents)</h1><div class="grid">'+cards+'</div></body></html>',wait_until="load")
    showcase.screenshot(path=str(OUT/"candidate-contact-sheet.png"),full_page=True,timeout=15000)
    showcase.close()
  except Exception as e:result["errors"].append("candidate dimensions/contact sheet: "+type(e).__name__+": "+str(e)[:250])
  context.close();browser.close()
except Exception as e:
 result["errors"].append("browser unavailable: "+type(e).__name__+": "+str(e)[:400])
finally:
 save()
 print("005B_CHROMIUM_SUMMARY",json.dumps({k:v for k,v in result.items() if k not in ("gallery_items","network_failures","storage_responses","candidate_images")},ensure_ascii=False),flush=True)
