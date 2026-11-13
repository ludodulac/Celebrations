// M035 — Safe, optional, presentation-only button over the published
// general homepage image. This never grants access or changes page routing.
export const DEFAULT_HOME_ENTRY_BUTTON=Object.freeze({
 enabled:true,label:'Bienvenue',background:'#28483D',color:'#FFFFFF',
 borderColor:'#F3E5C9',borderWidth:2,radius:16
});
const hex=value=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value);
export function validHomeEntryButton(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const allowed=['enabled','label','background','color','borderColor','borderWidth','radius'];
 if(Object.keys(value).some(key=>!allowed.includes(key)))return false;
 return typeof value.enabled==='boolean'&&typeof value.label==='string'&&
  value.label.trim().length>=1&&value.label.trim().length<=64&&
  !/[\u0000-\u001f\u007f<>]/.test(value.label)&&
  ['background','color','borderColor'].every(key=>hex(value[key]))&&
  Number.isInteger(value.borderWidth)&&value.borderWidth>=0&&value.borderWidth<=5&&
  [0,8,16,28].includes(value.radius);
}
export function normalizeHomeEntryButton(value){
 return validHomeEntryButton(value)?{
  enabled:value.enabled,label:value.label.trim(),
  background:value.background.toUpperCase(),color:value.color.toUpperCase(),
  borderColor:value.borderColor.toUpperCase(),borderWidth:value.borderWidth,
  radius:value.radius
 }:({...DEFAULT_HOME_ENTRY_BUTTON});
}
