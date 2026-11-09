import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';

test('M4: embedded ESBuild-named public visitor helper exists before bundled function',()=>{
 const helper=TRIAL_SITE_CLIENT.indexOf('const __name=');
 const model=TRIAL_SITE_CLIENT.indexOf('function createPublicVisitorModel(');
 assert.ok(helper>0,'Missing esbuild helper in INLINE browser code');
 assert.ok(model>helper,'The helper must be declared BEFORE the captured function');
 assert.doesNotThrow(()=>new Script(TRIAL_SITE_CLIENT),'Public website script must parse');
});
test('M4: builtin __name helper preserves exact callable semantics',()=>{
 const code=TRIAL_SITE_CLIENT;
 const at=code.indexOf('const __name=');
 const stop=code.indexOf('\n',at);
 const declaration=code.slice(at,stop);
 // A function emitted by esbuild can have the __name(a, "a") call inside
 // its Function.toString() result: it must work on the browser side.
 const actual=new Function(declaration+';const fn=(x)=>x+1;__name(fn,"computed");return {name:fn.name,value:fn(5)}')();
 assert.deepEqual(actual,{name:'computed',value:6});
});
