// M038 — visitor audio reliability. No private media or publication changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';

const source=TRIAL_SITE_CLIENT;
test('M038: site visitor client still compiles after audio amendments',()=>{
 assert.doesNotThrow(()=>new Function(source));
});
test('M038: Android users may play audio immediately or open a direct link',()=>{
 assert.match(source,/audio\.preload='none'/);
 assert.match(source,/player\.preload='metadata'/);
 assert.match(source,/player\.play\(\)/);
 assert.match(source,/media-audio-direct/);
 assert.match(source,/audio\.addEventListener\('error'/);
 assert.match(source,/direct\.target='_blank'/);
});
test('M040: no visitor global media gallery, even if general media exists',()=>{
 assert.doesNotMatch(source,/function generalGalleryEntries\(/);
 assert.doesNotMatch(source,/general\.append\(library\)/);
 assert.doesNotMatch(source,/Médiathèque générale/);
 assert.match(source,/if\(active==='mediatheque-generale'\)active='celebrations'/);
 assert.match(source,/\'\/mediatheque-generale\':\'celebrations\'/);
});
test('M040: each celebration still has its own gallery shortcut',()=>{
 assert.match(source,/\['preparation',t\('Programme'\)\],\['mediatheque',t\('Médiathèque'\)\]/);
 assert.match(source,/const all=galleryEntries\(\),tabs=/);
 assert.match(source,/galleryCard\(item\)/);
});
test('M038: do not display an empty gallery tab when audio is present',()=>{
 assert.match(source,/if\(all\.length&&!all\.some/);
 assert.match(source,/libraryFamily=\['pdf','file'\]\.includes\(first\.type\)\?'text':first\.type/);
});
