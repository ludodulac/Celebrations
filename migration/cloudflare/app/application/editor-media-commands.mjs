// M08: explicit in-memory media assignment only. Never publish, save or
// upload as a side-effect of selecting a catalogue item.
export function createEditorMediaCommands(){
 function chooseFile(block,file,choosingVideo){
  if(choosingVideo&&file.category!=='videos')return false;
  block.href=file.src;delete block.assetId;
  if(choosingVideo){
   // Never change the kind of a video block or discard its existing title.
   if(!String(block.text||'').trim())
    block.text=file.name.replace(/\.(?:mp4|webm|ogv|ogg)(?:[?#].*)?$/i,'');
  }else{
   block.displayAsButton=true;delete block.cover;delete block.coverAssetId;
   if(!String(block.text||'').trim()||['Mon bouton','Découvrir le programme'].includes(block.text))
    block.text='Ouvrir : '+file.name;
  }
  return true;
 }
 function chooseImage(block,source,cover=false){
  if(cover){block.cover=source.src||'';block.coverAssetId=source.assetId||''}
  else{block.src=source.src||'';block.assetId=source.assetId||''}
  return block;
 }
 return {chooseFile,chooseImage};
}
