// Mission D2: only safe CSS and layout improvements reused from the site's existing public classes.
// No scripts are used by the preview and all imported text remains HTML-escaped.
export const D2_STYLE = `
.d-bar{position:relative;min-height:32px;padding:5px 12px;gap:10px;background:#fffaf4!important;color:#723e25!important;border-bottom:1px solid #eed3b4}
.d-bar strong{font-size:.76rem}.d-bar small{font-size:.72rem;opacity:.9;color:#723e25}
.d-shell{max-width:1100px;padding:14px 12px 45px}
.d-heading{border:1px solid #dfe3e8;border-top:5px solid var(--accent);border-radius:16px;padding:12px 18px}
.d-heading h1{font-size:clamp(1.18rem,2.2vw,1.75rem);letter-spacing:-.025em;margin:5px 0}
.d-nav{gap:6px;margin:12px 0}
.d-chip{border-radius:999px;padding:8px 12px;font-size:.84rem}
.d-nav .d-nav{width:100%;gap:5px;padding-top:6px;border-top:1px solid var(--line)}
.d-content{gap:12px;margin-top:12px}
.d-event{border-radius:12px;padding:12px;grid-template-columns:64px minmax(0,1fr);gap:10px}
.d-event h3{font-size:1.04rem;margin:0 0 5px}
.d-time{font-size:1rem}
.d-day{padding:14px;border-radius:10px;background:#fff!important}
.d-day h2{font-size:1.06rem;margin-top:0}
.d-card,.d-resource,.d-event,.d-day,.d-static,.d-legal,.d-editorial{padding:14px}
.d-resource{border-radius:12px}
.d-resource h3{font-size:1rem}
.d-gallery{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.d-gallery .d-resource{min-width:0;height:100%}
.d-gallery .d-image{width:100%;margin:0}
.d-gallery .d-image img{width:100%;height:auto;max-height:220px;object-fit:contain}
.d-gallery .d-image figcaption{overflow-wrap:anywhere}
.d-home-banner{max-width:1100px;margin:8px auto;border:1px solid #7db7ff;border-left:5px solid #1677ff;border-radius:10px;background:#eef6ff;padding:8px 11px;font-size:13px;line-height:1.35;color:#174a7c}
.d-home-banner a{color:#0b5fc6}
.d-welcome{background:#fffaf4;border:1px solid #eed3b4;border-radius:18px;padding:clamp(15px,3vw,30px);box-shadow:0 8px 24px #6b3d2214;text-align:center;margin:8px 0 15px}
.d-welcome h1{font-size:clamp(1.5rem,4vw,2.3rem);line-height:1.2;color:#723e25;margin:0 0 12px}
.d-welcome p{color:#624e41;margin:0 0 10px}
.d-welcome img{width:100%;height:auto;max-height:440px;object-fit:contain;display:block;border-radius:14px;margin:16px 0}
.d-welcome-actions{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap}
.d-welcome-actions .d-btn{border:0;border-radius:10px;background:#a64c23;color:white;font-weight:750;padding:13px 20px}
.d-muted-chip{display:inline-flex;padding:10px 14px;border-radius:10px;background:#ececec;color:#777}
.d-home .d-heading{display:none}
.d-home .d-content{margin-top:6px}
.d-celebration-title{display:grid;justify-items:center;gap:6px;padding:12px 16px;text-align:center;border-top:5px solid var(--accent)}
.d-celebration-title h2{font-size:clamp(1.15rem,2.3vw,1.8rem);margin:0}
.d-celebration-title .d-date{color:var(--accent);font-weight:750}
.d-choice-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:14px 0}
.d-choice-grid .d-choice{padding:15px;border:1px solid var(--line);border-top:5px solid var(--accent);border-radius:15px;text-decoration:none;font-weight:750}
.d-choice-grid .d-choice:hover{background:#fffaf4}
.d-top-title{font-weight:700;margin:0}
.d-legal{white-space:normal}
.d-legal-text{line-height:1.65}
.d-static blockquote{border-left:3px solid #dab790;padding-left:12px}
.d-static .d-static-link{display:inline-flex;margin:4px 8px 4px 0}
.d-static img{display:block;max-width:100%;height:auto;max-height:450px;object-fit:contain;margin:10px auto;border-radius:10px}
.d-block[data-kind="static_html_snapshot"] .d-static{border:none}
.d-resource.restricted{background:#f7f8fa;border-style:dashed}
.d-gap-warning{background:#fff9ed;padding:10px 12px;border-left:4px solid #c08b20;font-size:.84rem;margin:8px 0}

.d-welcome-actions .d-chip{background:#a64c23;color:#fff;border:0;border-radius:10px;font-weight:750;padding:13px 20px}
.d-home>.d-shell>.d-nav{display:none}
body.d-celebration .d-heading{display:none}
.d-home .d-welcome{margin-top:0}
.d-heading small{color:#667085}
.d-nav .d-chip:hover{background:#f8f3ed}
.d-nav .d-chip.active{background:var(--accent);color:#fff}


.d-celebration-identity{display:flex;align-items:center;justify-content:center;gap:14px}
.d-celebration-flame{height:45px;width:45px;object-fit:contain}
@media(max-width:500px){.d-celebration-flame{height:30px;width:30px}.d-celebration-identity{gap:7px}}
@media(max-width:850px){
 .d-shell{padding:8px 10px 35px}
 .d-heading{padding:8px 10px}
 .d-nav{gap:5px;margin:8px 0}
 .d-chip{padding:7px 9px;font-size:.73rem}
 .d-celebration-title{padding:8px}
 .d-gallery{grid-template-columns:repeat(2,minmax(0,1fr))}
 .d-choice-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
 .d-event{grid-template-columns:48px minmax(0,1fr);gap:8px;padding:9px}
 .d-content{gap:8px}
 .d-welcome-actions .d-btn,.d-welcome-actions .d-chip{width:100%;justify-content:center}
}
@media(max-width:450px){
 .d-gallery{grid-template-columns:1fr}
 .d-bar{display:block;text-align:center;padding:5px 7px}
 .d-bar small{display:block}
 .d-shell{padding:8px}
 .d-chip{font-size:.7rem}
 .d-welcome{padding:15px}
 .d-choice-grid{gap:8px}
 .d-event{padding:9px}
 .d-resource{padding:10px}
}
`;
