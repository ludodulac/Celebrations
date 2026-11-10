import {readFileSync} from 'node:fs';
import {prepareMichaelLayout} from '../migration/cloudflare/editor-michael-preparation-layout.mjs';

const page=JSON.parse(readFileSync(0,'utf8'));
const result=prepareMichaelLayout(page);
process.stdout.write(JSON.stringify(result));
