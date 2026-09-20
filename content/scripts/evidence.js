(function (ZR) {
  'use strict';
  function hits(title, abstract, terms, branch, topicID=null) {
    const out=[], seen=new Set(), nt=ZR.Utils.normalizeText(title), na=ZR.Utils.normalizeText(abstract);
    for(const term of terms||[]) {
      for(const [source,blob] of [['title',nt],['abstract',na]]) {
        const key=ZR.Utils.normalizeText(term)+'|'+source;
        if(seen.has(key)||!ZR.Utils.containsTerm(blob,term)) continue;
        seen.add(key); out.push({term,source,branch,topic_id:topicID});
      }
    }
    return out;
  }
  function collect(paper,card) {
    const ev={direct:[],contextual:[],transferable:[],exclusions:[],topics:{}};
    const direct=[...(card.scope.direct.anchors||[]),...(card.scope.direct.aliases||[])];
    const contextual=[...(card.scope.contextual.anchors||[]),...(card.scope.contextual.aliases||[])];
    ev.direct=hits(paper.title,paper.abstract,direct,'direct');
    ev.contextual=hits(paper.title,paper.abstract,contextual,'contextual');
    for(const t of card.scope.transferable.topics||[]) ev.transferable.push(...hits(paper.title,paper.abstract,[...(t.anchors||[]),...(t.aliases||[])],'transferable',t.id));
    for(const ex of (card.scope.exclusions&&card.scope.exclusions.examples)||[]) ev.exclusions.push(...hits(paper.title,paper.abstract,[ex],'exclusion'));
    for(const t of card.topics||[]) { const h=hits(paper.title,paper.abstract,[...(t.anchors||[]),...(t.aliases||[])],'topic',t.id); if(h.length)ev.topics[t.id]=h; }
    return ev;
  }
  function heuristic(paper,card,ev) {
    const titleDirect=ev.direct.some(x=>x.source==='title'), titleContext=ev.contextual.some(x=>x.source==='title');
    const topics=Object.keys(ev.topics||{});
    const transfer=ev.transferable[0]&&ev.transferable[0].topic_id||null;
    if(!paper.abstract && !titleDirect && !titleContext && !ev.transferable.some(x=>x.source==='title')) return {scope:'UNCERTAIN',strength:null,topics,transferable_topic:null,reason:'Only limited title evidence is available; the abstract is missing.',positive_evidence:[],negative_evidence:[],uncertainty:'Abstract unavailable'};
    if(ev.direct.length){const strength=titleDirect||ev.direct.length>=3?'HIGH':ev.direct.length>=2?'MEDIUM':'LOW';return {scope:'DIRECT',strength,topics,transferable_topic:null,reason:'Deterministic evidence directly matches the scorecard domain.',positive_evidence:ev.direct.slice(0,3).map(x=>`${x.term} (${x.source})`),negative_evidence:[],uncertainty:null};}
    if(ev.contextual.length){const strength=titleContext||ev.contextual.length>=3?'HIGH':ev.contextual.length>=2?'MEDIUM':'LOW';return {scope:'CONTEXTUAL',strength,topics,transferable_topic:null,reason:'The paper matches the broader scorecard context but lacks direct-domain anchors.',positive_evidence:ev.contextual.slice(0,3).map(x=>`${x.term} (${x.source})`),negative_evidence:[],uncertainty:null};}
    if(ev.transferable.length){const strength=ev.transferable.some(x=>x.source==='title')||ev.transferable.length>=3?'HIGH':ev.transferable.length>=2?'MEDIUM':'LOW';return {scope:'TRANSFERABLE',strength,topics,transferable_topic:transfer,reason:'The target is outside the direct domain, but a configured transferable method/topic is matched.',positive_evidence:ev.transferable.slice(0,3).map(x=>`${x.term} (${x.source})`),negative_evidence:[],uncertainty:null};}
    return {scope:'OUT_OF_SCOPE',strength:null,topics,transferable_topic:null,reason:'No sufficient direct, contextual, or transferable evidence was found.',positive_evidence:[],negative_evidence:ev.exclusions.slice(0,3).map(x=>`${x.term} (${x.source})`),uncertainty:null};
  }
  ZR.Evidence={hits,collect,heuristic};
})(ZR);
