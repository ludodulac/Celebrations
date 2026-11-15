import test from 'node:test';
import assert from 'node:assert/strict';
import {TRIAL_SITE_CLIENT} from '../migration/cloudflare/editor-trial-site-client.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
import {CSS_03_TEXT_AND_GALLERY} from '../migration/cloudflare/app/styles/public/03-text-and-gallery.mjs';
import {CSS_06_LIBRARY_DIALOGS} from '../migration/cloudflare/app/styles/admin/06-library-dialogs.mjs';
test('M041: both browser inline scripts compile',()=>{
 assert.doesNotThrow(()=>new Function(TRIAL_SITE_CLIENT));
 assert.doesNotThrow(()=>new Function(DEMO_CLIENT));
});
test('M041: seek buttons are visible on gallery and ordinary celebration audio blocks',()=>{
 assert.match(TRIAL_SITE_CLIENT,/function audioSeekBar\(audio\)/);
 assert.match(TRIAL_SITE_CLIENT,/box\.append\(audio,audioSeekBar\(audio\)\)/);
 assert.match(TRIAL_SITE_CLIENT,/const controls=audioSeekBar\(audio\)/);
 assert.match(TRIAL_SITE_CLIENT,/Reculer de 10 secondes/);
 assert.match(TRIAL_SITE_CLIENT,/Avancer de 10 secondes/);
 assert.match(CSS_03_TEXT_AND_GALLERY,/\.media-seek-always/);
});
test('M041: published visitor gallery classifies and groups every audio without D1 rewrites',()=>{
 assert.match(TRIAL_SITE_CLIENT,/function audioTypeFor\(item\)/);
 assert.match(TRIAL_SITE_CLIENT,/function audioDateTitle\(item\)/);
 assert.match(TRIAL_SITE_CLIENT,/matching\.sort\(compareAudios\)/);
 assert.match(TRIAL_SITE_CLIENT,/publishedTypes=new Map/);
 assert.match(TRIAL_SITE_CLIENT,/audio-group-heading/);
 assert.match(TRIAL_SITE_CLIENT,/audio-date-heading/);
});
test('M041: admin offers audio types and new-type creation before import',()=>{
 assert.match(DEMO_CLIENT,/Type de MP3 à importer/);
 assert.match(DEMO_CLIENT,/Créer un type/);
 assert.match(DEMO_CLIENT,/action=audio-type-create/);
 assert.match(DEMO_CLIENT,/action=set-audio-type/);
 assert.match(DEMO_CLIENT,/saveAudioTypeForMedia\(stored,selectedAudioType/);
 assert.match(DEMO_CLIENT,/record\.audioType/);
 assert.match(CSS_06_LIBRARY_DIALOGS,/audio-type-upload-selector/);
});
