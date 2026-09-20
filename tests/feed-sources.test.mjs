import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=path.resolve(import.meta.dirname,'..');
const load=(name,context)=>vm.runInNewContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});
function element(name,text='',children=[],attributes={}){
  const localName=name.split(':').at(-1);
  const own={localName,nodeName:name,textContent:text||children.map(x=>x.textContent).join(''),
    getAttribute:key=>attributes[key]??null,
    getElementsByTagName:key=>descendants(own).filter(x=>x.nodeName===key),
    getElementsByTagNameNS:(_ns,key)=>descendants(own).filter(x=>x.localName===key)};
  own.children=children;
  return own;
}
function descendants(node){return node.children.flatMap(child=>[child,...descendants(child)]);}
function document(rootElement){return {documentElement:rootElement,getElementsByTagName:key=>descendants(rootElement).filter(x=>x.nodeName===key)};}
const rss=document(element('rss','',[element('channel','',[element('item','',[
  element('title','Test protein design paper'),
  element('description','A &amp; B <b>result</b>'),
  element('link','https://pubmed.ncbi.nlm.nih.gov/12345678/'),
  element('pubDate','Sat, 19 Sep 2026 12:00:00 GMT'),
  element('dc:creator','First Author'),element('dc:creator','Second Author'),
  element('dc:source','Example Journal'),element('guid','doi:10.1234/example')
])])]));
const atom=document(element('feed','',[element('entry','',[
  element('title','Atom protein paper'),element('summary','Atom abstract'),
  element('link','',[],{rel:'alternate',href:'https://example.org/paper'}),
  element('author','',[element('name','Atom Author')]),element('published','2026-09-19')
])]));
const wrong=document(element('html','',[element('body','Not a feed')]));
const requestLog=[];
let responseDoc=rss;
const Zotero={HTTP:{request:async (_method,url,options)=>{
  requestLog.push({url,options});
  return options.responseType==='document'?{response:responseDoc}:{responseText:JSON.stringify({version:'https://jsonfeed.org/version/1.1',items:[{title:'JSON paper',url:'https://example.org/json',authors:[{name:'JSON Author'}]}]})};
}},logError:()=>{}};
const ZR={Config:{feeds:{feeds:[]},subscriptions:{subscriptions:[]}},
  Utils:{getPref:()=>100,stripMarkup:value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').trim(),parseDateLoose:value=>value||null,normalizeDOI:value=>value||null,normalizeText:value=>String(value||'').toLowerCase(),containsTerm:()=>true},
  DB:{updateFeedState:async()=>{}},Events:{emit:()=>{}},ConfigManager:{saveFeeds:async()=>{}}};
load('content/scripts/feeds.js',{ZR,Zotero});
load('content/services/feed-service.js',{ZR,Zotero});

const feed={id:'pubmed',name:'PubMed RSS',type:'rss',url:'https://pubmed.ncbi.nlm.nih.gov/rss/search/example/',max_items:100,enabled:true};
assert.equal(ZR.Feeds.feedMode('RSS'),'rss');
assert.equal(ZR.Feeds.feedMode('pubmed'),'rss');
assert.equal(ZR.Feeds.feedMode('author_rss'),'rss');
assert.equal(ZR.Feeds.feedMode('zotwatch'),'rss');
assert.equal(ZR.Feeds.feedMode('europe_pmc_api'),'europe_pmc_api');
assert.equal(ZR.Feeds.feedMode('link'),'link');
assert.equal(ZR.Feeds.feedMode('json_feed'),'json_feed');
let papers=await ZR.Feeds.fetchFeed(feed);
assert.equal(papers.length,1);
assert.equal(papers[0].pmid,'12345678');
assert.equal(papers[0].doi,'10.1234/example');
assert.equal(papers[0].authors.length,2);
assert.equal(papers[0].journal,'Example Journal');
assert.equal(requestLog.at(-1).options.responseType,'document');
assert.equal(ZR.Feeds.parseRSS(atom,feed,100)[0].url,'https://example.org/paper');
assert.equal(ZR.Feeds.parseRSS(atom,feed,100)[0].authors[0],'Atom Author');
assert.throws(()=>ZR.Feeds.parseRSS(wrong,feed,100),/Expected RSS or Atom/);
responseDoc=null;
papers=await ZR.Feeds.fetchFeed({...feed,type:'link'});
assert.equal(papers[0].title,'JSON paper');
assert.equal(requestLog.at(-2).options.responseType,'document');
assert.equal(requestLog.at(-1).options.responseType,'text');
papers=await ZR.Feeds.fetchFeed({...feed,type:'json_feed'});
assert.equal(papers[0].authors[0],'JSON Author');
assert.equal(requestLog.at(-1).options.responseType,'text');
responseDoc=wrong;
ZR.Config.feeds.feeds=[feed];
const result=await ZR.Feeds.fetchAll();
assert.equal(result.errors,1);
assert.equal(result.feed_errors[0].id,'pubmed');
assert.match(result.feed_errors[0].message,/Expected RSS or Atom/);
assert.throws(()=>ZR.Services.Feeds.validate({...feed,type:'europe_pmc_api',query:'protein design'},feed.id),/PubMed RSS URL requires/);
assert.equal(ZR.Services.Feeds.validate(feed,feed.id).type,'rss');
assert.match(fs.readFileSync(path.join(root,'content/ui/dashboard/dashboard.js'),'utf8'),/type:'rss',url:''/);

console.log('RSS, Atom, JSON Feed, legacy types, and feed validation: PASS');
