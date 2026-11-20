import test from 'node:test';
import assert from 'node:assert/strict';
import {readableMediaPath,isReadableMediaPath} from '../migration/cloudflare/app/domain/editor-readable-media-path.mjs';

test('new uploads get readable URLs with normalized names',()=>{
 assert.equal(readableMediaPath('Programme Michaël 2026.pdf','pdf'),'/doc/programme-michael-2026.pdf');
 assert.equal(readableMediaPath('Chant des Anges.mp3','audio'),'/audio/chant-des-anges.mp3');
 assert.equal(readableMediaPath('Archange Michaël.JPG','image'),'/image/archange-michael.jpg');
});
test('collision suffixes preserve original extension',()=>{
 const used=['/doc/programme.pdf','/doc/programme-1.pdf'];
 assert.equal(readableMediaPath('Programme.pdf','pdf',used),'/doc/programme-2.pdf');
});
test('path allocator rejects unsupported types and traversal',()=>{
 assert.equal(readableMediaPath('a.pdf','video'),null);
 assert.equal(readableMediaPath('../Mon fichier.pdf','pdf'),'/doc/mon-fichier.pdf');
 assert.equal(isReadableMediaPath('/media/new/abc'),false);
 assert.equal(isReadableMediaPath('/doc/mon-fichier.pdf'),true);
});
