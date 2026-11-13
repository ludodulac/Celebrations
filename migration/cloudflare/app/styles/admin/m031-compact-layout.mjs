// M031/4 — Admin-only ergonomic override, following Espace Jeunesse.
// The editor, visibility/D1 guard, publication and media behavior are unchanged.
export const M031_COMPACT_LAYOUT_CSS = `
.stage-editor.m031-compact .m031-admin-home-link{color:inherit;text-decoration:none;border-radius:5px}
.stage-editor.m031-compact .m031-admin-home-link:hover{text-decoration:underline;text-underline-offset:3px}
.stage-editor.m031-compact .m031-admin-home-link:focus-visible{outline:3px solid #648caa;outline-offset:3px}
.stage-editor.m031-compact .rail .m031-site-link{
 display:flex;align-items:center;text-decoration:none;min-height:41px;padding:8px 10px;
 border:1px solid var(--tone-soft,#e1e6e9);border-radius:9px;font:600 13px system-ui,sans-serif;color:inherit
}
.stage-editor.m031-compact .rail .m031-site-link:hover{background:var(--tone-soft,#eef2f4)}
.stage-editor.m031-compact .main{max-width:none!important;width:100%;padding:10px clamp(12px,2vw,30px) 28px!important}
.stage-editor.m031-compact .m031-workbar{
 position:sticky;top:0;z-index:90;
 background:rgba(255,255,255,.98);border:1px solid #d8e0e5;border-radius:10px;
 box-shadow:0 4px 15px #26374717;padding:4px 9px;margin-bottom:8px;
 backdrop-filter:blur(10px)
}
.stage-editor.m031-compact .m031-workbar-head{display:flex;align-items:center;gap:7px;min-height:44px}
.stage-editor.m031-compact .m031-workbar-title{font:700 12px system-ui,sans-serif;white-space:nowrap}
.stage-editor.m031-compact .m031-state-dot{width:12px;height:12px;flex:none;border-radius:50%;background:#99a3ae}
.stage-editor.m031-compact .m031-state-dot.state-published{background:#29a568}
.stage-editor.m031-compact .m031-state-dot.state-draft{background:#e7a348}
.stage-editor.m031-compact .m031-state-dot.state-hidden{background:#99a3ae}
.stage-editor.m031-compact .m031-settings-details{position:relative;flex:0 0 37px;z-index:112}
.stage-editor.m031-compact .m031-settings-details>summary{
 width:37px;height:40px;display:grid;place-items:center;cursor:pointer;
 list-style:none;font-size:20px;border:1px solid #d6dfe4;border-radius:8px;background:#f7f9fa
}
.stage-editor.m031-compact .m031-settings-details>summary::-webkit-details-marker{display:none}
.stage-editor.m031-compact .m031-settings-fields{
 position:absolute;left:0;top:calc(100% + 6px);z-index:114;
 width:min(600px,calc(100vw - 350px));max-width:calc(100vw - 24px);
 padding:12px;border:1px solid #d6dfe5;border-radius:10px;background:white;
 box-shadow:0 12px 35px #26374733;max-height:70dvh;overflow:auto;display:grid;gap:12px
}
.stage-editor.m031-compact .m031-settings-fields .editor-language-row,
.stage-editor.m031-compact .m031-settings-fields .celebration-publication-controls{
 display:flex!important;flex-wrap:wrap;align-items:center;gap:9px 13px;
 margin:0!important;padding:5px!important;border:0!important;background:transparent!important;
 box-shadow:none!important;min-width:0
}
.stage-editor.m031-compact .m031-settings-fields .editor-language-choice{min-width:120px}
.stage-editor.m031-compact .m031-settings-fields input,
.stage-editor.m031-compact .m031-settings-fields select{max-width:100%;min-height:39px}
.stage-editor.m031-compact .m031-settings-fields .m022-save{display:none!important}
.stage-editor.m031-compact .m031-workbar .topbar{
 position:static!important;top:auto!important;z-index:auto!important;display:flex!important;
 width:100%!important;min-height:0!important;height:auto!important;align-items:center!important;
 padding:0!important;margin:0!important;border:0!important;box-shadow:none!important;
 background:transparent!important
}
.stage-editor.m031-compact .m031-workbar .topbar>div:first-child{display:none}
.stage-editor.m031-compact .m031-toolbar-slot{flex:1;min-width:0}
.stage-editor.m031-compact .m031-workbar .actions{
 display:flex!important;align-items:center!important;justify-content:flex-end!important;
 gap:6px!important;flex-wrap:nowrap!important;width:100%
}
.stage-editor.m031-compact .m031-workbar .actions>.btn{
 min-height:42px!important;height:42px!important;max-width:250px;
 padding:6px 9px!important;white-space:nowrap;font-size:12px!important
}
.stage-editor.m031-compact .m031-workbar .actions>#undo-btn{
 flex:0 0 42px;max-width:42px!important;width:42px!important;
 padding:0!important;font-size:22px!important
}
.stage-editor.m031-compact .m031-workbar .actions>[hidden],
.stage-editor.m031-compact [hidden]{display:none!important}
.stage-editor.m031-compact .m031-rail-pages{
 margin:0;flex:none;width:100%;background:#fff;border:1px solid #dfe5e8;
 border-radius:12px;box-shadow:0 3px 12px #25364713;overflow:visible
}
.stage-editor.m031-compact .m031-rail-pages .list{
 display:flex!important;flex-direction:column!important;gap:4px!important;
 padding:8px!important;min-width:0!important
}
.stage-editor.m031-compact .m031-rail-pages .general-page-row{
 display:grid;grid-template-columns:minmax(0,1fr) 14px 37px;
 gap:5px;align-items:center;min-width:0
}
.stage-editor.m031-compact .m031-rail-pages .general-page-row>.item{
 display:block;width:100%;min-width:0;text-align:left;
 font-size:13px;line-height:1.25;padding:9px 6px;overflow-wrap:normal;word-break:normal
}
.stage-editor.m031-compact .m031-rail-pages .general-page-row>.page-options{grid-column:3}
.stage-editor.m031-compact .m031-rail-pages .general-page-row>.inline-page-state{
 grid-column:2;margin:0!important;width:12px;height:12px;min-width:12px;padding:0;
 font-size:0!important;align-self:center;justify-self:center;border-radius:50%
}
.stage-editor.m031-compact .m031-rail-pages .page-options>summary{min-width:36px;min-height:38px;display:grid;place-items:center}
.stage-editor.m031-compact .m031-rail-pages .foot{padding:8px}
.stage-editor.m031-compact .m031-page-flyout[popover]:not(:popover-open){display:none!important}
.stage-editor.m031-compact .m031-page-flyout:popover-open{
 position:fixed!important;margin:0!important;padding:12px!important;
 max-width:calc(100vw - 24px);width:300px;max-height:calc(100dvh - 24px);
 overflow:auto!important;z-index:500!important;
 border:1px solid #cbd4da!important;border-radius:13px!important;
 background:#fff!important;box-shadow:0 16px 40px #1829383b!important;
 display:grid!important;gap:8px!important
}
.stage-editor.m031-compact .m031-page-flyout:popover-open>.btn{min-height:40px;text-align:left}
@media(min-width:1051px){
 .stage-editor.m031-compact.shell{grid-template-columns:300px minmax(0,1fr)!important}
 .stage-editor.m031-compact .rail{
  position:sticky;top:0;height:100dvh;min-height:0;overflow-y:auto;overflow-x:hidden;
  padding:13px 12px 12px;gap:9px;scrollbar-width:thin;
  border-right:1px solid #e4e7e9
 }
 .stage-editor.m031-compact .rail .brand{padding:3px 8px 9px}
 .stage-editor.m031-compact .rail nav{gap:3px}
 .stage-editor.m031-compact .rail .navbtn{min-height:39px;padding:8px 10px;font-size:13px}
 .stage-editor.m031-compact.m031-wide-page #workspace .layout,
 .stage-editor.m031-compact.m031-wide-page #workspace .celebration-editor .layout{
  display:block!important;grid-template-columns:minmax(0,1fr)!important;
  width:100%!important;max-width:none!important
 }
 .stage-editor.m031-compact.m031-wide-page #workspace .layout>section,
 .stage-editor.m031-compact.m031-wide-page #workspace .canvas-wrap,
 .stage-editor.m031-compact.m031-wide-page #workspace .canvas{
  min-width:0!important;width:100%!important;max-width:none!important
 }
}
@media(max-width:1050px){
 .stage-editor.m031-compact .m031-rail-pages{margin:0 0 9px}
 .stage-editor.m031-compact .m031-settings-fields{width:min(520px,calc(100vw - 24px))}
}
@media(max-width:700px){
 .stage-editor.m031-compact .m031-workbar{padding:4px 6px;margin-bottom:6px}
 .stage-editor.m031-compact .m031-workbar-head{gap:4px;min-height:42px}
 .stage-editor.m031-compact .m031-workbar-title{
  position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)
 }
 .stage-editor.m031-compact .m031-workbar .actions{gap:4px!important}
 .stage-editor.m031-compact .m031-workbar .actions>.btn{
  min-height:42px!important;height:42px!important;padding:5px 6px!important;
  font-size:clamp(10px,3vw,12px)!important
 }
 .stage-editor.m031-compact .m031-workbar .actions>#undo-btn{flex-basis:39px;max-width:39px!important}
 .stage-editor.m031-compact .m031-settings-details{flex-basis:36px}
 .stage-editor.m031-compact .m031-settings-fields{
  width:min(330px,calc(100vw - 28px));max-width:calc(100vw - 28px);
  grid-template-columns:minmax(0,1fr);max-height:63dvh
 }
}

/* M032 — direct media URL controls on the existing admin cards, no new panel. */
.stage-editor.m031-compact .global-media-card .file-actions{
 display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-top:8px
}
.stage-editor.m031-compact .global-media-card .file-actions .btn{
 min-height:40px;white-space:normal;line-height:1.25;
 text-align:center;text-decoration:none
}
.stage-editor.m031-compact .media-direct-public-status,
.stage-editor.m031-compact .media-direct-private-status{
 display:block;font:600 12px/1.4 system-ui,sans-serif;margin:9px 0 3px;
 padding:8px 9px;border-radius:8px;overflow-wrap:anywhere
}
.stage-editor.m031-compact .media-direct-public-status{
 color:#145737;background:#eaf8ef;border:1px solid #bfe6c9
}
.stage-editor.m031-compact .media-direct-private-status{
 color:#414f5b;background:#f5f7f8;border:1px solid #e1e6ea
}
@media(max-width:600px){
 .stage-editor.m031-compact .global-media-card .file-actions .btn{flex:1 1 140px}
}

/* M033 — Each page has just ONE compact line and ONE action ellipsis.
   Keep published/draft/hidden indicator and touch targets. */
.stage-editor.m031-compact .m031-rail-pages .list{
 gap:2px!important;padding:5px!important
}
.stage-editor.m031-compact .m031-rail-pages .general-page-row{
 display:grid!important;
 grid-template-columns:minmax(0,1fr) 12px 36px!important;
 align-items:center!important;column-gap:4px!important;
 row-gap:0!important;min-width:0!important;
 min-height:39px!important;
 padding:1px 0!important;margin:0!important;
 border:0!important;border-radius:6px
}
.stage-editor.m031-compact .m031-rail-pages .general-page-row>.item{
 margin:0!important;padding:6px 5px!important;
 min-height:37px!important;height:auto!important;
 border-radius:6px;line-height:1.25!important
}
.stage-editor.m031-compact .m031-rail-pages .general-page-row>.page-options{
 grid-column:3!important;grid-row:1!important;
 margin:0!important;padding:0!important;
 min-width:36px!important;max-width:36px!important
}
.stage-editor.m031-compact .m031-rail-pages .general-page-row>.inline-page-state{
 grid-column:2!important;grid-row:1!important
}
.stage-editor.m031-compact .m031-rail-pages .page-options>summary{
 box-sizing:border-box;width:36px!important;height:37px!important;
 min-width:36px!important;min-height:37px!important;
 margin:0!important;padding:0!important;line-height:1
}
.stage-editor.m031-compact .m033-single-page-menu-actions{
 display:grid;gap:6px;padding:0 0 7px;border-bottom:1px solid #e4e9ec
}
.stage-editor.m031-compact .m033-single-page-menu-actions>.btn{
 width:100%;min-height:40px;text-align:left
}
.stage-editor.m031-compact .m033-single-page-menu-actions .publication-actions{
 min-width:0
}

/* M035: the existing settings gear contains a collapsible welcome-button
   style picker, usable on narrow Android screens without covering the editor. */
.stage-editor.m031-compact .m035-entry-settings{
 width:100%;min-width:min(100%,260px);max-width:100%;
 border:1px solid #d8e3df;border-radius:9px;background:#fff
}
.stage-editor.m031-compact .m035-entry-settings>summary{
 display:list-item;cursor:pointer;padding:9px 12px;
 font-weight:700;color:#263d35
}
.stage-editor.m031-compact .m035-entry-fields{
 display:grid;gap:11px;min-width:0;padding:10px 12px 14px;
 border-top:1px solid #e4eae7
}
.stage-editor.m031-compact .m035-entry-fields .hint{margin:0;line-height:1.4}
.stage-editor.m031-compact .m035-entry-check{display:flex;gap:10px;align-items:center}
.stage-editor.m031-compact .m035-entry-check input{
 width:21px;min-width:21px;height:21px
}
.stage-editor.m031-compact .m035-entry-field{
 display:flex;flex-direction:column;gap:5px;min-width:0;
 font-size:13px;font-weight:600
}
.stage-editor.m031-compact .m035-entry-field input[type=text]{
 width:100%;box-sizing:border-box;min-height:42px
}
.stage-editor.m031-compact .m035-entry-colors{
 display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));
 gap:10px;max-width:100%
}
.stage-editor.m031-compact .m035-entry-colors select{
 min-height:42px;width:100%;max-width:100%
}
.stage-editor.m031-compact .m035-entry-field input[type=color]{
 width:100%;max-width:110px;min-height:42px;cursor:pointer
}
.stage-editor.m031-compact .m035-entry-preview-wrap{
 display:flex;justify-content:center;align-items:center;
 padding:15px;min-height:72px;background:#eef2ef;border-radius:8px
}
.stage-editor.m031-compact .m035-entry-preview{
 display:inline-flex;align-items:center;justify-content:center;
 box-sizing:border-box;max-width:100%;min-width:145px;min-height:48px;
 padding:10px 20px;border-style:solid;
 font:bold 17px/1.25 system-ui,sans-serif;text-align:center;
 overflow-wrap:anywhere;box-shadow:0 3px 12px #1e392f26
}
.stage-editor.m031-compact .m035-entry-apply{min-height:44px;white-space:normal}
@media(max-width:600px){
 .stage-editor.m031-compact .m035-entry-fields{padding:9px 10px}
 .stage-editor.m031-compact .m035-entry-colors{grid-template-columns:1fr 1fr}
}

/* M036 — The original star is the only shortcut to the public site. */
.stage-editor .rail .brand .m036-public-star{
 display:grid;place-items:center;flex:0 0 auto;
 color:inherit;text-decoration:none;cursor:pointer
}
.stage-editor .rail .brand .m036-public-star:hover{
 filter:brightness(1.12);box-shadow:0 2px 10px #13282035
}
.stage-editor .rail .brand .m036-public-star:focus-visible{
 outline:3px solid #7ca796;outline-offset:3px
}
/* Image size controls remain in the existing block editor, on touch too. */
.stage-editor .m036-full-bleed-field{
 display:flex;align-items:center;gap:10px;margin:9px 0;
 font-weight:600;font-size:13px;line-height:1.35;
 min-height:42px;cursor:pointer
}
.stage-editor .m036-full-bleed-field input[type=checkbox]{
 flex:0 0 21px;width:21px;min-width:21px;height:21px;cursor:pointer
}
`;
