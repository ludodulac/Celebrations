// M07: serializable editor blocks and sections. Never migrate data on read.
export function createBlockModel(){
 const styleDefaults=()=>({border:'none',color:'#d7dde5',shadow:false,width:1});
 function createContent(kind,id,starterText={}){
  const names={heading:'Nouveau titre',text:'Votre paragraphe',button:'Mon bouton',
   download:'Télécharger le document',event:'Titre de l’événement',
   video:'',image:'',audio:'MP3 à choisir'};
  if(kind==='divider')return {id,kind:'divider',color:'#858c94',thickness:1,widthPct:60};
  // 'download' is an editor insertion preset, not a new persisted block kind.
  // Existing button styles and layout logic therefore remain compatible.
  const actualKind=kind==='download'?'button':kind;
  const created={id,kind:actualKind,align:'left',text:starterText[kind]?'':(names[kind]||''),href:'',src:''};
  if(actualKind==='button')created.displayAsButton=true;
  if(kind==='download')created.download=true;
  return created;
 }
 function createSection(id,layout,columns,extra={}){
  // Keep the original child objects without copying or changing rich/media fields.
  return {id,kind:'section',layout,columns,...extra,style:styleDefaults()};
 }
 function createResourcePreset(kind,id,create){
  let columns,layout,presentation;
  if(kind==='video'){
   presentation='video';layout='single';columns=[[create('heading'),create('video')],[]];
  }else if(kind==='documents'){
   presentation='documents';layout='single';columns=[[create('heading'),create('download')],[]];
  }else{
   presentation='resource';layout='columns';
   columns=[[create('image')],[create('heading'),create('text'),create('download')]];
  }
  const section=createSection(id,layout,columns,{
   presentation,columnAlignments:kind==='resource'?['center','center']:['top','top']});
  return {section,selectedIndex:layout==='columns'?1:0};
 }
 function duplicateData(existing,id,clone){
  const copied=clone(existing);copied.id=id;return copied;
 }
 function sectionStyle(section,validColor){
  const st=section.style&&typeof section.style==='object'?section.style:{};
  return {border:['none','round','square'].includes(st.border)?st.border:'none',
   color:validColor(st.color)?st.color:'#d7dde5',
   width:[1,2,3,4,5].includes(Number(st.width))?Number(st.width):1,shadow:!!st.shadow};
 }
 function patchSectionStyle(section,patch,validColor){
  const existing=section.style&&typeof section.style==='object'&&!Array.isArray(section.style)
   ?section.style:{};
  return {...existing,...sectionStyle(section,validColor),...patch};
 }
 function columnVerticalAlign(section,index){
  const value=section.columnAlignments?.[index];
  return ['top','center','bottom'].includes(value)?value:
   section.presentation==='resource'?'center':'top';
 }
 function columnButtonLayout(section,index){
  return section.columnButtonLayouts?.[index]==='row'?'row':'stack';
 }
 function nextLayout(layout){return layout==='columns'?'single':'columns'}
 return {createContent,createSection,createResourcePreset,duplicateData,sectionStyle,
  patchSectionStyle,columnVerticalAlign,columnButtonLayout,nextLayout};
}
