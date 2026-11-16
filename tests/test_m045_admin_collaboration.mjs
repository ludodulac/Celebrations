// M045 — two administrators, two browsers: no silent loss of content.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEditorSyncPolicy} from '../migration/cloudflare/app/application/editor-sync-policy.mjs';
const policy=createEditorSyncPolicy();
const a={id:'a-101',name:'Accueil',blocks:[{kind:'text',text:'A'}]};
const b={id:'b-101',name:'Programme',blocks:[{kind:'text',text:'B'}]};
const snap=({pages=[a,b],sharedPages=[],plans=[{id:'101',visibility:'published'}],
 localization={registry:{languages:['fr']},pages:{}},other={}}={})=>({
 record:{pages,celebrationDates:{},celebrationTimes:{},siteHomeId:'neutral-accueil-general',...other},
 shared:{pages:sharedPages,homeId:'neutral-accueil-general'},
 plans,localization
});
const change=(page,text)=>({...page,blocks:[{kind:'text',text}]});

test('two admins editing different pages in Gabriel can merge safely',()=>{
 const base=snap();
 const local=snap({pages:[change(a,'Mac'),b]});
 const remote=snap({pages:[a,change(b,'Collègue')]});
 const result=policy.mergeSnapshots(base,local,remote);
 assert.equal(result.ok,true,JSON.stringify(result.conflicts));
 assert.equal(result.record.pages[0].blocks[0].text,'Mac');
 assert.equal(result.record.pages[1].blocks[0].text,'Collègue');
});
test('same page changed on both computers is a hard conflict',()=>{
 const base=snap();
 const r=policy.mergeSnapshots(base,snap({pages:[change(a,'Mac'),b]}),
  snap({pages:[change(a,'Collègue'),b]}));
 assert.equal(r.ok,false);assert.match(r.conflicts.join('|'),/a-101/);
});
test('reloading alone must never cause an automatic POST to the server',()=>{
 const source=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
 const entry=source.slice(source.lastIndexOf('if(IS_STAGE){await loadAdminMode()'));
 assert.match(entry,/await serverLoad\(\);\}/);
 assert.doesNotMatch(entry,/serverSave\(/);
 assert.doesNotMatch(source,/serverDiverged=false;await serverSave\(\)/);
 assert.match(source,/if\(pending\?\._serverPending===true/);
 assert.match(source,/recoverServerBase\(pending\)/);
});
test('independent additions and a change to a third page are preserved',()=>{
 const base=snap(), x={id:'c-101',name:'Nouvelle Mac',blocks:[]},
 y={id:'d-101',name:'Nouvelle collègue',blocks:[]};
 const result=policy.mergeSnapshots(base,snap({pages:[a,b,x]}),
  snap({pages:[change(a,'Collègue'),b,y]}));
 assert.equal(result.ok,true,result.conflicts.join('|'));
 assert.deepEqual(result.record.pages.map(p=>p.id),['a-101','b-101','d-101','c-101']);
 assert.equal(result.record.pages[0].blocks[0].text,'Collègue');
});
test('delete versus concurrent edit must fail closed',()=>{
 const base=snap();
 const result=policy.mergeSnapshots(base,snap({pages:[b]}),
  snap({pages:[change(a,'Collègue'),b]}));
 assert.equal(result.ok,false);
});
test('same page, separate languages can merge, but same translation cannot',()=>{
 const base=snap({localization:{registry:{languages:['fr','en','es']},pages:{'a-101':{}}}});
 const local=snap({localization:{registry:{languages:['fr','en','es']},pages:{'a-101':{en:{name:'Hello',blocks:[]}}}}});
 const remote=snap({localization:{registry:{languages:['fr','en','es']},pages:{'a-101':{es:{name:'Hola',blocks:[]}}}}});
 const merged=policy.mergeSnapshots(base,local,remote);
 assert.equal(merged.ok,true,merged.conflicts.join('|'));
 assert.ok(merged.localization.pages['a-101'].en);
 assert.ok(merged.localization.pages['a-101'].es);
 const conflict=policy.mergeSnapshots(base,local,snap({localization:{registry:{languages:['fr','en','es']},pages:{'a-101':{en:{name:'Changed elsewhere',blocks:[]}}}}}));
 assert.equal(conflict.ok,false);
});
test('contradictory page reorders do not silently override one another',()=>{
 const c={id:'c-101',name:'C',blocks:[]};
 const base=snap({pages:[a,b,c]});
 const result=policy.mergeSnapshots(base,snap({pages:[b,a,c]}),snap({pages:[a,c,b]}));
 assert.equal(result.ok,false);
});
test('confirm the whole result, not only currently selected page',()=>{
 const expected=snap({pages:[change(a,'Mac'),change(b,'Colleague')]});
 const readback={...expected,revision:3,record:{...expected.record,pages:[change(a,'Mac'),b]}};
 assert.equal(policy.readbackConfirmed(readback,3,'a-101',expected.record,expected.shared,expected.localization,expected.plans),false);
 readback.record.pages[1]=change(b,'Colleague');
 assert.equal(policy.readbackConfirmed(readback,3,'a-101',expected.record,expected.shared,expected.localization,expected.plans),true);
});
