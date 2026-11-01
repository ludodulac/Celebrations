import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {handleTrialSite} from '../migration/cloudflare/editor-trial-site-page.mjs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';
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
 assert.ok(html.includes('Retour à l’administration'));
 assert.ok(html.includes('Texte public du Mercredi'));
 assert.ok(html.includes('Célébration Michaël'));
 assert.ok(html.includes("celebrations-demo-preparation-"));
 const s=html.match(/window\.__TRIAL_SITE_SEED__=([\s\S]*?);<\/script>/);
 assert.ok(s,'embedded public seed');
 const seed=JSON.parse(s[1]);
 assert.equal(seed.pages.length,9);
 assert.ok(seed.pages.every(p=>p.blocks.length>0));
 assert.equal(seed.pages.find(p=>p.id==='apres-celebration-101').name,'Après préparation');
 assert.ok(html.includes('id="menu-toggle"'));
 assert.equal(seed.pages.find(p=>p.group==='page').name,'Accueil général');
 assert.equal(sqls.length,6);
 assert.ok(sqls.every(q=>q.startsWith('SELECT ')),'read only');
 assert.match(r.headers.get('content-security-policy'),/connect-src 'none'/);
 const scripts=[...html.matchAll(/<script nonce="[0-9a-f]+">([\s\S]*?)<\/script>/g)];
 assert.equal(scripts.length,2);
 for(const m of scripts)new Script(m[1]);
});
test('Trial site denies unknown stages, production host, and POST writes',async()=>{
 assert.equal((await handleTrialSite(new Request(site+'?page=invalid'),env)).status,404);
 assert.equal((await handleTrialSite(new Request('https://www.ronde-des-archanges-universelle.eu/__editor/voir-le-site'),env)).status,404);
 assert.equal((await handleTrialSite(new Request(site,{method:'POST'}),env)).status,405);
 assert.equal((await handleTrialSite(new Request(site+'?celebration=999'),env)).status,404);
});

test('Site preview sanitises saved rich text while retaining only selected colour and bold',()=>{
 assert.ok(TRIAL_SITE_CLIENT.includes("function inlineTextColor("));
 assert.ok(TRIAL_SITE_CLIENT.includes("tag==='SPAN'||tag==='FONT'"));
 assert.ok(TRIAL_SITE_CLIENT.includes("wrapper.style.color=color"));
 assert.ok(TRIAL_SITE_CLIENT.includes("['SCRIPT','STYLE','SVG','IFRAME','OBJECT','TEMPLATE']"));
});
