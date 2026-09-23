import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const load=(name,context)=>vm.runInNewContext(fs.readFileSync(path.join(root,'content',name),'utf8'),context,{filename:name});
const ZR={Config:{subscriptions:{subscriptions:[{id:'sub',scorecard:'card',enabled:true}]}},Services:{},
  Settings:{get:()=>false},Journal:{preprintSource:()=>null,displayMetric:async()=>null},
  DB:{latestSubscriptionScreenings:async()=>[],getPaper:async()=>null,paperByZotero:async()=>null}};
const context={ZR,Zotero:{}};
load('scripts/utils.js',context);
load('scripts/screening.js',context);

const clean=ZR.Utils.stripMarkup;
assert.equal(clean('<b>Example signaling</b>.'),'Example signaling.');
assert.equal(clean('&lt;b&gt;Example signaling&lt;/b&gt;.'),'Example signaling.');
assert.equal(clean('&amp;lt;b&amp;gt;Example signaling&amp;lt;/b&amp;gt;.'),'Example signaling.');
assert.equal(clean('cation-Cl&lt;sup&gt;-&lt;/sup&gt; cotransporter'),'cation-Cl- cotransporter');
assert.equal(clean('P &lt; 0.05'),'P < 0.05');
assert.equal(clean('M<sub>2</sub> and N<sup>+</sup>'),'M2 and N+');

const notice='Retraction Note: Example cation-Cl&lt;sup&gt;-&lt;/sup&gt; study.';
assert.equal(ZR.Screening.isCorrectionOrRetraction({title:notice}),true);
assert.equal(ZR.Screening.isCorrectionOrRetraction({title:'&lt;b&gt;Retraction Note:&lt;/b&gt; Example study'}),true);
assert.equal(ZR.Screening.isCorrectionOrRetraction({title:'Correction to: Example study'}),true);
assert.equal(ZR.Screening.isCorrectionOrRetraction({title:'A study of retraction mechanisms'}),false);

const rows=[
  {id:1,paper_id:31,subscription_id:'sub',scorecard_id:'card',title:'<b>Example signaling</b>.',authors_json:'[]',judgement_json:'{}',topics_json:'[]',reading_priority:80,grade:'A'},
  {id:2,paper_id:97,subscription_id:'sub',scorecard_id:'card',title:notice,authors_json:'[]',judgement_json:'{}',topics_json:'[]',reading_priority:65,grade:'B'}
];
ZR.DB.latestSubscriptionScreenings=async()=>rows;
ZR.DB.getPaper=async()=>({id:31,title:'<b>Example signaling</b>.'});
ZR.DB.paperByZotero=async()=>({id:97,title:notice});
load('services/paper-service.js',context);
const listed=await ZR.Services.Papers.list({subscriptionID:'sub'});
assert.equal(listed.total,1,'stored retraction notices must be hidden without deleting database rows');
assert.equal(listed.grade_counts.B,0);
assert.equal(listed.rows[0].title,'Example signaling.');
assert.equal((await ZR.Services.Papers.get(31)).title,'Example signaling.');
const pane=await ZR.Services.Papers.forZoteroItem({libraryID:1,key:'ABC12345'});
assert.equal(pane.screening,null,'a stored retraction notice must not show a score in the item pane');
ZR.DB.getPaper=async()=>({id:97,title:notice});
await assert.rejects(()=>ZR.Screening.importPaperToZotero(97),/Correction\/retraction notice excluded/);

ZR.Paths={db:'mock.sqlite'};
ZR.State={itemCache:new Map()};
context.Zotero.Prefs={get:()=> 'sub'};
context.Zotero.DBConnection=class{
  async queryAsync(sql){
    if(sql.includes('PRAGMA table_info(feedback)'))return[{name:'corrected_transferable_topic'}];
    if(sql.includes('SELECT p.id paper_id,p.title paper_title'))return[
      {paper_id:31,paper_title:'<b>Example signaling</b>.',zotero_library_id:1,zotero_key:'NORMAL01',topics_json:'[]'},
      {paper_id:97,paper_title:notice,zotero_library_id:1,zotero_key:'NOTICE01',topics_json:'[]'}
    ];
    return[];
  }
};
load('scripts/db.js',context);
await ZR.DB.init();
assert.equal(await ZR.DB.loadItemCache(),1,'the item-tree cache must omit stored retraction notices');
assert.equal(ZR.State.itemCache.has('1:NORMAL01'),true);
assert.equal(ZR.State.itemCache.has('1:NOTICE01'),false);

console.log('Encoded title cleanup and stored retraction suppression: PASS');
