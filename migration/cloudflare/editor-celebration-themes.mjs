// Five coordinated shades per colourway; every archangel has five choices.
// No change to typography: foreground text always stays charcoal or dark grey.
const PALETTES={
 michael:[
  {name:'Rubis délicat',shades:['#fff8f7','#f9e1de','#e3aaa4','#be5557','#8c3036']},
  {name:'Carmin classique',shades:['#fdf4f4','#f1d5d7','#d69ba0','#ae414a','#81232e']},
  {name:'Grenat profond',shades:['#fcf6f7','#e8d9dc','#c598a3','#984252','#6c2637']},
  {name:'Rose ancien',shades:['#fff8f8','#f4e5e7','#ddb5bd','#c16b7a','#90434f']},
  {name:'Rouge velours',shades:['#fdf6f4','#f3deda','#dca6a1','#ad514e','#783633']}
 ],
 raphael:[
  {name:'Sauge tendre',shades:['#f7faf6','#e3eee2','#aecbb1','#639c73','#376c4c']},
  {name:'Émeraude',shades:['#f5fbf8','#d8efe2','#98ceb1','#3d9874','#1d6650']},
  {name:'Olive douce',shades:['#fafbf5','#ecefdb','#c8d09d','#8b9c4d','#596733']},
  {name:'Forêt',shades:['#f5f9f6','#dce9df','#aac4b0','#5a866c','#315a45']},
  {name:'Menthe',shades:['#f4fcf9','#daf4e9','#a0dcca','#52ac97','#2d7569']}
 ],
 gabriel:[
  {name:'Bleu ciel',shades:['#f5faff','#e0effc','#accfe9','#6b9ec7','#3b6e97']},
  {name:'Azur',shades:['#f5faff','#d8ecff','#99c7e9','#428fca','#26608f']},
  {name:'Bleu ardoise',shades:['#f5f8fa','#dfe8ef','#b3c8d9','#6c94b4','#446682']},
  {name:'Bleu nuit doux',shades:['#f7f9fc','#dce5f2','#a6bedd','#6689bd','#395d94']},
  {name:'Bleu lagon',shades:['#f4fbfc','#dbf0f3','#a0d0db','#4c9bab','#337787']}
 ],
 auriel:[
  {name:'Or lumineux',shades:['#fffbef','#fbf0cd','#efd38c','#dca742','#a67b2d']},
  {name:'Abricot',shades:['#fffaf4','#fce7d0','#f3c294','#e69b5b','#b66c35']},
  {name:'Ambre',shades:['#fff9ec','#f8e6bd','#ebc379','#d69a3c','#9b6b25']},
  {name:'Miel doux',shades:['#fffcf2','#f7edcf','#e9d29b','#cba253','#98763c']},
  {name:'Safran',shades:['#fff9ef','#fbe8bd','#f1c774','#e5a544','#a87128']}
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
