import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';

const BASE='65caf8d5d03d29882d0de0c0d00cdcfc622e473e';
const oldCode=execFileSync('git',['show',BASE+':supabase-data.js'],{encoding:'utf8'});
const newCode=readFileSync('supabase-data.js','utf8');
const tables=['celebrations_celebrations','celebrations_steps','celebrations_events',
 'celebrations_contents','celebrations_event_contents','celebrations_step_contents',
 'celebrations_links','celebrations_groups'];
const fixture={
 celebrations_celebrations:[{id:101,archangel:'Michaël',year:'2026',status:'active'}],
 celebrations_steps:[{celebration_id:101,step_key:'mercredi',label:'Mercredi',
  start_date:'2026-11-11',end_date:'2026-11-11',body_text:'Bienvenue'}],
 celebrations_events:[{id:42,celebration_id:101,step_key:'mercredi',title:'Célébration',
   event_time:'18:00',description:'Texte',audience:'all',sort_order:3}],
 celebrations_contents:[{id:7,name:'Photo',content_type:'IMAGE',category:'Image',
   storage_path:'media/image-test.jpg',mime_type:'image/jpeg',has_cover:false}],
 celebrations_event_contents:[{event_id:42,content_id:7}],
 celebrations_step_contents:[{celebration_id:101,step_key:'mercredi',content_id:7}],
 celebrations_links:[{event_id:null,celebration_id:101,step_key:'mercredi',
   label:'Programme',url:'/programme/',link_type:'link'}],
 celebrations_groups:[{id:1,name:'Participants'}]
};
async function run(code,data,backendPresent=true){
 const calls=[];
 const ctx={
  window:backendPresent?{celebrationsStagingData:async name=>{
    calls.push(name);
    if(!Object.hasOwn(data,name))throw new Error('Unknown table');
    return structuredClone(data[name]);
  }}:{},
  localStorage:{getItem:()=>null},
  DEFAULTS:{groups:[{id:99,name:'Tous'}]},
  clone:value=>JSON.parse(JSON.stringify(value)),
  console:{warn(){},error(){}}
 };
 const output=await runInNewContext(code+'\nloadStateFromSupabase()',ctx);
 return {output:JSON.parse(JSON.stringify(output)),calls};
}
test('M01: 8 legacy pseudo-REST reads become direct Cloudflare D1 table calls',()=>{
 assert.ok(oldCode.includes('/rest/v1/celebrations_celebrations?'));
 assert.ok(!newCode.includes('/rest/v1/'));
 assert.ok(newCode.includes('readCloudflareTable('));
 assert.ok(!newCode.includes('function sbJson('));
 for(const name of tables)assert.ok(newCode.includes("readCloudflareTable('"+name+"')"));
});
test('M01: content, link, image, date, visibility and association results identical',async()=>{
 const previous=await run(oldCode,fixture);
 const next=await run(newCode,fixture);
 assert.deepEqual(next,previous);
 assert.deepEqual(next.calls,tables);
 assert.equal(next.output.celebrations[0].archangel,'Michaël');
 assert.equal(next.output.contents[0].storagePath,'media/image-test.jpg');
});
test('M01: empty D1 response still returns exactly the historic fallback',async()=>{
 const empty=Object.fromEntries(tables.map(t=>[t,[]]));
 assert.deepEqual(await run(newCode,empty),await run(oldCode,empty));
});
test('M01: missing Cloudflare D1 adapter fails closed, never contacts Supabase',async()=>{
 await assert.rejects(()=>run(newCode,fixture,false),/Cloudflare D1 indisponible/);
});
test('M01: table name is strictly validated',async()=>{
 const env={window:{celebrationsStagingData:()=>{throw Error('Called unexpectedly')}}};
 await assert.rejects(()=>runInNewContext(newCode+
  "\nreadCloudflareTable('other_private_table')",env),/Cloudflare D1 indisponible/);
});
