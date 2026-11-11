// M018-D: targeted privacy regression without Cloudflare or production data.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {loadSevenStageContent} from '../migration/cloudflare/editor-demo-preparation-page.mjs';
import {publicSnapshot} from '../migration/cloudflare/editor-publication-api.mjs';
import {createPublicVisitorModel} from '../migration/cloudflare/app/domain/editor-public-visitor-model.mjs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';

const tableRows={
 celebrations_celebrations:[
  {id:101,archangel:'Michaël',year:'2026',status:'published'},
  {id:102,archangel:'Gabriel',year:'2027',status:'published'},
  {id:103,archangel:'Raphaël',year:'2028',status:'published'}
 ],
 celebrations_steps:[{id:1,celebration_id:101,step_key:'mercredi',label:'Mercredi',
  body_text:'SECRET_STAGE_LEGACY',sort_order:1}]
};
function db(){
 return {prepare(sql){
  return {bind(){return this},async all(){
   const name=sql.includes('FROM celebrations_celebrations')?'celebrations_celebrations':
    sql.includes('FROM celebrations_steps')?'celebrations_steps':null;
   return {results:tableRows[name]??[]};
  }};
 }};
}
function publication(){
 const protectedNeutral={id:'neutral-private',group:'page',name:'Secret neutral',
  visibility:'published',accessPolicy:{mode:'SELECTED_TYPES',typeIds:['member-type:cat1']},
  blocks:[{kind:'text',text:'SECRET_ORDINARY_PAGE'}]};
 const publicNeutral={id:'neutral-public',group:'page',name:'Accueil',
  visibility:'published',blocks:[{kind:'text',text:'PUBLIC_HOME'}]};
 const protectedStage={id:'mercredi-101',group:'celebration',
  visibility:'published',accessPolicy:{mode:'SELECTED_TYPES',typeIds:['member-type:cat1']},
  blocks:[{kind:'text',text:'SECRET_STAGE_EDITOR'}]};
 const privatePlan={id:'plan-gabriel-2027-11-10',title:'Gabriel rendez-vous',
  archangel:'Gabriel',year:'2027',visibility:'published'};
 const published={
  shared:{pages:[publicNeutral,protectedNeutral],homeId:publicNeutral.id},
  drafts:{'101':{pages:[protectedStage]}},plans:[privatePlan],
  celebrationVisibility:{'101':'published','102':'published','103':'hidden',
   [privatePlan.id]:'published'},
  celebrationAccessPolicies:{
   '101':{mode:'PUBLIC'},
   '102':{mode:'SELECTED_TYPES',typeIds:['member-type:cat1']},
   '103':{mode:'SELECTED_TYPES',typeIds:['member-type:cat1']},
   [privatePlan.id]:{mode:'ALL_PRIVATE_TYPES'}
  }
 };
 return {drafts:{'101':{pages:[protectedStage]}},shared:published.shared,
  plans:[privatePlan],mediaCatalogue:[],published,publishedRevision:2};
}
test('M018-D: private visible title is listed, private hidden name never appears, direct private ID denied',async()=>{
 const state=publication(),env={DB:db()};
 const view=await loadSevenStageContent(env,'101',{publicOnly:true,publishedState:state});
 assert.deepEqual(view.seed.celebrations.map(c=>String(c.id)),['101','102']);
 const gabriel=view.seed.celebrations.find(c=>String(c.id)==='102');
 assert.equal(gabriel.titleOnly,true);
 assert.equal(gabriel.archangel,'Gabriel');
 assert.ok(!JSON.stringify(gabriel).includes('typeIds'));
 assert.ok(!JSON.stringify(view.seed).includes('SECRET_STAGE_LEGACY'));
 assert.ok(!JSON.stringify(view.seed).includes('SECRET_STAGE_EDITOR'));
 assert.ok(!JSON.stringify(view.seed).includes('Raphaël'));
 await assert.rejects(()=>loadSevenStageContent(env,'102',
  {publicOnly:true,publishedState:state}),/Unknown celebration/);
 await assert.rejects(()=>loadSevenStageContent(env,'103',
  {publicOnly:true,publishedState:state}),/Unknown celebration/);
});
test('M018-D: private planned celebration exposes only minimal label (never pages/media)',async()=>{
 const state=publication(),view=publicSnapshot(state,'101');
 const title=view.titleOnlyCelebrations;
 assert.equal(title.length,1);
 assert.equal(title[0].title,'Gabriel rendez-vous');
 assert.equal(title[0].titleOnly,true);
 assert.ok(!Object.hasOwn(title[0],'accessPolicy'));
 assert.deepEqual(view.plans,[]);
 const client=createPublicVisitorModel().publicSnapshot(view);
 assert.deepEqual(client.titleOnlyCelebrations,title);
 assert.ok(!client.ids.includes('neutral-private'));
 assert.ok(!JSON.stringify(view).includes('SECRET_ORDINARY_PAGE'));
 await assert.rejects(()=>loadSevenStageContent({DB:db()},
  'plan-gabriel-2027-11-10',{publicOnly:true,publishedState:state}),
  /Unknown celebration/);
});
test('M018-D: visitor never links a private title to a selectable celebration',()=>{
 new vm.Script(TRIAL_SITE_CLIENT);
 assert.match(TRIAL_SITE_CLIENT,/entry\.titleOnly\?'div':'a'/);
 assert.match(TRIAL_SITE_CLIENT,/if\(!entry\.titleOnly\)card\.href/);
 assert.match(TRIAL_SITE_CLIENT,/Privée — connexion nécessaire/);
});
