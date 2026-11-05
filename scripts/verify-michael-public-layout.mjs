import assert from 'node:assert/strict';
const url='https://ronde-des-archanges-universelle.eu/api/editor-publication?celebration=101';
const res=await fetch(url,{cache:'no-store'});
assert.equal(res.status,200,'Published snapshot must be publicly readable');
const json=await res.json(),page=json.record?.pages?.find(p=>p.id==='preparation-101');
assert.ok(page,'Michaël preparation exists publicly');
assert.equal(page.blocks.length,23,'Exactly 23 coherent page sections after migration');
assert.equal(page.blocks.filter(x=>x.presentation==='resource').length,13);
assert.equal(page.blocks.filter(x=>x.presentation==='documents').length,2);
assert.equal(page.blocks.filter(x=>x.kind==='divider').length,3);
const flatten=blocks=>blocks.flatMap(b=>b.kind==='section'?
 (b.columns||[]).flatMap(flatten):[b]);
const leaf=flatten(page.blocks);
assert.equal(leaf.length,70,'All 70 original media/content elements remain');
assert.equal(leaf.filter(x=>x.hideOnSite).length,5);
assert.equal(leaf.filter(x=>x.kind==='audio').length,2);
assert.equal(leaf.filter(x=>x.kind==='button').length,15);
assert.equal(leaf.filter(x=>x.kind==='image').length,13);
assert.equal(leaf.filter(x=>x.kind==='heading').length,26);
console.log('MICHAEL_PUBLIC_LAYOUT_CONFIRMED '+JSON.stringify({
 page:page.id,sections:page.blocks.length,unchangedOriginalItems:leaf.length,
 resourceCards:13,documents:2,duplicateTitlesHidden:5,audios:2,pdfsAndVideoLinks:15
}));
