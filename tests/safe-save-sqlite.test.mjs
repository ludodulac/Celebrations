import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import vm from 'node:vm';

// All writes are confined to a fresh in-memory SQLite DB, never Cloudflare.
const source=await readFile(new URL('../migration/cloudflare/safe-save-api.mjs',import.meta.url),'utf8');
const moduleSource=source.replace('import {authorize} from "./auth-api.mjs";','const authorize=async()=>true;').replace('export async function handleSafeSave','async function handleSafeSave');
const ctx=vm.createContext({Request,Response,Date,Set,String,Number,Array,Object});
vm.runInContext(moduleSource+'\nthis.handler=handleSafeSave;',ctx);
const schema=await readFile(new URL('../migration/cloudflare/celebrations-schema.sql',import.meta.url),'utf8');
function isolatedD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(schema);
  const env={DB:{prepare(sql){return {bind(...args){return {sql,args,run:async()=>sqlite.prepare(sql).run(...args)}}}}, async batch(statements){
    sqlite.exec('BEGIN');
    try{const result=statements.map(({sql,args})=>sqlite.prepare(sql).run(...args));sqlite.exec('COMMIT');return result}
    catch(error){sqlite.exec('ROLLBACK');throw error}
  }}};
  return {sqlite,env};
}
async function save(env,body) {
  const resp=await ctx.handler(new Request('https://isolated.example/api/safe-save',{method:'POST',body:JSON.stringify(body)}),env);
  return {status:resp.status,body:await resp.json()};
}
const snapshot=()=>({action:'safe_merge',groups:[],contents:[
 {id:'c1',name:'Audio',type:'audio',sourceType:'storage',storagePath:'media/audio.mp3',fileName:'audio.mp3',hasCover:true,coverStoragePath:'media/cover.png',coverFileName:'cover.png'},
 {id:'c2',name:'Texte',type:'text',sourceType:'inline',text:'Texte existant'}
],celebrations:[{id:9,archangel:'Gabriel',days:[{key:'d1',label:'Jour 1',contentIds:['c2','c1'],links:[{label:'Premier',url:'https://example.org/1'},{label:'Second',url:'https://example.org/2'}]}]}],events:[{id:'e1',celebrationId:9,dayKey:'d1',title:'Événement',contentIds:['c1','c2'],links:[{label:'Page',url:'https://example.org/e'}]}]});
const links=(db,id)=>db.prepare('SELECT step_key,event_id,label,url,sort_order FROM celebrations_links WHERE celebration_id=? ORDER BY event_id,sort_order').all(id);

test('isolated SQLite round-trip: links, relations, media refs, idempotence and unrelated records',async()=>{
  const {sqlite,env}=isolatedD1();
  try{
    sqlite.prepare('INSERT INTO celebrations_celebrations (id,archangel) VALUES (?,?)').run(99,'Unaffected');
    sqlite.prepare('INSERT INTO celebrations_links (celebration_id,step_key,label,url,sort_order) VALUES (?,?,?,?,?)').run(99,'other','Keep','https://unrelated.example',0);
    const unrelatedBefore=links(sqlite,99);
    const data=snapshot();
    assert.equal((await save(env,data)).status,200);
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM celebrations_links WHERE celebration_id=9').get().n,3);
    assert.deepEqual(sqlite.prepare('SELECT content_id,sort_order FROM celebrations_event_contents WHERE event_id=? ORDER BY sort_order').all('e1').map(x=>[x.content_id,x.sort_order]),[['c1',0],['c2',1]]);
    assert.deepEqual(sqlite.prepare('SELECT content_id,sort_order FROM celebrations_step_contents WHERE celebration_id=9 ORDER BY sort_order').all().map(x=>[x.content_id,x.sort_order]),[['c2',0],['c1',1]]);
    assert.equal(sqlite.prepare('SELECT storage_path FROM celebrations_contents WHERE id=?').get('c1').storage_path,'media/audio.mp3');
    assert.equal(sqlite.prepare('SELECT cover_storage_path FROM celebrations_contents WHERE id=?').get('c1').cover_storage_path,'media/cover.png');
    const first=links(sqlite,9);
    assert.equal((await save(env,data)).status,200);
    assert.deepEqual(links(sqlite,9),first);
    assert.deepEqual(links(sqlite,99),unrelatedBefore);
    data.events[0].title='Événement modifié';
    data.events[0].links=[]; // explicit removal, other celebration and day links untouched
    assert.equal((await save(env,data)).status,200);
    assert.equal(sqlite.prepare('SELECT title FROM celebrations_events WHERE id=?').get('e1').title,'Événement modifié');
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM celebrations_links WHERE celebration_id=9').get().n,2);
    assert.deepEqual(links(sqlite,99),unrelatedBefore);
    assert.equal(sqlite.prepare('PRAGMA foreign_key_check').all().length,0);
  }finally{sqlite.close()}
});
