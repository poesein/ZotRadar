(function (ZR) {
  'use strict';
  async function getText(url,timeout=30000){const x=await Zotero.HTTP.request('GET',url,{responseType:'text',timeout});return x.responseText||String(x.response||'');}
  function nodeText(node,names){for(const name of names){const els=node.getElementsByTagName(name);if(els&&els.length&&els[0].textContent)return els[0].textContent.trim();const all=node.getElementsByTagNameNS('*',name.includes(':')?name.split(':').pop():name);if(all&&all.length&&all[0].textContent)return all[0].textContent.trim();}return'';}
  function parseRSS(doc,feed,maxItems){
    // Keep RSS/Atom field mapping here. XHR's standard XML response supplies the
    // DOM; Services.appShell.hiddenDOMWindow is unavailable in current Zotero.
    const root=doc?.documentElement;
    if(!root)throw new Error('Feed did not return an XML document');
    if(root.localName==='parsererror'||doc.getElementsByTagName('parsererror').length)throw new Error('Feed returned malformed XML');
    const kind=String(root.localName||root.nodeName||'').split(':').pop().toLowerCase();
    if(!['rss','feed','rdf'].includes(kind))throw new Error('Expected RSS or Atom XML');
    let entries=[...doc.getElementsByTagName('item')];
    if(!entries.length)entries=[...doc.getElementsByTagName('entry')];
    const out=[];
    for(const e of entries.slice(0,maxItems)){
      const links=[...e.getElementsByTagName('link')];
      const linkNode=links.find(x=>x.getAttribute('rel')==='alternate')||links.find(x=>x.getAttribute('href'))||links[0];
      const link=nodeText(e,['link'])||linkNode?.getAttribute('href')||'';
      const blob=e.textContent||'';
      const doi=(blob.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i)||[])[0]||null;
      const pmid=(link.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i)||[])[1]||(blob.match(/\bPMID\s*:?\s*(\d+)/i)||[])[1]||null;
      const creators=[...e.getElementsByTagNameNS('*','creator')].map(x=>x.textContent.trim()).filter(Boolean);
      if(!creators.length)creators.push(...[...e.getElementsByTagName('author')].map(x=>nodeText(x,['name'])||x.textContent.trim()).filter(Boolean));
      out.push({
        title:ZR.Utils.stripMarkup(nodeText(e,['title']))||'Untitled',
        abstract:ZR.Utils.stripMarkup(nodeText(e,['description','summary','content:encoded','content'])),
        authors:creators,
        published:ZR.Utils.parseDateLoose(nodeText(e,['pubDate','published','updated','dc:date'])),
        doi:ZR.Utils.normalizeDOI(doi),pmid,pmcid:null,url:link,
        journal:nodeText(e,['prism:publicationName','publicationName','dc:source','source']),
        source_type:feed.type,source_name:feed.name||feed.id,citation_count:0,
        source_records:[{id:feed.id,type:feed.type,name:feed.name||feed.id,url:feed.url||''}]
      });
    }
    return out;
  }
  function epmcPaper(item,feed){const j=(item.journalInfo||{}).journal||{};let authors=[];if(item.authorList&&Array.isArray(item.authorList.author))authors=item.authorList.author.map(a=>a.fullName||[a.firstName,a.lastName].filter(Boolean).join(' ')).filter(Boolean);else if(item.authorString)authors=String(item.authorString).split(',').map(x=>x.trim()).filter(Boolean);const types=item.pubTypeList?.pubType||[];return{title:ZR.Utils.stripMarkup(item.title||'Untitled'),abstract:ZR.Utils.stripMarkup(item.abstractText||''),authors,published:ZR.Utils.parseDateLoose(item.firstPublicationDate||item.firstIndexDate||item.dateOfPublication),doi:ZR.Utils.normalizeDOI(item.doi),pmid:item.pmid||null,pmcid:item.pmcid||null,url:item.pmid?`https://pubmed.ncbi.nlm.nih.gov/${item.pmid}/`:item.doi?`https://doi.org/${item.doi}`:'',journal:item.journalTitle||j.title||'',publication_types:Array.isArray(types)?types:[types],source_type:feed.type,source_name:feed.name||feed.id,citation_count:Number(item.citedByCount||0),source_records:[{id:feed.id,type:feed.type,name:feed.name||feed.id,url:feed.url||''}]};}
  async function fetchEuropePMC(feed,maxItems){const pageSize=Math.min(1000,Number(maxItems||feed.max_items||100)),url=String(feed.url||'https://www.ebi.ac.uk/europepmc/webservices/rest/search')+'?query='+encodeURIComponent(feed.query||'')+'&format=json&resultType=core&pageSize='+pageSize;const p=JSON.parse(await getText(url,30000)),rows=((p.resultList||{}).result)||[];return rows.slice(0,pageSize).map(x=>epmcPaper(x,feed));}
  function feedMode(type){const value=String(type||'').trim().toLowerCase();return value==='europe_pmc_api'?'europe_pmc_api':value==='json_feed'?'json_feed':value==='link'||value==='auto'?'link':'rss';}
  function parseJSONFeed(data,feed,maxItems){
    if(!data||!Array.isArray(data.items)||!String(data.version||'').startsWith('https://jsonfeed.org/version/'))throw new Error('Link did not return RSS, Atom, or JSON Feed');
    return data.items.slice(0,maxItems).map(item=>{
      const url=String(item.url||item.external_url||'');
      const blob=[item.id,url,item.content_text,item.content_html,item.summary].filter(Boolean).join(' ');
      const doi=(blob.match(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i)||[])[0]||null;
      const pmid=(url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i)||[])[1]||(blob.match(/\bPMID\s*:?\s*(\d+)/i)||[])[1]||null;
      const authors=(item.authors||[item.author].filter(Boolean)).map(x=>typeof x==='string'?x:x?.name).filter(Boolean);
      return{title:ZR.Utils.stripMarkup(item.title||'Untitled'),abstract:ZR.Utils.stripMarkup(item.content_text||item.summary||item.content_html||''),authors,published:ZR.Utils.parseDateLoose(item.date_published||item.date_modified),doi:ZR.Utils.normalizeDOI(doi),pmid,pmcid:null,url,journal:String(item._journal||''),source_type:feed.type,source_name:feed.name||feed.id,citation_count:0,source_records:[{id:feed.id,type:feed.type,name:feed.name||feed.id,url:feed.url||''}]};
    });
  }
  async function fetchXML(feed,maxItems){const response=await Zotero.HTTP.request('GET',feed.url,{responseType:'document',timeout:30000});return parseRSS(response.responseXML||response.response,feed,maxItems);}
  async function fetchJSONFeed(feed,maxItems){let data;try{data=JSON.parse(await getText(feed.url,30000));}catch(_){throw new Error('Feed did not return valid JSON');}return parseJSONFeed(data,feed,maxItems);}
  async function fetchLink(feed,maxItems){
    const response=await Zotero.HTTP.request('GET',feed.url,{responseType:'document',timeout:30000});
    const doc=response.responseXML||response.response;
    if(doc?.documentElement)return parseRSS(doc,feed,maxItems);
    let data;
    try{data=JSON.parse(await getText(feed.url,30000));}catch(_){throw new Error('Link did not return RSS, Atom, or JSON Feed');}
    if(Array.isArray(data?.resultList?.result))return data.resultList.result.slice(0,maxItems).map(x=>epmcPaper(x,feed));
    return parseJSONFeed(data,feed,maxItems);
  }
  async function fetchFeed(feed){const max=Math.min(Number(feed.max_items||ZR.Utils.getPref('maxFeedItems',100)),Number(ZR.Utils.getPref('maxFeedItems',100)));const mode=feedMode(feed.type);if(mode==='europe_pmc_api')return fetchEuropePMC(feed,max);if(mode==='json_feed')return fetchJSONFeed(feed,max);return mode==='link'?fetchLink(feed,max):fetchXML(feed,max);}
  function normalizedTitle(t){return ZR.Utils.normalizeText(t).replace(/[^a-z0-9\u4e00-\u9fff ]/g,'').replace(/\s+/g,' ').trim();}
  function dedupe(papers){const map=new Map();for(const p of papers){const key=p.doi?'doi:'+ZR.Utils.normalizeDOI(p.doi):p.pmid?'pmid:'+p.pmid:'title:'+normalizedTitle(p.title);if(!map.has(key)){map.set(key,{...p});continue;}const x=map.get(key);if(String(p.abstract||'').length>String(x.abstract||'').length)x.abstract=p.abstract;if(!x.journal&&p.journal)x.journal=p.journal;if(!x.doi&&p.doi)x.doi=p.doi;if(!x.pmid&&p.pmid)x.pmid=p.pmid;x.source_records=[...(x.source_records||[]),...(p.source_records||[])];}return[...map.values()];}
  async function completeFromEPMC(paper){
    const original=String(paper.abstract||'').trim(),hasID=!!(paper.doi||paper.pmid||paper.pmcid);
    // RSS descriptions can be short teasers. Only probe those when an exact
    // identifier can verify the returned record; never replace a full abstract.
    if(original.length>=180||original.length&& !hasID)return paper;
    let query='',kind='title';
    if(paper.doi){query=`DOI:\"${paper.doi}\"`;kind='doi';}
    else if(paper.pmid){query=`EXT_ID:\"${paper.pmid}\"`;kind='pmid';}
    else if(paper.pmcid){query=`PMCID:\"${paper.pmcid}\"`;kind='pmcid';}
    else query=`TITLE:\"${String(paper.title||'').replace(/"/g,'')}\"`;
    const url='https://www.ebi.ac.uk/europepmc/webservices/rest/search?query='+encodeURIComponent(query)+'&format=json&resultType=core&pageSize=1';
    try{
      const response=JSON.parse(await getText(url,30000)),item=(((response.resultList||{}).result)||[])[0];
      if(!item)return paper;
      if(kind==='doi'&&ZR.Utils.normalizeDOI(item.doi)!==ZR.Utils.normalizeDOI(paper.doi))return paper;
      if(kind==='pmid'&&String(item.pmid||'')!==String(paper.pmid||''))return paper;
      if(kind==='pmcid'&&String(item.pmcid||'').toLowerCase()!==String(paper.pmcid||'').toLowerCase())return paper;
      if(kind==='title'&&normalizedTitle(item.title)!==normalizedTitle(paper.title))return paper;
      const updated=epmcPaper(item,{type:'europe_pmc_completion',name:'Europe PMC completion',url});
      return{...paper,abstract:String(updated.abstract||'').length>original.length?updated.abstract:paper.abstract,
        doi:updated.doi||paper.doi,pmid:updated.pmid||paper.pmid,pmcid:updated.pmcid||paper.pmcid,
        journal:updated.journal||paper.journal,citation_count:updated.citation_count||paper.citation_count};
    }catch(e){ZR.Utils.log('EPMC completion failed',e);return paper;}
  }
  function matchesSubscription(paper,sub){const m=sub.match||{};if(m.all)return true;const blob=ZR.Utils.normalizeText(`${paper.title}\n${paper.abstract}`),any=m.any_terms||[],all=m.all_terms||[];if(any.length&&!any.some(t=>ZR.Utils.containsTerm(blob,t)))return false;if(all.length&&!all.every(t=>ZR.Utils.containsTerm(blob,t)))return false;return !!(any.length||all.length);}
  function subscriptionsFor(paper){const rows=ZR.ScorecardManager.activeSubscriptions(),sourceIDs=new Set((paper.source_records||[]).map(r=>String(r.id||'')).filter(Boolean));const eligible=rows.filter(x=>{const ids=Array.isArray(x.feed_ids)?x.feed_ids.map(String):[];return !ids.length||ids.some(id=>sourceIDs.has(id));}),hits=eligible.filter(x=>matchesSubscription(paper,x));if(hits.length)return hits;const d=eligible.find(x=>x.default);return d?[d]:[];}
  function errorSummary(e){return String(e?.message||e).replace(/https?:\/\/[^\s"'<>]+/g,'[URL]').replace(/(?:[A-Z]:[\\/]|file:\/\/\/)[^\s"'<>]+/gi,'[path]').slice(0,240);}
  async function fetchAll(feedIDs=null){const wanted=feedIDs?new Set((feedIDs||[]).map(String)):null;const feeds=(ZR.Config.feeds.feeds||[]).filter(f=>f.enabled!==false&&f.url&&!String(f.url).startsWith('TODO_')&&(!wanted||wanted.has(String(f.id)))),out=[],feed_errors=[];for(const f of feeds){try{const rows=await fetchFeed(f);out.push(...rows);await ZR.DB.updateFeedState(f.id,rows.length,null);}catch(e){feed_errors.push({id:f.id,message:errorSummary(e)});await ZR.DB.updateFeedState(f.id,0,String(e));Zotero.logError(e);}}return{papers:dedupe(out),fetched:out.length,errors:feed_errors.length,feed_errors,feed_ids:feeds.map(f=>f.id)};}
  ZR.Feeds={getText,parseRSS,parseJSONFeed,feedMode,fetchEuropePMC,fetchFeed,dedupe,completeFromEPMC,matchesSubscription,subscriptionsFor,fetchAll};
})(ZR);
