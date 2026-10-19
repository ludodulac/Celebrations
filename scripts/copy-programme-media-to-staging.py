#!/usr/bin/env python3
"""Copy programme-linked source objects into isolated staging; never delete or overwrite."""
import os, hashlib, json, boto3
from botocore.config import Config
from botocore.exceptions import ClientError
import importlib.util
from pathlib import Path
preflight=Path(__file__).with_name("verify-programme-staging-copy-readiness.py")
spec=importlib.util.spec_from_file_location("programme_staging_preflight",preflight)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
src,dst,keys,source_keys,destination_keys=(module.src,module.dst,module.keys,module.source_keys,module.destination_keys)
SOURCE="celebrations-media"
TARGET="celebrations-exit-staging"
if os.getenv("CONFIRM_STAGING_COPY")!="COPY_PROGRAMME_TO_STAGING":
 raise SystemExit("Staging copy not confirmed")
if os.getenv("GITHUB_REF") not in ("refs/heads/fix/celebrations-programme-library-006","refs/heads/main"):
 raise SystemExit("Wrong branch")
if os.getenv("GITHUB_REF")=="refs/heads/main" and os.getenv("GITHUB_WORKFLOW")!="Copier les médias vers le stockage de test":
 raise SystemExit("Unrecognized staging launcher")
available=sorted(keys & source_keys)
missing=sorted(keys - source_keys)
if len(available)!=97 or len(missing)!=1 or destination_keys:
 raise SystemExit("Inventory changed; refusing copy")
copied=0
for key in available:
 obj=src.get_object(Bucket=SOURCE,Key=key)
 payload=obj["Body"].read()
 obj["Body"].close()
 sha=hashlib.sha256(payload).hexdigest()
 dst.put_object(Bucket=TARGET,Key=key,Body=payload,ContentType=obj.get("ContentType") or "application/octet-stream")
 copied+=1
 result=dst.get_object(Bucket=TARGET,Key=key)
 data=result["Body"].read()
 result["Body"].close()
 if hashlib.sha256(data).hexdigest()!=sha:
  raise RuntimeError("Destination verification failed")
print("STAGING_COPY_RESULT "+json.dumps({"copied":copied,"verified":copied,"unresolved":len(missing)}))
