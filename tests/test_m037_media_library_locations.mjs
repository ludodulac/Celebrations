import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {discoverMedia} from '../migration/cloudflare/editor-publication-api.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {M031_COMPACT_LAYOUT_CSS} from '../migration/cloudflare/app/styles/admin/m031-compact-layout.mjs';

const image=n=>'/media/new/12345678-1234-4234-8234-123456789ab'+n+'.jpg';
const entry=n=>({
 id:'image|'+image(n),src:image(n),type:'image',source:'uploaded',name:'Image '+n,
 general:false
});
const page=(id,visibility,n,group='page')=>({
 id,name:id,group,visibility,blocks:[{kind:'image',src:image(n),text:'Photo '+n}]
});

test('M037: pages publiées, masquées, brouillons et supprimées sont distinguées',()=>{
 const state={
  mediaCatalogue:[1,2,3,4].map(entry),
  shared:{pages:[page('hidden-page','hidden',2),page('draft-page','draft',3)]},
  drafts:{},
  published:{shared:{pages:[page('live-page','published',1)]},drafts:{}}
 };
 const result=discoverMedia(state);
 assert.equal(result.length,4);
 assert.deepEqual(result.map(x=>x.uses.map(u=>u.usageStatus)),
  [['published'],['hidden'],['draft'],[]]);
 assert.equal(result[3].src,image(4),'suppression de page = image toujours au catalogue');
});

test('M037: masquer la célébration masque ses images indépendamment du statut de la page',()=>{
 const state={
  mediaCatalogue:[entry(1)],shared:{pages:[]},drafts:{},
  published:{shared:{pages:[]},drafts:{
   '101':{pages:[page('mercredi-101','published',1,'celebration')]}
  },celebrationVisibility:{'101':'hidden'}}
 };
 const record=discoverMedia(state)[0];
 assert.equal(record.uses[0].usageStatus,'hidden');
});

test('M037: un ancien brouillon ne remplace pas une référence publiée encore visible',()=>{
 const state={
  mediaCatalogue:[entry(1)],
  shared:{pages:[page('live-page','draft',1)]},drafts:{},
  published:{shared:{pages:[page('live-page','published',1)]},drafts:{}}
 };
 assert.equal(discoverMedia(state)[0].uses[0].usageStatus,'published');
});

test('M037: cartes sobres, image cliquable, suppression confirmée et couleurs explicites',()=>{
 const source=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
 assert.ok(DEMO_CLIENT.includes('N’apparaît nulle part'));
 assert.ok(DEMO_CLIENT.includes('Êtes-vous sûr de vouloir supprimer'));
 assert.ok(source.includes("n('a','media-picture-link')"));
 assert.ok(!source.includes("link.append(n('span','media-unused-ribbon'"));
 assert.ok(!source.includes("b('Supprimer si inutilisé'"));
 assert.ok(!source.includes("controls.append(b('🔗 Copier l’URL'"));
 assert.match(M031_COMPACT_LAYOUT_CSS,/file-location-published/);
 assert.match(M031_COMPACT_LAYOUT_CSS,/file-location-hidden/);
 assert.match(M031_COMPACT_LAYOUT_CSS,/file-location-draft/);
 assert.doesNotThrow(()=>new Function(DEMO_CLIENT));
});

test('M037: le mode d’emploi intégré est court et actualisé',()=>{
 const source=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
 assert.match(source,/const GUIDE_TOPICS=\[/);
 assert.match(source,/N’apparaît nulle part/);
 assert.match(source,/Prendre toute la largeur de la page/);
 assert.match(source,/200 Mo/);
 assert.match(source,/Gestion des membres et des accès privés/);
 assert.doesNotMatch(source,/Dans la fiche du fichier, utilisez « 👁 Voir »/);
 const topics=source.slice(source.indexOf('const GUIDE_TOPICS=['),
  source.indexOf('function userGuide(){'));
 assert.equal((topics.match(/"group":/g)||[]).length,14);
});
