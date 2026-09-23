(function(ZR){'use strict';
 function shape(r){const j=ZR.Utils.safeJSON(r.judgement_json,{}),mj=ZR.Utils.safeJSON(r.model_judgement_json,j),topics=ZR.Utils.safeJSON(r.topics_json,[]);return{screening_id:Number(r.id),paper_id:Number(r.paper_id),subscription_id:r.subscription_id,title:ZR.Utils.stripMarkup(r.title)||'Untitled',abstract:r.abstract,authors:ZR.Utils.safeJSON(r.authors_json,[]),published:r.published||'',doi:r.doi||'',pmid:r.pmid||'',pmcid:r.pmcid||'',url:r.url||'',journal:r.journal||'',citations:Number(r.citation_count||0),zotero_library_id:r.zotero_library_id,zotero_key:r.zotero_key,read:r.read_state==='1',scorecard_id:r.scorecard_id,scope:r.scope,strength:r.strength,topics:Array.isArray(topics)?topics:[],transferable_topic:r.transferable_topic,reason:j.reason||'',positive_evidence:Array.isArray(j.positive_evidence)?j.positive_evidence:[],negative_evidence:Array.isArray(j.negative_evidence)?j.negative_evidence:[],uncertainty:j.uncertainty||null,base_relevance:r.base_relevance,feedback_adjustment:r.feedback_adjustment,personalized_relevance:r.personalized_relevance,journal_score:r.journal_score,journal_adjustment:r.journal_adjustment,reading_priority:r.reading_priority,grade:r.grade,user_overridden:!!r.user_overridden,model_judgement:mj};}
 async function cachedTitle(p){const raw=await ZR.DB.getMeta('title-zh:'+p.paper_id),saved=ZR.Utils.safeJSON(raw,null);return saved?.source_title===p.title?String(saved.title_zh||''):'';}
 const translationPending=new Set(),translationFailed=new Map(),translationQueue=[];let translationWorking=false;
 async function processTitleTranslations(){
   if(translationWorking)return;
   translationWorking=true;
   try{while(translationQueue.length){
     const p=translationQueue.shift(),key=p.paper_id+':'+p.title;
     try{
       const current=await cachedTitle(p);if(current)continue;
        const model=ZR.Ollama.modelID();
        const resp=await ZR.Ollama.chat([{role:'system',content:'Translate this scientific paper title into concise Simplified Chinese. Preserve gene names, proteins, mutations, numbers, Greek letters and method names exactly. Do not add facts. Return JSON only.'},{role:'user',content:p.title}],{type:'object',required:['title_zh'],properties:{title_zh:{type:'string'}}},{maxTokens:256});
        const raw=String(resp?.content||'').trim(),parsed=ZR.Utils.safeJSON(raw,null);
       const title=String(parsed?.title_zh||(!raw.startsWith('{')&&!raw.startsWith('<think>')?raw:'' )).trim();
       if(!title||title.length>600)throw new Error('Invalid title translation');
       await ZR.DB.setMeta('title-zh:'+p.paper_id,JSON.stringify({source_title:p.title,title_zh:title,model}));
       translationFailed.delete(key);ZR.Events?.emit('papers:title-translated',{paperID:p.paper_id,source_title:p.title,title_zh:title});
     }catch(e){translationFailed.set(key,Date.now());ZR.Utils.log('Title translation failed',e);ZR.Events?.emit('papers:title-translation-failed',{paperID:p.paper_id,source_title:p.title})}
     finally{translationPending.delete(key)}
   }}finally{translationWorking=false}
 }
 function queueTitleTranslations(rows,{priority=false}={}){
   const fresh=[];
   for(const p of rows||[]){
     const key=p.paper_id+':'+p.title;
     if(!p.title||p.title_zh||translationPending.has(key)||Date.now()-(translationFailed.get(key)||0)<600000)continue;
     translationPending.add(key);fresh.push({paper_id:p.paper_id,title:p.title});
   }
   if(priority)translationQueue.unshift(...fresh);else translationQueue.push(...fresh);
   if(fresh.length)processTitleTranslations().catch(e=>ZR.Utils.log('Title translation queue failed',e));
 }
 async function waitForTitleTranslations(rows,shouldContinue=()=>true){
   const unique=[...new Map((rows||[]).filter(p=>p.paper_id&&p.title).map(p=>[p.paper_id+':'+p.title,p])).values()];
   queueTitleTranslations(unique);
   while(shouldContinue()&&unique.some(p=>translationPending.has(p.paper_id+':'+p.title)))await new Promise(resolve=>setTimeout(resolve,300));
   let translated=0;
   for(const p of unique)if(await cachedTitle(p))translated++;
   return{total:unique.length,translated,failed:unique.length-translated};
 }
 async function backfillTitleTranslations(){const rows=await ZR.DB.all('SELECT p.id paper_id,p.title FROM papers p WHERE EXISTS (SELECT 1 FROM screenings s WHERE s.paper_id=p.id) ORDER BY p.id');queueTitleTranslations(rows.map(r=>({paper_id:r.paper_id,title:r.title})));return rows.length;}
 const journalPending=new Set();let journalTail=Promise.resolve();
 function queueJournalMetrics(rows){if(!ZR.Settings.get('easyScholarKey'))return;for(const p of rows){const key=ZR.Journal.normalizeJournal(p.journal);if(!key||p.is_preprint||p.journal_metric||journalPending.has(key)||ZR.Journal.isPreprint(p.journal))continue;journalPending.add(key);journalTail=journalTail.then(()=>ZR.Journal.ensureDisplayMetric(p.journal)).catch(e=>ZR.Utils.log('Journal display metric failed',e)).finally(()=>journalPending.delete(key));}}
 function authorText(author){if(typeof author==='string')return author;return String(author?.name||author?.fullName||[author?.firstName,author?.lastName].filter(Boolean).join(' ')||'');}
 function authorKey(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z\s]/g,' ').replace(/\s+/g,' ').trim();}
 function priorityAuthorMatches(author,raw){const name=authorKey(author),parts=name.split(' ');if(!name)return false;return String(raw||'').split(/[,;\n]+/).some(entry=>{const target=authorKey(entry),p=target.split(' ');if(!target||p.length<2)return false;if(name===target)return true;const surname=p[p.length-1],initial=p[0][0];return parts.includes(surname)&&parts.some(x=>x!==surname&&x[0]===initial)})}
 const importPresenceCache=new Map();
 async function isImported(r){
   const key=String(r.paper_id)+':'+String(r.zotero_library_id||'')+':'+String(r.zotero_key||'');
   const cached=importPresenceCache.get(key);
   if(cached?.pending)return cached.pending;
   if(cached&&Date.now()-cached.at<(cached.value?60000:10000))return cached.value;
   const pending=(async()=>{
     let found=false;
     if(r.zotero_key&&r.zotero_library_id!=null)found=!Zotero?.Items?.getByLibraryAndKey||!!Zotero.Items.getByLibraryAndKey(r.zotero_library_id,r.zotero_key);
     if(!found&&ZR.Screening?.isInZotero){try{found=await ZR.Screening.isInZotero(r)}catch(e){ZR.Utils.log('Zotero import status lookup failed',e)}}
     return found;
   })();
   importPresenceCache.set(key,{pending});
   try{const found=await pending;if(importPresenceCache.get(key)?.pending===pending)importPresenceCache.set(key,{value:found,at:Date.now()});return found}
   catch(e){if(importPresenceCache.get(key)?.pending===pending)importPresenceCache.delete(key);throw e}
 }
 async function journals(subscriptionID){const rows=await ZR.DB.all(`SELECT DISTINCT p.journal FROM screenings s JOIN papers p ON p.id=s.paper_id WHERE s.subscription_id=? AND p.journal<>'' ORDER BY p.journal COLLATE NOCASE`,[String(subscriptionID)]);return rows.map(r=>String(r.journal));}
 async function list(opts={}){
   const sid=String(opts.subscriptionID||'');if(!sid)throw new Error('subscriptionID required');
   const sub=(ZR.Config.subscriptions.subscriptions||[]).find(x=>x.id===sid);
   // A disabled (or removed) direction must never fall through to another scorecard.
   if(!sub||sub.enabled===false)return{rows:[],total:0,grade_counts:{A:0,B:0,C:0,D:0,other:0},offset:0,limit:0};
   const all=opts.all===true;
   let rows=(await ZR.DB.latestSubscriptionScreenings(sid,all?2147483647:Number(opts.limit||10000))).filter(r=>r.scorecard_id===sub.scorecard).map(r=>{const p=shape(r);p.preprint_source=ZR.Journal.preprintSource?.({...p,source_records:ZR.Utils.safeJSON(r.source_records_json,[])})||null;p.is_preprint=!!p.preprint_source;return p}).filter(p=>!ZR.Screening.isCorrectionOrRetraction(p));
   const q=String(opts.search||'').toLowerCase().trim();
   if(q)rows=rows.filter(r=>[r.title,r.abstract,r.journal,r.preprint_source,r.doi,(r.authors||[]).map(authorText).join(' ')].join(' ').toLowerCase().includes(q));
   if(opts.grade)rows=rows.filter(r=>opts.grade==='UNRATED'?!['A','B','C','D'].includes(String(r.grade||'').toUpperCase()):r.grade===opts.grade);
   if(opts.scope)rows=rows.filter(r=>r.scope===opts.scope);
   if(opts.journal)rows=rows.filter(r=>r.journal===opts.journal);
   if(opts.read==='read')rows=rows.filter(r=>r.read);else if(opts.read==='unread')rows=rows.filter(r=>!r.read);
   if(opts.imported==='imported'||opts.imported==='unimported'){
     const selected=[];
     // Bound concurrent Zotero searches: serial lookups make a single filter
     // change appear unresponsive, while an unbounded burst can stall Zotero.
     for(let i=0;i<rows.length;i+=8){const batch=rows.slice(i,i+8),presence=await Promise.all(batch.map(isImported));for(let j=0;j<batch.length;j++)if(opts.imported==='imported'?presence[j]:!presence[j])selected.push(batch[j])}
     rows=selected;
   }
   if(opts.topic)rows=rows.filter(r=>(r.topics||[]).includes(opts.topic)||r.transferable_topic===opts.topic);
   if(opts.priorityAuthorsOnly){const configured=ZR.Settings.get('priorityAuthors');rows=rows.filter(r=>(r.authors||[]).some(author=>priorityAuthorMatches(authorText(author),configured)))}
   const grade_counts={A:0,B:0,C:0,D:0,other:0};for(const r of rows){const grade=String(r.grade||'').toUpperCase();grade_counts[Object.hasOwn(grade_counts,grade)&&grade!=='other'?grade:'other']++}
   const priority=(a,b)=>(Number(b.reading_priority??-1)-Number(a.reading_priority??-1))||(Number(b.screening_id)-Number(a.screening_id));
   if(opts.sort==='if_desc'){
     const metrics=new Map();
     for(const r of rows){const key=ZR.Journal.normalizeJournal(r.journal);if(!metrics.has(key))metrics.set(key,r.is_preprint?null:await ZR.Journal.displayMetric(r.journal));r.journal_metric=r.is_preprint?null:metrics.get(key)}
     queueJournalMetrics(rows);
     rows.sort((a,b)=>(Number(b.journal_metric?.impact_factor??-1)-Number(a.journal_metric?.impact_factor??-1))||priority(a,b));
   }else if(opts.sort==='date_desc'){
     const dateValue=r=>{const n=Date.parse(String(r.published||''));return Number.isFinite(n)?n:-1};
     rows.sort((a,b)=>(dateValue(b)-dateValue(a))||priority(a,b));
   }else rows.sort(priority);
   const total=rows.length,offset=all?0:Number(opts.offset||0),limit=all?total:Number(opts.pageSize||opts.limit||500),page=all?rows:rows.slice(offset,offset+limit);
   for(const r of page){if(!r.journal_metric&&!r.is_preprint)r.journal_metric=await ZR.Journal.displayMetric(r.journal);if(ZR.Settings.get('showChineseTitle'))r.title_zh=await cachedTitle(r)}
   if(opts.includeFeedback){for(const r of page)r.feedback=await ZR.DB.latestFeedback(r.paper_id,r.scorecard_id)}
   return{rows:page,total,grade_counts,offset,limit};
 }
 async function forZoteroItem(item){const paper=await ZR.DB.paperByZotero(item.libraryID,item.key);if(!paper)return{paper:null,screening:null};paper.title=ZR.Utils.stripMarkup(paper.title)||'Untitled';if(ZR.Screening.isCorrectionOrRetraction(paper))return{paper,screening:null};const subID=String(ZR.Utils.getPref('defaultSubscription','protein_design'));const sub=(ZR.Config.subscriptions.subscriptions||[]).find(x=>x.id===subID&&x.enabled!==false)||(ZR.Config.subscriptions.subscriptions||[]).find(x=>x.enabled!==false);if(!sub)return{paper,screening:null};const rows=await ZR.DB.latestSubscriptionScreenings(sub.id,100000);const r=rows.find(x=>Number(x.paper_id)===Number(paper.id)&&x.scorecard_id===sub.scorecard);return{paper,screening:r?shape(r):null,subscription:sub};}
 async function screenZoteroItems(items){const r=await ZR.Screening.screenZoteroItems(items);ZR.Events?.emit('papers:changed',{zotero:true});return r;}
 async function get(paperID,subscriptionID=null){if(subscriptionID){const rows=(await ZR.DB.latestSubscriptionScreenings(String(subscriptionID),100000)).filter(r=>Number(r.paper_id)===Number(paperID));if(rows.length)return shape(rows[0]);}const p=await ZR.DB.getPaper(Number(paperID));if(!p)throw new Error('paper not found');return{...p,title:ZR.Utils.stripMarkup(p.title)||'Untitled'};}
 async function requireScreeningModel(){if(!ZR.Ollama?.health)return;const cfg=ZR.Ollama.providerConfig();if(cfg.provider!=='ollama'){ZR.Ollama.modelID();return;}const state=await ZR.Ollama.health();if(!state.ok)throw new Error('Model provider unavailable: '+String(state.error||'connection failed'));const model=ZR.Ollama.modelName();if(Array.isArray(state.models)&&state.models.length&&!state.models.includes(model))throw new Error('Configured model not available: '+model);}
 async function rescreen(paperID,subscriptionID){const sub=await ZR.Services.Subscriptions.get(subscriptionID),p=await ZR.DB.getPaper(Number(paperID));if(sub.enabled===false)throw new Error('Subscription is disabled: '+subscriptionID);if(!p)throw new Error('paper not found');await requireScreeningModel();const r=await ZR.Screening.screenPaper(p,sub,{runID:'dashboard-rescreen',forceModel:true,requireModel:true});ZR.Events?.emit('papers:changed',{paperID:Number(paperID),subscriptionID});return r;}
 async function rescreenMany(ids,subscriptionID){const sub=await ZR.Services.Subscriptions.get(subscriptionID),clean=[...new Set((ids||[]).map(Number).filter(n=>Number.isInteger(n)&&n>0))],result={rescored:0,unscored:0,failed:0,error:null};if(sub.enabled===false)throw new Error('Subscription is disabled: '+subscriptionID);if(!clean.length)return result;try{await requireScreeningModel()}catch(e){return{...result,failed:clean.length,error:String(e.message||e)}}for(const id of clean){try{const p=await ZR.DB.getPaper(id);if(!p)throw new Error('paper not found');const screened=await ZR.Screening.screenPaper(p,sub,{runID:'dashboard-bulk-rescreen',forceModel:true,requireModel:true});if(screened?.scores?.reading_priority==null)result.unscored++;else result.rescored++}catch(e){result.failed++;if(!result.error)result.error=String(e.message||e);ZR.Utils.log('Bulk rescreen failed',id,e)}}if(result.rescored||result.unscored)ZR.Events?.emit('papers:changed',{paperIDs:clean,subscriptionID});return result;}
 async function importToZotero(paperID){const r=await ZR.Screening.importPaperToZotero(Number(paperID));importPresenceCache.clear();ZR.Events?.emit('papers:changed',{paperID:Number(paperID)});return r;}
 async function setReadStates(ids,read){const clean=[...new Set((ids||[]).map(Number).filter(n=>Number.isInteger(n)&&n>0))];if(!clean.length)return 0;await ZR.DB.setReadStates(clean,!!read);ZR.Events?.emit('papers:changed',{paperIDs:clean,read:!!read});return clean.length;}
 async function markRead(paperID){return(await setReadStates([paperID],true))===1;}
 async function importMany(ids){const clean=[...new Set((ids||[]).map(Number).filter(n=>Number.isInteger(n)&&n>0))],result={imported:0,alreadyInZotero:0,failed:0};for(const id of clean){try{const p=await ZR.DB.getPaper(id);if(!p)throw new Error('paper not found');if(p.zotero_key){result.alreadyInZotero++;continue}await importToZotero(id);result.imported++}catch(e){result.failed++;ZR.Utils.log('Bulk Zotero import failed',id,e)}}return result;}
 let maintenance=null;
 function maintenanceStatus(){return maintenance?{...maintenance,failures:[...maintenance.failures]}:{state:'idle'};}
 async function startMaintenance({mode,subscriptionID,itemKeys=[]}={}){
   if(['running','translating'].includes(maintenance?.state))throw new Error('Maintenance job already running');
   const active=(ZR.Config.subscriptions.subscriptions||[]).filter(s=>s.enabled!==false);
   let tasks=[];
   if(mode==='rescore-existing'){
     const rows=await ZR.DB.all('SELECT DISTINCT paper_id,subscription_id FROM screenings ORDER BY subscription_id,paper_id');
     const allowed=new Set(active.map(s=>s.id));
     tasks=rows.filter(r=>allowed.has(r.subscription_id)).map(r=>({paperID:Number(r.paper_id),subscriptionID:r.subscription_id}));
   }else if(mode==='score-zotero-items'){
     const sub=active.find(s=>s.id===String(subscriptionID));if(!sub)throw new Error('Unknown or disabled subscription: '+subscriptionID);
     const keys=[...new Set((itemKeys||[]).map(String).filter(k=>/^[A-Z0-9]{8}$/.test(k)))];
     if(!keys.length||keys.length>100)throw new Error('Provide 1–100 Zotero item keys');
     tasks=keys.map(key=>({itemKey:key,subscriptionID:sub.id}));
   }else throw new Error('Unknown maintenance mode');
   await requireScreeningModel();
   maintenance={id:ZR.Utils.randomToken(16),mode,state:'running',total:tasks.length,completed:0,scored:0,unscored:0,failed:0,translations:{total:0,translated:0,failed:0},failures:[],startedAt:ZR.Utils.nowISO(),finishedAt:null};
   const current=maintenance;
   void(async()=>{
     const translationRows=[];
     for(const task of tasks){
       if(current.state!=='running')break;
       try{
         const sub=(ZR.Config.subscriptions.subscriptions||[]).find(s=>s.id===task.subscriptionID&&s.enabled!==false);
         if(!sub)throw new Error('Subscription disabled during maintenance: '+task.subscriptionID);
         let paper;
         if(task.itemKey){
           const item=Zotero.Items.getByLibraryAndKey(Zotero.Libraries.userLibraryID,task.itemKey);
           if(!item?.isRegularItem?.())throw new Error('Zotero regular item not found: '+task.itemKey);
           paper=ZR.Screening.itemToPaper(item);
         }else paper=await ZR.DB.getPaper(task.paperID);
         if(!paper)throw new Error('Paper not found: '+task.paperID);
         const result=await ZR.Screening.screenPaper(paper,sub,{runID:'maintenance-'+current.id,forceModel:true,requireModel:true});
         translationRows.push({paper_id:result.paper_id,title:paper.title});
         if(result?.scores?.reading_priority==null)current.unscored++;else current.scored++;
       }catch(e){current.failed++;if(task.paperID){try{const old=await ZR.DB.getPaper(task.paperID);if(old)translationRows.push({paper_id:task.paperID,title:old.title})}catch(_){}}if(current.failures.length<100)current.failures.push({paperID:task.paperID||null,itemKey:task.itemKey||null,subscriptionID:task.subscriptionID,error:String(e?.message||e).slice(0,300)});ZR.Utils.log('Maintenance screening failed',task,e)}
       current.completed++;
       if(current.completed%10===0)ZR.Events?.emit('papers:changed',{maintenance:true,completed:current.completed});
     }
     if(current.state==='running'){
       current.state='translating';
       current.translations=await waitForTitleTranslations(translationRows,()=>current.state==='translating');
     }
     current.state=current.state==='translating'?'complete':'cancelled';current.finishedAt=ZR.Utils.nowISO();
     try{await ZR.DB.loadItemCache();ZR.UI?.refreshColumns?.()}catch(e){ZR.Utils.log('Maintenance cache refresh failed',e)}
     ZR.Events?.emit('papers:changed',{maintenance:true,completed:current.completed});
   })().catch(e=>{current.state='failed';current.finishedAt=ZR.Utils.nowISO();current.failures.push({error:String(e?.message||e)});ZR.Utils.log('Maintenance job failed',e)});
   return maintenanceStatus();
 }
 function cancelMaintenance(){if(['running','translating'].includes(maintenance?.state))maintenance.state='cancelling';return maintenanceStatus();}
 async function purgeCorrectionNotices({apply=false}={}){
   if(['running','translating'].includes(maintenance?.state))throw new Error('Maintenance job already running');
   const rows=await ZR.DB.all('SELECT id,title FROM papers ORDER BY id');
   // Zotero's database rows can be strict proxies: selecting id/title does not
   // permit the classifier to inspect any other optional paper fields.
   const matches=rows.filter(row=>ZR.Screening.isCorrectionOrRetraction({title:row.title})).map(row=>({id:Number(row.id),title:row.title}));
   if(!apply)return{matched:matches.length,removed:0,rows:matches};
   await ZR.DB.conn.executeTransaction(async()=>{
     for(const row of matches){
       await ZR.DB.exec('DELETE FROM papers WHERE id=?',[row.id]);
       await ZR.DB.exec('DELETE FROM meta WHERE key IN (?,?)',['title-zh:'+row.id,'paper:read:'+row.id]);
     }
   });
   await ZR.DB.loadItemCache();ZR.UI?.refreshColumns?.();ZR.Events?.emit('papers:changed',{purgedCorrections:matches.length});
   return{matched:matches.length,removed:matches.length,rows:matches};
 }
 ZR.Services=ZR.Services||{};ZR.Services.Papers={list,journals,get,forZoteroItem,screenZoteroItems,rescreen,rescreenMany,importToZotero,importMany,markRead,setReadStates,shape,priorityAuthorMatches,queueTitleTranslations,backfillTitleTranslations,queueJournalMetrics,cachedTitle,startMaintenance,maintenanceStatus,cancelMaintenance,purgeCorrectionNotices};
})(ZR);
