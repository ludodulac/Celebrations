/* Célébrations staging-only WAV → MP3 converter.
   Uses the local vendored lamejs 1.2.1 encoder; never uploads WAV or contacts an external server.
   Runs off-main-thread, streaming PCM reads to limit memory use for long recordings.
   The source WAV remains untouched. */
'use strict';
importScripts('/migration/cloudflare/lame.all.min.js');
const PCM=1, FLOAT=3, EXTENSIBLE=65534;
const WAV_MAX=1024*1024*1024; // 1 GiB input; uses chunked reads, not whole-file decoding.
const CHUNK_FRAMES=16384;
const decoder=new TextDecoder('ascii');
function str(view,start,n){return decoder.decode(new Uint8Array(view.buffer,view.byteOffset+start,n))}
function fail(msg){throw new Error(msg)}
async function chunk(file,at,length){
 if(at<0||length<0||at+length>file.size)fail('WAV tronqué ou invalide.');
 return new DataView(await file.slice(at,at+length).arrayBuffer());
}
async function wavInfo(file){
 if(file.size<44||file.size>WAV_MAX)fail('WAV requis, entre 44 octets et 1 Gio.');
 const header=await chunk(file,0,12);
 if(str(header,0,4)!=='RIFF'||str(header,8,4)!=='WAVE')fail('Le fichier n’est pas un WAV RIFF standard.');
 let pos=12,fmt=null,data=null;
 while(pos+8<=file.size){
  const h=await chunk(file,pos,8),type=str(h,0,4),size=h.getUint32(4,true),start=pos+8;
  if(start+size>file.size)fail('WAV tronqué.');
  if(type==='fmt '){
   if(size<16||size>256)fail('En-tête WAV non pris en charge.');
   const f=await chunk(file,start,size);
   let encoding=f.getUint16(0,true);
   const channels=f.getUint16(2,true),rate=f.getUint32(4,true),align=f.getUint16(12,true),bits=f.getUint16(14,true);
   if(encoding===EXTENSIBLE&&size>=40)encoding=f.getUint16(24,true);
   fmt={encoding,channels,rate,align,bits};
  }
  if(type==='data'&&size>0&&!data)data={start,size};
  pos=start+size+(size%2);
  if(fmt&&data)break;
 }
 if(!fmt||!data)fail('Le WAV ne contient pas de piste audio utilisable.');
 const {encoding,channels,rate,align,bits}=fmt;
 if(![PCM,FLOAT].includes(encoding)||channels<1||channels>8||rate<8000||rate>192000||
     (encoding===FLOAT&&bits!==32)||(encoding===PCM&&![8,16,24,32].includes(bits))||
     align!==channels*bits/8)fail('WAV non pris en charge : utiliser PCM 8/16/24/32 bits ou float 32 bits.');
 return {...fmt,...data,frames:Math.floor(data.size/align)};
}
function sample(view,offset,bits,encoding){
 if(encoding===FLOAT)return Math.max(-1,Math.min(1,view.getFloat32(offset,true)||0));
 if(bits===8)return (view.getUint8(offset)-128)/128;
 if(bits===16)return view.getInt16(offset,true)/32768;
 if(bits===32)return view.getInt32(offset,true)/2147483648;
 const n=view.getUint8(offset)|(view.getUint8(offset+1)<<8)|(view.getUint8(offset+2)<<16);
 return ((n&0x800000)?(n|0xff000000):n)/8388608;
}
async function convert(file,kbps){
 if(!self.lamejs?.Mp3Encoder)fail('Encodeur MP3 absent du site de test.');
 const info=await wavInfo(file);
 const rate=info.rate===44100?44100:info.rate===48000?48000:info.rate<44100?44100:48000;
 const count=Math.ceil(info.frames*rate/info.rate);
 if(!Number.isSafeInteger(count)||count<=0)fail('WAV sans échantillons.');
 const encoder=new self.lamejs.Mp3Encoder(1,rate,kbps);
 const audioParts=[];
 let cache=null,cacheStart=-1,cacheEnd=0;
 async function load(frame){
  if(frame>=cacheStart&&frame<cacheEnd)return;
  cacheStart=Math.max(0,Math.min(info.frames-1,Math.floor(frame/CHUNK_FRAMES)*CHUNK_FRAMES));
  cacheEnd=Math.min(info.frames,cacheStart+CHUNK_FRAMES+8192);
  const offset=info.start+cacheStart*info.align;
  cache=new DataView(await file.slice(offset,offset+(cacheEnd-cacheStart)*info.align).arrayBuffer());
 }
 function mono(frame){
  const i=Math.max(0,Math.min(info.frames-1,frame));
  if(i<cacheStart||i>=cacheEnd)fail('Erreur de lecture du WAV : fragment manquant.');
  let result=0;
  const off=(i-cacheStart)*info.align;
  for(let channel=0;channel<info.channels;channel++)
   result+=sample(cache,off+channel*(info.bits/8),info.bits,info.encoding);
  return result/info.channels;
 }
 const target=new Int16Array(1152);
 let lastPercent=-1;
 for(let start=0;start<count;start+=1152){
  const length=Math.min(1152,count-start);
  await load(Math.floor(start*info.rate/rate));
  for(let j=0;j<length;j++){
   const at=(start+j)*info.rate/rate,idx=Math.floor(at),frac=at-idx;
   // Fast path for common 44.1/48 kHz PCM: no interpolation or extra chunk reads.
   const left=mono(idx);
   const result=frac>0?left*(1-frac)+mono(Math.min(info.frames-1,idx+1))*frac:left;
   target[j]=Math.max(-32768,Math.min(32767,Math.round(result*32767)));
  }
  const encoded=encoder.encodeBuffer(length===1152?target:target.subarray(0,length));
  if(encoded?.length)audioParts.push(new Uint8Array(encoded));
  const percent=Math.min(99,Math.floor((start+length)*100/count));
  if(percent!==lastPercent&&(percent%2===0||percent===99)){postMessage({type:'progress',percent});lastPercent=percent}
 }
 const tail=encoder.flush();
 if(tail?.length)audioParts.push(new Uint8Array(tail));
 const blob=new Blob(audioParts,{type:'audio/mpeg'});
 if(blob.size<128)fail('Le fichier MP3 généré est incomplet.');
 postMessage({type:'done',blob,rate,kbps,seconds:info.frames/info.rate,bytes:blob.size});
}
self.onmessage=async e=>{
 if(e.data?.action!=='convert')return;
 try{
  const {file,kbps}=e.data;
  if(!(file instanceof Blob)||![96,128,160,192].includes(kbps))fail('Paramètres invalides.');
  await convert(file,kbps);
 }catch(error){postMessage({type:'error',message:error?.message||'Conversion impossible.'})}
};