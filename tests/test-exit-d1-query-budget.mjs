// All tests below run against node:sqlite in memory. ZERO Cloudflare calls.
import {test} from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFile} from "node:fs/promises";
const schema=await readFile(new URL("../migration/cloudflare/celebrations-schema.sql",import.meta.url),"utf8");
function fixture(){
 const db=new DatabaseSync(":memory:");
 db.exec(schema);
 db.exec("BEGIN");
 const addCel=db.prepare("INSERT INTO celebrations_celebrations(id,archangel) VALUES (?,?)");
 for(let i=1;i<=4;i++)addCel.run(i,"Synthetic");
 const addEvent=db.prepare("INSERT INTO celebrations_events(id,celebration_id,step_key,title,audience) VALUES (?,?,?,?,?)");
 for(let i=0;i<62;i++)addEvent.run("ev-"+i,(i%4)+1,"day-"+i,"Event "+i,i%7===0?"angel":"all");
 const addContent=db.prepare("INSERT INTO celebrations_contents(id,name,content_type,audience,storage_path,cover_storage_path) VALUES (?,?,?,?,?,?)");
 for(let i=0;i<211;i++)addContent.run("content-"+i,"Fixture "+i,"PDF",i%9===0?"angel":"all","media/fixture-"+i,"media/cover-"+i);
 const addRelation=db.prepare("INSERT INTO celebrations_event_contents(event_id,content_id,sort_order) VALUES (?,?,?)");
 for(let i=0;i<256;i++)addRelation.run("ev-"+(i%62),"content-"+(i%211),i);
 db.exec("COMMIT");db.exec("ANALYZE");
 return db;
}
const original=aud=>`SELECT * FROM celebrations_event_contents WHERE content_id IN (SELECT id FROM celebrations_contents WHERE audience IN ${aud}) AND event_id IN (SELECT id FROM celebrations_events WHERE audience IN ${aud})`;
const optimized=aud=>`SELECT ec.event_id,ec.content_id,ec.sort_order FROM celebrations_event_contents ec CROSS JOIN celebrations_contents c CROSS JOIN celebrations_events e WHERE ec.content_id=c.id AND ec.event_id=e.id AND c.audience IN ${aud} AND e.audience IN ${aud}`;
const identity=r=>JSON.stringify(r.slice().sort((x,y)=>(x.event_id+":"+x.content_id).localeCompare(y.event_id+":"+y.content_id)));
test("CROSS JOIN reads the relation once, preserving every public and participant permission",()=>{
 const db=fixture();
 try{
  for(const audience of ["('all')","('all','angel')"]){
   const expected=db.prepare(original(audience)).all(),actual=db.prepare(optimized(audience)).all();
   assert.equal(identity(actual),identity(expected),"Public and restricted relation memberships must match exactly");
   const plan=db.prepare("EXPLAIN QUERY PLAN "+optimized(audience)).all().map(x=>x.detail).join(" | ");
   assert.match(plan,/SCAN ec/,"Relation table must have one-pass access");
   assert.match(plan,/SEARCH c USING/,"Content parent must be found by PK");
   assert.match(plan,/SEARCH e USING/,"Event parent must be found by PK");
   assert.ok(!plan.includes("LIST SUBQUERY"),"Never use the old repeated-subquery plan");
   console.log("LOCAL_D1_RELATION_EXPLAIN audience="+audience+" plan="+plan);
  }
 }finally{db.close()}
});
test("staging media path lookup and aggregated click queries have covering indexes",()=>{
 const db=fixture();
 try{
  const idx=db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map(x=>x.name);
  for(const expected of [
   "idx_celebrations_contents_storage_path",
   "idx_celebrations_contents_cover_storage_path",
   "idx_celebrations_clicks_resource_summary",
   "idx_celebrations_clicks_page_summary"
  ])assert.ok(idx.includes(expected),"Missing quota-saving index "+expected);
  const queries=[
   ["media original","SELECT 1 FROM celebrations_contents c WHERE (c.storage_path=? OR c.cover_storage_path=?) AND c.audience='all' LIMIT 1",["media/fixture-1","media/fixture-1"]],
   ["media path","SELECT 1 FROM celebrations_contents WHERE storage_path=? LIMIT 1",["media/fixture-1"]],
   ["media cover","SELECT 1 FROM celebrations_contents WHERE cover_storage_path=? LIMIT 1",["media/cover-1"]],
   ["resource clicks","SELECT target_kind,target_label,COUNT(*) AS n,MAX(clicked_at) FROM celebrations_clicks WHERE target_kind<>'page-view' GROUP BY target_kind,target_label ORDER BY n DESC LIMIT 100",[]],
   ["page views","SELECT COALESCE(page_path,'/') AS page,COUNT(*) AS cnt,COUNT(DISTINCT visitor_id) FROM celebrations_clicks WHERE target_kind='page-view' GROUP BY COALESCE(page_path,'/') ORDER BY cnt DESC LIMIT 100",[]]
  ];
  for(const [label,sql,args] of queries){
   const plan=db.prepare("EXPLAIN QUERY PLAN "+sql).all().map(x=>x.detail).join(" | ");
   console.log("LOCAL_D1_COST_EXPLAIN "+label+" plan="+plan);
   if(label==="media original")assert.match(plan,/INDEX|SEARCH/,"Media lookup must not fully scan all content");
   if(label==="media path"||label==="media cover")assert.match(plan,/INDEX|SEARCH/);
   if(label==="resource clicks")assert.match(plan,/idx_celebrations_clicks_resource_summary/);
   if(label==="page views")assert.match(plan,/idx_celebrations_clicks_page_summary/);
   if(args.length)assert.ok(db.prepare(sql).get(...args),"Known media fixture must remain accessible");
  }
 }finally{db.close()}
});
