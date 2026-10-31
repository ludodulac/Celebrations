import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {handlePreparationDemo} from '../migration/cloudflare/editor-demo-preparation-page.mjs';
const host='https://celebrations-exit-staging.rondes.workers.dev/__editor/demo-preparation';
const data={
 celebrations:[{id:101,archangel:'Michaël',year:'2026',status:'active'},{id:202,archangel:'Gabriel',year:'2026'}],
 steps:[{id:42,celebration_id:101,label:'Préparation',step_key:'preparation-101',start_date:'2026-10-01',end_date:null,body_text:'Texte source exact <important> et accents'}],
 events:[{id:'event-1',title:'Temps de préparation',event_time:'19:00',description:'Description exacte',audience:'all',sort_order:1}],
 eventContents:[{event_id:'event-1',sort_order:1,id:'a',name:'Audio historique',description:'Description audio',content_type:'Audio',source_type:'file',storage_path:'media/son.mp3',audience:'all'}],
 stepContents:[{sort_order:1,id:'b',name:'Programme PDF',content_type:'PDF',source_type:'file',storage_path:'media/preparation.pdf',inline_text:'Texte du document',audience:'all'}],
 links:[{id:7,celebration_id:101,step_key:'preparation-101',event_id:null,url:'https://example.org/source',label:'Lien source',sort_order:1}]
};
const sqls=[];
const env={DB:{prepare(sql){sqls.push(sql);return {bind(...params){return {async all(){
  if(sql.includes('FROM celebrations_celebrations'))return {results:data.celebrations};
  if(sql.includes('FROM celebrations_steps'))return {results:data.steps};
  if(sql.includes('FROM celebrations_links'))return {results:data.links};
  if(sql.includes('FROM celebrations_events WHERE'))return {results:data.events};
  if(sql.includes('FROM celebrations_event_contents'))return {results:data.eventContents};
  if(sql.includes('FROM celebrations_step_contents'))return {results:data.stepContents};
  if(sql.includes('FROM celebrations_links'))return {results:data.links};
  throw new Error('Unexpected SQL');
 }}}}}}};
test('Preparation demo includes every public step/event/content/link without database write',async()=>{
 const r=await handlePreparationDemo(new Request(host),env);
 assert.equal(r.status,200);
 const html=await r.text();
 for(const required of ['Texte source exact','Temps de préparation','Description exacte','Audio historique','Description audio','Programme PDF','Texte du document','Lien source','preparation-101','Préparation réelle']){
  assert.ok(html.includes(required),required);
 }
 assert.ok(html.includes('media/son.mp3'));
 assert.ok(html.includes('media/preparation.pdf'));
 assert.ok(!html.includes('secret')&&!html.includes('committee/'));
 assert.ok(sqls.every(x=>x.trim().startsWith('SELECT ')));
 assert.equal(sqls.length,6);
 assert.match(r.headers.get('content-security-policy'),/connect-src 'none'/);
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
