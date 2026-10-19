#!/usr/bin/env python3
"""Read-only staging D1 diagnosis: counts only, never reveal media paths or credentials."""
import os,requests,json
account=os.environ["CLOUDFLARE_ACCOUNT_ID"]
db=os.environ["STAGING_D1_ID"]
headers={"Authorization":"Bearer "+os.environ["CLOUDFLARE_API_TOKEN"]}
root=f"https://api.cloudflare.com/client/v4/accounts/{account}/d1/database/{db}/query"
sql="""SELECT
(SELECT count(*) FROM public_media) AS acl_rows,
(SELECT count(*) FROM public_media WHERE approved=1 AND revoked_at IS NULL) AS approved_rows,
(SELECT count(*) FROM celebrations_contents c WHERE c.audience='all' AND EXISTS(SELECT 1 FROM celebrations_event_contents ec JOIN celebrations_events e ON e.id=ec.event_id WHERE ec.content_id=c.id AND e.audience='all')) AS public_linked_contents,
(SELECT count(*) FROM celebrations_contents c JOIN public_media pm ON pm.storage_path=c.storage_path WHERE pm.approved=0 OR pm.revoked_at IS NOT NULL) AS explicitly_denied_contents"""
r=requests.post(root,headers=headers,json={"sql":sql},timeout=30)
r.raise_for_status()
data=r.json()
if not data.get("success"): raise SystemExit("D1 query failed")
print("STAGING_MEDIA_AUTH_DIAGNOSTIC "+json.dumps(data["result"][0]["results"][0]))
