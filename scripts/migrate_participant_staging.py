#!/usr/bin/env python3
"""Source-read-only, staging-D1-only participant account import.

Copies salted PBKDF2 password hashes and recovery question hashes unchanged.
Does not copy session tokens: the user must log in again on the new domain.
Never prints PII, passwords, salts or hash values. Preserves existing accounts
and refuses conflicts. Explicitly verifies Cloudflare D1 identity before writes.
"""
import datetime as dt
import json
import os
import re
from urllib.parse import urlparse
import requests

SOURCE=os.environ["SUPABASE_URL"].rstrip("/")
ACCOUNT=os.environ["CLOUDFLARE_ACCOUNT_ID"]
DB_ID=os.environ["STAGING_D1_ID"]
assert os.environ["STAGING_R2_BUCKET"]=="celebrations-exit-staging"
assert urlparse(SOURCE).hostname=="jwyayfkssyagvnablttg.supabase.co"
assert re.fullmatch(r"[a-f0-9]{32}",ACCOUNT,re.I)
assert re.fullmatch(r"[0-9a-f-]{36}",DB_ID,re.I)
api=f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/d1/database/{DB_ID}"
cfh={"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"]}
r=requests.get(api,headers=cfh,timeout=25).json()
assert r.get("success") and r.get("result",{}).get("name")=="celebrations-exit-staging", "Not staging database"
sh={"apikey":os.environ["SUPABASE_SERVICE_ROLE_KEY"],
 "Authorization":"Bearer "+os.environ["SUPABASE_SERVICE_ROLE_KEY"]}
columns=[
 "email","password_salt","password_hash","question_1","answer_1_salt",
 "answer_1_hash","question_2","answer_2_salt","answer_2_hash",
 "recovery_failed_count","recovery_locked_until","created_at",
 "registered_at","updated_at","audience"
]
resp=requests.get(SOURCE+"/rest/v1/celebrations_participants",
 headers=sh,params={"select":",".join(columns),"limit":"1000"},timeout=35)
resp.raise_for_status()
rows=resp.json()
assert isinstance(rows,list) and len(rows)==1,"Unexpected source accounts: refusing partial migration"
def d1(sql,args=()):
 response=requests.post(api+"/query",headers=cfh,json={"sql":sql,"params":list(args)},timeout=30)
 response.raise_for_status()
 data=response.json()
 if not data.get("success") or data.get("result",[{}])[0].get("success") is False:
  raise RuntimeError("Staging D1 participant query failed")
 return data["result"][0].get("results",[])
def canonical(v):
 if v is None:return None
 if isinstance(v,str) and re.match(r"^\d\d\d\d-\d\d-\d\dT",v):
  try:return dt.datetime.fromisoformat(v.replace("Z","+00:00")).astimezone(dt.timezone.utc).isoformat()
  except ValueError:pass
 return str(v)
for row in rows:
 assert set(row)==set(columns),"Unexpected account fields"
 assert re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+",row["email"])
 assert re.fullmatch(r"[a-f0-9]{64}",row["password_hash"],re.I),"Incompatible password hash"
 assert len(row["password_salt"] or "")>=16,"Missing password salt"
 for name in ("answer_1_hash","answer_2_hash"):
  assert re.fullmatch(r"[a-f0-9]{64}",row[name],re.I),"Incompatible recovery hash"
 existing=d1("SELECT "+",".join('"'+c+'"' for c in columns)+
  " FROM celebrations_participants WHERE email=?",(row["email"],))
 if existing:
  assert len(existing)==1 and all(canonical(existing[0][c])==canonical(row[c]) for c in columns),(
   "Existing participant differs: refusing overwrite")
 else:
  sql="INSERT INTO celebrations_participants ("+",".join('"'+c+'"' for c in columns)+   ") VALUES ("+",".join("?" for _ in columns)+") ON CONFLICT(email) DO NOTHING"
  d1(sql,tuple(row[c] for c in columns))
 recorded=d1("SELECT "+",".join('"'+c+'"' for c in columns)+
  " FROM celebrations_participants WHERE email=?",(row["email"],))
 assert len(recorded)==1 and all(canonical(recorded[0][c])==canonical(row[c]) for c in columns),(
  "Private account migration verification failed")
 # No session is migrated; tokens valid on Supabase must not be reused blindly.
 other=d1("SELECT COUNT(*) AS n FROM celebrations_participants")
 assert int(other[0]["n"])>=1
 # Non-sensitive authorized/registered status must be recognized on the Worker.
 auth=requests.post("https://celebrations-exit-staging.rondes.workers.dev/api/auth",
   json={"action":"participant_status","email":row["email"]},timeout=25)
 assert auth.status_code==200 and auth.json().get("authorized") is True and auth.json().get("registered") is True
 # Important: this does not know the user's original password; a real password
 # login cannot be tested without the user and must be checked after cutover.
 print("STAGING_PARTICIPANT_ACCOUNT_IMPORTED "+json.dumps({
  "source_accounts":len(rows),"d1_verified_accounts":len(rows),
  "password_hash_preserved":True,"recovery_hashes_preserved":True,
  "old_sessions_migrated":0,"same_password_login_user_test_pending":True,
  "production_writes":0}),flush=True)
