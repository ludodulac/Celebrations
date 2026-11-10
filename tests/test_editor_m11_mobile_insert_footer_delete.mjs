import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createPageModel} from '../migration/cloudflare/app/domain/editor-pages.mjs';
import {createEditorPageCommands} from '../migration/cloudflare/app/application/editor-page-commands.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {CSS_04_SECTION_COMPOSER} from '../migration/cloudflare/app/styles/admin/04-section-composer.mjs';

function menuHarness(mobile){
 class Element{
  constructor(tag,cls='',content=''){
   this.tag=tag;this.className=cls;this.textContent=content;
   this.children=[];this.parentNode=null;this.attrs={};this.listeners={};
   this.hidden=false;this.open=false;this.isConnected=true;
  }
  append(...els){for(const el of els){
   if(el.parentNode){const siblings=el.parentNode.children;
    siblings.splice(siblings.indexOf(el),1)}
   this.children.push(el);el.parentNode=this;
  }}
  get nextSibling(){if(!this.parentNode)return null;
   const all=this.parentNode.children;
   return all[all.indexOf(this)+1]||null}
  insertBefore(el,next){
   if(el.parentNode){const siblings=el.parentNode.children;
    siblings.splice(siblings.indexOf(el),1)}
   el.parentNode=this;
   const i=next?this.children.indexOf(next):-1;
   this.children.splice(i<0?this.children.length:i,0,el);
  }
  remove(){if(this.parentNode){const list=this.parentNode.children;
   list.splice(list.indexOf(this),1);this.parentNode=null}}
  setAttribute(key,value){this.attrs[key]=value}
  addEventListener(type,fn){(this.listeners[type]||=[]).push(fn)}
  removeEventListener(type,fn){this.listeners[type]=this.listeners[type]?.filter(v=>v!==fn)||[]}
  showModal(){this.open=true;this.shownModal=true}
  close(){this.open=false;for(const fn of this.listeners.close||[])fn()}
 }
 const body=new Element('body');
 const document={body,querySelector:selector=>{
  if(selector!=='dialog.editor-insert-dialog[open]')throw Error('Unknown selector');
  return body.children.find(el=>el.tag==='dialog'&&el.open)||null
 }};
 const ctx={
  window:{matchMedia:()=>({matches:mobile})},document,
  queueMicrotask:fn=>Promise.resolve().then(fn),
  n:(tag,cls='',content='')=>new Element(tag,cls,content),
  b:(text,click,cls='')=>{const el=new Element('button',cls,text);el.onclick=click;return el}
 };
 const start=DEMO_CLIENT.indexOf('function toggleInsertionMenu(');
 const end=DEMO_CLIENT.indexOf('function existingBlockAddControls(',start);
 assert.ok(start>0&&end>start,'The three menus share a single insertion helper');
 vm.runInNewContext(DEMO_CLIENT.slice(start,end)+'\nthis.toggle=toggleInsertionMenu;',ctx);
 const parent=new Element('div','section-insert');
 const trigger=new Element('button','section-add-blue');
 const menu=new Element('div','section-insert-choices');
 menu.hidden=true;
 const choice=new Element('button','btn','Bloc seul');
 menu.append(choice);parent.append(trigger,menu);body.append(parent);
 return {ctx,body,parent,trigger,menu,choice};
}

test('M11: on a phone all + menus open one native centred dialog, not the bottom ribbon',async()=>{
 const h=menuHarness(true);
 h.ctx.toggle(h.menu,h.trigger,'Ajouter un bloc');
 const modal=h.body.children.find(el=>el.tag==='dialog');
 assert.ok(modal?.shownModal,'Native showModal must open on touch');
 assert.equal(modal.attrs['aria-label'],'Ajouter un bloc');
 assert.equal(h.trigger.attrs['aria-expanded'],'true');
 assert.equal(h.menu.hidden,false);
 assert.equal(h.menu.parentNode.className,'editor-insert-dialog-options');
 assert.equal(modal.children[0].className,'editor-insert-dialog-header');
 assert.equal(modal.children[0].children[1].textContent,'Fermer');
 assert.match(CSS_04_SECTION_COMPOSER,/dialog\.editor-insert-dialog\[open\]\{/);
 assert.match(CSS_04_SECTION_COMPOSER,/dialog\.editor-insert-dialog::backdrop/);
 assert.match(CSS_04_SECTION_COMPOSER,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(CSS_04_SECTION_COMPOSER,/max-height:calc\(100dvh - 42px\)/);
 // A choice closes the dialog even when its usual click callback rerenders.
 h.menu.listeners.click[0]({target:{closest:()=>h.choice}});
 await Promise.resolve();
 assert.equal(modal.open,false);
 assert.equal(h.menu.parentNode,h.parent);
 assert.equal(h.menu.hidden,true);
 assert.equal(h.trigger.attrs['aria-expanded'],'false');
 assert.ok(!h.body.children.includes(modal));
});

test('M11: desktop retains existing in-place insertion menu, without a modal',()=>{
 const h=menuHarness(false);
 h.ctx.toggle(h.menu,h.trigger,'Ajouter un bloc');
 assert.equal(h.menu.hidden,false);
 assert.equal(h.trigger.attrs['aria-expanded'],'true');
 assert.equal(h.body.children.filter(el=>el.tag==='dialog').length,0);
 h.ctx.toggle(h.menu,h.trigger,'Ajouter un bloc');
 assert.equal(h.menu.hidden,true);
 assert.equal(h.trigger.attrs['aria-expanded'],'false');
});

test('M11: blue, green and single-block menus all invoke the same helper',()=>{
 assert.match(DEMO_CLIENT,/toggleInsertionMenu\(menu,toggle,'Ajouter un bloc'\)/);
 assert.match(DEMO_CLIENT,/toggleInsertionMenu\(menu,add,'Ajouter un élément dans ce bloc'\)/);
 assert.match(DEMO_CLIENT,/toggleInsertionMenu\(menu,add,'Ajouter un élément à '/);
 assert.match(DEMO_CLIENT,/modal\.addEventListener\('close'/);
 assert.match(DEMO_CLIENT,/modal\.showModal\(\)/);
 // The existing options and their callbacks remain the same.
 for(const title of ['Bloc seul','Deux colonnes','Lecteur audio','Titre','Image','Texte'])
  assert.ok(DEMO_CLIENT.includes(title));
});

test('M11: last footer page can be deleted, while the home and last celebration stage stay protected',()=>{
 const model=createPageModel();
 const commands=createEditorPageCommands({model});
 const home={id:'neutral-accueil-general',group:'page',blocks:[],name:'Accueil'};
 const footer=model.createPage('footer','Confidentialité','a'.repeat(36));
 const other=model.createPage('page','Contact','b'.repeat(36));
 const db={siteHomeId:home.id,pages:[home,footer,other]};
 const plan=commands.deletionPlan(db,footer,'101');
 assert.equal(plan.allowed,true);
 assert.equal(plan.general,true);
 assert.equal(plan.siblings.length,0);
 const next=commands.removeConfirmedPage(db,footer,footer.id,plan);
 assert.equal(next,home.id);
 assert.deepEqual(db.pages,[home,other]);
 assert.deepEqual(model.groupPages(db.pages,'footer'),[]);
 assert.equal(commands.deletionPlan(db,home,'101').allowed,false);
 const singleExtra=model.createPage('celebration','Unique','c'.repeat(36),'101');
 db.pages=[home,singleExtra];
 assert.equal(commands.deletionPlan(db,singleExtra,'101').allowed,false);
 assert.equal(commands.removeConfirmedPage(db,singleExtra,singleExtra.id,
  commands.deletionPlan(db,singleExtra,'101')),null);
});

test('M11: UI deletion checks the shared plan, not a second obsolete siblings guard',()=>{
 const start=DEMO_CLIENT.indexOf('async function removeCustomPage(q)');
 const end=DEMO_CLIENT.indexOf('function ',start+10);
 const source=DEMO_CLIENT.slice(start,end);
 assert.ok(start>=0&&end>start);
 assert.match(source,/editorPageCommands\.deletionPlan\(db,q,/);
 assert.match(source,/if\(!plan\.allowed\)/);
 assert.doesNotMatch(source,/if\(!siblings\.length\)/);
 assert.match(source,/editorPageCommands\.removeConfirmedPage\(db,q,id,plan\)/);
 assert.match(source,/serverSave\(\)/,'Deletions still save to the same server');
});
