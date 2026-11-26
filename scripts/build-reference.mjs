// Offline only: no Cloudflare credentials, API calls, resource access or deploy.
import {build,transformSync} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(readFileSync(new URL('../docs/reconciliation/production-manifest.json',import.meta.url)));
const result=await build({absWorkingDir:root+'migration/cloudflare',entryPoints:['production-worker.mjs'],bundle:true,format:'esm',platform:'browser',external:['node:crypto'],keepNames:true,write:false,metafile:true});
const code=result.outputFiles[0].text;
const normalize=source=>transformSync(source,{loader:'js',format:'esm',charset:'utf8',minifySyntax:true,legalComments:'none'}).code;
const normalized=normalize(code);
const hash=createHash('sha256').update(normalized).digest('hex');
assert.equal(hash,manifest.normalized_sha256,'Worker differs from the recovered production reference; investigate before updating the manifest');
if(process.argv[2])assert.equal(normalized,normalize(readFileSync(process.argv[2],'utf8')),'Recovered Worker differs from reconstructed sources');
mkdirSync(root+'.reference-build',{recursive:true});
writeFileSync(root+'.reference-build/production-worker.js',code);
writeFileSync(root+'.reference-build/inputs.json',JSON.stringify(result.metafile.inputs,null,2)+'\n');
console.log(JSON.stringify({result:'PRODUCTION_SOURCE_EQUIVALENCE_PASS',version:manifest.version,normalized_sha256:hash,modules:Object.keys(result.metafile.inputs).length,deployment:false}));
