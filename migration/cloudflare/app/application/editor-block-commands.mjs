// M07: local list commands. Explicit arguments, no network or publication.
export function createEditorBlockCommands({model}){
 function duplicateInContainer(existing,items,id,clone){
  const index=items.indexOf(existing);if(index<0)return null;
  const copy=model.duplicateData(existing,id,clone);
  items.splice(index+1,0,copy);return copy;
 }
 function wrapRootBlock(page,original,added,id){
  const index=page.blocks.indexOf(original);if(index<0)return null;
  const section=model.createSection(id,'single',[[original,added],[]]);
  page.blocks.splice(index,1,section);return section;
 }
 return {duplicateInContainer,wrapRootBlock};
}
