import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareMichaelLayout} from '../migration/cloudflare/editor-michael-preparation-layout.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';
const kinds={34:'heading',35:'text',36:'heading',37:'image',38:'button',
 39:'heading',40:'text',41:'heading',42:'image',43:'button',
 44:'heading',45:'heading',46:'button',47:'heading',48:'heading',
 49:'text',50:'image',51:'audio',52:'heading',53:'text',54:'heading',
 55:'image',56:'button',57:'heading',58:'image',59:'button',
 60:'heading',61:'image',62:'button',63:'heading',64:'image',
 65:'button',66:'heading',67:'text',68:'heading',69:'text',
 70:'image',71:'button'};
const item=(id,kind=kinds[id])=>({id,kind,text:'Document '+id,
 rich:kind==='text'?'<em>Paragraphe '+id+'</em>':undefined,
 src:kind==='image'?'/media/picture-'+id+'.jpg':undefined,
 href:kind==='button'?'/media/doc-'+id+'.pdf':undefined,
 widthPct:kind==='image'?67:undefined});
const section=(id,blocks,cols=[blocks,[]],layout='single')=>({
 id,kind:'section',layout,columns:cols,style:{border:'none',width:1}
});
function fixture(){
 const roots=[
  section('intro',[{...item(4,'heading'),text:'Travail de Préparation'},item(2,'text'),item(3,'text'),item(5,'text')]),
  section('travail',[],[[item(6,'heading'),item(7,'image')],[item(8,'button')]],'columns'),
  item('line-1','divider'),
  section('flammes',[],[[item('title-flammes','heading'),item(12,'image')],[item(13,'audio')]],'columns'),
  section('symbolisme',[],[[item(16,'image')],[item(15,'heading')]],'columns'),
  item(17,'button'),
  section('entraide',[item(18,'heading'),item(19,'text')]),
  section('visages-intro',[item(20,'heading'),item(21,'text')]),
  section('visages-cours',[item(22,'heading'),item(23,'image'),item(24,'button')]),
  section('visages-ceremonie',[item(25,'heading'),item(26,'image'),item(27,'button')]),
  item('line-2','divider'),
  section('documents',[item(28,'heading'),item(29,'button'),item(30,'heading'),
   item(31,'button'),item(32,'heading'),item(33,'button')]),
  item('line-3','divider'),
  ...Array.from({length:38},(_,i)=>item(34+i)),
 ];
 return {id:'preparation-101',name:'Préparation',group:'celebration',blocks:roots};
}
const flatten=items=>items.flatMap(b=>b.kind==='section'?b.columns.flatMap(flatten):[b]);
test('Michaël: re-layout every existing content block without changing text, files or links',()=>{
 const before=fixture();
 const leaves=flatten(before.blocks);
 const map=new Map(leaves.map(x=>[String(x.id),JSON.stringify(x)]));
 const {page,report}=prepareMichaelLayout(before);
 assert.equal(before.blocks.length,51,'Original input is never mutated');
 assert.ok(report.afterRoot<26,'51 disjoint sections are composed into fewer organized zones');
 assert.equal(report.leaves,leaves.length);
 assert.equal(report.beforeRoot,51);
 const after=flatten(page.blocks);
 assert.equal(after.length,leaves.length,'Every file and content is kept');
 const visited=new Set();
 for(const x of after){
  assert.ok(map.has(String(x.id)),'No added false historical item');
  assert.ok(!visited.has(String(x.id)),'No duplicated original item');
  visited.add(String(x.id));
  const y=structuredClone(x);delete y.hideOnSite;
  assert.equal(JSON.stringify(y),map.get(String(x.id)),'Original block fields intact: '+x.id);
 }
 assert.deepEqual(report.hiddenDuplicates,[36,41,45,48,69]);
 assert.ok(page.blocks.some(x=>x.presentation==='resource'&&x.columns[0][0].id===58));
 assert.ok(page.blocks.some(x=>x.presentation==='documents'&&x.columns[0].length===6));
 assert.ok(page.blocks.some(x=>x.presentation==='intro'));
 assert.ok(page.blocks.some(x=>x.presentation==='text'));
 assert.equal(after.filter(x=>x.kind==='button').length,leaves.filter(x=>x.kind==='button').length);
 assert.equal(after.filter(x=>x.kind==='audio').length,2);
 assert.ok(after.some(x=>x.id===17),'The YouTube link stays intact');
 assert.ok(after.some(x=>x.id===71),'Last recommendations PDF remains');
});
test('Migration refuses any different page or new live edit rather than overwrite',()=>{
 assert.throws(()=>prepareMichaelLayout({...fixture(),id:'preparation-102'}),/not the specified/i);
 const changed=fixture();changed.blocks.push(item(72,'button'));
 assert.throws(()=>prepareMichaelLayout(changed),/changed/i);
 const moved=fixture();moved.blocks[5]={...moved.blocks[5],id:999};
 assert.throws(()=>prepareMichaelLayout(moved),/Changed page/);
});
test('Templates are normal editable sections and visitor view supports the layouts',()=>{
 for(const title of ['Ressource : image + document','Vidéo : titre + lecteur',
  'Document : titre + PDF'])assert.ok(DEMO_CLIENT.includes(title),title);
 for(const type of ['resource','video','documents','intro','text'])
  assert.ok(TRIAL_SITE_CLIENT.includes('b.presentation')&&DEMO_CLIENT.includes(type));
 assert.ok(TRIAL_SITE_CLIENT.includes("if(!b||b.hideOnSite===true)return;"));
 assert.ok(TRIAL_SITE_CLIENT.includes("make('article','trial-document-item')"));
});
