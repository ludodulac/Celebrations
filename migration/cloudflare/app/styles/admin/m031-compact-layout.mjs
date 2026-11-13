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
`;
