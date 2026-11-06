import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMichaelWednesdayLayout} from '../migration/cloudflare/editor-michael-wednesday-layout.mjs';

const types={
2:'text',3:'heading',4:'text',5:'heading',6:'button',7:'heading',
8:'text',9:'heading',10:'button',11:'heading',12:'heading',13:'audio',
14:'heading',15:'text',16:'heading',17:'image',18:'button',
19:'heading',20:'heading',21:'image',22:'button',23:'heading',24:'image',25:'button',
26:'heading',27:'heading',28:'text',29:'image',30:'audio',31:'heading',
32:'text',33:'image',34:'audio',35:'heading',36:'heading',37:'text',
38:'image',39:'audio',40:'heading',41:'text',42:'heading',43:'image',44:'button',
45:'heading',46:'heading',47:'text',48:'image',49:'button',50:'heading',
51:'text',52:'image',53:'button',54:'heading',55:'text',56:'heading',57:'text',
58:'button',59:'heading',60:'text',61:'button',62:'button',63:'heading',64:'text',
65:'heading',66:'image',67:'button',68:'heading',69:'text',70:'button',
71:'heading',72:'text',73:'button'
};
const titles={3:'Programme de cette célébration au Québec',
7:'Cercle d’Entraide',14:'Engagement devant une contrevertu',
19:'16:00 — Consécration',26:'18:45 — Chants',40:'19:00 — Méditation',
54:'19:30 — Les secrets de la ménora',63:'Essene Radio'};
function sample(){
 const blocks=Array.from({length:72},(_,i)=>{
  const id=i+2,k=types[id];
  const out={id,kind:k,text:titles[id]||'Contenu authentique numéro '+id,align:'left'};
  if(k==='button')out.href=(id===58||id===49||id===53)?
   'https://youtu.be/test'+id:'https://example.org/media/'+id+'.pdf';
  if(k==='audio')out.src='/media/'+id+'.mp3';
  if(k==='image'){out.src='/media/'+id+'.jpg';out.widthPct=50}
  return out;
 });
 return {id:'mercredi-101',group:'celebration',name:'Mercredi',
  blocks,visibility:'published'};
}
const flatten=blocks=>blocks.flatMap(x=>x.kind==='section'?
 (x.columns||[]).flatMap(flatten):[x]);

test('Wednesday keeps all 72 original blocks and creates 21 coherent sections',()=>{
 const p=sample(),original=JSON.parse(JSON.stringify(p));
 const {page,report}=prepareMichaelWednesdayLayout(p);
 assert.deepEqual(p,original,'Pure transformation must not mutate the input');
 assert.equal(page.blocks.length,21);
 assert.equal(report.beforeRoot,72);
 assert.equal(report.afterRoot,21);
 assert.equal(report.leaves,72);
 const leaves=flatten(page.blocks),byId=new Map(leaves.map(x=>[x.id,x]));
 assert.equal(byId.size,72);
 for(const item of original.blocks){
  const copy={...byId.get(item.id)};
  delete copy.hideOnSite;delete copy.displayAsButton;
  assert.deepEqual(copy,item,'Original text, URL and media restored for '+item.id);
 }
 assert.equal(leaves.filter(x=>x.kind==='audio').length,4);
 assert.equal(leaves.filter(x=>x.kind==='image').length,10);
 assert.equal(leaves.filter(x=>x.kind==='button').length,14);
});
test('Chronological sections keep document, music, rites, conference and radio together',()=>{
 const {page}=prepareMichaelWednesdayLayout(sample());
 const groups=page.blocks;
 const bySuffix=s=>groups.find(x=>x.id.endsWith(s+'-2026'));
 assert.deepEqual(bySuffix('programme-pdf').columns[0].map(x=>x.id),[5,6]);
 assert.deepEqual(bySuffix('consecration-courte').columns.map(c=>c.map(x=>x.id)),[[21],[20,22]]);
 assert.deepEqual(bySuffix('chant-allume-ta-bougie').columns.map(c=>c.map(x=>x.id)),[[29],[27,28,30]]);
 assert.deepEqual(bySuffix('meditation-menorah').columns.map(c=>c.map(x=>x.id)),[[43],[40,41,42,44]]);
 assert.deepEqual(bySuffix('bougie-pratique').columns.map(c=>c.map(x=>x.id)),[[52],[50,51,53]]);
 assert.deepEqual(bySuffix('essene-radio-presentation').columns.map(c=>c.map(x=>x.id)),[[66],[65,67]]);
 assert.equal(groups.filter(x=>x.presentation==='resource').length,10);
 assert.equal(groups.filter(x=>x.presentation==='documents').length,1);
 assert.equal(groups.filter(x=>x.presentation==='video').length,2);
});
test('Conference keeps the actual YouTube thumbnail and two independent alternative link buttons',()=>{
 const {page}=prepareMichaelWednesdayLayout(sample());
 const group=page.blocks.find(x=>x.id.includes('conference-menorah'));
 assert.equal(group.layout,'single');assert.equal(group.presentation,'video');
 assert.equal(group.columnButtonLayouts[0],'row');
 assert.deepEqual(group.columns[0].map(x=>x.id),[54,55,56,57,58,59,60,61,62]);
 const youtube=group.columns[0].find(x=>x.id===58);
 assert.equal(youtube.displayAsButton,undefined,
  'Historical linked video must still render its miniature');
 for(const id of [61,62]){
  const link=group.columns[0].find(x=>x.id===id);
  assert.equal(link.displayAsButton,true);
  assert.equal(link.href,'https://example.org/media/'+id+'.pdf');
 }
 assert.deepEqual(flatten(page.blocks).filter(x=>x.hideOnSite).map(x=>x.id).sort((a,b)=>a-b),
 [9,12,36,56,57,59,60]);
});
test('Fail closed if source page changes, links vanish or an unrelated celebration is selected',()=>{
 const wrong=sample();wrong.id='preparation-101';
 assert.throws(()=>prepareMichaelWednesdayLayout(wrong),/Target must be/);
 const badId=sample();badId.blocks[4].id=9000;
 assert.throws(()=>prepareMichaelWednesdayLayout(badId),/Unexpected block order/);
 const edited=sample();edited.blocks.pop();
 assert.throws(()=>prepareMichaelWednesdayLayout(edited),/72 root blocks/);
 const missing=sample();missing.blocks.find(x=>x.id===62).href='';
 assert.throws(()=>prepareMichaelWednesdayLayout(missing),/Missing existing link/);
 const absent=sample();absent.blocks.find(x=>x.id===39).src='';
 assert.throws(()=>prepareMichaelWednesdayLayout(absent),/Missing original audio/);
 const changed=sample();changed.blocks.find(x=>x.id===54).text='Autre conférence';
 assert.throws(()=>prepareMichaelWednesdayLayout(changed),/major Wednesday topic/);
});
