import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {handleTrialSite} from '../migration/cloudflare/editor-trial-site-page.mjs';
import {TRIAL_SITE_CLIENT,TRIAL_SITE_STYLE} from '../migration/cloudflare/editor-trial-site-client.mjs';
const site='https://celebrations-exit-staging.rondes.workers.dev/__editor/voir-le-site';
const data={
 celebrations:[{id:101,archangel:'Michaël',year:'2026'}],
 steps:['Préparation','Mercredi','Jeudi','Vendredi','Samedi','Dimanche','Après célébration'].map((label,i)=>({id:i+1,celebration_id:101,step_key:['preparation','mercredi','jeudi','vendredi','samedi','dimanche','apres-celebration'][i]+'-101',label,start_date:null,end_date:null,body_text:'Texte public du '+label})),
 events:[],
 eventContents:[],
 stepContents:[{step_key:'preparation-101',sort_order:1,id:'pdf-1',name:'Document de célébration',content_type:'document',mime_type:'application/pdf',source_type:'file',storage_path:'media/programme-document',audience:'all'}],
 links:[]
};
const sqls=[];
const env={DB:{prepare(sql){sqls.push(sql);return {bind(...args){return {async all(){
 if(sql.includes('FROM celebrations_celebrations'))return {results:data.celebrations};
  if(sql.includes("FROM celebrations_contents WHERE audience='all'"))return {results:[]};
 if(sql.includes('FROM celebrations_steps'))return {results:data.steps};
 if(sql.includes('FROM celebrations_events WHERE'))return {results:data.events};
 if(sql.includes('FROM celebrations_event_contents'))return {results:data.eventContents};
 if(sql.includes('FROM celebrations_step_contents'))return {results:data.stepContents};
 if(sql.includes('FROM celebrations_links'))return {results:data.links};
 throw Error('Unexpected read query '+sql);
 }}}}}}};
// Public pages require an explicit R2 publication, not D1 presence alone.
const publishedSnapshot={
 version:1,drafts:{'101':{pages:[]}},plans:[],
 shared:{pages:[],homeId:''},
 published:{drafts:{'101':{pages:[]}},shared:{pages:[],homeId:''},plans:[],
  celebrationVisibility:{'101':'published'}}
};
env.EDITOR_BUCKET={async get(){return {etag:'1',body:true,text:async()=>JSON.stringify(publishedSnapshot)}}};

test('An unapproved D1 celebration remains invisible to anonymous visitors',async()=>{
 const hidden={...env,EDITOR_BUCKET:{async get(){return {etag:'1',body:true,text:async()=>JSON.stringify({
  ...publishedSnapshot,published:{...publishedSnapshot.published,celebrationVisibility:{}}
 })}}}};
 const response=await handleTrialSite(new Request(site+'?celebration=101&page=mercredi'),hidden);
 assert.equal(response.status,404,'D1 alone must not publish a celebration');
});

test('Site trial response contains eight programme pages plus neutral home, a return button, no write queries',async()=>{
 const r=await handleTrialSite(new Request(site+'?celebration=101&page=mercredi'),env);
 assert.equal(r.status,200);
 const html=await r.text();
 assert.ok(html.includes('Site d’essai'));
 assert.ok(html.includes('<footer class="footer"><nav id="footer-pages"'), 'Published footer pages retain their navigation');
 assert.ok(html.includes('<a id="back-admin"'), 'Existing admin return link is retained');
 assert.ok(html.includes('>Administration</a></footer>'));
 assert.ok(!html.includes('← Retour à l’administration'));
 assert.ok(!html.includes('Prévisualisation du programme'));
 assert.ok(!html.includes('Aperçu de démonstration'));
 assert.ok(html.includes('Texte public du Mercredi'));
 assert.ok(!html.includes('id="page-heading"')&&!html.includes('id="site-hero-title"'),'Fixed, uneditable page headings are removed');
 assert.ok(html.includes("window.__PUBLIC_SITE_SNAPSHOT__"));
 assert.ok(!html.includes('localStorage.setItem('),'Visitor cannot overwrite local admin drafts');
 const s=html.match(/window\.__TRIAL_SITE_SEED__=([\s\S]*?);<\/script>/);
 assert.ok(s,'embedded public seed');
 const seed=JSON.parse(s[1]);
 assert.equal(seed.pages.length,10);
 const programme=seed.pages.find(p=>p.id==='programme-101');
 const preparation=seed.pages.find(p=>p.id==='preparation-101');
 assert.ok(programme,'Each celebration must have its own Programme page');
 assert.ok(preparation,'Preparation remains a separate page');
 assert.notEqual(programme.id,preparation.id);
 assert.ok(seed.files.some(x=>x.category==='pdf'&&x.name==='Document de célébration'),'PDF MIME is visible in the celebration file catalogue');
 assert.ok(seed.library.some(x=>x.type==='pdf'&&x.name==='Document de célébration'),'PDF MIME is visible in the celebration media library');
 assert.match(TRIAL_SITE_CLIENT,/\['programme',t\('Programme'\)\]/,'Programme shortcut must route to Programme');
 assert.ok(TRIAL_SITE_CLIENT.includes("'/programme':'programme'"),'Direct Programme URL must not route to Preparation');
 assert.ok(seed.pages.every(p=>p.blocks.length>0));
 assert.equal(seed.pages.find(p=>p.id==='apres-celebration-101').name,'Après célébration');
 assert.ok(html.includes('id="menu-toggle"'));
 assert.equal(seed.pages.find(p=>p.group==='page').name,'Accueil général');
 assert.equal(sqls.length,8);
 assert.ok(sqls.every(q=>q.startsWith('SELECT ')),'read only');
 assert.match(r.headers.get('content-security-policy'),/connect-src 'self'/);
 const scripts=[...html.matchAll(/<script nonce="[0-9a-f]+">([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,2);
 for(const m of scripts)new Script(m[1]);
});
test('Trial site rejects invalid stages and POST, but the live official host is allowed',async()=>{
 assert.equal((await handleTrialSite(new Request(site+'?page=invalid'),env)).status,404);
 assert.equal((await handleTrialSite(new Request('https://www.ronde-des-archanges-universelle.eu/__editor/voir-le-site'),env)).status,200);
 assert.equal((await handleTrialSite(new Request(site,{method:'POST'}),env)).status,405);
 assert.equal((await handleTrialSite(new Request(site+'?celebration=999'),env)).status,404);
});

test('Site preview sanitises saved rich text while retaining only selected colour and bold',()=>{
 assert.ok(TRIAL_SITE_CLIENT.includes("function inlineTextColor("));
 assert.ok(TRIAL_SITE_CLIENT.includes("tag==='SPAN'||tag==='FONT'"));
 assert.ok(TRIAL_SITE_CLIENT.includes("wrapper.style.color=color"));
 assert.ok(TRIAL_SITE_CLIENT.includes("['SCRIPT','STYLE','SVG','IFRAME','OBJECT','TEMPLATE']"));
});

test('Nouvel aperçu : accueil neutre, menu Célébrations et URL Gabriel planifiée',async()=>{
 const home=await handleTrialSite(new Request(site+'?celebration=101'),env);
 assert.equal(home.status,200);
 const html=await home.text();
 assert.ok(html.includes('☰ Menu'));
 assert.ok(html.includes('Ronde des Archanges Universelle'));
 // M009-A: planned draft pages belong to the authenticated editor, never HTML
 // served anonymously to visitors. The editor preparation preview is unchanged.
 const planned=await handleTrialSite(new Request(site+'?celebration=plan-gabriel-2026-11-04&page=mercredi'),env);
 assert.equal(planned.status,404);
 assert.equal((await handleTrialSite(new Request(site+'?celebration=101&page=celebrations'),env)).status,200);
 assert.equal((await handleTrialSite(new Request(site+'?celebration=101&page=mediatheque'),env)).status,200);
 assert.ok(html.includes('celebration-shortcuts'));
 assert.ok(!html.includes('id="celebration-choice"'));
 assert.ok(!html.includes('id="return-celebration"'));
});

test('video thumbnails have small bold captions under them, not titles in boxed buttons',()=>{
 assert.ok(TRIAL_SITE_CLIENT.includes("container.append(toggle,title)"),
  'YouTube/Vimeo caption is outside the player button');
 assert.ok(TRIAL_SITE_CLIENT.includes("container.append(a,title)"),
  'External video caption is a sibling below its thumbnail link');
 assert.ok(!TRIAL_SITE_CLIENT.includes("a.append(title);container.append(a)"),
  'A video title is no longer inside a linked framed card');
 assert.match(TRIAL_SITE_STYLE,/\.trial-video-title\{font-size:14px;line-height:1\.4;font-weight:700/);
 assert.match(TRIAL_SITE_STYLE,/\.trial-video \.trial-site-link\{border:0;/);
});

test('Visitor menu keeps custom pages in author order without a global media library',()=>{
 const script=TRIAL_SITE_CLIENT;
 const start=script.indexOf("const general=el('general-navigation');general.replaceChildren();");
 const end=script.indexOf("const menu=el('menu-toggle')",start);
 assert.ok(start>=0&&end>start,'Visitor navigation builder is present');
 const nav=script.slice(start,end);
 const home=nav.indexOf('general.append(home)');
 const extras=nav.indexOf("for(const p of pages.filter(p=>p.group==='page'");
 const all=nav.indexOf('general.append(all)');
 assert.ok(home>=0&&home<extras&&extras<all,
  'Homepage, author-ordered pages, then celebrations');
 assert.ok(!nav.includes('general.append(library)'),
  'Global visitor media library must remain absent');
 assert.ok(nav.includes("p.placement!=='footer'"),
  'Footer pages must not be duplicated in main navigation');
});
