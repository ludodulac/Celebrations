// M029: isolated, public presentation preference for a desktop menu label.
// This does not govern private media, members, publication, or page titles.
export function navigationPreference(value){
 const raw=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 return {
  title:typeof raw.title==='string'?raw.title.trim().slice(0,110):'',
  position:['left','center','right'].includes(raw.position)?raw.position:'center'
 };
}
export function validNavigationPreference(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const normalized=navigationPreference(value);
 return typeof value.title==='string'&&value.title===normalized.title&&
  value.position===normalized.position;
}
