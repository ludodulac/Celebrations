import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPageModel} from '../migration/cloudflare/app/domain/editor-pages.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const client=read('migration/cloudflare/editor-demo-client-source.js');
const members=read('migration/cloudflare/app/admin/editor-member-spaces-integration.mjs');
const adapter=read('migration/cloudflare/app/admin/real-editor-member-spaces.mjs');
const css=read('migration/cloudflare/app/styles/admin/stage-layout.mjs');
test('visibility choice saves its setting without committing draft content',()=>{
 const section=client.slice(client.indexOf('function publicationActions('),client.indexOf('function attachPagePublicationControls('));
 assert.match(section,/select\.onchange=async/);
 assert.match(section,/serverPublish\(editorPageModel\.publicationIntent\(kind,q,chosen\),\{flushContent:false\}\)/);
 assert.doesNotMatch(section,/b\(['"](?:Appliquer|Mettre à jour le site)/);
 const publishing=client.slice(client.indexOf('async function serverPublish('),client.indexOf('const serverFileAsDataURL='));
 assert.match(publishing,/const unsavedContent=dirty\|\|!!db\._serverPending/);
 assert.match(publishing,/if\(!unsavedContent\|\|flushContent\)db\._serverPending=false/);
 assert.match(publishing,/if\(!flushContent&&unsavedContent\)/);
});
test('public status and unsaved content are independent',()=>{
 const model=createPageModel();
 assert.equal(model.pageVisibility({visibility:'published'}),'published');
 assert.equal(model.pageVisibility({visibility:'draft'}),'draft');
 assert.equal(model.pageVisibility({visibility:'hidden'}),'hidden');
 assert.deepEqual(model.publicationIntent('page',{id:'preparation-101'},'hidden'),
  {kind:'page',pageId:'preparation-101',visibility:'hidden'});
});
test('one content save command is bound to both visible buttons',()=>{
 assert.match(client,/function saveCurrentContent\(\)\{if\(IS_STAGE\)\{save\(\);void serverSave\(\)\}else save\(true\)\}/);
 assert.match(client,/el\('save-btn'\)\.onclick=saveCurrentContent/);
 assert.match(client,/b\('Enregistrer',saveCurrentContent,'sm m022-save'\)/);
 assert.match(client,/function syncSecondarySave\(\)/);
 assert.match(css,/m022-save/);
 assert.match(css,/79b998/);
});
test('no duplicate button in celebration page settings or private page editor',()=>{
 assert.match(client,/if\(p\.group!=='celebration'\)row\.append\(b\('Dupliquer'/);
 const privatePage=client.slice(client.indexOf('function privatePageWorkspace('),client.indexOf('function render(){'));
 assert.doesNotMatch(privatePage,/b\('Dupliquer'/);
 assert.match(client,/b\('＋ Page',\(\)=>createPage\('celebration'\)\)/);
});
test('historical page menu is absent unless a genuine delete action exists',()=>{
 const chunk=client.slice(client.indexOf('function attachPagePublicationControls('),client.indexOf('function pageWorkspace('));
 assert.match(chunk,/if\(removable\)\{/);
 assert.match(chunk,/const menu=n\('div','page-options-menu'\)/);
 assert.doesNotMatch(chunk,/opts\.querySelector\('\.page-options-menu'\)/);
});
test('member access auto-saves securely with explicit broadening consent',()=>{
 const chunk=client.slice(client.indexOf('function accessControls(kind,p){'),client.indexOf('async function openPrivatePage('));
 assert.match(chunk,/async function autoSaveAccess\(\)/);
 assert.match(chunk,/widens\(confirmed,next\)&&!await siteConfirm/);
 assert.match(chunk,/if\(dirty\|\|db\._serverPending\|\|privateBusy\)/);
 assert.match(chunk,/memberPanel\.commandContent\(kind==='page'\?'page-access':'celebration-access'/);
 assert.doesNotMatch(chunk,/Enregistrer l’accès/);
 assert.match(chunk,/restore\(\);/);
});
test('one celebration-only popup selects category and language, creates draft-only versions',()=>{
 assert.match(client,/await memberPanel\.duplicateCelebrationVersion\(pages,celebrationLabel\(entry\)\)/);
 assert.doesNotMatch(client,/Que souhaitez-vous dupliquer \?/);
 assert.match(members,/async function duplicateWholeCelebrationVersion\(/);
 assert.match(members,/name:'category',label:'Catégorie'/);
 assert.match(members,/name:'language',label:'Langue'/);
 assert.match(members,/const conflicts=source\.filter/);
 assert.match(members,/const result=await mutate\('save',\{spaces\}\)/);
 assert.doesNotMatch(members.slice(members.indexOf('async function duplicateWholeCelebrationVersion('),members.indexOf('function renderSpaces(')),/personId|enrollment|release'?/);
 assert.match(adapter,/duplicateCelebrationVersion:\(\.\.\.args\)=>mounted\.duplicateCelebrationVersion\(\.\.\.args\)/);
});
