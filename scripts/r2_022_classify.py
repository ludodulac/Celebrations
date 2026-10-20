"""Conservative R2 access classification from R2-021 evidence. No network or writes."""
import json,sys,collections
def classify(e):
    path=e["path"]; refs=e.get("references",[])
    if not refs:return "UNREFERENCED","No reference in audited content tables; publication not authorized"
    audiences={str(r.get("audience") or "").lower() for r in refs}
    if any(a not in ("all","") for a in audiences):
        return "RESTRICTED_CONFIRMED","Explicit non-global audience in content metadata"
    return "UNCERTAIN","Global audience metadata is not independent publication authorization"
def report(e):
    rows=[{"path":x["path"],"classification":classify(x)[0],"reason":classify(x)[1],"references":x.get("references",[]),"direct_http_status":x.get("unauthenticated_direct_access",{}).get("status")} for x in e["files"]]
    counts=dict(collections.Counter(x["classification"] for x in rows))
    for name in ("PUBLIC_CONFIRMED","RESTRICTED_CONFIRMED","UNCERTAIN","UNREFERENCED"):counts.setdefault(name,0)
    return {"source_files":len(rows),"counts":counts,"committee_files":sum(x["path"].startswith("committee/") for x in rows),"rules":["HTTP 206 does not authorize public distribution","Missing database reference never authorizes publication","Audience all does not authorize publishing outside existing site"],"files":rows}
if __name__=="__main__":
    with open(sys.argv[1],encoding="utf8") as f:e=json.load(f)
    result=report(e)
    with open(sys.argv[2],"w",encoding="utf8") as f:json.dump(result,f,ensure_ascii=False,indent=2)
    print("CLASSIFICATION_COUNTS "+json.dumps(result["counts"],sort_keys=True))
