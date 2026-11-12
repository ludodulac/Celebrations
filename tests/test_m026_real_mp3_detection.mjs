import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
const block=source.slice(source.indexOf('async function uploadLargeMp3('),
 source.indexOf('async function createExternalMedia('));
const extract=pattern=>{
 const match=block.match(pattern);
 assert.ok(match,'Upload routing expression missing');
 return Function('name','return ('+match[1]+').test(name)'); // isolate regex only
};
test('90 Mo MP3 with an ordinary filename selects multipart R2 rather than legacy 26 Mo form',()=>{
 const isMp3=extract(/const mp3=(\/[^\n;]+\/i)\.test\(String\(file\.name\|\|''\)\)/);
 const allowedLarge=extract(/if\(!?(\/[^\n;]+\/i)\.test\(normalizedName\)\)/);
 for(const name of ['Enregistrement 90 Mo.mp3','Mon conte.MP3','conte.test.mp3']){
  assert.equal(isMp3(name),true,name);
  assert.equal(allowedLarge(name),true,name);
 }
 for(const name of ['livre.pdf','partage.wav','fichier.mp3.pdf']){
  assert.equal(isMp3(name),false,name);
  assert.equal(allowedLarge(name),false,name);
 }
 const MAX=200_000_000,ORDINARY=25_000_000,FILE=90_000_000;
 assert.ok(FILE>ORDINARY&&FILE<=MAX);
 assert.equal(isMp3('Conte 90 Mo.mp3')&&FILE>ORDINARY,true,
  '90 MB MP3 must bypass old 26 MB multipart/form-data request');
 assert.match(block,/if\(mp3&&file\.size>MP3_SINGLE_REQUEST\)\{\s*const result=await uploadLargeMp3\(file,onProgress\)/);
 assert.match(block,/xhr\.open\('POST',endpoint\('mpu-part'\),true\)/);
 assert.doesNotMatch(block,/const mp3=\/\\\\\.mp3\$\/i/,'Double slash regression must never recur');
});
test('document access policy stays protected: public PDFs only if released, not private/drafts',()=>{
 const gateway=readFileSync(new URL('../migration/cloudflare/public-upload-gateway.mjs',import.meta.url),'utf8');
 assert.match(gateway,/if\(!state\.published\)return false/);
 assert.match(gateway,/if\(referencedByPrivateOwner\(state,src\)\)return false/);
 assert.match(gateway,/if\(publishedPageReferences\(state,src\)\)return true/);
});
