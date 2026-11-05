import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {handleEditorDemo} from '../migration/cloudflare/editor-demo-page.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {DEMO_CSS} from '../migration/cloudflare/editor-demo-style.mjs';
const BASE='https://celebrations-exit-staging.rondes.workers.dev/__editor/demo';
test('demo is anonymous, local and CSP-restricted',async()=>{
 const response=handleEditorDemo(new Request(BASE));
 assert.equal(response.status,200);
 assert.match(await response.text(),/Atelier visuel/);
 assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);
 assert.equal(response.headers.get('cache-control'),'no-store');
});
test('demo rejects other hosts and POST',()=>{
 assert.equal(handleEditorDemo(new Request(BASE,{method:'POST'})).status,405);
 assert.equal(handleEditorDemo(new Request('https://example.com/__editor/demo')).status,404);
});
test('demo client parses and uses browser local drafts only',()=>{
 new vm.Script(DEMO_CLIENT);
 assert.ok(DEMO_CLIENT.includes('localStorage.setItem'));
 assert.ok(DEMO_CLIENT.includes('contentEditable'));
 assert.ok(DEMO_CLIENT.includes("&format=json"),'Only read-only public manifests may be fetched');
 assert.ok(!DEMO_CLIENT.includes("method:'PUT'"));
});
test('demo file manager uses IndexedDB only, with PDF/audio/video and file-backed preview buttons',()=>{
 assert.ok(DEMO_CLIENT.includes('indexedDB.open'));
 assert.ok(DEMO_CLIENT.includes('application/pdf'));
 assert.ok(DEMO_CLIENT.includes('video/*'), 'Import selector accepts video MIME types');
 assert.ok(DEMO_CLIENT.includes('audio/*'), 'Import selector accepts audio MIME types');
 assert.ok(DEMO_CLIENT.includes("data-action='choose-asset'")||DEMO_CLIENT.includes("dataset.action='choose-asset'"));
 assert.ok(DEMO_CLIENT.includes('URL.createObjectURL'));
 assert.ok(DEMO_CLIENT.includes("&format=json"),'Only read-only public manifests may be fetched');
 assert.ok(!DEMO_CLIENT.includes("method:'PUT'"));
});

test('rich text is restricted to safe tags and formatting uses block-local state',()=>{
 assert.ok(DEMO_CLIENT.includes("function htmlSafe("));
 assert.ok(DEMO_CLIENT.includes("function editorFormatToolbar("));
 assert.ok(DEMO_CLIENT.includes("function duplicateBlock("));
 assert.ok(DEMO_CLIENT.includes("strong"));
 assert.ok(DEMO_CLIENT.includes("em"));
 assert.ok(DEMO_CLIENT.includes("fontSize"));
 assert.ok(DEMO_CLIENT.includes("validColor"));
 assert.ok(DEMO_CLIENT.includes("sizeOf"));
 assert.ok(DEMO_CLIENT.includes("uniqueBlockId"));
 assert.ok(DEMO_CLIENT.includes("Supprimer cet élément"));
 assert.ok(!DEMO_CLIENT.includes("eval("));
});

test('block toolbar remains visible and in flow on desktop and phone',()=>{
 assert.match(DEMO_CSS,/\.tools\{position:static;display:flex;/);
 assert.doesNotMatch(DEMO_CSS,/\.tools\{position:absolute;/);
 assert.ok(DEMO_CLIENT.includes("'Dupliquer'"));
 assert.ok(DEMO_CLIENT.includes("'Supprimer'"));
});

test('only the selected block shows editing controls, simplifying the page',()=>{
 assert.match(DEMO_CSS,/\.block>\.tools,\.block>\.formatbar,\.block>\.link-line,\.block>\.block-edit-actions\{display:none !important\}/);
 assert.match(DEMO_CSS,/\.block\.is-selected>\.tools/);
 assert.ok(DEMO_CLIENT.includes('function selectBlock('));
 assert.ok(DEMO_CLIENT.includes("box.onclick=()=>selectBlock(box)"));
 assert.ok(DEMO_CLIENT.includes('z.onfocus=()=>{') && DEMO_CLIENT.includes('selectBlock(box);'));
});

test('Partial formatting preserves a selected range and keeps whole paragraph font size',()=>{
 assert.ok(DEMO_CLIENT.includes('rememberedSelection'));
 assert.ok(DEMO_CLIENT.includes('range.extractContents()'));
 assert.ok(DEMO_CLIENT.includes("selected.selectNodeContents(span)"));
 assert.ok(DEMO_CLIENT.includes("sizes.title='Taille du paragraphe entier'"));
 assert.ok(DEMO_CLIENT.includes("make('G','Gras (sélection ou bloc)'"));
 assert.ok(DEMO_CLIENT.includes('function inlineColor('));
 assert.ok(DEMO_CLIENT.includes("tag==='span'||tag==='font'"));
 assert.ok(!DEMO_CLIENT.includes('eval('));
});

test('RGB normalisation accepts browser variations and rejects unsafe inline colours',()=>{
 const start=DEMO_CLIENT.indexOf('function inlineColor(');
 const end=DEMO_CLIENT.indexOf('\\nfunction htmlSafe(',start);
 // Decode the embedded client first: newline exists in DEMO_CLIENT.
 const ending=end<0?DEMO_CLIENT.indexOf('\nfunction htmlSafe(',start):end;
 assert.ok(start>=0&&ending>start);
 const scope={};
 vm.runInNewContext(DEMO_CLIENT.slice(start,ending)+';this.color=inlineColor',scope);
 assert.equal(scope.color('rgb(227, 52, 47)'),'#e3342f');
 assert.equal(scope.color('rgb(227 52 47)'),'#e3342f');
 assert.equal(scope.color('#e3342f'),'#e3342f');
 assert.equal(scope.color('url(javascript:evil)'), '');
});

test('CSP-safe rich colour restoration uses DOM assignments after sanitising HTML',()=>{
 assert.ok(DEMO_CLIENT.includes('function restoreInlineColours('));
 assert.ok(DEMO_CLIENT.includes('restoreInlineColours(z)'));
 assert.ok(DEMO_CLIENT.includes("span.removeAttribute('style');span.style.color=value"));
});

test('the selected element has an explicit draft-only Validate button',()=>{
 assert.ok(DEMO_CLIENT.includes("b('✓ Valider'"));
 assert.ok(DEMO_CLIENT.includes("void validateBlock(box,validate)"));
 assert.match(DEMO_CSS,/\.block\.is-selected>\.block-validate-actions\{/);
 assert.match(DEMO_CSS,/\.block>\.block-validate-actions\{display:none!important\}/);
 assert.match(DEMO_CLIENT,/await serverSave\(\);[\s\S]*?if\(db\._serverPending\)return;/);
 assert.ok(DEMO_CLIENT.includes("if(typeof render==='function')render()"), 'Validation re-renders to fully close editing tools');
});

test('new headings and text fields are empty with visible hints, not saved template text',()=>{
 const start=DEMO_CLIENT.indexOf('function createContent(kind){');
 const end=DEMO_CLIENT.indexOf('\nfunction add(kind)',start);
 assert.ok(start>0&&end>start);
 const ctx={uniqueBlockId:()=>123};
 vm.runInNewContext(
  "const STARTER_TEXT={heading:'Nouveau titre',text:'Votre paragraphe',button:'Mon bouton',event:'Titre de l’événement'};\n"+
  DEMO_CLIENT.slice(start,end)+'\nthis.make=createContent;',ctx);
 for(const kind of ['heading','text','button','event'])assert.equal(ctx.make(kind).text,'',kind);
 assert.equal(ctx.make('audio').text,'MP3 à choisir');
 assert.ok(DEMO_CLIENT.includes('z.dataset.placeholder=STARTER_TEXT[x.kind]'));
 assert.ok(DEMO_CLIENT.includes('range.selectNodeContents(z)'), 'Older starter labels become fully selected on first tap');
});

test('validation closes only after private server save succeeds, keeps editor open on failure',async()=>{
 const start=DEMO_CLIENT.indexOf('async function validateBlock(');
 const end=DEMO_CLIENT.indexOf('\nfunction block(x,p',start);
 assert.ok(start>=0&&end>start);
 async function simulate(success){
  const scope={document:{activeElement:null},saved:0,attempts:0,removed:0};
  vm.runInNewContext(
   "let dirty=true,selectedBlockId='element-1';const db={_serverPending:true},IS_STAGE=true;"+
   "function save(){dirty=false;this.saved++}"+
   "async function serverSave(){this.attempts++;if(this.success)db._serverPending=false;}"+
   DEMO_CLIENT.slice(start,end)+
   ";this.validate=validateBlock;this.selected=()=>selectedBlockId;this.pending=()=>db._serverPending;",scope);
  scope.success=success;
  const box={isConnected:true,dataset:{id:'element-1'},contains:()=>false,classList:{remove:()=>{scope.removed++}}};
  const button={disabled:false,textContent:'✓ Valider',blur:()=>{}};
  await scope.validate(box,button);
  return {scope,button};
 }
 const good=await simulate(true);
 assert.equal(good.scope.saved,1);assert.equal(good.scope.attempts,1);
 assert.equal(good.scope.selected(),null);assert.equal(good.scope.removed,1);
 assert.equal(good.button.disabled,false);
 const refused=await simulate(false);
 assert.equal(refused.scope.attempts,1);
 assert.equal(refused.scope.selected(),'element-1');
 assert.equal(refused.scope.removed,0);
 assert.equal(refused.scope.pending(),true);
});
