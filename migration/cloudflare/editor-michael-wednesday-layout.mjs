// One-page-only, content-preserving layout for the WEDNESDAY of Michaël.
// Never use for Préparation, another weekday, or another celebration.
// Each original leaf is retained, including its text, media, IDs and links.
// Repetitions are hidden only from visitors; they remain editable.
const clone=x=>JSON.parse(JSON.stringify(x));
const assert=(ok,message)=>{if(!ok)throw Error('MICHAEL_WEDNESDAY_LAYOUT_BLOCKED: '+message)};
const allLeaves=blocks=>(blocks||[]).flatMap(b=>b.kind==='section'?
 (b.columns||[]).flatMap(allLeaves):[b]);
const sectionId=name=>'michael-mercredi-layout-'+name+'-2026';
const style=()=>({border:'none',color:'#d7dde5',shadow:false,width:1});
const group=(name,presentation,left,right=[],layout='single',buttons='stack')=>({
 id:sectionId(name),kind:'section',presentation,layout,columns:[left,right],
 ...(layout==='columns'?{columnAlignments:['center','center']}:{}),
 ...(buttons==='row'?{columnButtonLayouts:['row','stack']}:{}),
 style:style()
});
export function prepareMichaelWednesdayLayout(page){
 assert(page?.id==='mercredi-101'&&page.group==='celebration',
  'Target must be Michaël Wednesday (mercredi-101)');
 const original=clone(page),old=original.blocks;
 assert(Array.isArray(old)&&old.length===72,
  'Page no longer has the audited 72 root blocks; refuse unsafe layout');
 const kinds={
  2:'text',3:'heading',4:'text',5:'heading',6:'button',
  7:'heading',8:'text',9:'heading',10:'button',
  11:'heading',12:'heading',13:'audio',
  14:'heading',15:'text',16:'heading',17:'image',18:'button',
  19:'heading',20:'heading',21:'image',22:'button',23:'heading',24:'image',25:'button',
  26:'heading',27:'heading',28:'text',29:'image',30:'audio',
  31:'heading',32:'text',33:'image',34:'audio',
  35:'heading',36:'heading',37:'text',38:'image',39:'audio',
  40:'heading',41:'text',42:'heading',43:'image',44:'button',
  45:'heading',46:'heading',47:'text',48:'image',49:'button',
  50:'heading',51:'text',52:'image',53:'button',
  54:'heading',55:'text',56:'heading',57:'text',58:'button',
  59:'heading',60:'text',61:'button',62:'button',
  63:'heading',64:'text',65:'heading',66:'image',67:'button',
  68:'heading',69:'text',70:'button',71:'heading',72:'text',73:'button'
 };
 const lookup=new Map();
 for(let n=0;n<old.length;n++){
  const item=old[n],id=n+2;
  assert(item&&item.kind===kinds[id]&&String(item.id)===String(id),
   'Unexpected block order or content type at root '+n+' (id '+id+')');
  assert(item.hideOnSite!==true,'Originally hidden content needs manual review: '+id);
  lookup.set(id,item);
 }
 const text=(id,fragment)=>{
  assert(String(lookup.get(id)?.text||'').toLocaleLowerCase('fr').includes(fragment.toLocaleLowerCase('fr')),
   'A major Wednesday topic was changed (id '+id+')');
 };
 text(3,'Programme de cette célébration au Québec');
 text(7,'Cercle d’Entraide');
 text(14,'Engagement devant une contrevertu');
 text(19,'16:00');
 text(26,'18:45');
 text(40,'19:00');
 text(54,'19:30');
 text(63,'Essene Radio');
 // Preserve the real document/media targets: no guessed new links.
 for(const id of [6,10,18,22,25,44,49,53,58,61,62,67,70,73])
  assert(typeof lookup.get(id).href==='string'&&lookup.get(id).href.trim(),
   'Missing existing link '+id);
 for(const id of [13,30,34,39])
  assert(lookup.get(id).src||lookup.get(id).remoteKey,
   'Missing original audio '+id);
 const originalLeaves=allLeaves(old);
 assert(originalLeaves.length===72,'Original leaf count changed');
 const take=id=>lookup.get(id);
 const hide=id=>{const item=take(id);item.hideOnSite=true;return item};
 const link=id=>{const item=take(id);item.displayAsButton=true;return item};
 const out=[
  // Intro, published programme and communication to the Quebec gathering.
  group('introduction','intro',[take(2),take(3),take(4)]),
  group('programme-pdf','documents',[take(5),take(6)]),
  group('entraide','text',[take(7),take(8),hide(9),take(10)]),
  group('plus-de-guerre','video',[take(11),hide(12),take(13)]),
  // Daily preparation and consecration programme.
  group('engagement','resource',[take(17)],
   [take(14),take(15),take(16),take(18)],'columns'),
  group('consecration-horaire','intro',[take(19)]),
  group('consecration-courte','resource',[take(21)],[take(20),take(22)],'columns'),
  group('consecration-longue','resource',[take(24)],[take(23),take(25)],'columns'),
  group('chants-horaire','intro',[take(26)]),
  group('chant-allume-ta-bougie','resource',[take(29)],
   [take(27),take(28),take(30)],'columns'),
  group('chant-appel-des-maitres','resource',[take(33)],
   [take(31),take(32),take(34)],'columns'),
  group('chant-om-amin','resource',[take(38)],
   [take(35),hide(36),take(37),take(39)],'columns'),
  // Guided meditation and the two existing separate YouTube video resources.
  group('meditation-menorah','resource',[take(43)],
   [take(40),take(41),take(42),take(44)],'columns'),
  group('bougie-introduction','intro',[take(45)]),
  group('bougie-theorie','resource',[take(48)],
   [take(46),take(47),take(49)],'columns'),
  group('bougie-pratique','resource',[take(52)],
   [take(50),take(51),take(53)],'columns'),
  // One coherent conference with an actual YouTube thumbnail and the
  // existing independent SoundCloud and SoundCloud-player buttons.
  group('conference-menorah','video',[
   take(54),take(55),hide(56),hide(57),take(58),
   hide(59),hide(60),link(61),link(62)
  ],[],'single','row'),
  // Essene Radio: description, illustrated PDF, website, radio player.
  group('essene-radio-introduction','text',[take(63),take(64)]),
  group('essene-radio-presentation','resource',[take(66)],
   [take(65),take(67)],'columns'),
  group('essene-radio-site','text',[take(68),take(69),take(70)]),
  group('essene-radio-player','text',[take(71),take(72),take(73)])
 ];
 const after=allLeaves(out);
 assert(out.length===21,'Expected 21 coherent groups');
 assert(after.length===originalLeaves.length,'Leaf data was lost');
 const serialize=item=>{
  const copyItem=clone(item);
  delete copyItem.hideOnSite;delete copyItem.displayAsButton;
  return JSON.stringify(copyItem);
 };
 const originalMap=new Map(originalLeaves.map(item=>[String(item.id),serialize(item)]));
 assert(originalMap.size===72,'Old leaf IDs must be unique');
 const seen=new Set();
 for(const item of after){
  const id=String(item.id);assert(!seen.has(id),'Duplicate leaf '+id);
  seen.add(id);
  assert(originalMap.get(id)===serialize(item),'Original media/text/URL changed at '+id);
 }
 assert(seen.size===72,'Missing an item');
 const hidden=after.filter(item=>item.hideOnSite===true).map(item=>Number(item.id)).sort((a,b)=>a-b);
 const expectedHidden=[9,12,36,56,57,59,60];
 assert(JSON.stringify(hidden)===JSON.stringify(expectedHidden),
  'Unexpected text was hidden');
 assert([61,62].every(id=>take(id).displayAsButton===true),
  'Alternative conference URLs must be independent explicit link buttons');
 original.blocks=out;
 return {page:original,report:{
  beforeRoot:old.length,afterRoot:out.length,leaves:after.length,
  hiddenDuplicates:hidden,explicitExtraButtons:[61,62],
  sections:out.map(x=>({id:x.id,presentation:x.presentation,layout:x.layout,
   children:x.columns.map(c=>c.length)}))
 }};
}
