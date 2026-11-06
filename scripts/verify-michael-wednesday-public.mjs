import assert from 'node:assert/strict';
const origin='https://ronde-des-archanges-universelle.eu';
const response=await fetch(origin+'/api/editor-publication?celebration=101',{cache:'no-store'});
assert.equal(response.status,200,'Official public data must load');
const data=await response.json();
const page=data.record?.pages?.find(p=>p.id==='mercredi-101');
assert.ok(page,'Michaël Wednesday page must exist');
assert.equal(page.visibility,'published');
assert.equal(page.blocks.length,21,'Wednesday must contain exactly 21 carefully grouped sections');
const flatten=b=>b.flatMap(x=>x.kind==='section'?(x.columns||[]).flatMap(flatten):[x]);
const leaf=flatten(page.blocks);
assert.equal(leaf.length,72,'All the original items must still exist');
const counts=Object.fromEntries(['heading','text','image','audio','button'].map(k=>[k,leaf.filter(x=>x.kind===k).length]));
assert.deepEqual(counts,{heading:28,text:16,image:10,audio:4,button:14});
const hidden=leaf.filter(x=>x.hideOnSite===true).map(x=>Number(x.id)).sort((a,b)=>a-b);
assert.deepEqual(hidden,[9,12,36,56,57,59,60]);
const links=new Map(leaf.filter(x=>x.kind==='button').map(x=>[Number(x.id),x]));
for(const id of [61,62])assert.equal(links.get(id)?.displayAsButton,true);
assert.equal(links.get(58)?.displayAsButton,undefined,
 'Original conference YouTube video must stay a video thumbnail');
for(const s of page.blocks)assert.equal(s.kind,'section');
assert.equal(page.blocks.filter(s=>s.presentation==='resource').length,10);
assert.equal(page.blocks.filter(s=>s.presentation==='documents').length,1);
assert.equal(page.blocks.filter(s=>s.presentation==='video').length,2);
console.log('MICHAEL_WEDNESDAY_OFFICIAL_PUBLIC_PASS '+JSON.stringify({
 page:page.id,sections:page.blocks.length,untouchedLeafCount:leaf.length,
 ...counts,hideRepeats:hidden.length,alternativeConferenceButtons:true
}));
