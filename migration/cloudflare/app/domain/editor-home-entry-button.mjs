// M035 — Safe, optional, presentation-only button over the published
// general homepage image. This never grants access or changes page routing.
export const DEFAULT_HOME_ENTRY_BUTTON=Object.freeze({
 enabled:true,label:'Bienvenue',background:'#28483D',color:'#FFFFFF',
 borderColor:'#F3E5C9',borderWidth:2,radius:16,width:0,height:0,positionY:0,
 desktopImage:'/assets/home/automne-ordinateur.webp',
 mobileImage:'/assets/home/automne-telephone.webp'
});
const hex=value=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value);
export function validHomeImageUrl(value){
 if(typeof value!=='string'||value.length>1500||/[\\\u0000-\u001f\u007f]/.test(value))return false;
 if(!value)return true; // empty field means use the existing homepage image
 if(value.startsWith('/'))return !value.startsWith('//')&&
  (/^\/media\/(?!.*\.\.)[^?#]+\.(?:png|jpe?g|webp|gif)(?:\?[^#]*)?$/i.test(value)||
   /^\/assets\/home\/[-a-z0-9]+\.webp$/i.test(value));
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password}
 catch{return false}
}
export function validHomeEntryButton(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const allowed=['enabled','label','background','color','borderColor','borderWidth','radius','width','height','positionY','desktopImage','mobileImage'];
 if(Object.keys(value).some(key=>!allowed.includes(key)))return false;
 return typeof value.enabled==='boolean'&&typeof value.label==='string'&&
  value.label.trim().length>=1&&value.label.trim().length<=64&&
  !/[\u0000-\u001f\u007f<>]/.test(value.label)&&
  ['background','color','borderColor'].every(key=>hex(value[key]))&&
  Number.isInteger(value.borderWidth)&&value.borderWidth>=0&&value.borderWidth<=5&&
  [0,8,16,28].includes(value.radius)&&
  (value.width===undefined||value.width===0||Number.isInteger(value.width)&&value.width>=160&&value.width<=500)&&
  (value.height===undefined||value.height===0||Number.isInteger(value.height)&&value.height>=44&&value.height<=140)&&
  (value.positionY===undefined||value.positionY===0||Number.isInteger(value.positionY)&&value.positionY>=10&&value.positionY<=90)&&
  (value.desktopImage===undefined||validHomeImageUrl(value.desktopImage))&&
  (value.mobileImage===undefined||validHomeImageUrl(value.mobileImage));
}
export function normalizeHomeEntryButton(value){
 return validHomeEntryButton(value)?{
  enabled:value.enabled,label:value.label.trim(),
  background:value.background.toUpperCase(),color:value.color.toUpperCase(),
  borderColor:value.borderColor.toUpperCase(),borderWidth:value.borderWidth,
  radius:value.radius,width:value.width??0,height:value.height??0,positionY:value.positionY??0,
  desktopImage:value.desktopImage??DEFAULT_HOME_ENTRY_BUTTON.desktopImage,
  mobileImage:value.mobileImage??DEFAULT_HOME_ENTRY_BUTTON.mobileImage
 }:({...DEFAULT_HOME_ENTRY_BUTTON});
}
