// M16 — pure release safety contract. No network, writes or deploy commands.
// A green unit test is NEVER a proof that real Cloudflare backups exist.
export const OFFICIAL_WORKER='celebrations-exit-production';
export const EDITOR_OBJECT='editor-trials/server-drafts-v1.json';
export const EDITOR_BUCKET='celebrations-exit-staging';
export const SCHEMA='celebrations.release-evidence.v1';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const SHA=/^[a-f0-9]{64}$/i;
const COMMIT=/^[a-f0-9]{40}$/i;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=(value,message)=>{if(!value)throw new Error('M16_BLOCK: '+message)};
const time=value=>Number.isFinite(Date.parse(value))?Date.parse(value):NaN;
const verified=x=>x===true;
const hasSha=x=>typeof x==='string'&&SHA.test(x);
export function activeDeployment(apiResponse){
 fail(apiResponse?.success===true,'Cloudflare deployment GET not successful');
 const list=apiResponse?.result?.deployments;
 fail(Array.isArray(list)&&list.length>0,'active deployments list unavailable');
 const latest=list[0];
 fail(plain(latest)&&UUID.test(latest.id||''),'active deployment ID missing');
 fail(Array.isArray(latest.versions)&&latest.versions.length===1,
  'split or ambiguous active deployment cannot be rolled back automatically');
 const version=latest.versions[0];
 fail(UUID.test(version?.version_id||'')&&version.percentage===100,
  'active version must have exactly 100% traffic');
 return Object.freeze({
  script:OFFICIAL_WORKER,
  deploymentId:latest.id,
  versionId:version.version_id,
  createdAt:latest.created_on||null
 });
}
function fresh(value,now,period,label){
 const t=time(value);
 fail(Number.isFinite(t)&&t<=now&&now-t<=period,label+' must be recent');
}
export function checkReleaseEvidence(evidence,observed,{now=Date.now(),allowSynthetic=false}={}){
 fail(plain(evidence)&&evidence.schema===SCHEMA,'release evidence schema missing');
 fail(COMMIT.test(evidence.candidateCommit||''),'candidate Git commit not pinned');
 fail(evidence.source==='audited-live'||allowSynthetic&&evidence.source==='synthetic-test',
  'synthetic or unverified evidence forbidden for real release');
 fresh(evidence.collectedAt,now,30*60*1000,'release evidence');
 const w=evidence.worker;
 fail(plain(w)&&w.script===OFFICIAL_WORKER,'Worker name mismatch');
 fail(UUID.test(w.deploymentId||'')&&UUID.test(w.versionId||''),
  'the exact original Worker deployment/version IDs are required');
 fail(w.deploymentId===observed?.deploymentId&&w.versionId===observed?.versionId,
  'active Worker changed since evidence was captured: stop');
 fail(observed.script===OFFICIAL_WORKER,'unexpected Worker identity');
 // Worker version IDs belong to their Worker service: an isolated candidate
 // receives a DIFFERENT version ID. Compare complete bundle digests, not IDs.
 fail(verified(w.rollbackTestOnIsolatedCandidate)&&
  hasSha(w.originalBundleSha256)&&
  w.originalBundleSha256===w.isolatedRestoredBundleSha256&&
  UUID.test(w.isolatedCandidateVersionId||'')&&
  w.isolatedCandidateVersionId!==w.versionId,
  'original Worker bundle/asset/config digest not re-tested in an isolated candidate');
 fresh(w.rehearsedAt,now,24*60*60*1000,'Worker rehearsal');
 const e=evidence.editor;
 fail(plain(e)&&e.bucket===EDITOR_BUCKET&&e.sourceKey===EDITOR_OBJECT,
  'live editor storage identity mismatch');
 fail(Number.isInteger(e.revision)&&e.revision>0,'editor revision missing');
 fail(hasSha(e.sourceSha256)&&hasSha(e.restoredSha256)&&
  e.sourceSha256===e.restoredSha256,
  'editor source was not restored byte-for-byte');
 fail(hasSha(e.encryptedBackupSha256)&&hasSha(e.independentBackupSha256)&&
  e.encryptedBackupSha256===e.independentBackupSha256,
  'encrypted off-Cloudflare backup bytes not verified');
 fail(verified(e.immutableArchive)&&verified(e.archiveReadbackVerified)&&
  verified(e.etagUnchanged)&&verified(e.offCloudflareReadbackVerified),
  'editor archive readback, immutability, offsite copy or stable ETag unproved');
 fail(typeof e.offCloudflareProvider==='string'&&e.offCloudflareProvider.length>2&&
  !/cloudflare|^r2$/i.test(e.offCloudflareProvider),
  'independent editor backup provider not identified');
 fresh(e.backedUpAt,now,24*60*60*1000,'editor backup');
 const d=evidence.d1;
 fail(plain(d)&&d.database==='celebrations-exit-production',
  'D1 production database not identified');
 fail(hasSha(d.exportSha256)&&d.exportSha256===d.restoredExportSha256,
  'D1 complete export bytes not revalidated');
 fail(verified(d.schemaAndDataExport)&&verified(d.restoredInIsolatedSqlite)&&
  d.sqliteIntegrity==='ok'&&d.foreignKeyViolations===0,
  'full D1 schema+data / integrity / foreign keys not restored');
 fail(Array.isArray(d.tableCounts)&&d.tableCounts.length>=1 &&
  d.tableCounts.every(x=>plain(x)&&typeof x.table==='string'&&
  /^[a-z][a-z0-9_]*$/.test(x.table)&&Number.isInteger(x.source)&&
  x.source>=0&&x.source===x.restored),
  'D1 restored table inventory/counts mismatch');
 fail(new Set(d.tableCounts.map(x=>x.table)).size===d.tableCounts.length,
  'D1 repeated table names');
 fail(verified(d.allTablesIncluded)&&verified(d.offCloudflareCopyRestored),
  'full table coverage or independent D1 copy unproved');
 fresh(d.exportedAt,now,24*60*60*1000,'D1 export');
 const m=evidence.media;
 fail(plain(m)&&Number.isInteger(m.referencedObjects)&&m.referencedObjects>0,
  'media reference inventory unavailable');
 fail(m.recoveredObjects===m.referencedObjects&&
  m.offCloudflareCopies===m.referencedObjects&&
  m.verifiedSha256Objects===m.referencedObjects,
  'every referenced media binary requires a hash-verified independent copy');
 fail(verified(m.includesHistoricMedia)&&verified(m.includesEditorUploads)&&
  verified(m.pathsPreserved),'historic media, new R2 or URLs not included');
 fail(hasSha(m.manifestSha256)&&m.manifestSha256===m.restoredManifestSha256,
  'media manifest not revalidated');
 fresh(m.copiedAt,now,24*60*60*1000,'media archive');
 fail(verified(evidence.ownerReleaseApproval),'a separate explicit approval to release is required');
 return Object.freeze({status:allowSynthetic&&evidence.source==='synthetic-test'?
  'SYNTHETIC_CONTRACT_ONLY':'PRECONDITIONS_DOCUMENTED_NOT_DEPLOYED',
  rollbackVersionId:w.versionId,candidateCommit:evidence.candidateCommit,
  mediaCount:m.referencedObjects,d1Tables:d.tableCounts.length,editorRevision:e.revision});
}
// The plan only DESCRIBES a manual rollback. It never invokes Wrangler.
// Re-check that the live Worker is still the one just deployed before using it.
export function exactRollbackPlan({previous,afterFailedDeploy,expectedNewVersionId,ownerApproved=false}){
 fail(ownerApproved,'owner approval missing for a production rollback');
 fail(plain(previous)&&previous.script===OFFICIAL_WORKER&&UUID.test(previous.versionId||''),
  'exact previous Worker ID missing');
 fail(previous.versionId!==expectedNewVersionId&&
  UUID.test(expectedNewVersionId||''),'deployment version mismatch');
 fail(plain(afterFailedDeploy)&&afterFailedDeploy.script===OFFICIAL_WORKER&&
  afterFailedDeploy.versionId===expectedNewVersionId,
  'live version drift: another release intervened');
 return Object.freeze({
  args:['wrangler','rollback',previous.versionId,'--name',OFFICIAL_WORKER,
   '--message','Célébrations owner-approved rollback to exact observed previous Worker'],
  expectedActiveVersionAfter:previous.versionId,
  warning:'Immediate live mutation; does NOT restore D1 or R2.'
 });
}
