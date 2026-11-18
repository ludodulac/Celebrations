// M13 — Explicit layering; the array order IS the historical cascade.
// Do not reorder or merge overrides without a new pixel-level approval.
import {CSS_01_FOUNDATIONS} from './01-foundations.mjs';
import {CSS_02_BLOCK_CONTROLS} from './02-block-controls.mjs';
import {CSS_03_THEMES_PAGES_MEDIA} from './03-themes-pages-media.mjs';
import {CSS_04_SECTION_COMPOSER} from './04-section-composer.mjs';
import {CSS_05_GUIDE_PUBLICATION} from './05-guide-publication.mjs';
import {CSS_06_LIBRARY_DIALOGS} from './06-library-dialogs.mjs';
import {CSS_07_DRAG_RESOURCES} from './07-drag-resources.mjs';
import {CSS_08_COLUMN_OVERRIDES} from './08-column-overrides.mjs';
// M049 — Home-image preview mirrors the published full-viewport cover crop.
const HOME_VIEWPORT_PREVIEW_CSS = `
.m049-home-viewport{position:relative;display:block;overflow:hidden;width:100%;max-width:100%;background:#eef0ef;border:1px solid #ccd4d0;border-radius:8px;box-sizing:border-box}
.m049-home-viewport.is-desktop{aspect-ratio:1440 / 824}
.m049-home-viewport.is-mobile{aspect-ratio:390 / 782;max-width:390px;margin-inline:auto}
.m049-home-viewport .m048-image-preview{display:block!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;aspect-ratio:auto!important;object-fit:cover!important;object-position:center top!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important}
.m048-home-images{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
.m048-home-images .m048-image-field{min-width:0}
@media(max-width:700px){.m048-home-images{grid-template-columns:minmax(0,1fr)}}
`;
export const ADMIN_STYLE = [CSS_01_FOUNDATIONS,CSS_02_BLOCK_CONTROLS,CSS_03_THEMES_PAGES_MEDIA,CSS_04_SECTION_COMPOSER,CSS_05_GUIDE_PUBLICATION,CSS_06_LIBRARY_DIALOGS,CSS_07_DRAG_RESOURCES,CSS_08_COLUMN_OVERRIDES].join('') + HOME_VIEWPORT_PREVIEW_CSS;
