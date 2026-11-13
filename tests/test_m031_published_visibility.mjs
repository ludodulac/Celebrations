import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
const api=readFileSync(new URL('../migration/cloudflare/editor-server-draft-api.mjs',import.meta.url),'utf8');
const compiled=readFileSync(new URL('../migration/cloudflare/editor-demo-client.mjs',import.meta.url),'utf8');
function testVisibility(server,local){
 const match=src.match(/function sharedVisibility\(\)\{[\s\S]*?\n\}/);
 assert.ok(match,'sharedVisibility function missing');
 const localStorage={getItem:()=>JSON.stringify({celebrationVisibility:local})};
 const fn=Function('IS_STAGE','serverPublishedCelebrationVisibility','localStorage','SHARED_KEY',match[0]+';return sharedVisibility()');
 return fn(true,server,localStorage,'test-key');
}
test('M031: published R2 Michaël 101 stays green even when local draft is hidden or absent',()=>{
 assert.equal(testVisibility({'101':'published'},{'101':'hidden'})['101'],'published');
 assert.equal(testVisibility({'101':'published'},{})['101'],'published');
 assert.equal(testVisibility({'101':'hidden'},{'101':'published'})['101'],'hidden');
});
test('M031: server supplies published status under the authenticated editor GET only',()=>{
 assert.match(api,/publishedCelebrationVisibility:state\.published\?\.celebrationVisibility/);
 assert.match(api,/if\(open&&isWritableEditorHost\(url\.hostname,env\)&&\s*!await hasEditorAccess\(request,env\)\)/);
 assert.match(src,/serverPublishedCelebrationVisibility=publicStates&&typeof publicStates/);
 assert.match(src,/serverPublishedCelebrationVisibility=\{\.\.\.\(serverPublishedCelebrationVisibility\|\|\{\}\),\[SERVER_ID\]:command\.visibility\}/);
});
test('M031: deployment output regenerated from source, no stale inline script',()=>{
 const marker='+"\\n"+',p=compiled.indexOf(marker);
 assert.ok(p>0);
 assert.equal(JSON.parse(compiled.slice(p+marker.length,-2)),src);
});
