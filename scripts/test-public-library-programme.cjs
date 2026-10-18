// Regression tests for the programme-driven public media gallery.
// Run: node --test scripts/test-public-library-programme.cjs
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('public-library-simple.js','utf8');
const begin=source.indexOf('function imageGalleryItems(');
const end=source.indexOf('\nfunction galleryOriginMeta',begin);
assert.ok(begin>=0&&end>begin,'Gallery selection function exists');
const context={
 state:{contents:[]},
 normalizeGallerySource:v=>String(v||'').trim().toLowerCase(),
 publicLibraryName:c=>c.name,
 audienceOk:a=>a==='all'||a==='angel',
};
vm.createContext(context);
vm.runInContext(source.slice(begin,end),context);
const item=(id,props={})=>({id,name:'Content '+id,audience:'all',category:'Mercredi',type:'Image',sourceType:'file',storagePath:'media/'+id+'.jpg',hasCover:false,...props});
test('only programme-linked images appear',()=>{
 context.state.contents=[item(1),item(2)];
 const result=context.imageGalleryItems(new Set(['1']));
 assert.equal(result.length,1);
 assert.equal(result[0].content.id,1);
});
test('includes a separate cover as well as an image',()=>{
 context.state.contents=[item(1,{hasCover:true,coverStoragePath:'media/cover.jpg'})];
 const result=context.imageGalleryItems(new Set(['1']));
 assert.deepEqual(Array.from(result,x=>x.kind),['cover','image'].sort((a,b)=>a.localeCompare(b))); 
});
test('deduplicates identical media paths, not matching filenames',()=>{
 context.state.contents=[item(1),item(2,{storagePath:'media/1.jpg'}),item(3,{storagePath:'media/3.jpg'})];
 assert.equal(context.imageGalleryItems(new Set(['1','2','3'])).length,2);
});
test('respects audience and excludes welcome-only assets',()=>{
 context.state.contents=[item(1,{audience:'nonangel'}),item(2,{category:'Accueil'}),item(3)];
 assert.equal(context.imageGalleryItems(new Set(['1','2','3'])).length,1);
});
