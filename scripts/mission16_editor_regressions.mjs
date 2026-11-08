// M16: single explicit local regression inventory, instead of duplicating
// the same test command in a new release workflow. No shell, network or writes.
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
export const REGRESSION_FILES=Object.freeze([
 'tests/test_mission15_legacy_cleanup.mjs',
 'tests/test_mission14_editor_security.mjs',
 'tests/test_mission13_styles.mjs',
 'tests/test_mission12_public_renderer.mjs',
 'tests/test_mission11_drag_undo.mjs',
 'tests/test_mission10_safe_persistence.mjs',
 'tests/test_mission09_page_lifecycle.mjs',
 'tests/test_mission08_media_catalogue.mjs',
 'tests/test_mission07_block_model.mjs',
 'tests/test_mission06_editor_modules.mjs',
 'tests/test_mission05_editor_composition.mjs',
 'tests/test-editor-access-gate.mjs',
 'tests/test-editor-publication-media.mjs',
 'tests/test-editor-server-drafts.mjs',
 'tests/test-exit-production-candidate.mjs',
 'tests/test-editor-demo.mjs',
 'tests/test-editor-demo-preparation.mjs',
 'tests/test-editor-michael-preparation-layout.mjs',
 'tests/test-editor-trial-site.mjs',
 'tests/test-editor-trial-audio.mjs',
 'tests/test-editor-d4-access.mjs',
 'tests/test-editor-e2a-access.mjs',
 'tests/test-editor-permanent-access.mjs',
 'tests/test-editor-section-presentation-step3.mjs',
 'tests/test-editor-multiple-button-links.mjs',
 'tests/test-editor-presentation-server-roundtrip-step4.mjs',
 'tests/test-editor-modal-page-video-fixes.mjs',
 'tests/test-editor-undo-video-media.mjs',
 'tests/test-editor-celebration-themes.mjs'
]);
export function assertMatrix(){
 if(new Set(REGRESSION_FILES).size!==REGRESSION_FILES.length)
  throw new Error('Duplicate regression test file');
 if(!REGRESSION_FILES.every(x=>x.startsWith('tests/')&&
  x.endsWith('.mjs')&&existsSync(x)))throw new Error('Regression file missing');
 return REGRESSION_FILES.length;
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 assertMatrix();
 if(process.argv[2]==='--list'){
  console.log(REGRESSION_FILES.join('\n'));
 }else{
  if(process.argv.length>2)throw new Error('Unknown M16 test-matrix option');
  const res=spawnSync(process.execPath,['--test',...REGRESSION_FILES],{
   stdio:'inherit',env:process.env,timeout:150000
  });
  if(res.error)throw res.error;
  process.exitCode=res.status===0?0:1;
 }
}
