import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {readFileSync} from 'node:fs';
import {createPublicVisitorModel} from '../migration/cloudflare/app/domain/editor-public-visitor-model.mjs';
import {TRIAL_SITE_CLIENT,TRIAL_SITE_STYLE} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {SERVER_PREVIEW_PREFETCH} from '../migration/cloudflare/editor-server-sync-client.mjs';
import {handleTrialSite} from '../migration/cloudflare/editor-trial-site-page.mjs';
const publicModel=createPublicVisitorModel();
const duplicate=x=>JSON.parse(JSON.stringify(x));

test('M12: one statically composed nonce-safe public script; no runtime source rewriting',()=>{
 new Script(TRIAL_SITE_CLIENT);
 assert.equal(TRIAL_SITE_CLIENT.split('function createPublicVisitorModel(').length-1,1);
 assert.equal(TRIAL_SITE_CLIENT.split('async function fetchServerPreview(').length-1,1);
 assert.ok(TRIAL_SITE_CLIENT.includes("createPublicVisitorModel().publicSnapshot("));
 assert.ok(TRIAL_SITE_CLIENT.includes("const publicVisitorModel=createPublicVisitorModel()"));
 assert.ok(!TRIAL_SITE_CLIENT.includes('localStorage.getItem('));
 assert.ok(!TRIAL_SITE_CLIENT.includes('localStorage.setItem('));
 assert.ok(!TRIAL_SITE_CLIENT.includes("addEventListener('storage'"));
 assert.ok(TRIAL_SITE_CLIENT.includes('cache:\'no-store\''));
 assert.ok(SERVER_PREVIEW_PREFETCH.includes('window.__PUBLIC_SITE_SNAPSHOT__=null'));
 assert.ok(!SERVER_PREVIEW_PREFETCH.includes('localStorage.'));
 const handler=readFileSync('migration/cloudflare/editor-trial-site-page.mjs','utf8');
 assert.ok(!handler.includes('TRIAL_SITE_CLIENT.replace('));
 assert.ok(!handler.includes('allowSavedImages=String.raw'));
});
test('M12: unverified or failed server response shows NO browser-local public pages',()=>{
 for(const wrong of [null,undefined,{}, {ok:false}, {ok:true}, {ok:true,shared:{pages:null}}])
  assert.equal(publicModel.publicSnapshot(wrong),null);
 assert.equal(publicModel.published({id:'x'},undefined),false);
 assert.equal(publicModel.published({id:'x'},[]),false);
 assert.equal(publicModel.published({id:'x',visibility:'hidden'},['x']),false);
 assert.equal(publicModel.published({id:'x',visibility:'draft'},['x']),false);
 assert.equal(publicModel.published({id:'x',visibility:'published'},['x']),true);
});
test('M12: server-published snapshot filters hidden pages even if mistakenly returned',()=>{
 const snapshot={
  ok:true,record:{pages:[
   {id:'mercredi-101',group:'celebration',visibility:'published',blocks:[{text:'Publié'}]},
   {id:'jeudi-101',group:'celebration',visibility:'draft',blocks:[{text:'Brouillon privé'}]},
   {id:'vendredi-101',group:'celebration',visibility:'hidden',blocks:[{text:'Masqué'}]}
  ]},shared:{homeId:'neutral-accueil-general',pages:[
   {id:'neutral-accueil-general',group:'page',blocks:[{text:'Accueil'}]},
   {id:'neutral-private',group:'page',visibility:'draft',blocks:[{text:'Interdit'}]}
  ]},plans:[{id:'plan-michael-2028-05-10',visibility:'draft'}],
  celebrationVisible:true,media:[{type:'image',src:'/media/photo.jpg'}]
 };
 const before=JSON.stringify(snapshot),publicCopy=publicModel.publicSnapshot(snapshot);
 assert.deepEqual(publicCopy.ids,['mercredi-101','neutral-accueil-general']);
 assert.deepEqual(publicCopy.record.pages.map(p=>p.id),['mercredi-101']);
 assert.deepEqual(publicCopy.shared.pages.map(p=>p.id),['neutral-accueil-general']);
 assert.equal(publicCopy.shared.homeId,'neutral-accueil-general');
 assert.equal(publicCopy.visible,true);
 assert.equal(publicCopy.media.length,1);
 assert.equal(JSON.stringify(snapshot),before,'no mutation of server-provided data');
});
test('M12: images/audio/video thumbnails nested in one and two columns are discovered',()=>{
 const pages=[{blocks:[
  {kind:'section',columns:[
   [{kind:'image',assetId:'left-file',src:''},
    {kind:'section',columns:[[{'kind':'video',coverAssetId:'deep-cover'}],[]]}],
   [{kind:'video',coverAssetId:'right-cover',href:'/media/movie.mp4'}]
  ]},{kind:'image',assetId:'root-file'},{kind:'button',coverAssetId:'button-cover'}
 ]}];
 assert.deepEqual([...publicModel.assetIds(pages)].sort(),[
  'button-cover','deep-cover','left-file','right-cover','root-file'
 ]);
 assert.deepEqual([...publicModel.assetIds([])],[]);
});
test('M12: private draft and publication flow remain separate from public rendering',()=>{
 const source=readFileSync('migration/cloudflare/app/domain/editor-public-visitor-model.mjs','utf8');
 for(const forbidden of ['localStorage.getItem(', 'localStorage.setItem(', 'fetch(', 'serverSave(', 'serverPublish(', 'indexedDB','document.','window.'])
  assert.ok(!source.includes(forbidden),'visitor projection cannot touch '+forbidden);
 assert.ok(TRIAL_SITE_CLIENT.includes("if(!b||b.hideOnSite===true)return;"));
 assert.ok(TRIAL_SITE_CLIENT.includes("if(b.kind==='section')"));
 assert.ok(TRIAL_SITE_CLIENT.includes("if(b.layout==='columns')"));
 assert.ok(TRIAL_SITE_CLIENT.includes("make('hr','trial-custom-divider')"));
 assert.ok(TRIAL_SITE_CLIENT.includes("img.style.width='100%'"));
 assert.ok(TRIAL_SITE_CLIENT.includes("const title=make('div','trial-video-title'"));
 assert.ok(TRIAL_SITE_CLIENT.includes("container.append(toggle,title)"));
 assert.ok(TRIAL_SITE_CLIENT.includes("formattedText(h,b)"));
 assert.ok(TRIAL_SITE_CLIENT.includes("frame-ancestors")===false);
 assert.ok(TRIAL_SITE_STYLE.length>20000,'CSS retained verbatim');
});
test('M12: old welcome route and mobile navigation remain unchanged',async()=>{
 const pageSource=readFileSync('migration/cloudflare/editor-trial-site-page.mjs','utf8');
 assert.ok(pageSource.includes("frame-ancestors 'none'"));
 for(const route of ['/mediatheque-generale','/programme','/mercredi','/jeudi','/vendredi'])
  assert.ok(TRIAL_SITE_CLIENT.includes("'"+route+"'"),route);
 const script=TRIAL_SITE_CLIENT;
 const nav=script.slice(script.indexOf("const general=el('general-navigation');general.replaceChildren();"),
  script.indexOf("const menu=el('menu-toggle')"));
 const home=nav.indexOf('general.append(home)'),all=nav.indexOf('general.append(all)'),
  gallery=nav.indexOf('general.append(library)'),extras=nav.indexOf("for(const p of pages.filter(p=>p.group==='page'");
 assert.ok(home>=0&&home<all&&all<gallery&&gallery<extras);
 assert.ok(TRIAL_SITE_CLIENT.includes("container.append(a,title)"));
});
