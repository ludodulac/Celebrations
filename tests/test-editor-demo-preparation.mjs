import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {handlePreparationDemo,STAGES} from '../migration/cloudflare/editor-demo-preparation-page.mjs';
const host='https://celebrations-exit-staging.rondes.workers.dev/__editor/demo-preparation';
const data={
 celebrations:[{id:101,archangel:'Michaël',year:'2026',status:'active'},{id:202,archangel:'Gabriel',year:'2026'}],
 steps:STAGES.map((stage,index)=>({id:42+index,celebration_id:101,label:stage.label,step_key:stage.slug+'-101',start_date:'2026-10-01',end_date:null,body_text:index===0?'Texte source exact <important> et accents':'Contenu historique '+stage.label})),
 events:[{id:'event-1',step_key:'preparation-101',title:'Temps de préparation',event_time:'19:00',description:'Description exacte',audience:'all',sort_order:1},{id:'event-2',step_key:'mercredi-101',title:'Rencontre mercredi',event_time:'10:00',description:'Rendez-vous public du mercredi',audience:'all',sort_order:2},{id:'event-hidden',step_key:'samedi-101',title:'Rendez-vous privé NE_PAS_PUBLIER',audience:'angel',sort_order:1}],
 eventContents:[{event_id:'event-1',sort_order:1,id:'a',name:'Audio historique',description:'Description audio',content_type:'Audio',source_type:'file',storage_path:'media/son.mp3',audience:'all'}],
 stepContents:[{step_key:'preparation-101',sort_order:1,id:'b',name:'Programme PDF',content_type:'PDF',source_type:'file',storage_path:'media/preparation.pdf',inline_text:'Texte du document',audience:'all'},{step_key:'apres-celebration-101',sort_order:2,id:'finale',name:'PDF de clôture',content_type:'PDF',source_type:'file',storage_path:'media/cloture.pdf',audience:'all'}],
 links:[{id:7,celebration_id:101,step_key:'preparation-101',event_id:null,url:'https://example.org/source',label:'Lien source',sort_order:1}]
};
const sqls=[];
const env={DB:{prepare(sql){sqls.push(sql);return {bind(...params){return {async all(){
  if(sql.includes('FROM celebrations_celebrations'))return {results:data.celebrations};
  if(sql.includes('SELECT DISTINCT c.name,c.file_name,c.storage_path'))return {results:[{name:'Audio historique',file_name:'son.mp3',storage_path:'media/son.mp3',content_type:'Audio'}]};
  if(sql.includes('FROM celebrations_steps'))return {results:data.steps};
  if(sql.includes('FROM celebrations_links'))return {results:data.links};
  if(sql.includes('FROM celebrations_events WHERE'))return {results:data.events.filter(e=>e.audience==='all')};
  if(sql.includes('FROM celebrations_event_contents'))return {results:data.eventContents};
  if(sql.includes('FROM celebrations_step_contents'))return {results:data.stepContents};
  if(sql.includes('FROM celebrations_links'))return {results:data.links};
  throw new Error('Unexpected SQL');
 }}}}}}};
test('Preparation demo includes every public step/event/content/link without database write',async()=>{
 const r=await handlePreparationDemo(new Request(host),env);
 assert.equal(r.status,200);
 const html=await r.text();
 for(const required of ['Texte source exact','Temps de préparation','Description exacte','Audio historique','Description audio','Programme PDF','Texte du document','Lien source','preparation-101','Pages de la célébration']){
  assert.ok(html.includes(required),required);
 }
 assert.ok(html.includes('media/son.mp3'));
 assert.ok(html.includes('href="/__editor/demo-preparation?celebration=101&page=neutral-accueil-general">← Accueil général</a>'),'Back navigation must stay in the new editor');
 assert.ok(!html.includes('href="/__editor/demo">← Atelier principal</a>'),'Old disconnected mockup must not be reachable from the new editor');
 assert.ok(html.includes('media/preparation.pdf'));
 assert.ok(!html.includes('secret')&&!html.includes('committee/'));
 const seedMatch=html.match(/window\.__PREPARATION_SEED__=([\s\S]*?);document\.getElementById/);
 assert.ok(seedMatch,'8 celebration pages plus neutral home embedded');
 const seed=JSON.parse(seedMatch[1]);
 assert.equal(seed.pages.length,9);
 assert.deepEqual(seed.pages.filter(p=>p.group==='celebration').map(p=>p.name),STAGES.map(s=>s.label));
 for(const page of seed.pages)assert.ok(page.blocks.length>0,'Missing '+page.name);
 assert.ok(seed.pages.find(p=>p.name==='Mercredi').blocks.some(b=>b.text.includes('Rencontre mercredi')));
 assert.ok(seed.pages.find(p=>p.name==='Après préparation').blocks.some(b=>b.text.includes('PDF de clôture')));
 assert.ok(seed.pages.find(p=>p.name==='Préparation').blocks.some(b=>b.text.includes('Programme PDF')));
 assert.ok(!html.includes('NE_PAS_PUBLIER'));
 assert.equal(seed.pages.filter(p=>p.group==='page').length,1);
 assert.equal(seed.pages[0].name,'Accueil général');
 assert.equal(seed.pages[0].blocks[0].text,'Ronde des Archanges Universelle');
 assert.ok(seed.media.some(m=>m.src.endsWith('/son.mp3')));
 assert.ok(seed.pages.find(p=>p.name==='Préparation').blocks.some(b=>b.kind==='audio'));
 assert.equal(seed.celebrations.length,2);
 assert.ok(html.includes("for(const archived of seed.pages"),'Older local edits preserved while other stages appear');
  assert.ok(sqls.every(x=>x.trim().startsWith('SELECT ')));
 assert.equal(sqls.length,7);
 assert.match(r.headers.get('content-security-policy'),/connect-src 'self'/);
 assert.ok(html.includes('MP3 et stockage R2'));
 assert.ok(html.includes('window.__STAGING_AUDIO__'));
 const scripts=[...html.matchAll(/<script nonce="[0-9a-f]+">([\s\S]*?)<\/script>/g)].map(x=>x[1]);
 assert.equal(scripts.length,2);
 for(const s of scripts)new Script(s);
 assert.ok(scripts[1].includes("celebrations-demo-preparation-"));
 assert.ok(scripts[1].includes("seed.pages=window.__PREPARATION_SEED__.pages"));
});
test('No other host, unsafe methods or arbitrary celebration',async()=>{
 const wrong=await handlePreparationDemo(new Request('https://www.ronde-des-archanges-universelle.eu/__editor/demo-preparation'),env);
 assert.equal(wrong.status,404);
 const post=await handlePreparationDemo(new Request(host,{method:'POST'}),env);
 assert.equal(post.status,405);
 const fake=await handlePreparationDemo(new Request(host+'?celebration=999'),env);
 assert.equal(fake.status,404);
});

test('Créer une célébration Gabriel depuis mercredi : huit étapes et dimanche à J+4, sans DB write',async()=>{
 const id='plan-gabriel-2026-11-04';
 const response=await handlePreparationDemo(new Request(host+'?celebration='+id),env);
 assert.equal(response.status,200);
 const html=await response.text();
 const match=html.match(/window\.__PREPARATION_SEED__=([\s\S]*?);document\.getElementById/);
 const seed=JSON.parse(match[1]);
 assert.equal(seed.archangel,'Gabriel');
 assert.equal(seed.start_date,'2026-11-04');
 assert.equal(seed.end_date,'2026-11-08');
 assert.equal(seed.pages.filter(p=>p.group==='celebration').length,8);
 assert.equal(seed.pages.find(p=>p.name==='Mercredi').blocks[1].text,'Date : 2026-11-04');
 assert.equal(seed.pages.find(p=>p.name==='Dimanche').blocks[1].text,'Date : 2026-11-08');
 assert.equal((await handlePreparationDemo(new Request(host+'?celebration=plan-raphael-2026-11-05'),env)).status,404);
});
