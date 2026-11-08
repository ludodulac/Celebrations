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
 stepContents:[],
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
test('Site trial response contains eight programme pages plus neutral home, a return button, no write queries',async()=>{
 const r=await handleTrialSite(new Request(site+'?celebration=101&page=mercredi'),env);
 assert.equal(r.status,200);
 const html=await r.text();
 assert.ok(html.includes('Site d’essai'));
 assert.ok(html.includes('<footer class="footer"><a id="back-admin"'));
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
 assert.equal(seed.pages.length,9);
 assert.ok(seed.pages.every(p=>p.blocks.length>0));
 assert.equal(seed.pages.find(p=>p.id==='apres-celebration-101').name,'Après célébration');
 assert.ok(html.includes('id="menu-toggle"'));
 assert.equal(seed.pages.find(p=>p.group==='page').name,'Accueil général');
 assert.equal(sqls.length,7);
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
 const planned=await handleTrialSite(new Request(site+'?celebration=plan-gabriel-2026-11-04&page=mercredi'),env);
 assert.equal(planned.status,200);
 const txt=await planned.text();
 assert.ok(txt.includes('Date : 2026-11-04'));
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

test('Visitor dropdown always lists Accueil, Célébrations and Médiathèque générale before custom pages',()=>{
 const script=TRIAL_SITE_CLIENT;
 const start=script.indexOf("const general=el('general-navigation');general.replaceChildren();");
 const end=script.indexOf("const menu=el('menu-toggle')",start);
 assert.ok(start>=0&&end>start,'Visitor navigation builder is present');
 const nav=script.slice(start,end);
 const home=nav.indexOf("general.append(home)");
 const all=nav.indexOf("general.append(all)");
 const library=nav.indexOf("general.append(library)");
 const extras=nav.indexOf("for(const p of pages.filter(p=>p.group==='page'");
 assert.ok(home>=0&&home<all&&all<library&&library<extras,
  'Permanent links precede all added visitor pages');
 assert.ok(!nav.includes("general.prepend(home)"),
  'Do not insert the homepage afterwards and leave custom pages before the media library');
 // Exercise the actual DOM builder on two synthetic added visitor pages.
 const general={children:[],replaceChildren(){this.children=[]},append(item){this.children.push(item)}};
 const make=(tag,cls,label)=>({tag,cls,label});
 const mockPages=[
  {id:'neutral-accueil-general',name:'Accueil',group:'page'},
  {id:'neutral-page-test-1',name:'Notre histoire',group:'page'},
  {id:'neutral-page-test-2',name:'Équipe',group:'page'}
 ];
 const output=new Function('el','generalPages','pages','slugOf','active','listing','isGeneralGallery','make','go',
  nav+';return general.children.map(item=>item.label);')(
   id=>{assert.equal(id,'general-navigation');return general},
   ()=>({homeId:'neutral-accueil-general'}),mockPages,
   p=>p.id,'neutral-accueil-general',false,false,make,()=>{}
  );
 assert.deepEqual(output,['⌂ Accueil','✧ Célébrations','▧ Médiathèque générale','Notre histoire','Équipe']);
});
