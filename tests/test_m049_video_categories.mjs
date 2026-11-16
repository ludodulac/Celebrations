import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';

const server=readFileSync(new URL('../migration/cloudflare/editor-publication-api.mjs',import.meta.url),'utf8');
const admin=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
const sourceFrom=(s,beg,end)=>{
 const a=s.indexOf(beg),b=s.indexOf(end,a);
 assert.ok(a>=0&&b>a,'classification function present');
 return s.slice(a,b);
};
const visitorClassifier=sourceFrom(TRIAL_SITE_CLIENT,'const defaultVideoTypes=','const defaultAudioTypes=');
const adminClassifier=sourceFrom(admin,'const DEFAULT_VIDEO_TYPES=','const DEFAULT_AUDIO_TYPES=');
const serverClassifier=sourceFrom(server,'const VIDEO_TYPES=','const cleanMediaName=');

test('M049: only three selectable categories for video',()=>{
 for(const str of [visitorClassifier,adminClassifier,serverClassifier])
  assert.match(str,/\['Conférences','Rituels','Exercices et explications'\]/);
 assert.doesNotMatch(serverClassifier,/VIDEO_TYPES=\['Conférences','Rituels','Explications','Exercices'\]/);
 assert.doesNotMatch(adminClassifier,/DEFAULT_VIDEO_TYPES=\['Conférences','Rituels','Explications','Exercices'\]/);
 assert.doesNotMatch(visitorClassifier,/defaultVideoTypes=\['Conférences','Rituels','Explications','Exercices'\]/);
});

test('M049: conference examples from the screenshots are recognized',()=>{
 const names=[
  'Voir : Comprendre le symbolisme de la Ronde des Archanges',
  'Voir : Comprendre le travail alchimique du rite du Pardon des Offenses',
  'Voir : Vimeo',
  'Voir : YouTube',
  '2013.09.20 Cernunnos l’Autre visage de l’Archange Michaël chez les Celtes – vidéo',
  'Voir : 2026.09.16 Les secrets de la ménora Essénienne.'
 ];
 for(const sample of names){
  const classifier=new Function(visitorClassifier+'return videoTypeFor;')();
  assert.equal(classifier({name:sample}),'Conférences',sample);
  // A stale classification must not override corrections based on the title.
  assert.equal(classifier({name:sample,videoType:'Explications'}),'Conférences',sample);
 }
});

test('M049: all exercise/explanation tags merge without losing historic media',()=>{
 const f=new Function(visitorClassifier+'return videoTypeFor;')();
 for(const type of ['Exercices','Explications','Exercices et explications']){
  assert.equal(f({name:'Mouvements et danse',videoType:type}),'Exercices et explications');
 }
 assert.equal(f({name:'Comment allumer une bougie'}),'Exercices et explications');
 assert.equal(f({name:'Rituel de lumière'}),'Rituels');
 assert.equal(f({name:'Une conférence',videoType:'Rituels'}),'Rituels');
});

test('M049: protected video category update still uses optimistic revision',()=>{
 assert.match(server,/expectedRevisionMatches\(input\.expectedRevision,current\.state\.version\)/);
 assert.match(server,/VIDEO_TYPES\.includes\(input\.videoType\)/);
 assert.match(server,/normalizedVideoType\(assigned\.videoType,assigned\.name\|\|m\.name\)/);
 assert.doesNotThrow(()=>new Function(TRIAL_SITE_CLIENT));
 assert.doesNotThrow(()=>new Function(DEMO_CLIENT));
});
