import {test} from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFile} from "node:fs/promises";
const src=await readFile(new URL("../admin-content-details.js",import.meta.url),"utf8");
const state={
 celebrations:[{id:51,archangel:"Michaël",year:"2026",
  days:[{key:"ceremony",label:"Cérémonie",contentIds:[12345]}]}],
 events:[{id:"event-uuid-2026",celebrationId:51,dayKey:"ceremony",
  title:"Rendez-vous",time:"12:30",contentIds:[12345]}],
 contents:[{id:"12345",name:"Private PDF",sourceType:"file",
  fileName:"test.pdf",type:"PDF",mimeType:"application/pdf",storagePath:"media/test.pdf"}]
};
const context={state,window:{},esc:v=>String(v),groupOptions:()=>"",panel:{},document:{}};
vm.runInNewContext(src,context);
test("admin content association summary recognizes numeric/string mixed identifiers",()=>{
 const a=vm.runInNewContext('contentAssociationData("12345")',context);
 assert.equal(a.days.length,1);
 assert.equal(a.events.length,1);
 const ui=vm.runInNewContext('associationEditor("12345")',context);
 assert.match(ui,/data-content-event="event-uuid-2026" checked/);
 assert.match(ui,/data-content-day/);
});
test("admin PDF edit controls never construct executable unquoted UUID click handlers",()=>{
 const html=vm.runInNewContext('contentFileBlock(state.contents[0])',context);
 assert.match(html,/data-open-content-file="view"/);
 assert.match(html,/data-open-content-file="download"/);
 assert.ok(!html.includes("onclick="));
});
