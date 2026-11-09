// M17 — reproducible, SYNTHETIC in-process benchmark of the M16 media
// merge versus the M17 implementation, with output-equivalence assertion.
// This is not a claim about real traffic, Cloudflare latency or production D1.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {mergePublicMedia} from '../migration/cloudflare/editor-publication-api.mjs';
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
const makeCase=mediaCount=>{
 const c=[[],[],[]];
 for(let index=0;index<mediaCount;index++){
  const src='/media/media/fichier-'+index+'.jpg';
  for(let part=0;part<3;part++){
   const uses=[];
   for(let i=0;i<48;i++){
    const n=part*24+i;
    uses.push({pageId:'page-'+n,celebrationId:String(index%9),
     pageName:'Page '+n,group:'celebration'});
   }
   c[part].push({id:'image|'+src,type:'image',src,name:'Média '+index,
    source:part===0?'historical':'uploaded',general:part===2,uses});
  }
 }
 return c;
};
const sample=(fn,input,rounds=9)=>{
 const durations=[];
 for(let i=0;i<rounds;i++){
  const start=performance.now();
  const output=fn(...input);
  const time=performance.now()-start;
  assert.equal(output.length,input[0].length);
  if(i>1)durations.push(time);
 }
 durations.sort((a,b)=>a-b);
 return durations[Math.floor(durations.length/2)];
};
for(const mediaCount of [150,500,1000]){
 const input=makeCase(mediaCount);
 const expected=legacyMergePublicMedia(...input);
 assert.deepEqual(mergePublicMedia(...input),expected,'M17 media output differs');
 // Alternate order to minimize one-sided JIT / thermal effects.
 const baselineMs=sample(legacyMergePublicMedia,input);
 const indexedMs=sample(mergePublicMedia,input);
 const ratio=baselineMs/indexedMs;
 console.log('M17_MEDIA_MERGE_BENCHMARK '+JSON.stringify({
  synthetic:true,node:process.version,mediaItems:mediaCount,
  catalogues:3,rawUses:mediaCount*3*48,
  uniqueUses:expected.reduce((sum,m)=>sum+m.uses.length,0),
  baselineMs:+baselineMs.toFixed(3),indexedMs:+indexedMs.toFixed(3),
  speedup: +ratio.toFixed(2),outputEqual:true
 }));
}
