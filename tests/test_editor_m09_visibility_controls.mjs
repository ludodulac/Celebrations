import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';

function editorVisibilityFixture(){
 const iconStart=DEMO_CLIENT.indexOf('function visibilityEyeIcon(');
 const iconEnd=DEMO_CLIENT.indexOf('\nfunction block(',iconStart);
 const settingsStart=DEMO_CLIENT.indexOf('function sectionSettings(');
 const settingsEnd=DEMO_CLIENT.indexOf('\n// The default is top',settingsStart);
 const renderStart=DEMO_CLIENT.indexOf('function renderSection(');
 const renderEnd=DEMO_CLIENT.indexOf('\nasync function removeCustomPage',renderStart);
 assert.ok(iconStart>0&&iconEnd>iconStart&&settingsStart>0&&settingsEnd>settingsStart&&renderEnd>renderStart);
 const env={marked:0,rendered:0};
 const script=`
 let preview=false;
 function node(tag,cls='',text=''){
  const obj={tag,className:cls,textContent:text,attributes:{},children:[],dataset:{},
    classList:{items:new Set(),add(x){this.items.add(x)},contains(x){return this.items.has(x)}},
    append(...parts){this.children.push(...parts)},setAttribute(k,v){this.attributes[k]=v}};
  return obj;
 }
 const document={createElementNS:(ns,tag)=>node(tag)};
 function n(tag,cls='',text=''){return node(tag,cls,text)}
 function b(text,fn,cls=''){const obj=node('button',cls,text);obj.onclick=fn;return obj}
 const editorBlockModel={nextLayout:x=>x==='single'?'columns':'single',
  patchSectionStyle:(_s,patch)=>patch};
 function sectionStyle(s){return {border:'none',color:'#dadada',width:1,shadow:false}}
 function validColor(){return true}
 function mark(){this.marked++}
 function render(){this.rendered++}
 function sectionFrame(){}
 function sectionColumn(section){const col=node('div','section-column');for(const item of section.columns[0])col.append(node('div','block',item.text));return col}
 function confirm(){return false}
 ${DEMO_CLIENT.slice(iconStart,iconEnd)}
 ${DEMO_CLIENT.slice(settingsStart,settingsEnd)}
 ${DEMO_CLIENT.slice(renderStart,renderEnd)}
 this.eye=visibilityEyeIcon;this.settings=sectionSettings;this.section=renderSection;
 `;
 vm.runInNewContext(script,env);
 return env;
}

test('M09: SVG eye icon is an actual eye, with a reliably crossed-out variant',()=>{
 const f=editorVisibilityFixture();
 const shown=f.eye(false),willHide=f.eye(true);
 assert.equal(shown.tag,'svg');assert.equal(willHide.tag,'svg');
 assert.equal(shown.children.length,2,'Plain eye is used for Show');
 assert.equal(willHide.children.length,3,'Crossing stroke exists for Hide');
 assert.equal(willHide.children[2].attributes.d,'M3 21 21 3');
 assert.equal(willHide.attributes['aria-hidden'],'true');
});

test('M09: block settings can toggle hide/show without erasing content or publishing',()=>{
 const f=editorVisibilityFixture();
 const section={id:18,kind:'section',layout:'columns',columns:[
  [{id:1,kind:'image',src:'/media/original.jpg',widthPct:90}],
  [{id:2,kind:'text',rich:'<strong>Original</strong>'}]],
  style:{border:'round',shadow:false,color:'#aabbcc',width:1}};
 const before=JSON.stringify(section.columns);
 const settings=f.settings(section);
 assert.equal(settings.tag,'details');
 const fields=settings.children.find(x=>x.className==='section-settings-fields');
 assert.ok(fields,'Settings contain the visibility choice');
 const button=fields.children.find(x=>x.className==='section-visibility-toggle');
 assert.ok(button,'The existing settings menu contains the whole-block eye');
 assert.equal(button.attributes['aria-label'],'Masquer le bloc entier aux visiteurs');
 assert.equal(button.children[0].children.length,3,'Before hide: crossed eye action');
 let stopped=0;
 button.onclick({stopPropagation(){stopped++}});
 assert.equal(section.hideOnSite,true);
 assert.equal(JSON.stringify(section.columns),before,'All media and child blocks remain unchanged');
 assert.equal(f.marked,1);assert.equal(f.rendered,1);
 const wrap=f.section(section,{blocks:[section]});
 assert.ok(wrap.classList.contains('hidden-on-public'));
 assert.ok(wrap.children.some(x=>x.textContent==='Bloc entier invisible aux visiteurs'));
 const restoredButton=f.settings(section).children.find(x=>x.className==='section-settings-fields')
  .children.find(x=>x.className==='section-visibility-toggle');
 assert.equal(restoredButton.children[0].children.length,2,'When hidden: open eye action');
 assert.equal(restoredButton.attributes['aria-label'],'Afficher le bloc entier aux visiteurs');
 restoredButton.onclick({stopPropagation(){}});
 assert.equal(section.hideOnSite,false);
 assert.equal(JSON.stringify(section.columns),before);
 assert.equal(f.marked,2);
 assert.equal(stopped,1);
});

test('M09: existing public renderer ignores whole hidden sections and hidden children',()=>{
 const start=TRIAL_SITE_CLIENT.indexOf('function appendPageBlock(');
 const rest=TRIAL_SITE_CLIENT.indexOf("if(b.kind==='section')",start);
 assert.ok(start>0&&rest>start);
 const excerpt=TRIAL_SITE_CLIENT.slice(start,rest)+
   "\n return 'visible';\n}\n this.fn=appendPageBlock;";
 const env={};
 vm.runInNewContext(excerpt,env);
 assert.equal(env.fn({id:1,kind:'section',hideOnSite:true}),undefined);
 assert.equal(env.fn({id:2,kind:'image',hideOnSite:true}),undefined);
 assert.equal(env.fn({id:3,kind:'section'}),'visible');
 assert.equal(env.fn({id:4,kind:'image'}),'visible');
});
