import {readFileSync,writeFileSync} from 'node:fs';
const target=new URL('../migration/cloudflare/editor-demo-client.mjs',import.meta.url);
const original=readFileSync(target,'utf8');
const prefix=original.slice(0,original.indexOf('export const DEMO_CLIENT=')).replace(/\/\/ Generated body:[^\n]*\n/g,'');
const body=readFileSync(new URL('../migration/cloudflare/editor-demo-client-source.js',import.meta.url),'utf8');
const result=prefix+'// Generated body: edit editor-demo-client-source.js, then run scripts/build-m019-editor-client.mjs.\nexport const DEMO_CLIENT="\\n(async()=>{\'use strict\';\\nconst __name=(fn,name)=>{Object.defineProperty(fn,\'name\',{value:name,configurable:true});return fn};\\n"+EDITOR_MODULES+"\\n"+'+JSON.stringify(body)+';\n';
if(process.argv.includes('--check')){if(result!==original)throw Error('M019 editor source out of date')}else writeFileSync(target,result);
