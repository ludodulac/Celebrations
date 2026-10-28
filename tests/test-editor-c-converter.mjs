import assert from 'node:assert/strict';
import {test} from 'node:test';
import {convertLegacy} from '../scripts/editor-c-converter.mjs';
const STAGES=['Préparation','Mercredi','Jeudi','Vendredi','Samedi','Dimanche','Après célébration'];
function fixture(){
 const celebrations_celebrations=['Michaël','Gabriel','Raphaël','Ouriel'].map((a,i)=>({id:i+1,archangel:a,year:'2026',status:i===3?'planned':'active'}));
 const celebrations_steps=celebrations_celebrations.flatMap(c=>STAGES.map((step,i)=>({
  id:c.id*100+i,celebration_id:c.id,step_key:step,label:step,body_text:'Texte '+step,start_date:'2026-10-01',end_date:'2026-10-02',sort_order:i
 })));
 const celebrations_events=[
  {id:'e2',celebration_id:1,step_key:'Mercredi',title:'Événement tardif',sort_order:2,event_time:'08:00',audience:'angel'},
  {id:'e1',celebration_id:1,step_key:'Mercredi',title:'Événement prioritaire',sort_order:1,event_time:'16:00',audience:'all'}
 ];
 const celebrations_contents=[
  {id:'a',name:'PDF comité? Non',content_type:'PDF',storage_path:'media/a.pdf',audience:'all'},
  {id:'b',name:'Audio privé',content_type:'Audio',storage_path:'media/b.wav',audience:'angel'},
  {id:'c',name:'Vidéo',content_type:'Vidéo',external_url:'https://example.invalid/video',audience:'all'},
  {id:'d',name:'Image',content_type:'Image',storage_path:'media/d.jpg',audience:'all'},
  {id:'orphan',name:'Non affecté',content_type:'Texte',inline_text:'Texte libre',audience:'nonangel'}
 ];
 return {
  celebrations_celebrations,celebrations_steps,celebrations_events,celebrations_contents,
  celebrations_event_contents:[{event_id:'e1',content_id:'a',sort_order:2},{event_id:'e1',content_id:'b',sort_order:1}],
  celebrations_step_contents:[{celebration_id:1,step_key:'Mercredi',content_id:'c',sort_order:5}],
  celebrations_links:[{id:1,celebration_id:1,step_key:'Mercredi',event_id:null,label:'Lien',url:'https://example.invalid',sort_order:1}],
  celebrations_footer_drafts:[{id:1,slug:'mentions-legales',draft_number:1,title:'Mentions',content:'Confidentiel',is_public:0}],
  celebrations_committee_letters:[{id:1,title:'Comité',slug:'comite1',file_name:'unlisted.pdf',storage_path:'committee/comite1.pdf'}],
  celebrations_public_settings:[{id:1,show_other_celebrations:0}]
 };
}
test('C converts all source relationships with stable IDs, confidential drafts, and no generated public URL',()=>{
 const source=fixture();
 const a=convertLegacy(source,{staticPages:{'index.html':'<section id="welcome-home">Bienvenue</section>'}});
 const b=convertLegacy(source,{staticPages:{'index.html':'<section id="welcome-home">Bienvenue</section>'}});
 assert.deepEqual(a,b,'Dry-run replay is deterministic');
 for(const c of Object.values(a.coverage))assert.equal(c.source,c.represented,'Full source coverage');
 assert.equal(a.statistics.celebrations,4);
 assert.equal(a.statistics.days,28);
 assert.equal(a.statistics.source_contents,5);
 assert.equal(a.statistics.source_events,2);
 assert.equal(a.statistics.committee_pdfs,1);
 assert.equal(a.statistics.unpublished_pages,a.statistics.pages);
 assert.ok(a.pages.every(p=>p.blocks.length<=64&&p.route_path.startsWith('/__editor/legacy/')));
 const day=a.pages.find(p=>p.source_key==='celebration:1:step:Mercredi');
 assert.ok(day,'All 7 stages represented by each of the 4 celebrations');
 assert.deepEqual(day.blocks.filter(b=>b.kind==='legacy_event').map(b=>b.source_id),['e1','e2'],'Sort order overrides event time');
 assert.deepEqual(day.blocks.find(b=>b.source_id==='e1').data.ordered_content_refs.map(x=>x.content_id),['b','a'],'Preserves attachment sort order');
 assert.equal(a.pages.filter(p=>p.source_key.startsWith('catalogue-part:')).flatMap(p=>p.blocks).length,source.celebrations_contents.length);
 assert.equal(a.pages.find(p=>p.source_key==='committee-private').blocks[0].data.visibility,'unlisted_by_link');
 assert.equal(a.pages.find(p=>p.source_key==='legal:mentions-legales').blocks[0].data.record.is_public,0);
 assert.equal(a.pages.find(p=>p.source_key==='celebration:4').blocks[0].data.record.status,'planned');
 assert.ok(a.pages.find(p=>p.source_key==='home').blocks.some(b=>b.data?.render_policy==='sanitize_and_review'));
});
test('C notices broken historic associations instead of silently accepting them',()=>{
 const source=fixture();
 source.celebrations_event_contents.push({event_id:'e2',content_id:'missing',sort_order:3});
 const plan=convertLegacy(source);
 assert.ok(plan.notes.some(x=>x==='missing_content_ref:missing'));
 assert.equal(plan.coverage.celebrations_event_contents.represented,3,'Even broken source relation is preserved for review');
});
