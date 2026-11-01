import test from 'node:test';
import assert from 'node:assert/strict';
import {fiveColourways,colourFamily} from '../migration/cloudflare/editor-celebration-themes.mjs';
import {DEMO_CSS} from '../migration/cloudflare/editor-demo-style.mjs';
import {TRIAL_SITE_CLIENT,TRIAL_SITE_STYLE} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';

const cases=[
 ['Michaël','michael',rgb=>rgb[0]>=rgb[1]&&rgb[0]>=rgb[2]],
 ['Raphaël','raphael',rgb=>rgb[1]>=rgb[0]&&rgb[1]>=rgb[2]],
 ['Gabriel','gabriel',rgb=>rgb[2]>=rgb[0]&&rgb[2]>=rgb[1]],
 ['Auriel','auriel',rgb=>rgb[0]>=rgb[1]&&rgb[1]>=rgb[2]]
];
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
test('Five coordinated monochrome colourways are generated for each of the four archangels',()=>{
 for(const [name,family,hue] of cases){
  assert.equal(colourFamily(name),family);
  const palettes=fiveColourways(name);
  assert.equal(palettes.length,5);
  assert.equal(new Set(palettes.map(p=>p.name)).size,5);
  assert.equal(new Set(palettes.map(p=>p.shades[4])).size,5);
  for(const p of palettes){
   assert.equal(p.shades.length,5);
   for(const shade of p.shades)assert.match(shade,/^#[0-9a-f]{6}$/i);
   assert.ok(hue(rgb(p.shades[3])),'Accent must stay within archangel hues: '+name+' '+p.name);
   assert.ok(hue(rgb(p.shades[4])),'Deep colour must stay within archangel hues: '+name+' '+p.name);
  }
 }
 assert.equal(colourFamily('Ouriel'),'auriel');
 assert.equal(colourFamily('Uriel'),'auriel');
});
test('Theme selection is kept in local drafts and preview without changing text colours',()=>{
 assert.ok(DEMO_CLIENT.includes('db.themeIndex=i'));
 assert.ok(DEMO_CLIENT.includes('theme-option'));
 assert.ok(DEMO_CLIENT.includes('aria-pressed'));
 assert.ok(TRIAL_SITE_CLIENT.includes('saved.themeIndex'));
 assert.ok(TRIAL_SITE_CLIENT.includes('applyCelebrationPalette()'));
 assert.match(DEMO_CSS,/\.stage-editor \.text\{color:#494f54\}/);
 assert.match(TRIAL_SITE_STYLE,/\.trial-paragraph\{color:#484f55\}/);
 assert.match(TRIAL_SITE_STYLE,/\.trial-heading\{color:#292e32\}/);
});
