// M047 — downloadable PDF/document buttons inside event/resource blocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBlockModel} from '../migration/cloudflare/app/domain/editor-block-model.mjs';
import {createEditorMediaCommands} from '../migration/cloudflare/app/application/editor-media-commands.mjs';
import {projectPublicPage} from '../migration/cloudflare/app/domain/editor-public-projection-security.mjs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {handlePublicEditorUpload} from '../migration/cloudflare/public-upload-gateway.mjs';
import {handleMedia} from '../migration/cloudflare/media-gateway.mjs';
import {EDITOR_SNAPSHOT_KEY} from '../migration/cloudflare/app/ports/editor-snapshot-contract.mjs';

const admin=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
const HOST='https://ronde-des-archanges-universelle.eu';
const PDF='/media/new/12345678-1234-4234-8234-123456789abc.pdf';
const file={src:PDF,name:'Psaume de Gabriel.pdf',category:'pdf'};

test('M047: both inlined scripts parse and download option is in blue/green menus',()=>{
 assert.doesNotThrow(()=>new Function(TRIAL_SITE_CLIENT));
 assert.doesNotThrow(()=>new Function(DEMO_CLIENT));
 assert.ok((admin.match(/Bouton de téléchargement/g)||[]).length>=4);
 assert.match(admin,/Document : titre \+ PDF à télécharger/);
 assert.match(admin,/x\.download===true\?'pdf':'all'/);
 assert.match(admin,/Coller le lien du PDF/);
});
test('M047: download preset is an ordinary button; standard links remain unchanged',()=>{
 const model=createBlockModel(),normal=model.createContent('button','n'),download=model.createContent('download','d');
 assert.equal(normal.download,undefined);
 assert.equal(download.kind,'button');assert.equal(download.download,true);
 assert.equal(download.text,'Télécharger le document');
 const resource=model.createResourcePreset('resource','r',kind=>model.createContent(kind,'id-'+kind)).section;
 assert.equal(resource.columns[1].at(-1).download,true);
 const documents=model.createResourcePreset('documents','docs',kind=>model.createContent(kind,'id-'+kind)).section;
 assert.equal(documents.columns[0][1].download,true);
});
test('M047: picking a library PDF gives a reusable URL and safe filename',()=>{
 const command=createEditorMediaCommands();
 const block=createBlockModel().createContent('download','123');
 assert.equal(command.chooseFile(block,file,false),true);
 assert.equal(block.href,PDF);assert.equal(block.download,true);
 assert.equal(block.downloadName,'Psaume de Gabriel.pdf');
 assert.equal(block.text,'Télécharger : Psaume de Gabriel.pdf');
 const normal=createBlockModel().createContent('button','124');
 assert.equal(command.chooseFile(normal,file,false),true);
 assert.equal(normal.download,undefined);assert.match(normal.text,/Ouvrir :/);
});
test('M047: public projection preserves download intent but no local asset IDs',()=>{
 const block={id:'b1',kind:'button',text:'Télécharger le PDF',href:PDF,
  download:true,downloadName:'Psaume de Gabriel.pdf',assetId:'private-draft-key'};
 const page={id:'neutral-accueil-general',name:'Accueil',group:'page',visibility:'published',blocks:[block]};
 const out=projectPublicPage(page);
 assert.equal(out.blocks[0].download,true);
 assert.equal(out.blocks[0].downloadName,'Psaume de Gabriel.pdf');
 assert.equal(out.blocks[0].assetId,undefined);
 assert.ok(!TRIAL_SITE_CLIENT.includes('fetch(href,{credentials'));
 assert.match(TRIAL_SITE_CLIENT,/url\.searchParams\.set\('download','1'\)/);
 assert.match(TRIAL_SITE_CLIENT,/trial-download-button/);
 assert.match(TRIAL_SITE_CLIENT,/media-download-link/);
 const ordinary={...block,download:false};delete ordinary.downloadName;
 assert.equal(projectPublicPage({...page,blocks:[ordinary]}).blocks[0].download,false);
});

function bucketState(published=true){
 const block={id:'document-1',kind:'button',href:PDF,text:'Télécharger',
  download:true,downloadName:'Psaume de Gabriel.pdf'};
 const pg={id:'neutral-accueil-general',name:'Accueil',group:'page',visibility:'published',
  blocks:published?[block]:[]};
 return {version:7,shared:{pages:[],homeId:pg.id},plans:[],drafts:{},
  mediaCatalogue:[{id:'pdf|'+PDF,type:'pdf',src:PDF,source:'uploaded',name:'Psaume de Gabriel.pdf'}],
  published:{shared:{pages:[pg],homeId:pg.id},drafts:{},plans:[],celebrationVisibility:{}}};
}
function editorBucket(published=true){
 const snapshot=bucketState(published),out={fileReads:0};
 out.get=async key=>{
  if(key===EDITOR_SNAPSHOT_KEY)return {etag:'1',text:async()=>JSON.stringify(snapshot)};
  if(key.startsWith('editor-trials/uploads/')){
   out.fileReads++;
   return {size:8,body:new TextEncoder().encode('%PDFDATA'),
    httpMetadata:{contentType:'application/pdf'}};
  }
  return null;
 };
 return out;
}
test('M047: published R2 PDF is inline normally but downloaded when requested',async()=>{
 const bucket=editorBucket(true),env={EDITOR_BUCKET:bucket};
 const view=await handlePublicEditorUpload(new Request(HOST+PDF),env);
 assert.equal(view.status,200);
 assert.equal(view.headers.get('content-disposition'),'inline');
 assert.equal(await view.text(),'%PDFDATA');
 const download=await handlePublicEditorUpload(new Request(HOST+PDF+'?download=1'),env);
 assert.equal(download.status,200);
 assert.match(download.headers.get('content-disposition'),/^attachment;/);
 assert.match(download.headers.get('content-disposition'),/Psaume%20de%20Gabriel\.pdf/);
 assert.equal(await download.text(),'%PDFDATA');
 const head=await handlePublicEditorUpload(new Request(HOST+PDF+'?download=1',{method:'HEAD'}),env);
 assert.equal(head.status,200);
 assert.match(head.headers.get('content-disposition'),/^attachment;/);
 assert.equal(await head.text(),'');
});
test('M047: download=1 cannot bypass unpublished/hidden PDF authorization',async()=>{
 const bucket=editorBucket(false),env={EDITOR_BUCKET:bucket};
 const denied=await handlePublicEditorUpload(new Request(HOST+PDF+'?download=1'),env);
 assert.equal(denied.status,404);
 assert.equal(bucket.fileReads,0);
});
test('M047: approved legacy D1 PDF can download, revoked media stays protected',async()=>{
 let authorized=true,readCount=0;
 const env={
  MEDIA_ACL:{prepare(){return {bind(){return {first:async()=>authorized?{approved:1,revoked_at:null}:{approved:0,revoked_at:'now'}}}}}},
  MEDIA_BUCKET:{get:async()=>{readCount++;return {size:4,body:'DATA',
   httpEtag:'"abc"',writeHttpMetadata(headers){headers.set('content-type','application/pdf')}}}}
 };
 const src=HOST+'/media/old/documents/programme.pdf';
 const display=await handleMedia(new Request(src),env);
 assert.equal(display.status,200);
 assert.notMatch(display.headers.get('content-disposition')||'',/attachment/);
 const download=await handleMedia(new Request(src+'?download=1'),env);
 assert.equal(download.status,200);
 assert.match(download.headers.get('content-disposition'),/^attachment;/);
 assert.equal(await download.text(),'DATA');
 authorized=false;
 const forbidden=await handleMedia(new Request(src+'?download=1'),env);
 assert.equal(forbidden.status,404);
 assert.equal(readCount,2,'Access rejection must happen before R2 read');
});
