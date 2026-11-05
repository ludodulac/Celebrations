// A non-destructive, one-page-only visual re-layout of Michaël 2026 Préparation.
// The original image, audio, video, PDF and formatted-text blocks keep their
// full objects and IDs. Repeated titles are hidden from visitors, never deleted.
// Run with current R2 snapshot only after validation and a verified backup.
const sectionId=name=>'michael-preparation-layout-'+name+'-2026';
const copy=x=>JSON.parse(JSON.stringify(x));
const visibleLeafs=blocks=>(blocks||[]).flatMap(b=>b.kind==='section'?
 (b.columns||[]).flatMap(visibleLeafs):[b]);
const count=x=>x.reduce((a,b)=>(a[b.kind]=(a[b.kind]||0)+1,a),{});
function assert(condition,message){if(!condition)throw Error('MICHAEL_LAYOUT_BLOCKED: '+message)}
function matched(root,index,kind,id){
 const item=root[index];
 assert(item&&item.kind===kind,'Expected '+kind+' at index '+index);
 if(id!==undefined)assert(String(item.id)===String(id),
  'Changed page at '+index+' (wanted '+id+' got '+item.id+')');
 return item;
}
const group=(name,presentation,left,right,layout='columns')=>({
 id:sectionId(name),kind:'section',presentation,layout,
 columns:[left,right],style:{border:'none',color:'#d7dde5',shadow:false,width:1}
});
function kids(section,expect){
 assert(section.kind==='section','Expected an existing section');
 const list=(section.columns||[]).flat();
 assert(list.length===expect,'Section '+section.id+' changed children count');
 return list;
}
function leaf(id,arr,kind){
 const item=arr.find(x=>String(x.id)===String(id));
 assert(item&&item.kind===kind,'Missing '+kind+' '+id);
 return item;
}
function hideDuplicate(item){
 item.hideOnSite=true;
 return item;
}
export function prepareMichaelLayout(page){
 assert(page?.id==='preparation-101','Not the specified Michael preparation page');
 // Exact current public-page structure was inspected from the R2 snapshot
 // on 2026-11-05, after the owner's last changes. Fail closed on new edits.
 const input=copy(page),old=input.blocks;
 assert(old.length===51,'The page structure has changed since the audit');
 const baseline=visibleLeafs(old).map(x=>copy(x));
 for(const [idx,kind,id] of [
  [0,'section'],[1,'section'],[2,'divider'],[3,'section'],[4,'section'],
  [5,'button',17],[6,'section'],[7,'section'],[8,'section'],[9,'section'],
  [10,'divider'],[11,'section'],[12,'divider'],
  ...Array.from({length:38},(_,i)=>[13+i,
   ({34:'heading',35:'text',36:'heading',37:'image',38:'button',
     39:'heading',40:'text',41:'heading',42:'image',43:'button',
     44:'heading',45:'heading',46:'button',47:'heading',48:'heading',
     49:'text',50:'image',51:'audio',52:'heading',53:'text',54:'heading',
     55:'image',56:'button',57:'heading',58:'image',59:'button',
     60:'heading',61:'image',62:'button',63:'heading',64:'image',
     65:'button',66:'heading',67:'text',68:'heading',69:'text',
     70:'image',71:'button'})[i+34],i+34])
 ])matched(old,idx,kind,id);
 const out=[];
 const intro=old[0];assert(kids(intro,4).some(x=>x.text?.includes('Travail de Préparation')),'Missing introduction');
 intro.presentation='intro';out.push(intro);
 const work=old[1],workKids=kids(work,3);
 work.layout='columns';work.presentation='resource';
 work.columns=[[leaf(7,workKids,'image')],
  [leaf(6,workKids,'heading'),leaf(8,workKids,'button')]];
 out.push(work,old[2]);
 const flames=old[3],flameKids=kids(flames,3);
 flames.layout='columns';flames.presentation='resource';
 flames.columns=[[leaf(12,flameKids,'image')],
  [flameKids.find(x=>x.kind==='heading'),leaf(13,flameKids,'audio')]];
 assert(flames.columns[1][0]?.kind==='heading','Missing flame heading');
 out.push(flames);
 const symbol=old[4],symbolKids=kids(symbol,2);
 symbol.layout='columns';symbol.presentation='resource';
 symbol.columns=[[leaf(16,symbolKids,'image')],
  [leaf(15,symbolKids,'heading'),old[5]]];
 out.push(symbol);
 const help=old[6];assert(leaf(18,kids(help,2),'heading'),'Missing help');
 help.presentation='text';out.push(help);
 const faces=old[7];assert(leaf(20,kids(faces,2),'heading'),'Missing faces');
 faces.presentation='text';out.push(faces);
 for(const [index,title,image,link] of [[8,22,23,24],[9,25,26,27]]){
  const sec=old[index],a=kids(sec,3);
  sec.layout='columns';sec.presentation='resource';
  sec.columns=[[leaf(image,a,'image')],[leaf(title,a,'heading'),leaf(link,a,'button')]];
  out.push(sec);
 }
 out.push(old[10]);
 const docs=old[11];assert(kids(docs,6).length===6,'Three historic PDFs missing');
 docs.layout='single';docs.presentation='documents';out.push(docs,old[12]);
 const item=id=>old[id-21]; // original root index 13 corresponds to id=34
 // Keep every node intact; duplicated headings are merely marked hiddenOnSite.
 out.push(group('alliance','resource',[item(37)],
  [item(34),item(35),hideDuplicate(item(36)),item(38)]));
 out.push(group('rites','resource',[item(42)],
  [item(39),item(40),hideDuplicate(item(41)),item(43)]));
 out.push(group('armes','documents',
  [item(44),item(46),hideDuplicate(item(45))],[],'single'));
 out.push(group('menorah','resource',[item(50)],
  [item(47),hideDuplicate(item(48)),item(49),item(51)]));
 out.push(group('psaumes-introduction','text',[item(52),item(53)],[],'single'));
 for(const [key,title,image,pdf] of [
  ['priere-156',54,55,56],['psaume-273',57,58,59],
  ['psaume-13',60,61,62],['psaume-237',63,64,65]
 ]){
  out.push(group(key,'resource',[item(image)],[item(title),item(pdf)]));
 }
 out.push(group('recommandations-introduction','text',
  [item(66),item(67)],[],'single'));
 out.push(group('recommandations-document','resource',[item(70)],
  [item(68),hideDuplicate(item(69)),item(71)]));
 const after=visibleLeafs(out).map(x=>copy(x));
 assert(after.length===baseline.length,'Some original content disappeared');
 const normalized=x=>{const y=copy(x);delete y.hideOnSite;return JSON.stringify(y)};
 const byId=xs=>new Map(xs.map(x=>[String(x.id),normalized(x)]));
 const before=byId(baseline),now=byId(after);
 assert(before.size===baseline.length,'Original block IDs are not unique');
 assert(now.size===after.length,'A block was duplicated');
 for(const [id,serialized] of before)
  assert(now.get(id)===serialized,'Changed the original data of block '+id);
 input.blocks=out;
 return {page:input,report:{
  beforeRoot:old.length,afterRoot:out.length,
  leaves:after.length,originalTypes:count(baseline),
  newPresentations:out.filter(x=>x.kind==='section').map(x=>x.presentation||'classic'),
  hiddenDuplicates:after.filter(x=>x.hideOnSite).map(x=>x.id)
 }};
}
