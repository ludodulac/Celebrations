import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync('migration/cloudflare/production-worker.mjs','utf8');
const map=src.match(/const DIRECT_PAGES=new Map\(\[([\s\S]+?)\]\);/);
const expected={
 '/programme':'preparation','/preparation':'preparation',
 '/mercredi':'mercredi','/jeudi':'jeudi','/vendredi':'vendredi',
 '/samedi':'samedi','/dimanche':'dimanche',
 '/apres-celebration':'apres-celebration',
 '/bibliotheque':'mediatheque','/mediatheque':'mediatheque',
 '/mediatheque-generale':'mediatheque-generale'
};
test('M02: public aliases are defined only once, outside the request handler',()=>{
 assert.ok(map,'Route table must be defined at module scope');
 assert.ok(src.indexOf('const DIRECT_PAGES=new Map(')<src.indexOf('export default {'));
 assert.equal(src.match(/new Map\(\[/g)?.length,1);
 const pairs=[...map[1].matchAll(/\["([^"]+)","([^"]+)"\]/g)];
 assert.deepEqual(Object.fromEntries(pairs.map(m=>[m[1],m[2]])),expected);
});
test('M02: existing trailing-slash URLs, home URL and no fallback changes',()=>{
 assert.ok(src.includes('path.length>1?path.replace(/\\/$/,""):path;'));
 assert.ok(src.includes('DIRECT_PAGES.has(normalized)'));
 assert.ok(src.includes('DIRECT_PAGES.get(normalized)'));
 assert.ok(src.includes('if(path==="/"||path==="/index.html"||DIRECT_PAGES.has(normalized))'));
 assert.ok(src.includes('return handleTrialSite(new Request(viewUrl,request),env);'));
 assert.ok(src.includes('return env.ASSETS.fetch(request)'));
});
test('M02: one official-host decision is reused; candidate read-only fences remain',()=>{
 assert.equal(src.match(/const officialHost=isOfficialEditorHost\(url.hostname\)/g)?.length,1);
 assert.ok(src.includes('if((officialHost||visualCandidate)&&env.DB)'));
 assert.ok(src.includes('isReadonlyCandidateHost(url.hostname)'));
 assert.ok(src.includes('isPrivateEditorPath(path)'));
 assert.ok(src.includes('if(officialHost){'));
});
