import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createPageModel} from '../migration/cloudflare/app/domain/editor-pages.mjs';
import {createEditorPageCommands} from '../migration/cloudflare/app/application/editor-page-commands.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';

const model=createPageModel();
const commands=createEditorPageCommands({model});
const clone=o=>JSON.parse(JSON.stringify(o));
const UUID='123e4567-e89b-12d3-a456-426614174000';
test('M09: editor compiles and actually uses the two imported modules',()=>{
 new vm.Script(DEMO_CLIENT);
 for(const name of ['createPageModel','createEditorPageCommands'])
  assert.equal(DEMO_CLIENT.split('function '+name+'(').length-1,1,name);
 for(const term of ['editorPageModel.pageSlug(','editorPageModel.createPage(',
  'editorPageModel.pageVisibility(','editorPageModel.celebrationVisibility(',
  'editorPageModel.groupPages(','editorPageModel.activePageId(',
  'editorPageCommands.moveGeneralPage(','editorPageCommands.deletionPlan(',
  'editorPageCommands.removeConfirmedPage(','editorPageCommands.restoreSharedPages(',
  'editorPageModel.plannedEntry(','editorPageModel.publicationIntent('])
  assert.ok(DEMO_CLIENT.includes(term),term);
 assert.ok(DEMO_CLIENT.includes("if(stateOfPage(q)==='published')"));
 assert.ok(DEMO_CLIENT.includes("serverPublish({kind:'page',pageId:q.id,visibility:'hidden'})"));
});
test('M09: fixed historical slugs, original URLs and order remain unchanged',()=>{
 assert.deepEqual(model.fixedStages,['accueil-celebration','preparation','mercredi','jeudi',
  'vendredi','samedi','dimanche','apres-celebration']);
 for(const slug of model.fixedStages)
  assert.equal(model.pageSlug({id:slug+'-101',group:'celebration'},'101'),slug);
 const planId='plan-michael-2028-05-10';
 assert.equal(model.pageSlug({id:'apres-celebration-'+planId,group:'celebration'},planId),'apres-celebration');
 assert.equal(model.pageSlug({id:'extra-'+UUID+'-101',group:'celebration'},'101'),'extra-'+UUID);
 assert.equal(model.pageSlug({id:'neutral-accueil-general',group:'page'},'101'),'neutral-accueil-general');
 assert.equal(model.editorUrl('101'),'/__editor/demo-preparation?celebration=101&tab=celebrations');
 assert.equal(model.editorUrl('plan-michael-2028-05-10'),
  '/__editor/demo-preparation?celebration=plan-michael-2028-05-10&tab=celebrations');
});
test('M09: new page is a draft with exactly the existing serialized schema',()=>{
 const general=model.createPage('page','Notre histoire',UUID,'101');
 const celebration=model.createPage('celebration','Autre texte',UUID,'101');
 assert.deepEqual(general,{id:'neutral-'+UUID,name:'Notre histoire',group:'page',
  visibility:'draft',blocks:[{id:1,kind:'heading',text:'Notre histoire',align:'center'}]});
 assert.deepEqual(celebration,{id:'extra-'+UUID+'-101',name:'Autre texte',group:'celebration',
  visibility:'draft',blocks:[{id:1,kind:'heading',text:'Autre texte',align:'center'}]});
 assert.equal(model.pageVisibility(general),'draft');
 assert.equal(model.pageVisibility(celebration),'draft');
 assert.equal(model.publicationIntent('page',general,'published').pageId,general.id);
});
test('M09: explicit hidden and draft stay non-public; legacy implicit publication is preserved',()=>{
 for(const [given,expected] of [
  [{id:'legacy'},'published'],
  [{visibility:undefined},'published'],
  [{visibility:'draft'},'draft'],
  [{visibility:'hidden'},'hidden'],
  [{visibility:'published'},'published']
 ])assert.equal(model.pageVisibility(given),expected);
 const history={id:'101',archangel:'Michaël'};
 const planned={id:'plan-michael-2028-05-10',visibility:'draft'};
 assert.equal(model.celebrationVisibility(history),'published');
 assert.equal(model.celebrationVisibility(planned),'draft');
 assert.equal(model.celebrationVisibility(history,{'101':'hidden'}),'hidden');
 assert.equal(model.celebrationVisibility(planned,{[planned.id]:'hidden'}),'hidden');
 assert.equal(model.celebrationVisibility(planned,{[planned.id]:'published'}),'published');
 assert.deepEqual(model.publicationIntent('page',{id:'p'},'hidden'),
  {kind:'page',pageId:'p',visibility:'hidden'});
 assert.deepEqual(model.publicationIntent('celebration',history,'draft'),
  {kind:'celebration',visibility:'draft'});
 assert.equal(model.publicationIntent('page',{id:'p'},'invalid'),null);
});
test('M09: editor navigation and manual page ordering never reorder other groups',()=>{
 const a={id:'page-a',group:'page',blocks:[{text:'A'}],misc:{name:'a'}};
 const b={id:'preparation-101',group:'celebration',visibility:'draft',blocks:[]};
 const c={id:'page-c',group:'page',blocks:[{text:'C'}]};
 const d={id:'mercredi-101',group:'celebration',visibility:'hidden',blocks:[]};
 const e={id:'page-e',group:'page',blocks:[{text:'E'}]};
 const db={pages:[a,b,c,d,e],unknown:{yes:true}};
 assert.deepEqual(model.groupPages(db.pages,'page'),[a,c,e]);
 assert.equal(model.activePageId(db.pages,'page','page-c'),'page-c');
 assert.equal(model.activePageId(db.pages,'page','missing'),'page-a');
 assert.equal(model.activePageId(db.pages,'celebration','page-c'),'preparation-101');
 assert.equal(commands.moveGeneralPage(db,c,-1),true);
 assert.deepEqual(db.pages,[c,b,a,d,e]);
 assert.strictEqual(db.pages[1],b);assert.strictEqual(db.pages[3],d);
 assert.equal(commands.moveGeneralPage(db,c,-1),false);
 assert.equal(commands.moveGeneralPage(db,c,1),true);
 assert.deepEqual(db.pages,[a,b,c,d,e]);
 assert.equal(commands.moveGeneralPage(db,b,1),false);
 assert.deepEqual(db.unknown,{yes:true});
 assert.equal(d.visibility,'hidden','reordering must not publish anything');
});
test('M09: old stage pages and the last page of a group cannot be removed',()=>{
 const fixed={id:'preparation-101',group:'celebration',name:'Préparation'};
 const extra={id:'extra-'+UUID+'-101',group:'celebration',visibility:'draft'};
 const home={id:'neutral-accueil-general',group:'page'};
 const general={id:'neutral-'+UUID,group:'page',visibility:'hidden'};
 const plan={id:'extra-'+UUID+'-plan-michael-2028-05-10',group:'celebration'};
 for(const page of [fixed,home])
  assert.equal(model.removablePage(page,'101').allowed,false);
 assert.deepEqual(model.removablePage(extra,'101'),{allowed:true,general:false});
 assert.deepEqual(model.removablePage(general,'101'),{allowed:true,general:true});
 assert.equal(model.removablePage(plan,'101').allowed,false,'foreign celebration is protected');
 const db={pages:[fixed,extra,home,general]};
 assert.equal(commands.deletionPlan(db,fixed,'101').allowed,false);
 const planInfo=commands.deletionPlan(db,extra,'101');
 assert.equal(planInfo.siblings.length,1);
 assert.strictEqual(planInfo.siblings[0],fixed);
 assert.equal(commands.removeConfirmedPage(db,extra,extra.id,planInfo),fixed.id);
 assert.deepEqual(db.pages,[fixed,home,general]);
 assert.equal(commands.removeConfirmedPage(db,extra,extra.id,planInfo),null,'no double deletion');
 const onlyOne={pages:[extra]};
 const last=commands.deletionPlan(onlyOne,extra,'101');
 assert.equal(last.siblings.length,0);
 assert.equal(commands.removeConfirmedPage(onlyOne,extra,extra.id,last),null);
 assert.deepEqual(onlyOne.pages,[extra]);
});
test('M09: deleting an authored home preserves other pages, switches home and records tombstones',()=>{
 const base={id:'neutral-accueil-general',group:'page',blocks:[{id:7,text:'Accueil'}]};
 const custom={id:'neutral-'+UUID,group:'page',visibility:'hidden',
  blocks:[{id:9,rich:'<strong>Édité</strong>',src:'/media/image.jpg'}],privateField:{x:9}};
 const event={id:'mercredi-101',group:'celebration',blocks:[]};
 const db={siteHomeId:custom.id,pages:[base,event,custom],misc:{kept:1}};
 const plan=commands.deletionPlan(db,custom,'101');
 const initial=JSON.stringify(db);
 assert.equal(plan.allowed,true);assert.equal(JSON.stringify(db),initial,
  'planning a removal does not mutate the document or publish');
 const shared={deletedPageIds:['previous','previous'],celebrationVisibility:{'101':'hidden'}};
 const ids=commands.rememberDeletedPage(shared,custom.id);
 assert.deepEqual(ids,['previous',custom.id]);
 assert.equal(commands.removeConfirmedPage(db,custom,custom.id,plan),base.id);
 assert.equal(db.siteHomeId,base.id);
 assert.deepEqual(db.pages,[base,event]);
 assert.deepEqual(db.misc,{kept:1});
 assert.equal(commands.rememberDeletedPage({deletedPageIds:ids},custom.id).length,2);
});
test('M09: shared page read/write retains page order, non-page fields and visibility metadata',()=>{
 const page1={id:'neutral-accueil-general',name:'Accueil',group:'page',
  blocks:[{kind:'image',src:'/media/historical.jpg'}],visibility:'published'};
 const page2={id:'neutral-'+UUID,name:'Brouillon',group:'page',
  blocks:[{kind:'text',rich:'<em>Édité</em>',futureField:{yes:true}}],visibility:'draft'};
 const event={id:'preparation-101',group:'celebration',visibility:'hidden',
  blocks:[{kind:'audio',remoteKey:'editor-trials/audio/a.mp3'}]};
 const db={pages:[event,{id:'unused-page',group:'page',blocks:[]}],siteHomeId:''};
 const saved={homeId:page2.id,pages:[page1,page2,{id:'not-whitelisted',group:'page',blocks:[]}],
  deletedPageIds:['old'],celebrationVisibility:{'101':'hidden'},future:{meta:10}};
 const snapshot=JSON.stringify(saved);
 assert.equal(commands.restoreSharedPages(db,saved),true);
 assert.deepEqual(db.pages,[event,page1,page2]);
 assert.equal(db.siteHomeId,page2.id);
 assert.equal(event.visibility,'hidden');
 assert.equal(page2.visibility,'draft');
 assert.equal(JSON.stringify(saved),snapshot,'read must not modify a stored snapshot');
 const output=commands.sharedSnapshot(db,saved);
 assert.deepEqual(output.pages,[page1,page2]);
 assert.equal(output.homeId,page2.id);
 assert.deepEqual(output.deletedPageIds,['old']);
 assert.deepEqual(output.celebrationVisibility,{'101':'hidden'});
 assert.deepEqual(output.future,{meta:10});
 assert.equal(JSON.stringify(db.pages[2].blocks),JSON.stringify(page2.blocks));
 assert.equal(commands.restoreSharedPages(db,{pages:[]}),false);
});
test('M09: new planned celebration remains an unpublished draft with stable ID',()=>{
 const id='plan-michael-2028-05-10';
 assert.equal(model.validPlannedId(id),true);
 assert.equal(model.validPlannedId('plan-michael-2028-05-10?admin=1'),false);
 assert.equal(model.validPlannedId('plan-inconnu-2028-05-10'),false);
 const draft=model.plannedEntry(id,'Michaël','2028-05-10','Michaël 2028',false);
 assert.deepEqual(draft,{id,archangel:'Michaël',date:'2028-05-10',year:'2028',
  title:'Michaël 2028',customTitle:false,kind:'planned',visibility:'draft'});
 assert.equal(model.celebrationVisibility(draft),'draft');
});
test('M09: a failed server hide does not remove an existing published page',async()=>{
 const source=DEMO_CLIENT.slice(DEMO_CLIENT.indexOf('async function removeCustomPage(q){'),
  DEMO_CLIENT.indexOf('function moveGeneralPage(p,dir){'));
 const q={id:'extra-'+UUID+'-101',group:'celebration',
  name:'Mon historique',visibility:'published',blocks:[{id:3,text:'Ne pas supprimer'}]};
 const other={id:'preparation-101',group:'celebration',visibility:'published',blocks:[]};
 const db={pages:[other,q],siteHomeId:'neutral-accueil-general'};
 let hideRequests=0,saveCalls=0,renders=0,localWrites=0;
 const storage={getItem:()=>null,setItem:()=>localWrites++};
 const args=['db','editorPageCommands','IS_STAGE','STAGE_SEED','confirm','alert',
  'stateOfPage','serverPublish','localStorage','SHARED_KEY','mark','save','render',
  'serverSave','status','id','selectedBlockId'];
 const factory=new Function(...args,source+'\nreturn async page=>{await removeCustomPage(page);return id};');
 const invoke=factory(db,commands,true,{celebrationId:'101'},()=>true,()=>{},
  model.pageVisibility,async()=>{hideRequests++;return false},storage,
  'shared-key',()=>{},()=>{saveCalls++},()=>{renders++},()=>{saveCalls++},{textContent:''},q.id,null);
 const selected=await invoke(q);
 assert.equal(selected,q.id);
 assert.equal(hideRequests,1);
 assert.equal(saveCalls,0);assert.equal(renders,0);assert.equal(localWrites,0);
 assert.strictEqual(db.pages[1],q);
 assert.equal(q.visibility,'published');
});
test('M09: a confirmed server hide precedes any local removal of a published page',async()=>{
 const source=DEMO_CLIENT.slice(DEMO_CLIENT.indexOf('async function removeCustomPage(q){'),
  DEMO_CLIENT.indexOf('function moveGeneralPage(p,dir){'));
 const q={id:'extra-'+UUID+'-101',name:'Mon texte',group:'celebration',
  visibility:'published',blocks:[{rich:'<strong>Important</strong>'}]};
 const old={id:'preparation-101',name:'Préparation',group:'celebration',blocks:[]};
 const db={pages:[old,q]},calls=[];
 const args=['db','editorPageCommands','IS_STAGE','STAGE_SEED','confirm','alert',
  'stateOfPage','serverPublish','localStorage','SHARED_KEY','mark','save','render',
  'serverSave','status','id','selectedBlockId'];
 const invoke=new Function(...args,source+'\nreturn async page=>{await removeCustomPage(page);return id};')(
  db,commands,true,{celebrationId:'101'},()=>true,()=>{},
  model.pageVisibility,async cmd=>{
   assert.deepEqual(cmd,{kind:'page',pageId:q.id,visibility:'hidden'});
   assert.ok(db.pages.includes(q),'not deleted before server confirms');
   calls.push('hide');return true;
  },{getItem:()=>null,setItem:()=>calls.push('local')},'shared',
  ()=>calls.push('mark'),()=>calls.push('save'),()=>calls.push('render'),
  ()=>calls.push('serverSave'),{textContent:''},q.id,null
 );
 assert.equal(await invoke(q),old.id);
 assert.deepEqual(db.pages,[old]);
 assert.deepEqual(calls,['hide','mark','save','render','serverSave']);
});
test('M09: domain/application functions perform zero I/O and cannot publish on their own',()=>{
 for(const file of ['migration/cloudflare/app/domain/editor-pages.mjs',
  'migration/cloudflare/app/application/editor-page-commands.mjs']){
  const source=readFileSync(file,'utf8');
  for(const forbidden of ['fetch(', 'localStorage','indexedDB','serverPublish(',
   'serverSave(', 'location.assign(', 'window.', 'document.', '.put('])
   assert.ok(!source.includes(forbidden),file+' must be side-effect free: '+forbidden);
 }
});
