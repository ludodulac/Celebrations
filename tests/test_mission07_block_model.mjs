import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createBlockModel} from '../migration/cloudflare/app/domain/editor-block-model.mjs';
import {createEditorBlockCommands} from '../migration/cloudflare/app/application/editor-block-commands.mjs';
import {DEMO_CLIENT} from '../migration/cloudflare/editor-demo-client.mjs';
const model=createBlockModel(),commands=createEditorBlockCommands({model});
const clone=x=>JSON.parse(JSON.stringify(x));
const starter={heading:'Nouveau titre',text:'Votre paragraphe',button:'Mon bouton',event:'Titre de l’événement'};
test('M07 integration: assembled editor syntax is valid, model and commands appear exactly once',()=>{
 new vm.Script(DEMO_CLIENT);
 assert.equal(DEMO_CLIENT.split('function createBlockModel(').length-1,1);
 assert.equal(DEMO_CLIENT.split('function createEditorBlockCommands(').length-1,1);
 assert.ok(DEMO_CLIENT.includes('editorBlockCommands.wrapRootBlock'));
 assert.ok(DEMO_CLIENT.includes('editorBlockModel.patchSectionStyle'));
 assert.ok(DEMO_CLIENT.includes("const editorBlockModel=createBlockModel()"));
});
test('M07 default JSON shapes match the existing eight editor block types',()=>{
 const expected={
 heading:{id:'x',kind:'heading',align:'left',text:'',href:'',src:''},
 text:{id:'x',kind:'text',align:'left',text:'',href:'',src:''},
 button:{id:'x',kind:'button',align:'left',text:'',href:'',src:'',displayAsButton:true},
 event:{id:'x',kind:'event',align:'left',text:'',href:'',src:''},
 image:{id:'x',kind:'image',align:'left',text:'',href:'',src:''},
 video:{id:'x',kind:'video',align:'left',text:'',href:'',src:''},
 audio:{id:'x',kind:'audio',align:'left',text:'MP3 à choisir',href:'',src:''},
 divider:{id:'x',kind:'divider',color:'#858c94',thickness:1,widthPct:60}
 };
 for(const [kind,want] of Object.entries(expected))
  assert.equal(JSON.stringify(model.createContent(kind,'x',starter)),JSON.stringify(want),kind);
});
test('M07 legacy fields, unknown kinds and media paths survive roundtrip and duplication',()=>{
 const blocks=[
 {id:1,kind:'heading',rich:'<strong>Titre</strong>',bold:true},
 {id:2,kind:'text',rich:'<em>Texte</em>',custom:{version:5}},
 {id:3,kind:'button',href:'/letter/ancien.pdf',displayAsButton:false},
 {id:4,kind:'image',src:'/media/photo.jpg',widthPct:40,assetId:'device'},
 {id:5,kind:'video',href:'https://example.org/film',cover:'/media/new/cover.png'},
 {id:6,kind:'audio',remoteKey:'editor-trials/audio/123.mp3'},
 {id:7,kind:'event',atTime:'14:30'},
 {id:8,kind:'divider',color:'#747474',widthPct:60},
 {id:9,kind:'unknown-legacy',futureField:{nested:'préservé'}}
 ];
 const section={id:'old-section',kind:'section',layout:'single',
  columns:[blocks.slice(0,4),blocks.slice(4)],style:{legacyStyle:123},
  columnButtonLayouts:['row','stack'],unknownPresentation:true};
 const page={id:'historic',blocks:[section],extraPage:{version:3}};
 const before=JSON.stringify(page);
 assert.equal(JSON.stringify(clone(page)),before,'no conversion of historical data on read');
 const duplicated=commands.duplicateInContainer(blocks[8],section.columns[1],'new-id',clone);
 assert.deepEqual({...duplicated,id:9},blocks[8]);
 assert.notStrictEqual(duplicated,blocks[8]);
 assert.equal(blocks[3].src,'/media/photo.jpg');
 assert.equal(page.extraPage.version,3);
});
test('M07 grouping and layout switch preserve original block references and hidden column',()=>{
 const original={id:1,kind:'image',src:'/media/historical.png',widthPct:33,unknownFlag:true};
 const added={id:2,kind:'text',rich:'<em>bonjour</em>'};
 const page={id:'x',blocks:[original]};
 const grouped=commands.wrapRootBlock(page,original,added,'grp');
 assert.strictEqual(page.blocks[0],grouped);
 assert.strictEqual(grouped.columns[0][0],original);
 assert.strictEqual(grouped.columns[0][1],added);
 grouped.columns[1].push({id:3,kind:'special-legacy'});
 grouped.layout=model.nextLayout(grouped.layout);
 grouped.layout=model.nextLayout(grouped.layout);
 assert.equal(grouped.layout,'single');
 assert.equal(grouped.columns[1][0].kind,'special-legacy');
 assert.equal(commands.wrapRootBlock(page,original,added,'another'),null);
});
test('M07 resource, video and document presets keep all current fields and ordering',()=>{
 let i=0;const make=kind=>model.createContent(kind,String(++i),starter);
 for(const [kind,layout,types] of [
 ['resource','columns',[['image'],['heading','text','button']]],
 ['video','single',[['heading','video'],[]]],
 ['documents','single',[['heading','button'],[]]]
 ]){
  const {section,selectedIndex}=model.createResourcePreset(kind,'section-'+kind,make);
  assert.equal(section.layout,layout);
  assert.deepEqual(section.columns.map(x=>x.map(y=>y.kind)),types);
  assert.equal(selectedIndex,layout==='columns'?1:0);
  assert.deepEqual(section.columnAlignments,kind==='resource'?['center','center']:['top','top']);
  assert.deepEqual(Object.keys(section),['id','kind','layout','columns','presentation','columnAlignments','style']);
 }
});
test('M07 visible style changes preserve stored undocumented metadata',()=>{
 const section={presentation:'resource',
  style:{border:'round',color:'#112233',width:1,shadow:true,unknown:{keep:'yes'}}};
 const updated=model.patchSectionStyle(section,{width:4},c=>/^#[0-9a-f]{6}$/i.test(c||''));
 assert.equal(updated.width,4);
 assert.deepEqual(updated.unknown,{keep:'yes'});
 assert.equal(section.style.width,1,'pure function must not mutate until user command');
 assert.equal(model.columnVerticalAlign(section,0),'center');
 assert.equal(model.columnButtonLayout(section,1),'stack');
});
