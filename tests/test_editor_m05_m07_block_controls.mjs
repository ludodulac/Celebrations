import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {DEMO_CSS} from '../migration/cloudflare/editor-demo-style.mjs';
import {createEditorBlockCommands} from '../migration/cloudflare/app/application/editor-block-commands.mjs';
import {createBlockModel} from '../migration/cloudflare/app/domain/editor-block-model.mjs';
import {createEditorDragModel} from '../migration/cloudflare/app/domain/editor-drag-model.mjs';

test('M05: les outils et Valider restent dans le flux normal, sans couche fixe',()=>{
 assert.doesNotMatch(DEMO_CSS,/\.block\.is-selected>\.tools\{[^}]*position:fixed/s);
 assert.doesNotMatch(DEMO_CSS,/\.stage-editor \.block\.is-selected>\.block-validate-actions\{[^}]*position:fixed/s);
 assert.match(DEMO_CSS,/\.block\.is-selected>\.tools\{position:static/);
 assert.match(DEMO_CSS,/\.stage-editor \.block\.is-selected>\.block-validate-actions\{\s*display:flex!important/);
 assert.match(DEMO_CSS,/\.stage-editor \.block-validate-button\{/);
 assert.match(DEMO_CSS,/\.stage-editor \.block-cancel-button\{/);
 assert.match(DEMO_CSS,/@media\(max-width:650px\)\{\s*\.stage-editor \.block\.is-selected>\.block-validate-actions\{flex-wrap:wrap\}/);
 assert.ok(DEMO_CLIENT.includes("row.append(cancel,validate);box.append(row)"));
});

test('M07: le duplicata conserve la taille réelle, sans devenir un nouveau titre principal',()=>{
 const start=DEMO_CLIENT.indexOf('function sizeOf(x){');
 const end=DEMO_CLIENT.indexOf('// Keep the user\'s selection',start);
 assert.ok(start>=0&&end>start);
 const env={editorBlockCommands:createEditorBlockCommands({model:createBlockModel()}),
  clone:v=>JSON.parse(JSON.stringify(v)),uniqueBlockId:()=>98765,marked:0,rendered:0};
 const src=`const BLOCK_SIZES=[14,16,18,20,24,28,32,40];let selectedBlockId=null;
 function mark(){this.marked++}function render(){this.rendered++}
 ${DEMO_CLIENT.slice(start,end)}
 this.duplicate=duplicateBlock;this.size=displayedHeadingSize;this.selected=()=>selectedBlockId;`;
 vm.runInNewContext(src,env);
 const first={id:'first',kind:'heading',text:'Célébration',rich:'<strong>Célébration</strong>',align:'center',color:'#aabbcc',bold:true};
 const second={id:'second',kind:'heading',text:'Sous-titre',align:'left'};
 const page={blocks:[first,second]};
 assert.equal(env.size(first,page),28);
 env.duplicate(first,page,page.blocks);
 assert.equal(page.blocks.length,3);
 assert.equal(page.blocks[1].size,28,'The cloned main heading must not shrink to 24px');
 assert.equal(page.blocks[1].rich,first.rich);
 assert.equal(page.blocks[1].color,first.color);
 assert.equal(page.blocks[1].align,first.align);
 assert.equal(page.blocks[1].bold,first.bold);
 assert.equal(env.selected(),'98765');
 assert.equal(first.size,undefined,'Original implicit styling remains unchanged');
 const subCopy=env.duplicate(second,page,page.blocks);
 assert.equal(page.blocks.at(-1).size,24,'A secondary heading keeps its 24px displayed size');
 assert.equal(page.blocks.filter(b=>b.id==='first').length,1,'A duplicate has a distinct ID');
 assert.equal(env.marked,2);
});

function cancellationEditor(){
 const page={id:'mercredi-101',blocks:[
   {id:'a',kind:'heading',text:'Titre avant',rich:'<strong>Titre</strong>',size:28},
   {id:'b',kind:'text',text:'Autre contenu'}
 ]};
 const model=createBlockModel();
 const drag=createEditorDragModel({createSection:model.createSection});
 const env={db:{pages:[page],_serverPending:false},status:{textContent:''},saveButton:{textContent:'Enregistrer'},
  clone:v=>JSON.parse(JSON.stringify(v)),editorElementLocation:(p,bid)=>drag.locate(p,bid),
  marked:0,rendered:0,updated:0};
 const start=DEMO_CLIENT.indexOf('let blockEditSession=null;');
 const end=DEMO_CLIENT.indexOf('// New labels are visual hints',start);
 assert.ok(start>=0&&end>start);
 const script=`let dirty=false,selectedBlockId=null,serverSaving=false;
 let undoStack=[],undoAnchor=null,lastTyping='',lastTypedAt=0;
 const db=this.db,status=this.status;
 const clone=this.clone,editorElementLocation=this.editorElementLocation;
 function page(){return db.pages[0]}
 function undoSnapshot(){return JSON.stringify({pages:db.pages})}
 function mark(){dirty=true;db._serverPending=true;this.marked++}
 function render(){this.rendered++}
 function updateUndoButton(){this.updated++}
 function el(){return this.saveButton}
 ${DEMO_CLIENT.slice(start,end)}
 this.select=selectBlock;this.cancel=cancelBlockEdit;this.baseline=refreshBlockEditBaseline;
 this.state=()=>({dirty,pending:db._serverPending,selectedBlockId});
 this.setSaving=v=>{serverSaving=v};
 this.mark=mark;`;
 vm.runInNewContext(script,env);
 const box={dataset:{id:'a'},closest:()=>null};
 return {env,page,box};
}

test('M06: Annuler restaure le bloc seul et garde l’administration, sans sauvegarde',()=>{
 const {env,page,box}=cancellationEditor();
 env.select(box);
 page.blocks[0].text='Texte modifié';
 page.blocks[0].rich='<em>Changé</em>';
 env.mark();
 env.cancel(box);
 assert.equal(page.blocks[0].text,'Titre avant');
 assert.equal(page.blocks[0].rich,'<strong>Titre</strong>');
 assert.equal(env.state().selectedBlockId,null);
 assert.equal(env.state().dirty,false);
 assert.equal(env.state().pending,false);
 assert.equal(env.saveButton.textContent,'Enregistrer');
 assert.match(env.status.textContent,/restez dans l’administration/);
 assert.equal(env.rendered,1);
});

test('M06: Annuler ne détruit jamais une modification faite dans un autre bloc',()=>{
 const {env,page,box}=cancellationEditor();
 env.select(box);
 page.blocks[0].text='Revenir au titre';
 env.mark();
 page.blocks[1].text='Autre bloc modifié';
 env.mark();
 env.cancel(box);
 assert.equal(page.blocks[0].text,'Titre avant');
 assert.equal(page.blocks[1].text,'Autre bloc modifié');
 assert.equal(env.state().dirty,true);
 assert.equal(env.state().pending,true);
});

test('M06: après Enregistrer, Annuler ne ramène pas un ancien contenu',()=>{
 const {env,page,box}=cancellationEditor();
 env.select(box);
 page.blocks[0].text='Version enregistrée';
 env.mark();
 env.db._serverPending=false;
 env.baseline();
 page.blocks[0].text='Essai à annuler';
 env.mark();
 env.cancel(box);
 assert.equal(page.blocks[0].text,'Version enregistrée');
 assert.equal(env.state().selectedBlockId,null);
});

test('M06: bloquer Annuler si une écriture serveur est en cours',()=>{
 const {env,page,box}=cancellationEditor();
 env.select(box);
 page.blocks[0].text='Écriture en cours';
 env.setSaving(true);
 env.cancel(box);
 assert.equal(page.blocks[0].text,'Écriture en cours');
 assert.equal(env.state().selectedBlockId,'a');
 assert.match(env.status.textContent,/Enregistrement en cours/);
});
