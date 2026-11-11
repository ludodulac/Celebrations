// M012-C — R2 is canonical, D1 acknowledges an exact private release epoch.
import {SPACE_VISIBILITIES} from '../domain/member-access.mjs';
const table='celebrations_private_release_fences';
const registry='celebrations_directory_private_spaces';
const q=(db,sql,...args)=>db.prepare(sql).bind(...args);
export const validCelebrationId=id=>typeof id==='string'&&/^[1-9][0-9]{0,7}$/.test(id);
const tokenOK=t=>typeof t==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(t);
export function releaseEpoch(published,cid,maxRevision){
 const e=published?.privateReleaseRevisions?.[cid];
 return validCelebrationId(cid)&&Number.isSafeInteger(maxRevision)&&Number.isSafeInteger(e?.revision)&&e.revision>0&&
  e.revision<=maxRevision&&tokenOK(e.token)?e:null;
}
export async function privateReleaseReady(db,published,cid,maxRevision,spaces){
 const e=releaseEpoch(published,cid,maxRevision);
 if(!e||!db)return false;
 const row=await q(db,'SELECT revision,token FROM '+table+' WHERE celebration_id=?',Number(cid)).first();
 if(row?.revision!==e.revision||row?.token!==e.token)return false;
 for(const s of spaces){
  if(s.visibility!==SPACE_VISIBILITIES.PRIVATE)continue;
  const r=await q(db,'SELECT celebration_id FROM '+registry+' WHERE space_id=?',s.id).first();
  if(r?.celebration_id!==Number(cid))return false;
 }
 return true;
}
export async function acknowledgePrivateRelease(db,published,cid,maxRevision,spaces){
 const e=releaseEpoch(published,cid,maxRevision);
 if(!e||!db?.batch)throw Error('Invalid release epoch');
 const privateSpaces=spaces.filter(s=>s.visibility===SPACE_VISIBILITIES.PRIVATE);
 const statements=privateSpaces.map(s=>q(db,'INSERT INTO '+registry+
  '(space_id,celebration_id) VALUES(?,?) ON CONFLICT(space_id) DO NOTHING',s.id,Number(cid)));
 // No enrollment is inferred or written. Older acknowledgements cannot
 // replace newer ones; same-token replay is idempotent.
 const checks=privateSpaces.map(()=> 'EXISTS (SELECT 1 FROM '+registry+' WHERE space_id=? AND celebration_id=?)');
 statements.push(q(db,'INSERT INTO '+table+'(celebration_id,revision,token) SELECT ?,?,? WHERE '+
  (checks.join(' AND ')||'1=1')+
  ' ON CONFLICT(celebration_id) DO UPDATE SET revision=excluded.revision,token=excluded.token'+
  ' WHERE revision<excluded.revision OR (revision=excluded.revision AND token=excluded.token)',
  Number(cid),e.revision,e.token,...privateSpaces.flatMap(s=>[s.id,Number(cid)])));
 const result=await db.batch(statements);
 if(Number(result?.at(-1)?.meta?.changes)!==1||
    !await privateReleaseReady(db,published,cid,maxRevision,spaces))
  throw Error('D1 release acknowledgement refused');
}
