// Canonical allowlist for new public-editor uploads. No executable web formats.
const formats=new Map([
 ['image/jpeg',{extension:'.jpg',type:'image',max:8_000_000}],
 ['image/png',{extension:'.png',type:'image',max:8_000_000}],
 ['image/webp',{extension:'.webp',type:'image',max:8_000_000}],
 ['application/pdf',{extension:'.pdf',type:'pdf',max:25_000_000}],
 ['audio/mpeg',{extension:'.mp3',type:'audio',max:25_000_000}],
 ['audio/wav',{extension:'.wav',type:'audio',max:25_000_000}],
 ['text/plain',{extension:'.txt',type:'file',max:5_000_000,attachment:true}],
 ['application/vnd.openxmlformats-officedocument.wordprocessingml.document',{extension:'.docx',type:'file',max:25_000_000,attachment:true}]
]);
export const editorUploadFormat=mime=>formats.get(String(mime||'').toLowerCase())||null;
export const editorUploadFilename=name=>typeof name==='string'&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/.test(name)&&
 [...formats.values()].some(format=>name.endsWith(format.extension));
export const editorUploadPath=path=>typeof path==='string'&&path.startsWith('/media/new/')&&editorUploadFilename(path.slice('/media/new/'.length));
export function editorUploadResponseFormat(filename){
 for(const [mime,format] of formats)if(filename.endsWith(format.extension))return {...format,mime};
 return null;
}
