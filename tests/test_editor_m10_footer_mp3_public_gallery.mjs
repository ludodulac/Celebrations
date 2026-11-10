import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createPageModel} from '../migration/cloudflare/app/domain/editor-pages.mjs';
import {createEditorPageCommands} from '../migration/cloudflare/app/application/editor-page-commands.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {renderEditorFrame} from '../migration/cloudflare/app/admin/editor-render.mjs';
import {readFileSync} from 'node:fs';

test('M10: footer pages are ordinary shared pages, isolated from the main menu',()=>{
 const model=createPageModel(),commands=createEditorPageCommands({model});
 const home={id:'neutral-accueil-general',name:'Accueil',group:'page',blocks:[]};
 const footer=model.createPage('footer','Mentions légales','a'.repeat(36));
 const other=model.createPage('page','Contact','b'.repeat(36));
 assert.equal(footer.group,'page');
 assert.equal(footer.placement,'footer');
 assert.equal(footer.name,'Mentions légales');
 assert.deepEqual(model.groupPages([home,footer,other],'page'),[home,other]);
 assert.deepEqual(model.groupPages([home,footer,other],'footer'),[footer]);
 const db={siteHomeId:home.id,pages:[home,footer,other]};
 const shared=commands.sharedSnapshot(db,{pages:[]});
 assert.equal(shared.pages.length,3,'Footer pages share the original revisioned server snapshot');
 assert.equal(shared.pages[1].placement,'footer');
 const fresh={siteHomeId:'',pages:[{id:'celebration-101',group:'celebration'}]};
 assert.equal(commands.restoreSharedPages(fresh,shared),true);
 assert.equal(fresh.pages.find(p=>p.id===footer.id).placement,'footer');
 const plan=commands.deletionPlan(db,footer,'101');
 assert.equal(plan.allowed,true);
 assert.equal(plan.siblings.length,0,'The last footer page may be deleted without deleting home');
 assert.equal(commands.removeConfirmedPage(db,footer,footer.id,plan),home.id);
 assert.equal(db.pages.includes(home),true);
});

test('M10: footer and guide are real admin navigation targets',()=>{
 const html=readFileSync('migration/cloudflare/editor-demo-preparation-page.mjs','utf8');
 assert.match(html,/data-tab=\\"footer\\"/);
 assert.match(html,/data-tab=\\"guide\\"/);
 assert.match(renderEditorFrame.toString(),/tab==='footer'\)footerPages\(\)/);
 assert.match(DEMO_CLIENT,/function footerPages\(\)\{pageWorkspace\('footer'\)\}/);
 assert.match(DEMO_CLIENT,/createPage\('footer'\)/);
 assert.match(DEMO_CLIENT,/group==='footer'\?'footer':'pages'/);
});

test('M10: footer links are generated only for published footer pages',()=>{
 const visitor=TRIAL_SITE_CLIENT;
 const layout=readFileSync('migration/cloudflare/editor-trial-site-page.mjs','utf8');
 assert.match(layout,/id=\\"footer-pages\\"/);
 assert.match(visitor,/const footerPages=el\('footer-pages'\);footerPages\.replaceChildren\(\)/);
 assert.match(visitor,/p\.group==='page'&&p\.placement==='footer'/);
 assert.match(visitor,/p\.group==='page'&&p\.placement!=='footer'/);
 assert.match(visitor,/footerPages\.append\(link\)/);
 assert.match(visitor,/link\.href='\?celebration='/);
 assert.match(visitor,/saved\?\.pages\)?/); // Shared snapshot is the only source of visitor pages.
});

test('M10: there is no public general media gallery, and hidden/unrelated pages stay excluded',()=>{
 assert.ok(!TRIAL_SITE_CLIENT.includes('▧ Médiathèque générale'));
 assert.ok(!TRIAL_SITE_CLIENT.includes("active==='mediatheque'||isGeneralGallery"));
 assert.ok(TRIAL_SITE_CLIENT.includes("if(active==='mediatheque-generale')active=generalPages().homeId"));
 const start=TRIAL_SITE_CLIENT.indexOf('function collectMedia(');
 const end=TRIAL_SITE_CLIENT.indexOf('function youtubeEmbed(',start);
 assert.ok(start>0&&end>start);
 const source=TRIAL_SITE_CLIENT.slice(start,end);
 assert.match(source,/if\(!block\|\|block\.hideOnSite===true\)continue/);
 const env={
  window:{__PUBLIC_CELEBRATION_VISIBLE__:true},
  pages:[
   {group:'page',name:'Accueil',blocks:[{kind:'image',src:'/media/general.jpg',text:'Acc'}]},
   {group:'page',placement:'footer',name:'Mentions',blocks:[{kind:'image',src:'/media/footer.jpg',text:'Pied'}]},
   {group:'celebration',name:'Mercredi',blocks:[
     {kind:'image',src:'/media/celebration.jpg',text:'Célébration'},
     {kind:'image',hideOnSite:true,src:'/media/invisible.jpg'},
     {kind:'section',hideOnSite:true,columns:[[{kind:'image',src:'/media/invisible-section.jpg'}],[]]}
   ]}
  ],
  urlOk:x=>x
 };
 vm.runInNewContext(source+'\nthis.entries=galleryEntries;',env);
 const urls=env.entries().map(x=>x.src);
 assert.equal(urls.length,1);
 assert.equal(urls[0],'/media/celebration.jpg');
 env.window.__PUBLIC_CELEBRATION_VISIBLE__=false;
 assert.equal(env.entries().length,0);
});

test('M10: an MP3 player is insertable with title, matching the existing visitor player',()=>{
 assert.match(DEMO_CLIENT,/\['Lecteur audio','audio'\]/);
 assert.match(DEMO_CLIENT,/const section=editorBlockModel\.createSection\(uniqueBlockId\(\),'single',\[\[audio\],\[\]\]\)/);
 assert.match(DEMO_CLIENT,/function attachChosenAudio\(record\)/);
 assert.match(DEMO_CLIENT,/chosenBlock\.src=src;delete chosenBlock\.remoteKey/);
 assert.match(DEMO_CLIENT,/title=n\('label','audio-title-field','Titre de l’audio'\)/);
 assert.match(TRIAL_SITE_CLIENT,/else if\(b.kind==='audio'\)/);
 assert.match(TRIAL_SITE_CLIENT,/audio\.controls=true/);
});

test('M10: MP3 transfers report actual bytes and keep images on the existing fetch path',()=>{
 const source=DEMO_CLIENT;
 assert.ok(source.includes("xhr.upload.onprogress=e=>"));
 assert.ok(source.includes("Math.round(e.loaded*100/e.total)"));
 assert.ok(source.includes("mediaUploadFeedback(100,'✓ MP3 importé"));
 assert.ok(source.includes("const response=await fetch('/api/editor-media?action=upload'"));
 assert.match(source,/bar\.hidden=!mediaUploadState/);
 assert.match(source,/bar\.setAttribute\('aria-label','Progression de l’import MP3'\)/);
 assert.ok(source.includes("mediaCategory==='audios'?'＋ Importer un MP3'"));
 assert.ok(!source.includes("record.general?'Retirer de la médiathèque générale':'Afficher aux visiteurs'"));
});

test('M10: delivered browser scripts parse without injection or malformed string escapes',()=>{new vm.Script(DEMO_CLIENT);new vm.Script(TRIAL_SITE_CLIENT)});
