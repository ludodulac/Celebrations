import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Execute the real staging handler with an isolated in-memory D1 batch spy.
const source=await readFile(new URL('../migration/cloudflare/safe-save-api.mjs',import.meta.url),'utf8');
const moduleSource=source.replace('import {authorize} from "./auth-api.mjs";','const authorize=async()=>true;').replace('export async function handleSafeSave','async function handleSafeSave');
const ctx=vm.createContext({Request,Response,Date,Set,String,Number,Array,Object});
vm.runInContext(moduleSource+'\nthis.handler=handleSafeSave;',ctx);
const fixture=(dayLinks,eventLinks)=>({action:'safe_merge',groups:[],contents:[],celebrations:[{id:9,archangel:'Test',days:[{key:'day1',label:'Day',links:dayLinks}]}],events:[{id:'event1',celebrationId:9,dayKey:'day1',title:'Event',links:eventLinks}]});
function mock(){const batches=[];const env={DB:{prepare(sql){return {bind(...args){return {sql,args}},run:async()=>({})}},async batch(statements){batches.push(statements)}}};return {env,batches}}
async function save(env,body){const r=await ctx.handler(new Request('https://staging.example/api/safe-save',{method:'POST',body:JSON.stringify(body)}),env);return {status:r.status,body:await r.json()}}
test('day and event links replace atomically with per-parent order',async()=>{const {env,batches}=mock();const result=await save(env,fixture([{url:'https://a.test',label:'A'},{url:'https://b.test',label:'B'}],[{url:'https://c.test',label:'C'}]));assert.equal(result.status,200);assert.equal(batches.length,1);const statements=batches[0];assert.equal(statements.filter(x=>x.sql.startsWith('DELETE FROM celebrations_links')).length,1);const inserts=statements.filter(x=>x.sql.startsWith('INSERT INTO celebrations_links'));assert.equal(inserts.length,3);assert.deepEqual(inserts.map(x=>x.args.at(-1)),[0,1,0]);assert.deepEqual(inserts.map(x=>x.args[2]),[null,null,'event1'])});
test('empty links delete prior links for included celebration',async()=>{const {env,batches}=mock();const result=await save(env,fixture([],[]));assert.equal(result.status,200);assert.equal(batches[0].filter(x=>x.sql.startsWith('DELETE FROM celebrations_links')).length,1);assert.equal(batches[0].filter(x=>x.sql.startsWith('INSERT INTO celebrations_links')).length,0)});
test('incomplete links refuse save without writes',async()=>{const {env,batches}=mock();const data=fixture([],[]);delete data.celebrations[0].days[0].links;const result=await save(env,data);assert.equal(result.status,409);assert.equal(batches.length,0)});
test('invalid link refuses save without writes',async()=>{const {env,batches}=mock();const result=await save(env,fixture([{label:'missing URL'}],[]));assert.equal(result.status,400);assert.equal(batches.length,0)});
