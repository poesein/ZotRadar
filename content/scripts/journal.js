(function (ZR) {
  'use strict';
  const PREPRINTS=['biorxiv','medrxiv','research square','preprints.org','ssrn','arxiv','chemrxiv','osf preprints','peerj preprints','authorea','researchsquare'];
  function normalizeJournal(name){let v=String(name||'').replace(/\s+/g,' ').trim();v=v.replace(/\s*[:\-–]\s*(?:official journal of|an official journal of|journal of the|the official|a journal of|including .*|international edition).*$/i,'').replace(/\s*:\s*journal of\b.*$/i,'').replace(/\s*:\s*[A-Za-z][A-Za-z&.\-]{1,9}$/,'').replace(/\s*=.*$/,'').replace(/\.\s+/g,' ').replace(/([a-z])\.([A-Z])/g,'$1 $2').replace(/[ .;,]+$/,'');return v.toLowerCase();}
  function isPreprint(j){const k=normalizeJournal(j);return PREPRINTS.some(x=>k.includes(x));}
  function preprintSource(paper={}){
    const journal=String(paper.journal||'').trim();
    if(journal&&!isPreprint(journal))return null;
    const records=Array.isArray(paper.source_records)?paper.source_records:[];
    const evidence=[journal,paper.url||'',...records.flatMap(r=>[r?.name||'',r?.url||''])].join(' ');
    if(/\bmedrxiv(?:\.org)?\b/i.test(evidence))return 'medRxiv';
    if(/\bbiorxiv(?:\.org)?\b/i.test(evidence))return 'bioRxiv';
    if(/\bresearch\s*square\b|researchsquare\.com/i.test(evidence))return 'Research Square';
    if(/preprints\.org/i.test(evidence))return 'Preprints.org';
    if(/\bauthorea\b/i.test(evidence))return 'Authorea';
    const doi=String(paper.doi||'').toLowerCase().replace(/^https?:\/\/(?:dx\.)?doi\.org\//,'');
    const rxiv=doi.match(/^10\.(?:64898|1101)\/\d{4}\.\d{2}\.\d{2}\.(\d{6}|\d{8})(?:v\d+)?$/);
    if(rxiv)return rxiv[1].length===8?'medRxiv':'bioRxiv';
    if(/^10\.21203\/rs\./.test(doi))return 'Research Square';
    if(/^10\.20944\/preprints/i.test(doi))return 'Preprints.org';
    if(/^10\.22541\//.test(doi))return 'Authorea';
    if(isPreprint(journal)||/preprint|预印本/i.test(evidence)||/^10\.(?:64898|1101|31234|32388|32942)\//.test(doi))return 'Preprint';
    return null;
  }
  function tierScore(tier,isTop=false){if(!tier)return null;const t=String(tier);let s=null;if(/1\s*区|一\s*区/.test(t))s=1;else if(/2\s*区|二\s*区/.test(t))s=.75;else if(/3\s*区|三\s*区/.test(t))s=.45;else if(/4\s*区|四\s*区/.test(t))s=.2;return s==null?null:Math.min(1,s+(isTop?.05:0));}
  function ifScore(v){if(v==null||String(v).trim()==='')return null;const x=Number(v);if(!Number.isFinite(x))return null;if(x<=1)return 0;return Math.max(0,Math.min(1,Math.log10(x)/1.75));}
  function parseEasy(data){const official=data&&data.officialRank||{};const ranks={};for(const item of data?.customRank?.rank||[])if(item&&typeof item==='object')Object.assign(ranks,item);for(const branch of ['select','all'])if(official[branch]&&typeof official[branch]==='object')for(const [key,value] of Object.entries(official[branch]))if(value!==undefined&&value!==null&&value!=='')ranks[key]=value;const pick=(...names)=>{for(const n of names){const v=ranks[n];if(v!==undefined&&v!==null&&v!=='')return String(v).trim();}return null;};let impact=null;for(const k of ['sciif','sciif5','impactFactor']){const raw=pick(k);if(raw===null)continue;const v=Number(raw);if(Number.isFinite(v)){impact=v;break;}}return{cas_tier:pick('sciUp','sciUpSmall','sciBase'),cas_top:!!pick('sciUpTop'),impact_factor:impact,jcr:pick('sci'),jci:pick('jci'),source:'easyscholar'};}
  function lookupNames(name){const original=String(name||'').replace(/\s+/g,' ').trim(),names=[original];const add=value=>{const candidate=String(value||'').replace(/\s+/g,' ').replace(/[\s.;:,]+$/,'').trim();if(candidate&&!names.some(x=>x.toLowerCase()===candidate.toLowerCase()))names.push(candidate)};add(original.replace(/\s*:\s*(?:official journal|an official journal|journal of|a journal|the official|[A-Za-z][A-Za-z&.\-]{1,9}$).*$/i,''));add(original.replace(/\s*\([^)]*\)\s*/g,' '));add(original.replace(/^the\s+/i,''));add(original.replace(/\.(?=\s+[A-Z])/g,' '));if(/^angewandte chemie\s*\(international ed/i.test(original))add('Angewandte Chemie International Edition');return names.slice(0,5)}
  async function easyScholarRequest(journal,keyOverride=null){const key=String(keyOverride==null?ZR.Utils.getPref('easyScholarKey',''):keyOverride).trim();if(!key)return{ok:false,error:'easyScholar key is not configured'};const url='https://www.easyscholar.cc/open/getPublicationRank?secretKey='+encodeURIComponent(key)+'&publicationName='+encodeURIComponent(journal);try{const x=await Zotero.HTTP.request('GET',url,{responseType:'text',timeout:20000});const p=JSON.parse(x.responseText||'{}');if(Number(p.code)!==200)return{ok:false,error:String(p.msg||p.message||('API code '+p.code)),raw:p};const r=parseEasy(p.data||{});return{ok:true,result:r,raw:p};}catch(e){ZR.Utils.log('easyScholar failed',e);return{ok:false,error:String(e&&e.message||e)};}}
  async function easyScholar(journal){const r=await easyScholarRequest(journal);if(!r.ok)return null;const info=r.result;return info.cas_tier==null&&info.impact_factor==null?null:info;}
  async function testEasyScholar(){const key=String(ZR.Utils.getPref('easyScholarKey','')).trim();if(!key)return{ok:false,error:'easyScholar key is not configured'};const journal='Nature';const r=await easyScholarRequest(journal,key);if(!r.ok)return r;return{ok:true,journal,result:r.result};}
  async function openAlex(journal){try{const url='https://api.openalex.org/sources?search='+encodeURIComponent(journal)+'&per-page=1';const x=await Zotero.HTTP.request('GET',url,{responseType:'text',timeout:20000});const p=JSON.parse(x.responseText||'{}'),s=(p.results||[])[0];if(!s)return null;const works=Number(s.works_count||0),cited=Number(s.cited_by_count||0),h=Number((s.summary_stats||{}).h_index||0);return{per_work:works?cited/works:0,h_index:h,is_repository:String(s.type||'').toLowerCase()==='repository',matched_name:s.display_name||'',source:'openalex'};}catch(e){return null;}}
  function proxyScore(p){if(!p)return null;if(p.is_repository)return .25;if(p.h_index>=500&&p.per_work>=50)return 1;if(p.h_index>=300&&p.per_work>=25)return .75;if(p.h_index>=120&&p.per_work>=10)return .45;if(p.h_index>=40)return .2;return null;}
  async function score(journal){const cfg=ZR.Config.scoring.journal||{},neutral=Number(cfg.neutral_score??50)/100,weights=cfg.weights||{cas_quality:.6,impact_factor:.4};const name=String(journal||''),nk=normalizeJournal(name);if(!nk)return{score:50,source:'no journal'};const cached=await ZR.DB.getJournalMetric(nk);if(cached){
      // Display metrics can arrive after the original screening. Reuse verified
      // easyScholar data when re-screening instead of pinning an old proxy or
      // unknown journal score forever.
      if(cached.source!=='easyscholar'&&cached.source!=='preprint'){
        const metric=await displayMetric(name);
        if(metric?.source==='easyscholar'){
          const cas=tierScore(metric.cas_tier,metric.cas_top),ifs=ifScore(metric.impact_factor);
          const blended=(cas==null?neutral:cas)*Number(weights.cas_quality??.6)+(ifs==null?neutral:ifs)*Number(weights.impact_factor??.4);
          const upgraded={...cached,impact_factor:metric.impact_factor,cas_tier:metric.cas_tier,cas_score:cas,if_score:ifs,source:'easyscholar',journal_score:Math.round(blended*10000)/100,jcr:metric.jcr,jci:metric.jci,cas_top:metric.cas_top};
          await ZR.DB.saveJournalMetric(upgraded);return{...upgraded,score:upgraded.journal_score};
        }
      }
      return{...cached,score:Number(cached.journal_score)};
    }if(isPreprint(name)){await ZR.DB.saveJournalMetric({name_key:nk,journal:name,journal_score:50,source:'preprint'});return{score:50,source:'preprint',is_preprint:true};}let info=await easyScholar(name),cas=null,ifs=null,source='';if(info){cas=tierScore(info.cas_tier,info.cas_top);ifs=ifScore(info.impact_factor);source='easyscholar';}else{const oa=await openAlex(name);if(oa&&oa.is_repository){await ZR.DB.saveJournalMetric({name_key:nk,journal:name,journal_score:50,source:'preprint'});return{score:50,source:'preprint',is_preprint:true};}cas=proxyScore(oa);source=oa?'openalex-proxy':'unknown';}
    const blended=(cas==null?neutral:cas)*Number(weights.cas_quality??.6)+(ifs==null?neutral:ifs)*Number(weights.impact_factor??.4);const score100=Math.round(blended*10000)/100;const rec={name_key:nk,journal:name,impact_factor:info&&info.impact_factor,cas_tier:info&&info.cas_tier,cas_score:cas,if_score:ifs,source,journal_score:score100,jcr:info&&info.jcr,jci:info&&info.jci,cas_top:info&&info.cas_top};await ZR.DB.saveJournalMetric(rec);return{...rec,score:score100};}
  const displayPending=new Map();
  async function displayMetric(name){const key=normalizeJournal(name);if(!key||isPreprint(name))return null;const scored=await ZR.DB.getJournalMetric(key),impact=Number(scored?.impact_factor);if(scored?.source==='easyscholar'&&((Number.isFinite(impact)&&impact>0)||scored.cas_tier))return{impact_factor:Number.isFinite(impact)&&impact>0?impact:null,cas_tier:scored.cas_tier,source:'easyscholar'};const raw=await ZR.DB.getMeta('journal-display:'+key);if(!raw)return null;const cached=ZR.Utils.safeJSON(raw,null);return cached?.metric||null;}
  async function ensureDisplayMetric(name){const key=normalizeJournal(name);if(!key||isPreprint(name)||!ZR.Utils.getPref('easyScholarKey',''))return null;const existing=await displayMetric(name);if(existing)return existing;const raw=await ZR.DB.getMeta('journal-display:'+key),cached=ZR.Utils.safeJSON(raw,null);if(cached&&(cached.metric||cached.lookupVersion===2)&&Date.now()-Number(cached.checkedAt||0)<(cached.metric?24:1)*3600*1000)return cached.metric||null;if(displayPending.has(key))return displayPending.get(key);const task=(async()=>{let metric=null,failed=false;for(const candidate of lookupNames(name)){const response=await easyScholarRequest(candidate);if(!response.ok){failed=true;break}if(response.result.impact_factor!=null||response.result.cas_tier){metric=response.result;break}}if(metric||!failed)await ZR.DB.setMeta('journal-display:'+key,JSON.stringify({checkedAt:Date.now(),lookupVersion:2,metric}));if(metric)ZR.Events?.emit('journals:display-changed',{key,metric});return metric})().finally(()=>displayPending.delete(key));displayPending.set(key,task);return task;}
  ZR.Journal={normalizeJournal,isPreprint,preprintSource,tierScore,ifScore,score,testEasyScholar,parseEasy,lookupNames,displayMetric,ensureDisplayMetric};
})(ZR);
