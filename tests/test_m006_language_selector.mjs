import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPublicLanguageSelector} from
 '../migration/cloudflare/app/application/public-language-selector.mjs';
import {activePublicLanguages} from
 '../migration/cloudflare/app/domain/public-language-navigation.mjs';
import {createPreparedLanguageRegistry as createLanguageRegistry,addLanguage,setLanguageActive} from
 '../migration/cloudflare/app/domain/editor-localization.mjs';

function mockDocument(){
 const doc={};
 doc.createElement=tag=>({
  tag,attrs:{},className:'',textContent:'',children:[],ownerDocument:doc,
  setAttribute(key,val){this.attrs[key]=val;},
  append(...nodes){this.children.push(...nodes);},
  replaceChildren(...nodes){this.children=[...nodes];}
 });
 return doc;
}
function walk(node){
 return [node,...(node.children||[]).flatMap(walk)];
}
test('M006 UI: native details selector shows active flags and names, and accessible links',()=>{
 const doc=mockDocument(),container=doc.createElement('div');
 const reg=createLanguageRegistry();
 const options=activePublicLanguages(reg,'en',
  'https://www.ronde-des-archanges-universelle.eu/mercredi?x=1');
 const node=renderPublicLanguageSelector(container,options);
 assert.equal(node.tag,'details');
 assert.equal(container.children[0],node);
 const elements=walk(node),links=elements.filter(n=>n.tag==='a');
 assert.equal(links.length,8);
 assert.deepEqual(links.map(n=>n.attrs.hreflang),['fr','en','es','de','pt','it','ar','zh-Hans']);
 assert.equal(links[1].attrs['aria-current'],'true');
 assert.equal(links[1].attrs.href,'https://www.ronde-des-archanges-universelle.eu/mercredi?x=1&lang=en');
 assert.ok(elements.some(n=>n.textContent==='English'));
 assert.ok(elements.some(n=>n.textContent==='🇬🇧'));
 assert.ok(elements.some(n=>n.attrs['aria-label']==='Choisir la langue'));
});
test('M006 UI: safe relative flag images, unsafe URL flags stay inert text',()=>{
 const doc=mockDocument(),container=doc.createElement('div');
 const node=renderPublicLanguageSelector(container,[
  {id:'fr',name:'Français',flag:'flags/fr.svg',selected:true,href:'/?lang=fr'},
  {id:'en',name:'English',flag:'javascript:alert(1)',selected:false,
   href:'/?lang=en'}
 ]);
 const elements=walk(node),images=elements.filter(n=>n.tag==='img');
 assert.equal(images.length,2); // one in selected summary + one in list
 assert.equal(images[0].attrs.src,'/flags/fr.svg');
 assert.equal(images[0].attrs.alt,'');
 assert.ok(elements.some(n=>n.textContent==='javascript:alert(1)'));
 assert.equal(elements.some(n=>n.attrs.src==='javascript:alert(1)'),false);
});
test('M006 UI: renderer uses only supplied public options, no global state',()=>{
 const doc=mockDocument(),container=doc.createElement('div');
 assert.throws(()=>renderPublicLanguageSelector(container,[]),TypeError);
 renderPublicLanguageSelector(container,[{id:'fr',name:'Français',
  flag:'🇫🇷',selected:true,href:'/?lang=fr'}]);
 assert.equal(container.children.length,1);
 renderPublicLanguageSelector(container,[{id:'en',name:'English',
  flag:'🇬🇧',selected:true,href:'/?lang=en'}]);
 assert.equal(container.children.length,1);
});
