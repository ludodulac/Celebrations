#!/usr/bin/env python3
"""M030 release: derive exact safe cleaned R2 + reversible snapshot from fresh FULL
D1/R2 exports. No remote calls, no data rows printed, no deletion on disk.
"""
import datetime
import hashlib
import json
import sqlite3
import sys
from pathlib import Path
from scripts.m030_m04_local_cleanup_plan import dry_run_d1,dry_run_r2,require,KEEP,REMOVE

def make():
    require(len(sys.argv)==4, "Usage: prepare_release.py D1.sql editor.json OUTPUT_DIRECTORY")
    d1_path,r2_path,folder=map(Path,sys.argv[1:])
    folder.mkdir(parents=True,exist_ok=True)
    sql=d1_path.read_text(encoding='utf8')
    raw=r2_path.read_text(encoding='utf8')
    data=json.loads(raw)
    d1_report=dry_run_d1(sql) # in-memory rollback, checks every other table
    r2_report,cleaned=dry_run_r2(data,return_cleaned=True)
    require(d1_report['identities_deleted_local_only']==6 and
        d1_report['steps_deleted_local_only']==21, "D1 references changed")
    require(r2_report['michael_101_and_shared_unchanged'] and
        r2_report['media_objects_deleted']==0, "Cannot preserve owner data")
    version=data['version']
    require(isinstance(version,int) and version>0,"Editor revision missing")
    now=datetime.datetime.now(datetime.timezone.utc).isoformat()
    cleaned['version']=version+1
    cleaned['updatedAt']=now
    rollback=json.loads(raw)
    rollback['version']=version+2
    rollback['updatedAt']=now
    clean_text=json.dumps(cleaned,ensure_ascii=False,separators=(',',':'))
    rollback_text=json.dumps(rollback,ensure_ascii=False,separators=(',',':'))
    (folder/'clean-editor.json').write_text(clean_text,encoding='utf8')
    (folder/'rollback-editor.json').write_text(rollback_text,encoding='utf8')
    # The DELETE statements are not executed here; the migration Worker
    # uses the Cloudflare D1 batch API (single transaction, fails atomically).
    manifest={
     'expectedWorker':'76f31003-53b1-436f-ab6d-3217b05c91c3',
     'oldRevision':version,'newRevision':version+1,'rollbackRevision':version+2,
     'oldSha256':hashlib.sha256(raw.encode('utf8')).hexdigest(),
     'newSha256':hashlib.sha256(clean_text.encode('utf8')).hexdigest(),
     'rollbackSha256':hashlib.sha256(rollback_text.encode('utf8')).hexdigest(),
     'expectedD1Ids':['101','102','103','104','105','106','107'],
     'deleteIds':sorted(REMOVE),'keepId':KEEP,'deleteStepCount':21,
     'oldD1Count':7,'newD1Count':1,'r2Summary':r2_report,'d1Summary':d1_report,
     'mediaObjectsDeleted':0
    }
    (folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
    print('M030_M10_FRESH_LOCAL_CLEANUP_PLAN_PASS'+json.dumps({
     'd1Identities':7,'toRemove':6,'steps':21,'keep':KEEP,
     'mediaObjectsDeleted':0,'ownerPagesPreserved':True,'versionDelta':1}))
if __name__=='__main__':make()
