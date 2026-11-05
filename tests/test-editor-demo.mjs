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

test('page/celebration status uses accessible green and orange circular indicators',()=>{
 assert.ok(DEMO_CLIENT.includes("badge.setAttribute('aria-label',VISIBILITY_LABELS[state])"));
 assert.ok(DEMO_CLIENT.includes("stateBadge.setAttribute('aria-label',VISIBILITY_LABELS[state])"));
 assert.ok(DEMO_CSS.includes('.inline-page-state.state-published'));
 assert.ok(DEMO_CSS.includes('.inline-page-state.state-draft'));
 assert.match(DEMO_CSS,/grid-template-columns:230px minmax\(0,1fr\)/);
 assert.ok(DEMO_CLIENT.includes("['published','Publier']"),'Publishing actions are still explicit');
});

test('global library has clickable files but no insert/open action buttons',()=>{
 assert.ok(DEMO_CLIENT.includes('function libraryTitle('));
 assert.ok(DEMO_CLIENT.includes('function libraryPicture('));
 const start=DEMO_CLIENT.indexOf('function media(){');
 const end=DEMO_CLIENT.indexOf('function audioWorkbench(){',start);
 assert.ok(start>0&&end>start);
 const source=DEMO_CLIENT.slice(start,end);
 assert.doesNotMatch(source,/b\('Insérer'/);
 assert.doesNotMatch(source,/b\('Ouvrir'/);
 assert.ok(source.includes('libraryLocationLinks(card,refs)'));
 assert.ok(source.includes('libraryUnusedText(card,unused,hasImage)'));
 assert.ok(DEMO_CSS.includes('.media-unused-ribbon'));
});

test('image editing has two distinct actions and a safe remove-image-only button',()=>{
 const start=DEMO_CLIENT.indexOf("if(x.kind==='image'){",DEMO_CLIENT.indexOf('function block('));
 const end=DEMO_CLIENT.indexOf("if(box._tools)",start);
 const section=DEMO_CLIENT.slice(start,end);
 assert.ok(section.includes("b('Télécharger une image',()=>startImageUpload(x)"));
 assert.ok(section.includes("b('Images du site',()=>showImagePicker(x)"));
 assert.ok(!section.includes("b('Choisir une image'"));
 assert.ok(DEMO_CLIENT.includes("remove.dataset.action='remove-image'"));
 assert.ok(DEMO_CSS.includes('.block[data-kind="image"]>.block-edit-actions.image-direct-actions'));
 assert.ok(DEMO_CLIENT.includes("box.dataset.kind=x.kind"));
 assert.ok(DEMO_CLIENT.includes("delete x.assetId;x.text='';delete x.widthPct"));
 assert.ok(DEMO_CLIENT.includes("const close=b('×',()=>dialog.close(),'image-picker-close')"));
 assert.match(DEMO_CSS,/\.image-picker-dialog\[open\]/);
 assert.match(DEMO_CSS,/\.stage-editor \.block\.is-selected>\.block-validate-actions\{\s*position:fixed/);
});

test('gallery renders bounded thumbnail cards with captions and upload, distinct from site images',()=>{
 const section=DEMO_CLIENT.slice(DEMO_CLIENT.indexOf('function showImagePicker('),
  DEMO_CLIENT.indexOf('function createContent(kind){'));
 assert.ok(section.includes("b('Télécharger une image'"));
 assert.ok(section.includes("n('span','image-picker-thumbnail')"));
 assert.ok(section.includes("n('span','image-picker-filename',name)"));
 assert.ok(section.includes("const item=b('',onChoose,'sm image-picker-card')"));
 assert.ok(DEMO_CSS.includes('grid-auto-rows:190px!important'));
 assert.ok(DEMO_CSS.includes('.image-picker-dialog .image-picker-thumbnail img:not([hidden])'));
 assert.ok(DEMO_CLIENT.includes('function removeImageFromBlock(x)'));
 assert.ok(DEMO_CLIENT.includes("remove.dataset.action='remove-image'"));
});

test('editor recovers hosted image when a local asset identifier is stale',()=>{
 const part=DEMO_CLIENT.slice(DEMO_CLIENT.indexOf("if(x.kind==='image'){",DEMO_CLIENT.indexOf('function block(')),
  DEMO_CLIENT.indexOf('if(box._tools)',DEMO_CLIENT.indexOf('function block(')));
 assert.ok(part.includes("const src=localUrl||hostedUrl"));
 assert.ok(part.includes("img.onerror=()=>"));
 assert.ok(part.includes("restorePageImageFromPublished(p,x)"));
 assert.ok(part.includes("image-size-slider"),'Size adjustment exists in image block');
 assert.ok(DEMO_CSS.includes('.picture.image-load-error>img'));
 assert.ok(DEMO_CLIENT.includes('function findImageByHeading('),'A source is matched by page and heading');
 assert.ok(DEMO_CLIENT.includes("image.src=url;delete image.assetId"),'Restoration stays explicit');
});

test('published pages can be republished after image resizing; aligner is removed',()=>{
 const start=DEMO_CLIENT.indexOf('function publicationActions(');
 const end=DEMO_CLIENT.indexOf('function attachPagePublicationControls(',start);
 const section=DEMO_CLIENT.slice(start,end);
 assert.ok(section.includes("visibility==='published'&&kind==='page'"));
 assert.ok(section.includes("'Mettre à jour le site'"));
 assert.ok(DEMO_CLIENT.includes("b('Publier cette taille'"));
 assert.ok(DEMO_CLIENT.includes("serverPublish({kind:'page',pageId:p.id,visibility:'published'})"));
 assert.ok(DEMO_CLIENT.includes('x.widthPct=Math.round(size)'));
 assert.ok(DEMO_CLIENT.includes('input.onchange=resize'));
 const block=DEMO_CLIENT.slice(DEMO_CLIENT.indexOf('function block('),DEMO_CLIENT.indexOf('function videoInfo('));
 assert.ok(!block.includes("b('↔ Aligner'"),'No redundant Align button in image or linked button block');
 assert.ok(DEMO_CSS.includes('.image-publish-size'));
});
