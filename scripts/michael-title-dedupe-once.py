#!/usr/bin/env python3
"""Michaël 2026: content-only 4-day title, caption and URL-card cleanup.

After the owner's screenshot approval: remove repeated textual introduction,
retain full appointment titles, use succinct PDF captions, strip "Voir :" and
technical dates from video captions, replace specifically repeated SoundCloud/
radio website cards with the editor's EXISTING button rendering option.
No runtime change and no new UI tool. Never delete media, text, links or blocks.
One full SHA-verified backup, conditional ETag update and public readback.
"""
import copy,datetime,hashlib,json,os,re,time,urllib.parse,urllib.request
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

CID="101"
DAYS=("jeudi","vendredi","samedi","dimanche")
KEY="editor-trials/server-drafts-v1.json"
BUCKET="celebrations-exit-staging"
URL="https://ronde-des-archanges-universelle.eu/api/editor-publication?celebration=101"
MODE=os.getenv("TITLE_DEDUPE_MODE","audit")
assert MODE in ("audit","apply"),"Unsupported mode"
assert os.environ["STAGING_R2_BUCKET"]==BUCKET
client=boto3.client("s3",region_name="auto",endpoint_url=os.environ["R2_ENDPOINT"],
 aws_access_key_id=os.environ["STAGING_R2_ACCESS_KEY_ID"],
 aws_secret_access_key=os.environ["STAGING_R2_SECRET_ACCESS_KEY"],
 config=Config(retries={"max_attempts":2,"mode":"standard"},connect_timeout=10,read_timeout=25))

def sha(blob):return hashlib.sha256(blob).hexdigest()
def read():
 o=client.get_object(Bucket=BUCKET,Key=KEY)
 return o["Body"].read(),o["ETag"]
def live():
 request=urllib.request.Request(URL,headers={"Cache-Control":"no-cache","User-Agent":"Celebrations-Content-Only-Layout-Audit"})
 with urllib.request.urlopen(request,timeout=20) as response:
  assert response.status==200
  return json.load(response)
def flatten(blocks):
 for b in blocks:
  if b.get("kind")=="section":
   for col in b.get("columns",[]):
    yield from flatten(col)
  else:yield b
def locate(state,area,day):
 collection=(state["drafts"] if area=="draft" else state["published"]["drafts"])[CID]["pages"]
 found=[p for p in collection if p.get("id")==day+"-101"]
 assert len(found)==1,day+" page not unique in "+area
 return found[0]
def index(page):
 leafs=list(flatten(page["blocks"]))
 out={str(x.get("id")):x for x in leafs}
 assert len(leafs)==len(out),"Duplicate content IDs"
 return out

# Explicit exact old titles (recorded from read-only inspection of the published
# pages at revision 127) -> new visitor captions. Preserve all href/src/assets.
TEXT_EDITS={
 "jeudi":{
  33:("10:00 — Conférence Loïc Air (en différé)","10:00 — Conférence de Loïc Air (en différé)"),
  35:("Conférence de Loïc Air du jeudi 10h — Terres de l’Érable, Michaël 2026","Terres de l’Érable — Michaël 2026"),
  39:("Voir : Conférence de Loïc Air — Terres de l’Érable, Michaël 2026","Conférence de Loïc Air"),
  70:("Voir : 2026.09.17 Enseignement de l’Érable sur le soutien mutuel — YouTube","Enseignement de l’Érable sur le soutien mutuel"),
  13:("M.286_Respecter les lois de dieu","Psaume 286 de l’Archange Michaël"),
  24:("Psaume 102 de l'Archange Michaël - La pensée claire est la garante d’une vie heureuse","Psaume 102 de l’Archange Michaël"),
  62:("Psaume 13 — Apprendre à regarder","Psaume 13 de l’Archange Michaël"),
  21:("Voir : Rituel pour la Paix pour soutenir et préparer la célébration de Michaël","Rituel pour la Paix"),
  57:("Voir : Comprendre le travail alchimique du rite du Pardon des Offenses","Comprendre le rite du Pardon des Offenses"),
  76:("Voir : Caroline Allan - L’Érable-Roi - Un arbre noble et plein de sagesse","L’Érable-Roi — Caroline Allan"),
  82:("Voir : Cérémonie de l’Érable — vidéo","Cérémonie de l’Érable")
 },
 "vendredi":{
  14:("Ps.28 de l'Archange Michaël - Construis en toi la pyramide de lumière avec les 4 éléments magiques.","Psaume 28 de l’Archange Michaël"),
  19:("Voir : Arcana du sens de l’Amour","Arcana du sens de l’Amour"),
  29:("Voir : Voir la conférence sur YouTube","Conférence de Loïc Air")
 },
 "samedi":{
  17:("Psaume 154 de l’Archange Michaël — Le premier pas vers la vérité","Psaume 154 de l’Archange Michaël"),
  23:("Voir : Arcanas des 7 règles de Michaël — présenté par Cindy Équilibre","Les sept règles de Michaël — Cindy Équilibre")
 },
 "dimanche":{
  18:("Psaume 106 de l’Archange Michaël — Comment discerner le vrai du faux","Psaume 106 de l’Archange Michaël"),
  6:("Voir : YouTube","Sur YouTube"),
  8:("Voir : Vimeo","Sur Vimeo"),
  25:("2026.09.20 Atelier Prière de la Mère et chants\nTerres de l’Érable, Michaël 2026","Terres de l’Érable — Michaël 2026"),
  27:("Voir : 2026.09.20 Atelier Prière de la Mère et chants — Terres de l’Érable, Michaël 2026","Atelier — Prière de la Mère et chants")
 }
}
# These exact text blocks contain a full repeated psalm subtitle in addition
# to the appointment/PDF heading. Keep the original in the versioned backup.
TEMPLE_INTROS={"jeudi":{10:286,23:102,61:13},
               "vendredi":{11:28,23:39},
               "samedi":{7:125,14:154},
               "dimanche":{15:106}}
TEMPLE_TEXT="L’Oracle de Dieu a parlé dans le temple de l’Archange Michaël."
# Linked external audio/websites: only the chosen records switch their EXISTING
# "display as a button" option. Never change YouTube/Vimeo preview rendering.
EXTERNAL_BUTTONS={
 "jeudi":{
  36:("on.soundcloud.com","🎧 Écouter sur SoundCloud"),
  72:("on.soundcloud.com","🎧 Écouter sur SoundCloud"),
  93:("www.esseneradio.com","📻 Ouvrir Essene Radio"),
  96:("player-radio.infomaniak.com","▶ Écouter Essene Radio")
 },
 "vendredi":{
  31:("on.soundcloud.com","🎧 Écouter sur SoundCloud"),
  52:("www.esseneradio.com","📻 Ouvrir Essene Radio"),
  55:("player-radio.infomaniak.com","▶ Écouter Essene Radio")
 },
 "samedi":{
  29:("on.soundcloud.com","🎧 Écouter sur SoundCloud"),
  31:("odysee.com","🎬 Voir sur Odysee"),
  67:("player-radio.infomaniak.com","▶ Écouter Essene Radio"),
  70:("www.esseneradio.com","📻 Ouvrir Essene Radio")
 },
 "dimanche":{
  13:("on.soundcloud.com","🎧 Écouter sur SoundCloud")
 }
}
# This is the redundant second introductory text in Thursday's 10h video block:
HIDE={"jeudi":{38}}
EXPECTED_ROOTS={"jeudi":38,"vendredi":25,"samedi":21,"dimanche":15}
EXPECTED_ITEMS={"jeudi":95,"vendredi":61,"samedi":69,"dimanche":42}
EXPECTED_ALREADY_HIDDEN={"jeudi":19,"vendredi":12,"samedi":16,"dimanche":12}
def transform(page,day):
 assert len(page["blocks"])==EXPECTED_ROOTS[day],day+" page layout changed"
 before=copy.deepcopy(page)
 old=index(before)
 assert len(old)==EXPECTED_ITEMS[day],day+" content count changed"
 assert sum(b.get("hideOnSite") is True for b in old.values())==EXPECTED_ALREADY_HIDDEN[day],day+" hidden titles changed"
 changed=copy.deepcopy(before)
 items=index(changed)
 report={"titles_or_captions":0,"temple_intros":0,"link_cards_to_buttons":0,"intro_hidden":0}
 for bid,(old_text,new_text) in TEXT_EDITS[day].items():
  item=items[str(bid)]
  assert item["kind"] in ("heading","button","text"),f"{day}: wrong block kind {bid}"
  assert not item.get("hideOnSite"),f"{day}: changing a hidden block {bid}"
  assert not item.get("rich"),f"{day}: formatted text block requires manual review {bid}"
  assert item.get("text")==old_text,f"{day}: unexpected text change {bid}"
  item["text"]=new_text
  report["titles_or_captions"]+=1
 for bid,num in TEMPLE_INTROS[day].items():
  item=items[str(bid)]
  assert item["kind"]=="text" and not item.get("rich") and not item.get("hideOnSite"),f"{day}: wrong temple block {bid}"
  assert re.match(r"^\s*l['’]{1,2}oracle de dieu a parlé dans le temple de l['’]archange michaël",str(item.get("text") or ""),re.I),f"{day}: unexpected temple text {bid}"
  assert re.search(r"\b"+str(num)+r"\b",item["text"]),f"{day}: no psalm {num} in block {bid}"
  item["text"]=TEMPLE_TEXT
  report["temple_intros"]+=1
 for bid,(host,label) in EXTERNAL_BUTTONS[day].items():
  item=items[str(bid)]
  assert item["kind"]=="button" and not item.get("displayAsButton"),f"{day}: existing button changed {bid}"
  assert not item.get("hideOnSite"),f"{day}: hidden link {bid}"
  old_host=urllib.parse.urlsplit(str(item.get("href") or "")).hostname
  assert old_host==host,f"{day}: link destination changed {bid}"
  assert not item.get("assetId"),f"{day}: local asset must not be changed {bid}"
  item["displayAsButton"]=True
  item["text"]=label
  report["link_cards_to_buttons"]+=1
 for bid in HIDE.get(day,set()):
  item=items[str(bid)]
  assert item["kind"]=="text" and not item.get("hideOnSite"),f"{day}: hidden text changed {bid}"
  assert item.get("text")=="Conférence de Loïc Air du jeudi 10h",f"{day}: different subtitle {bid}"
  item["hideOnSite"]=True
  report["intro_hidden"]+=1
 assert len(index(changed))==EXPECTED_ITEMS[day],"Lost content"
 for ident,old_block in old.items():
  target=items[ident]
  for k in set(old_block)|set(target):
   allow=(int(ident) in TEXT_EDITS[day] and k=="text") or (
     int(ident) in TEMPLE_INTROS[day] and k=="text") or (
     int(ident) in EXTERNAL_BUTTONS[day] and k in ("text","displayAsButton")) or (
     int(ident) in HIDE.get(day,set()) and k=="hideOnSite")
   if not allow:
    assert old_block.get(k)==target.get(k),f"{day}: unexpected field modification {ident}:{k}"
 for k in before:
  if k!="blocks":assert before[k]==changed[k],f"{day}: unexpected page metadata change"
 return changed,report

data,etag=read()
before=json.loads(data)
assert isinstance(before.get("version"),int) and before["version"]>=127
assert isinstance(before.get("published"),dict)
updated=copy.deepcopy(before)
reports={}
for day in DAYS:
 pub=locate(before,"published",day)
 draft=locate(before,"draft",day)
 assert pub["blocks"]==draft["blocks"],day+": private unsaved edits; stop"
 newpub,reports[day]=transform(pub,day)
 newdraft,draft_report=transform(draft,day)
 assert reports[day]==draft_report
 locate(updated,"published",day)["blocks"]=newpub["blocks"]
 locate(updated,"draft",day)["blocks"]=newdraft["blocks"]
assert all(len(locate(updated,"published",day)["blocks"])==EXPECTED_ROOTS[day] for day in DAYS)
# Complete page/celebration/no-new-code preservation proof.
scope={day+"-101" for day in DAYS}
for area in ("drafts","published"):
 left=before["drafts"] if area=="drafts" else before["published"]["drafts"]
 right=updated["drafts"] if area=="drafts" else updated["published"]["drafts"]
 for cid in left:
  if cid!=CID:assert left[cid]==right[cid]
  else:
   for key in left[cid]:
    if key!="pages":assert left[cid][key]==right[cid][key]
   assert len(left[cid]["pages"])==len(right[cid]["pages"])
   for op,np in zip(left[cid]["pages"],right[cid]["pages"]):
    if op["id"] not in scope:assert op==np,"Unrelated page modified"
    else:
     for field in op:
      if field!="blocks":assert op[field]==np[field]
for k in before:
 if k not in ("drafts","published","version","updatedAt","publishedAt"):assert before[k]==updated[k]
for k in before["published"]:
 if k!="drafts":assert before["published"][k]==updated["published"][k]
print("MICHAEL_CAPTION_CLEANUP_AUDIT "+json.dumps({"revision":before["version"],"changes_by_day":reports,
 "original_blocks_retained":sum(EXPECTED_ITEMS.values()),"all_other_pages_intact":True},ensure_ascii=False))
if MODE=="audit":
 print("MICHAEL_CAPTION_CLEANUP_READONLY_COMPLETE")
 raise SystemExit(0)
assert os.environ.get("TITLE_DEDUPE_APPROVED")=="yes"
oldlive=live()
assert int(oldlive.get("revision",-1))==before["version"],"Public revision changed"
public_index={x["id"]:x for x in oldlive.get("record",{}).get("pages",[])}
for day in DAYS:
 assert public_index[day+"-101"]["blocks"]==locate(before,"published",day)["blocks"],day+": live page mismatch"
stamp=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds")
updated["version"]=before["version"]+1
updated["updatedAt"]=stamp
updated["publishedAt"]=stamp
newdata=json.dumps(updated,ensure_ascii=False,separators=(",",":")).encode()
assert len(newdata)<5_000_000
backup="editor-trials/michael-layout-backups/caption-cleanup-"+sha(data)[:28]+".json"
try:
 client.put_object(Bucket=BUCKET,Key=backup,Body=data,ContentType="application/json",IfNoneMatch="*")
except ClientError as err:
 if err.response.get("ResponseMetadata",{}).get("HTTPStatusCode")!=412:raise
assert sha(client.get_object(Bucket=BUCKET,Key=backup)["Body"].read())==sha(data)
print("MICHAEL_CAPTION_CLEANUP_BACKUP_VERIFIED "+sha(data)[:16])
client.put_object(Bucket=BUCKET,Key=KEY,Body=newdata,ContentType="application/json",IfMatch=etag)
saved,newetag=read()
try:
 assert sha(saved)==sha(newdata),"Readback failed"
 for attempt in range(5):
  try:
   current=live()
   assert int(current.get("revision",-1))==updated["version"]
   current_idx={x["id"]:x for x in current.get("record",{}).get("pages",[])}
   for day in DAYS:
    assert current_idx[day+"-101"]["blocks"]==locate(updated,"published",day)["blocks"],day+": publication mismatch"
    assert len(index(current_idx[day+"-101"]))==EXPECTED_ITEMS[day]
   break
  except Exception:
   if attempt==4:raise
   time.sleep(2)
except Exception:
 try:
  client.put_object(Bucket=BUCKET,Key=KEY,Body=data,ContentType="application/json",IfMatch=newetag)
  assert sha(read()[0])==sha(data)
  print("MICHAEL_CAPTION_CLEANUP_ROLLBACK_VERIFIED")
 except Exception as rollback:
  print("MICHAEL_CAPTION_CLEANUP_ROLLBACK_CONFLICT "+type(rollback).__name__)
 raise
print("MICHAEL_CAPTION_CLEANUP_PUBLISHED_SUCCESS "+json.dumps({
 "revision":updated["version"],"by_day":reports,"media_and_urls_preserved":sum(EXPECTED_ITEMS.values()),
 "runtime_code_modified":False,"no_new_tools":True,"d1_changes":0},ensure_ascii=False))
