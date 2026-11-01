// Only staging assets. Vendor a fixed lamejs version into our own origin, never runtime CDN.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();
const base=path.join(root,'node_modules','lamejs');
const candidates=['lame.all.min.js','lame.all.js','lame.min.js'];
const source=candidates.map(p=>path.join(base,p)).find(p=>fs.existsSync(p));
assert.ok(source,'lamejs@1.2.1 missing from npm install');
const manifest=JSON.parse(fs.readFileSync(path.join(base,'package.json'),'utf8'));
assert.equal(manifest.version,'1.2.1','Do not silently upgrade the browser audio encoder');
const code=fs.readFileSync(source,'utf8');
assert.ok(code.includes('Mp3Encoder'),'Bundled encoder lacks the Mp3Encoder API');
const dir=path.join(root,'staging-public','migration','cloudflare');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'lame.all.min.js'),code);
const license=['LICENSE','LICENSE.txt','LICENSE.md','COPYING'].map(p=>path.join(base,p)).find(p=>fs.existsSync(p));
if(license)fs.copyFileSync(license,path.join(dir,'LAMEJS-LICENSE.txt'));
fs.writeFileSync(path.join(dir,'LAMEJS-NOTICE.txt'),
 'Audio encoder lamejs 1.2.1, LGPL-3.0. Source: https://github.com/zhuker/lamejs .\n'+
 'The converter runs on your device and does not transmit WAV files to third parties.\n');
console.log('Vendored lamejs@1.2.1 for staging from '+path.basename(source));
