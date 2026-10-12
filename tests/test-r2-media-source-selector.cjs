const assert=require('node:assert/strict');
const {test}=require('node:test');
const selector=require('../scripts/r2-media-source-selector.js');
const supabase=path=>'https://example.supabase.co/storage/v1/object/public/celebrations-media/'+path.split('/').map(encodeURIComponent).join('/');
test('defaults to Supabase and does not rewrite external URLs',()=>{
 assert.equal(selector.current(),'SUPABASE');
 assert.equal(selector.url('a b/test.mp3',supabase),supabase('a b/test.mp3'));
 assert.equal(selector.url('https://example.org/remote.pdf',supabase),'https://example.org/remote.pdf');
});
test('R2 requires explicit HTTPS origin and opt-in',()=>{
 assert.throws(()=>selector.configure({source:'R2'}));
 assert.throws(()=>selector.configure({r2Origin:'http://insecure.test'}));
 selector.configure({r2Origin:'https://media.example.org',source:'R2'});
 assert.equal(selector.url('audio/été.mp3',supabase),'https://media.example.org/audio/%C3%A9t%C3%A9.mp3');
 assert.throws(()=>selector.url('../secret',supabase));
});
test('rollback is immediate and preserves Supabase URL mapping',()=>{
 selector.rollback();
 assert.equal(selector.current(),'SUPABASE');
 assert.equal(selector.url('audio/test.mp3',supabase),supabase('audio/test.mp3'));
});
