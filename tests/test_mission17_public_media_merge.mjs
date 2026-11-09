import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergePublicMediaIndexed} from '../migration/cloudflare/app/domain/editor-public-media-merge.mjs';
import {mergePublicMedia,publishedMedia,publicSnapshot} from '../migration/cloudflare/editor-publication-api.mjs';

// Frozen, verbatim M16 implementation. This is an output-equivalence oracle,
// not a second production implementation or a rewrite of saved records.
function legacyMergePublicMedia(...catalogues){
 const merged=new Map();
 for(const item of catalogues.flat()){
  if(!item?.src||!['image','video','audio','pdf','file'].includes(item.type))continue;
  const id=item.type+'|'+item.src;
  if(!merged.has(id))merged.set(id,{...item,id,uses:[...(item.uses||[])]});
  else{
   const existing=merged.get(id);
   for(const use of item.uses||[])
    if(!existing.uses.some(u=>u.pageId===use.pageId&&u.celebrationId===use.celebrationId))existing.uses.push(use);
   if(item.general)existing.general=true;
  }
 }
 return [...merged.values()];
}
const pair=(i,celebration='101')=>({pageId:'page-'+i,celebrationId:celebration,
 name:'Nom de la page '+i,slug:'mercredi-'+i,group:'celebration'});
const cases=[
 [[],[],[]],
 [[null,{}, {src:'/media/test.jpg',type:'unknown'}, {src:'',type:'image'}]],
 [[{id:'legacy-id',name:'Première',src:'/media/pic.jpg',type:'image',
   source:'historical',general:false,uses:[pair(1),pair(1),pair(2)]}],
  [{name:'Deuxième',src:'/media/pic.jpg',type:'image',general:true,
    uses:[pair(1),pair(3),pair(2)]}]],
 [[{src:'/media/item.pdf',type:'pdf',uses:[{pageId:1,celebrationId:null},
   {pageId:NaN,celebrationId:'101'}]}],
  [{src:'/media/item.pdf',type:'pdf',uses:[{pageId:1,celebrationId:null},
   {pageId:NaN,celebrationId:'101'},{pageId:undefined,celebrationId:0}]}]],
 [[{src:'/media/pic.jpg',type:'image',uses:[pair(1)]},
   {src:'/media/pic.jpg',type:'audio',uses:[pair(2)]}],
  [{src:'/media/pic.jpg',type:'image',uses:[pair(3)]}]]
];
test('M17: exact M16 results on edge cases, duplicate uses, extra metadata and NaN',()=>{
 for(const input of cases){
  assert.deepEqual(mergePublicMediaIndexed(...input),legacyMergePublicMedia(...input));
  assert.deepEqual(mergePublicMedia(...input),legacyMergePublicMedia(...input));
 }
 const input=cases[2],frozen=structuredClone(input);
 const merged=mergePublicMedia(...input);
 assert.deepEqual(input,frozen,'merge may not mutate the source R2 records');
 assert.equal(merged[0].name,'Première','first-seen media metadata retained');
 assert.equal(merged[0].general,true,'later public-gallery status remains visible');
 assert.deepEqual(merged[0].uses.map(x=>x.pageId),[
  'page-1','page-1','page-2','page-3']);
});
test('M17: indexed merger preserves the very same order and refs as legacy on 300 seeded fixtures',()=>{
 let seed=7132927;
 function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
 for(let fixture=0;fixture<300;fixture++){
  const cats=[];
  for(let c=0;c<1+(fixture%5);c++){
   const rows=[];
   for(let j=0;j<10+(fixture%13);j++){
    const id=Math.floor(rand()*13),type=['image','video','pdf','audio','file'][Math.floor(rand()*5)];
    const uses=[];
    for(let k=0;k<1+Math.floor(rand()*12);k++)
     uses.push({pageId:'stage-'+Math.floor(rand()*9),
      celebrationId:String(Math.floor(rand()*4)),extra:'Meta '+k});
    rows.push({id:'old-'+j,type,src:'/media/'+id+'.jpg',uses,
     general:rand()>.78,name:'Source '+j,custom:{retain:fixture}});
   }
   cats.push(rows);
  }
  const before=JSON.stringify(cats);
  assert.deepEqual(mergePublicMediaIndexed(...cats),legacyMergePublicMedia(...cats),
   'fixture '+fixture);
  assert.equal(JSON.stringify(cats),before,'unexpected mutation on '+fixture);
 }
});
test('M17: first file duplicate uses, order and custom props stay byte-identical',()=>{
 const items=[[{type:'image',src:'/media/one.png',name:'Initial',
  custom:{linkText:'Ne pas perdre'},uses:[pair(2),pair(2),pair(3)]}],
 [{type:'image',src:'/media/one.png',name:'Renommer plus tard',
  custom:{linkText:'autre'},uses:[pair(4),pair(2)]}],
 [{type:'image',src:'/media/two.png',name:'Deuxième',uses:[pair(8)]}]];
 const old=legacyMergePublicMedia(...items);
 const fresh=mergePublicMedia(...items);
 assert.deepEqual(fresh,old);
 assert.equal(fresh[0].custom.linkText,'Ne pas perdre');
 assert.equal(fresh[0].uses[0],items[0][0].uses[0],
  'existing use refs must not be cloned or rewritten');
 assert.equal(fresh[0].uses.length,4);
 assert.deepEqual(fresh.map(x=>x.src),['/media/one.png','/media/two.png']);
});
test('M17: published/private separation continues upstream of the merge',()=>{
 const state={version:8,drafts:{},shared:{pages:[],homeId:''},plans:[],
  mediaCatalogue:[],published:{shared:{homeId:'neutral-accueil-general',
    pages:[{id:'neutral-accueil-general',group:'page',visibility:'published',
     blocks:[{kind:'image',src:'/media/home.png'}]},
    {id:'neutral-secret',group:'page',visibility:'draft',
     blocks:[{kind:'image',src:'/media/secret.png'}]}]},
    drafts:{'101':{pages:[{id:'mercredi-101',name:'Mercredi',
      group:'celebration',visibility:'published',
      blocks:[{kind:'image',src:'/media/public.png'}]},
     {id:'jeudi-101',name:'Jeudi',group:'celebration',visibility:'hidden',
      blocks:[{kind:'image',src:'/media/hidden.png'}]}]}},
    plans:[],celebrationVisibility:{'101':'published'}}};
 const snapshot=publicSnapshot(state,'101');
 const merged=mergePublicMedia(snapshot.media,[]);
 const asText=JSON.stringify(merged);
 assert.ok(asText.includes('/media/public.png'));
 assert.ok(asText.includes('/media/home.png'));
 assert.ok(!asText.includes('secret.png')&&!asText.includes('hidden.png'));
 assert.deepEqual(merged,legacyMergePublicMedia(snapshot.media,[]));
});
test('M17: indexed media module is pure and has no transport, DOM or storage writes',()=>{
 const source=readFileSync('migration/cloudflare/app/domain/editor-public-media-merge.mjs','utf8');
 for(const forbidden of ['fetch(', 'localStorage','indexedDB','document.', 'window.',
  'env.', '.put(', '.delete(', 'serverSave(', 'serverPublish('])
  assert.ok(!source.includes(forbidden),forbidden);
 const api=readFileSync('migration/cloudflare/editor-publication-api.mjs','utf8');
 assert.ok(api.includes("return mergePublicMediaIndexed(...catalogues)"));
 assert.ok(api.includes("snapshot.media=mergePublicMedia(snapshot.media,historic)"));
});
