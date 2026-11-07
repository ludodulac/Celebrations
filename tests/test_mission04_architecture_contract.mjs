import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const here='docs/architecture/';
const contract=JSON.parse(readFileSync(here+'CELEBRATIONS-M04-CONTRAT.json','utf8'));
const architecture=readFileSync(here+'MISSION-04-ARCHITECTURE-CIBLE-2026-11-07.md','utf8');
const source=path=>readFileSync('migration/cloudflare/'+path,'utf8');

test('Mission 04 is documentation/design only, not a code deployment',()=>{
 assert.equal(contract.schemaVersion,1);
 assert.equal(contract.status,'PROPOSED_TARGET_NOT_IMPLEMENTED');
 assert.equal(contract.mandatoryReleaseGates.noProductionDeploymentFromThisBranch,true);
 assert.match(architecture,/IMPLÉMENTATION NON COMMENCÉE/);
 assert.match(architecture,/Aucune modification fonctionnelle et aucun déploiement/);
 assert.match(architecture,/mission 05/i);
});

test('Target module responsibilities are unique, with no dependency cycles',()=>{
 const ids=contract.boundaries.map(x=>x.id);
 assert.equal(ids.length,8);
 assert.equal(new Set(ids).size,ids.length);
 assert.deepEqual(ids,['domain','application','ports','adapters','admin','public','compat','composition']);
 const visited=new Set(),active=new Set(),byId=new Map(contract.boundaries.map(x=>[x.id,x]));
 const visit=id=>{
  if(active.has(id))throw Error('Circular dependency: '+id);
  if(visited.has(id))return;
  const node=byId.get(id);
  assert.ok(node,'Unrecognized module: '+id);
  assert.ok(node.target.startsWith('migration/cloudflare/app/'));
  assert.ok(node.responsibility.length>25);
  active.add(id);
  for(const upstream of node.dependsOn)visit(upstream);
  active.delete(id);visited.add(id);
 };
 for(const id of ids)visit(id);
 assert.equal(visited.size,8);
 assert.deepEqual(byId.get('domain').dependsOn,[]);
});

test('Legacy data storage and response handlers are explicitly preserved',()=>{
 const snap=source('editor-server-draft-api.mjs');
 const publication=source('editor-publication-api.mjs');
 const worker=source('production-worker.mjs');
 assert.equal(contract.runtime.activeEditorR2Object,'editor-trials/server-drafts-v1.json');
 assert.ok(snap.includes(contract.runtime.activeEditorR2Object));
 assert.ok(publication.includes(contract.runtime.activeEditorR2Object));
 assert.ok(publication.includes('editor-trials/uploads/'));
 assert.ok(snap.includes('etagMatches')&&snap.includes('etagDoesNotMatch'));
 assert.ok(publication.includes('expectedRevision')&&publication.includes('409'));
 for(const fragment of ['"/media/"','"/letter/"','"ASSETS"']){
  if(fragment==='"ASSETS"')assert.ok(worker.includes('env.ASSETS.fetch'));
  else assert.ok(worker.includes(fragment.slice(1,-1)),'Missing '+fragment);
 }
 assert.equal(contract.compatibility.preserveConditionalEtagWritesAnd409,true);
 assert.equal(contract.compatibility.preserveDraftsAndPublishedSplit,true);
 assert.equal(contract.compatibility.preserveAllPageIds,true);
});

test('Functional parity contracts match the actual public and editor clients',()=>{
 const pub=source('editor-trial-site-client.mjs');
 const editor=source('editor-demo-client.mjs');
 const adapter=source('editor-demo-preparation-page.mjs');
 assert.deepEqual(contract.compatibility.visitorMenuFirstThree,
  ['Accueil','Célébrations','Médiathèque générale']);
 assert.deepEqual(contract.compatibility.stageSlugs,
  ['accueil-celebration','preparation','mercredi','jeudi','vendredi','samedi','dimanche','apres-celebration']);
 for(const stage of contract.compatibility.stageSlugs)assert.ok(adapter.includes(stage));
 for(const label of ['⌂ Accueil','✧ Célébrations','▧ Médiathèque générale'])
  assert.ok(pub.includes(label),'Missing current visitor menu: '+label);
 assert.ok(pub.includes('repeat(4'),'Desktop 4-column CSS currently present');
 assert.ok(pub.includes('repeat(2'),'Mobile 2-column CSS currently present');
 assert.ok(editor.includes('undoLastEditorAction'));
 assert.ok(editor.includes('Choisir une vidéo du site'));
 assert.ok(editor.includes('section-add-blue'));
 assert.ok(editor.includes('section-add-green'));
 assert.equal(contract.compatibility.preserveNoUndoOfRemotePublication,true);
 assert.equal(contract.compatibility.preserveCurrentSaveSemantics,true);
});

test('M03 release safety gaps stay open and cannot be claimed resolved by architecture alone',()=>{
 const gates=contract.mandatoryReleaseGates;
 for(const name of ['exactCurrentWorkerRollbackVerified',
  'independentlyRecoverableD1CurrentSnapshotVerified',
  'mediaBinaryRecoveryCoverageVerified',
  'independentOffCloudflareBackupVerified'])
  assert.equal(gates[name],false,'Do not prematurely mark '+name+' as verified');
 assert.equal(gates.mission02VisualParityRequired,true);
 assert.match(architecture,/94affae/);
 assert.match(architecture,/7cbfdb/);
});

test('Public route contract keeps authentication, legacy links and media URLs',()=>{
 const items=contract.frozenExternalRoutes.map(x=>x.method+' '+x.path);
 assert.equal(items.length,new Set(items).size,'Duplicate route contract');
 for(const item of ['GET /','GET /admin.html',
  'GET /api/editor-open-draft','POST /api/editor-open-draft',
  'GET /api/editor-publication','POST /api/editor-publication',
  'GET /media/*','GET /letter/*'])
  assert.ok(items.includes(item),item+' missing from contract');
 assert.deepEqual(contract.compatibility.pageVisibilityValues,['draft','published','hidden']);
 assert.equal(contract.compatibility.preserveLegacyAssetsFallback,true);
 assert.equal(contract.compatibility.preserveCurrentVideoMediaUploadRestrictions,true);
});
