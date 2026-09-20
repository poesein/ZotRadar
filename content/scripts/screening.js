(function (ZR) {
  'use strict';

  function itemToPaper(item) {
    const extra=item.getField('extra')||'', ids=ZR.Utils.extractIDs(extra), creators=item.getCreators ? item.getCreators() : [];
    return {
      zotero_library_id:item.libraryID,
      zotero_key:item.key,
      title:item.getField('title')||'Untitled',
      abstract:item.getField('abstractNote')||'',
      authors:creators.map(c=>[c.firstName,c.lastName].filter(Boolean).join(' ')||c.name).filter(Boolean),
      published:ZR.Utils.parseDateLoose(item.getField('date')),
      doi:ZR.Utils.normalizeDOI(item.getField('DOI')),
      pmid:ids.pmid, pmcid:ids.pmcid,
      url:item.getField('url')||'',
      journal:item.getField('publicationTitle')||item.getField('proceedingsTitle')||'',
      citation_count:0,
      source_type:'zotero',source_name:'Zotero library',source_records:[{type:'zotero',name:'Zotero library',url:''}]
    };
  }

  function cacheKey(paper,card,model){return ZR.Utils.hashString([paper.title,paper.abstract,ZR.Scorecards.hash(card.id),ZR.Ollama.PROMPT_VERSION,model].join('|'));}
  function staleModelContract(latest,card){return latest.prompt_contract_version!==ZR.Ollama.PROMPT_VERSION||latest.scorecard_hash!==ZR.Scorecards.hash(card.id);}
  function applyOverride(j,fb){if(!fb||!fb.corrected_scope)return{judgement:j,overridden:false};const out={...j,scope:fb.corrected_scope,strength:fb.corrected_strength||null,transferable_topic:fb.corrected_scope==='TRANSFERABLE'?(fb.corrected_transferable_topic||j.transferable_topic||null):null,reason:fb.note||'User-corrected relevance judgement.'};if(['OUT_OF_SCOPE','UNCERTAIN'].includes(out.scope))out.strength=null;return{judgement:out,overridden:true};}
  function isCorrectionOrRetraction(paper){
    const title=String(paper.title||'').trim();
    if(/^(?:(?:author|publisher|editorial)\s+)?(?:correction|corrigendum|erratum|retraction(?:\s+note)?|retracted(?:\s+article)?|expression\s+of\s+concern|withdrawal|withdrawn)\s*[:：\-–—.]/i.test(title))return true;
    if(/^(?:retraction\s+of|correction\s+to|corrigendum\s+to|erratum\s+(?:in|for|to)|withdrawal\s+of)\b/i.test(title))return true;
    if(/^(?:作者|出版者|期刊)?(?:更正|勘误|撤稿|撤回|关注声明)\s*[:：\-–—]?/.test(title))return true;
    return(paper.publication_types||[]).some(type=>/^(?:published\s+erratum|retraction\s+of\s+publication|expression\s+of\s+concern|corrigendum|withdrawn\s+publication)$/i.test(String(type).trim()));
  }
  async function isInZotero(paper){
    if(!Zotero.Search||!Zotero.Items?.get)throw new Error('Zotero search API unavailable');
    const doi=ZR.Utils.normalizeDOI(paper.doi),pmid=String(paper.pmid||'').trim(),title=ZR.DB.titleNorm(paper.title);
    const queries=[];if(doi)queries.push(['DOI','is',doi]);if(pmid)queries.push(['extra','contains','PMID: '+pmid]);if(title&&title!=='untitled')queries.push(['title','is',paper.title]);
    for(const [field,operator,value] of queries){
      const search=new Zotero.Search();search.addCondition(field,operator,value);
      for(const id of await search.search()||[]){
        const item=Zotero.Items.get(id);if(!item||!item.isRegularItem?.())continue;
        if(Zotero.Libraries?.get?.(item.libraryID)?.libraryType==='feed')continue;
        if(doi&&ZR.Utils.normalizeDOI(item.getField('DOI'))===doi)return true;
        if(pmid&&String(ZR.Utils.extractIDs(item.getField('extra')||'').pmid||'')===pmid)return true;
        if(title&&ZR.DB.titleNorm(item.getField('title'))===title)return true;
      }
    }
    return false;
  }

  async function screenPaper(paper,subscription,{runID='manual',forceModel=false,requireModel=false}={}){
    if(isCorrectionOrRetraction(paper))throw new Error('Correction/retraction notice excluded: '+String(paper.title||'').slice(0,160));
    const card=ZR.Scorecards.get(subscription.scorecard),paperID=await ZR.DB.upsertPaper(paper),ev=ZR.Evidence.collect(paper,card),modelPref=String(ZR.Utils.getPref('screeningModel','qwen3:8b'));let judgement,raw=null,model=modelPref;
    const key=cacheKey(paper,card,modelPref),cached=forceModel?null:await ZR.DB.getCache(key);
    if(cached){judgement=cached.judgement;raw=cached.raw_model_json;model=cached.model;}
    else{
      try{const r=await ZR.Ollama.screen(paper,card,ev);judgement=r.judgement;raw=r.raw;model=r.model;await ZR.DB.saveCache(key,card.id,judgement,ev,raw,model,ZR.Ollama.PROMPT_VERSION);}
      catch(e){if(requireModel)throw e;const provisional=ZR.Evidence.heuristic(paper,card,ev);judgement={...provisional,scope:'UNCERTAIN',strength:null,transferable_topic:null,reason:'Model screening unavailable; deterministic term matches alone cannot establish relevance or grade.',uncertainty:String(e&&e.message||e).slice(0,300)};model='heuristic-v5-fallback';ZR.Utils.log('screen fallback',paper.title,e);}
    }
    const modelJudgement=JSON.parse(JSON.stringify(judgement));
    const fb=await ZR.DB.latestFeedback(paperID,card.id),ov=applyOverride(judgement,fb);judgement=ov.judgement;
    let feedbackAdjustment=0,profileVersion=null,feedbackDetails={};
    if(!ov.overridden&&judgement.scope!=='UNCERTAIN'){
      try{const fr=await ZR.Feedback.adjustment({paperID,title:paper.title,abstract:paper.abstract,scorecardID:card.id,judgement});feedbackAdjustment=fr.adjustment;profileVersion=fr.version;feedbackDetails=fr.details;}
      catch(e){feedbackDetails={reason:'feedback unavailable',error:String(e)};}
    }
    const jinfo=await ZR.Journal.score(paper.journal||''),journalScore=Number(jinfo.score??50),scores=ZR.Scoring.score(judgement,{feedbackAdjustment,baselineJudgement:ov.overridden?modelJudgement:null,journalScore,isPreprint:jinfo.is_preprint===true||jinfo.source==='preprint'||ZR.Journal.isPreprint(paper.journal||''),cfg:ZR.Scoring.forCard(card)});
    const result={paper_id:paperID,subscription_id:subscription.id,scorecard_id:card.id,scorecard_version:card.version,scorecard_hash:ZR.Scorecards.hash(card.id),judgement,model_judgement:modelJudgement,rule_evidence:ev,scores,model,prompt_contract_version:ZR.Ollama.PROMPT_VERSION,scoring_policy_version:ZR.Scoring.POLICY,preference_profile_version:profileVersion,embedding_model_version:null,raw_model_json:raw,feedback_details:feedbackDetails,user_overridden:ov.overridden,created_at:ZR.Utils.nowISO()};
    const sid=await ZR.DB.saveScreening(runID,result);
    ZR.Services?.Papers?.queueTitleTranslations?.([{paper_id:paperID,title:paper.title}],{priority:true});
    if(paper.zotero_library_id!=null&&paper.zotero_key)ZR.DB.updateItemCache(paper.zotero_library_id,paper.zotero_key,{paper_id:paperID,screening_id:sid,reading_priority:scores.reading_priority,grade:scores.grade,scope:judgement.scope,strength:judgement.strength,topics:judgement.topics||[],scorecard_id:card.id});
    return result;
  }

  async function screenZoteroItems(items,scorecardID=null){const defaultSubID=String(ZR.Utils.getPref('defaultSubscription','protein_design'));const defaultSub=(ZR.Config.subscriptions.subscriptions||[]).find(x=>x.id===defaultSubID&&x.enabled!==false);const scID=scorecardID||(defaultSub?defaultSub.scorecard:String(ZR.Utils.getPref('defaultScorecard','protein_design'))),sub={id:defaultSub?defaultSub.id:'zotero-manual',scorecard:scID};const runID=await ZR.DB.startRun('zotero-manual');let n=0,errors=0;for(const item of items||[]){if(!item||!item.isRegularItem||!item.isRegularItem())continue;try{const p=itemToPaper(item),full=await ZR.Feeds.completeFromEPMC(p);await screenPaper(full,sub,{runID});n++;}catch(e){errors++;Zotero.logError(e);}}await ZR.DB.finishRun(runID,{fetched:n,papers:n,screenings:n,errors});await ZR.DB.loadItemCache();ZR.UI&&ZR.UI.refreshColumns();return{screened:n,errors};}

  async function runFeeds(subscriptionID=null){
    if(ZR.State.runInProgress)return{ok:false,error:'run already in progress'};
    ZR.State.runInProgress=true;
    let runID=null;
    const stats={fetched:0,papers:0,screenings:0,errors:0,filtered_correction:0,filtered_existing:0,filtered_zotero:0,subscription_id:null};
    try{
      const selected=subscriptionID?ZR.ScorecardManager.subscription(subscriptionID):null;
      stats.subscription_id=selected?selected.id:null;
      runID=await ZR.DB.startRun(selected?`feeds:${selected.id}`:'feeds');
      const allFeedIDs=selected?selected.feed_ids:[...new Set(ZR.ScorecardManager.activeSubscriptions().flatMap(s=>s.feed_ids||[]))];
      const fr=await ZR.Feeds.fetchAll(allFeedIDs);
      stats.fetched=fr.fetched;stats.errors+=fr.errors;
      for(let p of fr.papers){
        try{
          if(isCorrectionOrRetraction(p)){stats.filtered_correction++;continue}
          p=await ZR.Feeds.completeFromEPMC(p);
          if(isCorrectionOrRetraction(p)){stats.filtered_correction++;continue}
          if(await ZR.DB.findExistingPaper(p)){stats.filtered_existing++;continue}
          if(await isInZotero(p)){stats.filtered_zotero++;continue}
        }catch(e){stats.errors++;Zotero.logError(e);continue}
        stats.papers++;
        const targets=selected?(ZR.Feeds.matchesSubscription(p,selected)?[selected]:[]):ZR.Feeds.subscriptionsFor(p);
        for(const sub of targets){try{await screenPaper(p,sub,{runID});stats.screenings++}catch(e){stats.errors++;Zotero.logError(e)}}
      }
      await ZR.DB.finishRun(runID,stats);
      ZR.Utils.setPref('lastDailyRun',ZR.Utils.nowISO());
      return{ok:true,run_id:runID,...stats,feed_ids:fr.feed_ids||[]};
    }catch(e){
      stats.errors++;
      if(runID){try{await ZR.DB.finishRun(runID,stats,String(e))}catch(logError){Zotero.logError(logError)}}
      throw e;
    }finally{ZR.State.runInProgress=false}
  }

  async function rescorePaper(paperID,scorecardID){
    const latestRows=await ZR.DB.latestPaperScorecardScreenings(paperID,scorecardID);
    if(!latestRows.length)return null;
    const p=await ZR.DB.getPaper(paperID),card=ZR.Scorecards.get(scorecardID),fb=await ZR.DB.latestFeedback(paperID,scorecardID);
    const runID='rescore-'+ZR.Utils.randomToken(24),results=[];
    for(const latest of latestRows){
      const stale=staleModelContract(latest,card),explicitOverride=!!(fb&&fb.corrected_scope);
      if(stale&&!explicitOverride&&!latest.user_overridden)continue;
      const modelJ=latest.model_judgement||latest.judgement||ZR.Utils.safeJSON(latest.model_judgement_json)||ZR.Utils.safeJSON(latest.judgement_json);
      const safeModelJ=stale?{...modelJ,scope:'UNCERTAIN',strength:null,transferable_topic:null,reason:'Screening used an older model contract or scorecard; run model screening again.'}:latest.model==='heuristic-v5-fallback'?{...modelJ,scope:'UNCERTAIN',strength:null,transferable_topic:null,reason:'Model screening unavailable; deterministic term matches alone cannot establish relevance or grade.'}:modelJ;
      const ov=applyOverride(safeModelJ,fb),j=ov.judgement;
      let feedbackAdjustment=0,profileVersion=null,feedbackDetails={};
      if(!ov.overridden&&j.scope!=='UNCERTAIN'){
        try{const fr=await ZR.Feedback.adjustment({paperID,title:p.title,abstract:p.abstract,scorecardID,judgement:j});feedbackAdjustment=fr.adjustment;profileVersion=fr.version;feedbackDetails=fr.details}
        catch(e){feedbackDetails={reason:'feedback unavailable',error:String(e)}}
      }
      const jinfo=await ZR.Journal.score(p.journal||'');
      const scores=ZR.Scoring.score(j,{feedbackAdjustment,baselineJudgement:ov.overridden?modelJ:null,journalScore:jinfo?.score??latest.journal_score,isPreprint:jinfo?.is_preprint===true||jinfo?.source==='preprint'||ZR.Journal.isPreprint(p.journal||''),cfg:ZR.Scoring.forCard(card)});
      const result={paper_id:paperID,subscription_id:latest.subscription_id,scorecard_id:scorecardID,scorecard_version:card.version,scorecard_hash:ZR.Scorecards.hash(card.id),judgement:j,model_judgement:modelJ,rule_evidence:latest.rule_evidence||ZR.Utils.safeJSON(latest.rule_evidence_json,{}),scores,model:latest.model,prompt_contract_version:latest.prompt_contract_version,scoring_policy_version:ZR.Scoring.POLICY,preference_profile_version:profileVersion,embedding_model_version:null,raw_model_json:latest.raw_model_json,feedback_details:feedbackDetails,user_overridden:ov.overridden,created_at:ZR.Utils.nowISO()};
      await ZR.DB.saveScreening(runID,result);results.push(result);
    }
    return results[0]||null;
  }
  async function rescoreScorecard(scorecardID){const rows=await ZR.DB.latestScreenings(scorecardID,100000),seen=new Set();let n=0;for(const r of rows){if(seen.has(r.paper_id))continue;seen.add(r.paper_id);if(await rescorePaper(Number(r.paper_id),scorecardID))n++;}await ZR.DB.loadItemCache();ZR.UI&&ZR.UI.refreshColumns();return n;}

  async function importPaperToZotero(paperID){const p=await ZR.DB.getPaper(paperID);if(!p)throw new Error('paper not found');if(p.zotero_key){const item=Zotero.Items.getByLibraryAndKey(p.zotero_library_id,p.zotero_key);if(item)return item;}if(p.doi){const s=new Zotero.Search();s.libraryID=Zotero.Libraries.userLibraryID;s.addCondition('DOI','is',p.doi);const ids=await s.search();if(ids.length){const item=Zotero.Items.get(ids[0]);await ZR.DB.upsertPaper({...p,zotero_library_id:item.libraryID,zotero_key:item.key});await ZR.DB.loadItemCache();ZR.UI&&ZR.UI.refreshColumns();return item;}}
    const item=new Zotero.Item('journalArticle');item.libraryID=Zotero.Libraries.userLibraryID;item.setField('title',p.title);if(p.abstract)item.setField('abstractNote',p.abstract);if(p.doi)item.setField('DOI',p.doi);if(p.url)item.setField('url',p.url);if(p.journal)item.setField('publicationTitle',p.journal);if(p.published)item.setField('date',p.published);if(p.pmid||p.pmcid){let extra='';if(p.pmid)extra+=`PMID: ${p.pmid}\n`;if(p.pmcid)extra+=`PMCID: ${p.pmcid}`;item.setField('extra',extra.trim());}item.setCreators((p.authors||[]).map(author=>{if(typeof author==='string')return{creatorType:'author',name:author};if(author?.firstName||author?.lastName)return{creatorType:'author',firstName:String(author.firstName||''),lastName:String(author.lastName||'')};return{creatorType:'author',name:String(author?.name||author?.fullName||'')}}).filter(author=>author.name||author.firstName||author.lastName));const id=await item.saveTx();const saved=Zotero.Items.get(id);await ZR.DB.upsertPaper({...p,zotero_library_id:saved.libraryID,zotero_key:saved.key});await ZR.DB.loadItemCache();ZR.UI&&ZR.UI.refreshColumns();return saved;}

  ZR.Screening={itemToPaper,cacheKey,staleModelContract,applyOverride,isCorrectionOrRetraction,isInZotero,screenPaper,screenZoteroItems,runFeeds,rescorePaper,rescoreScorecard,importPaperToZotero};
})(ZR);
