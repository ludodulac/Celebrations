// M11: in-memory dragging between the page root and both columns.
// The exact same block object is moved: its id, rich text, media and unknown
// attributes cannot be rewritten during drag. No DOM, storage, network or save.
export function createEditorDragModel({createSection}){
 function locate(p,blockId){
  const requested=String(blockId);
  for(let i=0;i<(p.blocks||[]).length;i++){
   const item=p.blocks[i];
   if(item?.kind!=='section'&&String(item?.id)===requested)
    return {array:p.blocks,index:i,block:item,sectionId:'',columnIndex:0};
   if(item?.kind==='section'){
    for(let col=0;col<2;col++){
     const array=item.columns?.[col];if(!Array.isArray(array))continue;
     const index=array.findIndex(child=>child?.kind!=='section'&&String(child?.id)===requested);
     if(index>=0)return {array,index,block:array[index],sectionId:String(item.id),columnIndex:col};
    }
   }
  }
  return null;
 }
 function move(p,blockId,sectionId='',columnIndex=0,anchorId=null,after=false){
  const source=locate(p,blockId);if(!source)return false;
  let destination=p.blocks;
  if(sectionId){
   const section=p.blocks.find(b=>b?.kind==='section'&&String(b.id)===String(sectionId));
   if(!section||!Array.isArray(section.columns?.[columnIndex]))return false;
   destination=section.columns[columnIndex];
  }
  let index=destination.length;
  if(anchorId!==null&&anchorId!==undefined){
   const i=destination.findIndex(b=>String(b?.id)===String(anchorId));
   if(i<0)return false;
   index=i+(after?1:0);
  }
  if(source.array===destination){
   if(source.index<index)index--;
   if(source.index===index)return false; // no-op: do not push an Undo entry
  }
  source.array.splice(source.index,1);
  destination.splice(index,0,source.block);
  return true;
 }
 function intoBlock(p,sourceId,targetId,after=true,createId){
  const original=locate(p,sourceId),destination=locate(p,targetId);
  if(!original||!destination||original.block===destination.block||destination.sectionId)return false;
  const moved=original.block;
  original.array.splice(original.index,1);
  const index=p.blocks.indexOf(destination.block);
  if(index<0){original.array.splice(original.index,0,moved);return false}
  const section=createSection(createId(),'single',
   [after?[destination.block,moved]:[moved,destination.block],[]]);
  p.blocks.splice(index,1,section);
  return true;
 }
 function canDirectDrag(selectedId,blockId){
  // A casual mouse-down on an unselected image/title is just selection.
  // The explicit ⠿ handle remains an intentional drag affordance.
  return selectedId!==null&&selectedId!==undefined&&String(selectedId)===String(blockId);
 }
 function pointerIntent(state,event){
  const distance=Math.hypot(event.clientX-state.startX,event.clientY-state.startY);
  if(state.isTouch)return distance>12?'cancel':'wait';
  return distance<6?'wait':'activate';
 }
 function pointerAllowed(event,preview){
  return !preview&&(event.pointerType!=='mouse'||event.button===0);
 }
 return {locate,move,intoBlock,canDirectDrag,pointerIntent,pointerAllowed};
}
