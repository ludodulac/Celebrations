// Five coordinated shades per colourway; every archangel has five choices.
// No change to typography: foreground text always stays charcoal or dark grey.
const PALETTES={
 michael:[
  {name:'Rouge franc',shades:['#fff5f4','#ffe0df','#f59891','#ea342f','#c71d1a']},
  {name:'Rouge vif',shades:['#fff7f5','#ffd8d5','#ffaba4','#ed3734','#d21d1d']},
  {name:'Rouge coquelicot',shades:['#fff7f2','#ffdfd5','#ffad94','#f34d32','#ce2b21']},
  {name:'Rouge éclatant',shades:['#fff3f2','#ffdbd8','#fa9995','#e82d36','#c71d29']},
  {name:'Rouge vermillon',shades:['#fff7f0','#ffe0d1','#ffae95','#f04930','#cb2d20']}
 ],
 raphael:[
  {name:'Vert clair',shades:['#f3fff5','#d9f5df','#8fdaa7','#32ba63','#138644']},
  {name:'Vert émeraude',shades:['#f1fff7','#d4f6e3','#91e4b6','#21b36a','#078c50']},
  {name:'Vert prairie',shades:['#f6fff4','#def5d9','#a9dea0','#57b94b','#2e943b']},
  {name:'Vert feuille',shades:['#f6fff5','#dcf3dd','#9fd6a3','#38aa55','#208443']},
  {name:'Vert jade',shades:['#f1fff8','#d7f7e8','#98e1bf','#35b887','#0d8862']}
 ],
 gabriel:[
  {name:'Indigo lumineux',shades:['#f6f5ff','#e4e1ff','#b6aff9','#665ce4','#4134b9']},
  {name:'Indigo profond',shades:['#f5f4ff','#e2dcff','#aca3ee','#5b4fd4','#382db1']},
  {name:'Indigo violet',shades:['#f8f5ff','#ebe0ff','#c1a8fa','#7756e5','#5532bd']},
  {name:'Indigo azur',shades:['#f5f6ff','#e0e6ff','#a7b5fb','#5a6de0','#3948b9']},
  {name:'Indigo royal',shades:['#f6f5ff','#e2dfff','#aba5ee','#6256d5','#4037ae']}
 ],
 auriel:[
  {name:'Jaune soleil',shades:['#fffef1','#fff6c3','#ffdf6f','#efbb1f','#c49209']},
  {name:'Jaune citron',shades:['#fffff2','#fffbc4','#f1eb83','#e0ce2a','#af9e1b']},
  {name:'Jaune doré',shades:['#fffcef','#fff2bb','#f9da70','#e8b52d','#b98c12']},
  {name:'Jaune lumineux',shades:['#fffef4','#fff4d1','#f8db91','#eebc43','#bb8b24']},
  {name:'Jaune orangé',shades:['#fffaf0','#ffedd0','#ffce81','#f2a82c','#c58613']}
 ]
};
const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function colourFamily(archangel){
 const name=fold(archangel);
 if(name.includes('mich'))return 'michael';
 if(name.includes('rapha'))return 'raphael';
 if(name.includes('gabri'))return 'gabriel';
 if(name.includes('auriel')||name.includes('ouriel')||name.includes('uriel'))return 'auriel';
 return 'michael';
}
export function fiveColourways(archangel){
 return PALETTES[colourFamily(archangel)].map(p=>({name:p.name,shades:[...p.shades]}));
}
