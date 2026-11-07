// M06: local validation and text colour rules; no DOM, network or editor state.
export function createEditorLocalRules(){
function validIso(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;
 const [y,m,d]=value.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d));
 return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;
}

function prettyDate(iso){
 if(!validIso(iso))return '';
 const [year,month,day]=iso.split('-');
 return new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(Number(year),Number(month)-1,Number(day))));
}

function validTime(value){return typeof value==='string'&&/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)}

function validHref(raw){const s=String(raw||'').trim();if(!s||s.includes('\\'))return false;if(s.startsWith('/')&&!s.startsWith('//'))return true;try{return new URL(s).protocol==='https:'}catch{return false}}

function validColor(c){return typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c)}

function inlineColor(value){
 const v=String(value||'').trim().toLowerCase();
 if(/^#[0-9a-f]{6}$/.test(v))return v;
 const match=v.match(/^rgb\(([^)]+)\)$/);
 if(!match)return '';
 const values=match[1].split(/[\s,]+/).filter(Boolean);
 if(values.length!==3||values.some(n=>!/^\d{1,3}$/.test(n)||Number(n)>255))return '';
 return '#'+values.map(n=>Number(n).toString(16).padStart(2,'0')).join('');
}

return {validIso,prettyDate,validTime,validHref,validColor,inlineColor};
}
