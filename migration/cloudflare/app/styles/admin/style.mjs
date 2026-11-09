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
export const ADMIN_STYLE = [CSS_01_FOUNDATIONS,CSS_02_BLOCK_CONTROLS,CSS_03_THEMES_PAGES_MEDIA,CSS_04_SECTION_COMPOSER,CSS_05_GUIDE_PUBLICATION,CSS_06_LIBRARY_DIALOGS,CSS_07_DRAG_RESOURCES,CSS_08_COLUMN_OVERRIDES].join('');
