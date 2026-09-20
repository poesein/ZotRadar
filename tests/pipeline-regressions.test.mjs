import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const source=name=>fs.readFileSync(path.join(root,'content/scripts',name),'utf8');
const load=(name,context)=>vm.runInNewContext(source(name),context,{filename:name});

// A Paper entity may already exist while a subscription/scorecard task does not.
const subscriptions=[{id:'a',scorecard:'card',feed_ids:['feed']},{id:'b',scorecard:'card',feed_ids:['feed']}];
const fetched={title:'A reusable protein design method',abstract:'A full abstract describing a reusable protein design method.',doi:'10.1234/example',journal:'',source_records:[{id:'feed',type:'rss',url:'https://example.org/feed'}]};
let stored={...fetched,id:1,source_records:[...fetched.source_records]},modelCalls=0,scores=[],events=[];
const latest=new Map([['a',{scorecard_id:'card',scorecard_hash:'hash',prompt_contract_version:'prompt',scoring_policy_version:'policy',model:'model',scope:'DIRECT'}]]);
const ZR={
  State:{runInProgress:false},Config:{subscriptions:{subscriptions}},
  Utils:{getPref:()=> 'model',hashString:x=>x,nowISO:()=>new Date().toISOString(),log:()=>{},setPref:()=>{},safeJSON:JSON.parse,randomToken:()=> 'token'},
  DB:{findExistingPaper:async()=>stored?.id||null,getPaper:async()=>stored,
    latestPaperSubscriptionScreening:async(_id,sub)=>latest.get(sub)||null,
    startRun:async()=>1,finishRun:async()=>{},loadItemCache:async()=>{},
    upsertPaper:async paper=>{stored={...paper,id:1};return 1},getCache:async()=>null,saveCache:async()=>{},
    latestFeedback:async()=>null,saveScreening:async(_run,result)=>{latest.set(result.subscription_id,{...result,model:result.model});return latest.size}},
  Scorecards:{get:()=>({id:'card',version:1}),hash:()=> 'hash'},
  ScorecardManager:{activeSubscriptions:()=>subscriptions,subscription:id=>subscriptions.find(s=>s.id===id)},
  Feeds:{fetchAll:async()=>({papers:[{...fetched}],fetched:1,errors:0,feed_ids:['feed']}),completeFromEPMC:async p=>p,
    subscriptionsFor:()=>subscriptions,matchesSubscription:()=>true},
  Evidence:{collect:()=>({})},Ollama:{PROMPT_VERSION:'prompt',screen:async()=>{modelCalls++;return{judgement:{scope:'DIRECT',strength:'HIGH'},model:'model',raw:'{}'}}},
  Feedback:{adjustment:async()=>({adjustment:0,version:null,details:{}})},
  Journal:{score:async()=>({score:50,source:'no journal'}),preprintSource:p=>/^10\.21203\/rs\./.test(p.doi||'')?'Research Square':null},
  Scoring:{POLICY:'policy',forCard:()=>({}),score:(_j,opts)=>{scores.push(opts);return{base_relevance:95,feedback_adjustment:0,personalized_relevance:95,journal_score:50,journal_adjustment:0,reading_priority:95,grade:'A'}}},
  UI:{refreshColumns:()=>{}},Events:{emit:(name,payload)=>events.push([name,payload])}
};
load('screening.js',{ZR,Zotero:{logError:()=>{}}});
let run=await ZR.Screening.runFeeds();
assert.equal(run.screenings,1,'existing A paper must still be screened for B');
assert.equal(latest.has('b'),true);
assert.equal(modelCalls,1);
assert.equal(events.some(([name])=>name==='papers:changed'),true);
run=await ZR.Screening.runFeeds();
assert.equal(run.screenings,0,'completed subscription tasks must not repeat');
assert.equal(run.filtered_existing,1);
latest.set('b',{...latest.get('b'),model:'heuristic-v5-fallback',scope:'UNCERTAIN'});
run=await ZR.Screening.runFeeds();
assert.equal(run.screenings,1,'model-failure fallback must retry at next feed run');
assert.equal(modelCalls,2);
stored={...stored,abstract:'Short abstract.'};
run=await ZR.Screening.runFeeds();
assert.equal(run.screenings,2,'a better abstract must refresh both subscription tasks');
assert.equal(stored.abstract,fetched.abstract);
stored={...stored,doi:'10.21203/rs.3.rs-12345',journal:''};
ZR.Feeds.fetchAll=async()=>({papers:[{...stored}],fetched:1,errors:0,feed_ids:['feed']});
latest.clear();
await ZR.Screening.runFeeds();
assert.equal(scores.at(-1).isPreprint,true,'DOI-recognized preprint must bypass journal weighting');

// A short RSS teaser can be completed only when an exact identifier verifies it.
let requests=0;
const response={resultList:{result:[{title:fetched.title,abstractText:'This is a substantially longer and more useful abstract with methods, measurements and results than the RSS teaser.',doi:fetched.doi}]}};
const feedsZR={Utils:{normalizeDOI:v=>v,stripMarkup:v=>v||'',parseDateLoose:v=>v||null,normalizeText:v=>String(v||'').toLowerCase(),log:()=>{}},Config:{feeds:{feeds:[]}}};
load('feeds.js',{ZR:feedsZR,Zotero:{HTTP:{request:async()=>{requests++;return{responseText:JSON.stringify(response)}}}}});
const short=await feedsZR.Feeds.completeFromEPMC({...fetched,abstract:'Short teaser.'});
assert.ok(short.abstract.length>50);
const full=await feedsZR.Feeds.completeFromEPMC({...fetched,abstract:'x'.repeat(180)});
assert.equal(full.abstract.length,180);
assert.equal(requests,1);
response.resultList.result[0].doi='10.1234/different';
const mismatch=await feedsZR.Feeds.completeFromEPMC({...fetched,abstract:'Short teaser.'});
assert.equal(mismatch.abstract,'Short teaser.');
const journalZR={};
load('journal.js',{ZR:journalZR});
assert.equal(journalZR.Journal.preprintSource({doi:'10.21203/rs.3.rs-12345',journal:''}),'Research Square');
assert.equal(journalZR.Journal.preprintSource({doi:'10.21203/rs.3.rs-12345',journal:'Nature'}),null,
  'a published journal record must not be treated as its earlier preprint');

// Depth caps remain backward-compatible but may be tailored per Scorecard.
const card={id:'card',topics:[],scope:{direct:{anchors:['protein design'],aliases:[]},contextual:{anchors:[],aliases:[]},transferable:{topics:[]}},evidence_policy:{}};
const paper={title:fetched.title,abstract:fetched.abstract};
const extraction={main_question:'Protein design intervention',core_objects:['protein design'],interest_relation:'DIRECT_FOCUS',centrality:'CENTRAL',focus_role:'MAIN_SUBJECT',link_specificity:'DIRECT_CONFIGURED_CONTRIBUTION',evidence_type:'CLINICAL',evidence_depth:'HIGH',supporting_quotes:['protein design method','reusable protein design method'],unknowns:[],topics:[],transferable_topic:null,reason:'Direct study'};
const ollamaZR={Utils:{getPref:()=>'',safeJSON:JSON.parse,normalizeText:v=>String(v||'').toLowerCase(),containsTerm:(v,t)=>v.includes(t.toLowerCase())}};
load('ollama.js',{ZR:ollamaZR});
const evidence={direct:[{source:'title',term:'protein design'}],contextual:[],transferable:[]};
assert.equal(ollamaZR.Ollama.normalize(extraction,card,evidence,paper).strength,'MEDIUM');
card.evidence_policy.high_depth_cap_types=[];
assert.equal(ollamaZR.Ollama.normalize(extraction,card,evidence,paper).strength,'HIGH');
const scorecardZR={};
load('scorecards.js',{ZR:scorecardZR});
const template=JSON.parse(fs.readFileSync(path.join(root,'config/scorecards/_template.json'),'utf8'));
assert.equal(scorecardZR.ScorecardManager.validate(template).id,'example_domain');
assert.throws(()=>scorecardZR.ScorecardManager.validate({...template,evidence_policy:{high_depth_cap_types:['NOT_A_TYPE']}}),/unknown evidence type/);

const feedbackCalls=[],feedbackEvents=[];
const feedbackZR={DB:{row:async()=>({paper_id:7,scorecard_id:'card'}),revokeFeedback:async()=>true,
  rollbackProfile:async()=>true,loadItemCache:async()=>{},pickRows:rows=>rows},
  Feedback:{rebuild:async()=>({version:2})},
  Screening:{rescorePaper:async(id,cardID)=>feedbackCalls.push(['paper',id,cardID]),
    rescoreScorecard:async cardID=>feedbackCalls.push(['all',cardID])},
  UI:{refreshColumns:()=>{}},Events:{emit:(name,payload)=>feedbackEvents.push([name,payload])},Services:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'content/services/feedback-service.js'),'utf8'),{ZR:feedbackZR,Zotero:{logError:()=>{}}});
await feedbackZR.Services.Feedback.revoke(3);
await feedbackZR.Services.Feedback.rebuild('card');
await feedbackZR.Services.Feedback.rollback('card',1);
assert.deepEqual(feedbackCalls,[['paper',7,'card']],
  'snapshot rebuild/rollback must not rescore; revoke affects only its paper');
assert.equal(feedbackEvents.filter(([,payload])=>payload.snapshotOnly).length,2);

assert.equal(source('main.js').includes('await ZR.Services.Papers.backfillTitleTranslations()'),false,
  'startup must not enqueue a whole-library translation backfill');
console.log('Pipeline regression tests: PASS');
