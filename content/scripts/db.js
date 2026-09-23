(function (ZR) {
  'use strict';

  const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS papers (
  id INTEGER PRIMARY KEY,
  zotero_library_id INTEGER,
  zotero_key TEXT,
  title TEXT NOT NULL,
  title_norm TEXT NOT NULL,
  abstract TEXT NOT NULL DEFAULT '',
  authors_json TEXT NOT NULL DEFAULT '[]',
  published TEXT,
  doi TEXT,
  pmid TEXT,
  pmcid TEXT,
  url TEXT NOT NULL DEFAULT '',
  journal TEXT NOT NULL DEFAULT '',
  citation_count INTEGER NOT NULL DEFAULT 0,
  source_records_json TEXT NOT NULL DEFAULT '[]',
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_papers_zotero ON papers(zotero_library_id,zotero_key) WHERE zotero_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_papers_doi ON papers(doi);
CREATE INDEX IF NOT EXISTS ix_papers_title ON papers(title_norm);

CREATE TABLE IF NOT EXISTS screenings (
  id INTEGER PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  scorecard_id TEXT NOT NULL,
  scorecard_version INTEGER NOT NULL,
  scorecard_hash TEXT NOT NULL,
  scope TEXT NOT NULL,
  strength TEXT,
  topics_json TEXT NOT NULL DEFAULT '[]',
  transferable_topic TEXT,
  rule_evidence_json TEXT NOT NULL DEFAULT '{}',
  judgement_json TEXT NOT NULL,
  model_judgement_json TEXT,
  raw_model_json TEXT,
  model TEXT NOT NULL,
  prompt_contract_version TEXT NOT NULL,
  scoring_policy_version TEXT NOT NULL,
  base_relevance REAL,
  feedback_adjustment REAL NOT NULL DEFAULT 0,
  personalized_relevance REAL,
  journal_score REAL,
  journal_adjustment REAL NOT NULL DEFAULT 0,
  reading_priority REAL,
  grade TEXT,
  preference_profile_version INTEGER,
  embedding_model_version TEXT,
  feedback_details_json TEXT NOT NULL DEFAULT '{}',
  user_overridden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_screenings_latest ON screenings(paper_id,scorecard_id,id DESC);
CREATE INDEX IF NOT EXISTS ix_screenings_paper_subscription ON screenings(paper_id,subscription_id,id DESC);
CREATE INDEX IF NOT EXISTS ix_screenings_rank ON screenings(scorecard_id,reading_priority DESC);

CREATE TABLE IF NOT EXISTS screen_cache (
  cache_key TEXT PRIMARY KEY,
  scorecard_id TEXT NOT NULL,
  judgement_json TEXT NOT NULL,
  rule_evidence_json TEXT NOT NULL,
  raw_model_json TEXT,
  model TEXT NOT NULL,
  prompt_contract_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  scorecard_id TEXT NOT NULL,
  model_scope TEXT,
  model_strength TEXT,
  corrected_scope TEXT,
  corrected_strength TEXT,
  corrected_transferable_topic TEXT,
  priority_feedback TEXT,
  note TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'USER_EXPLICIT',
  weight REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  supersedes_feedback_id INTEGER
);
CREATE INDEX IF NOT EXISTS ix_feedback_active ON feedback(scorecard_id,active,paper_id);

CREATE TABLE IF NOT EXISTS profile_versions (
  id INTEGER PRIMARY KEY,
  scorecard_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  embedding_model TEXT NOT NULL,
  positive_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  transferable_count INTEGER NOT NULL DEFAULT 0,
  weak_positive_count INTEGER NOT NULL DEFAULT 0,
  learning_method TEXT NOT NULL DEFAULT 'knn',
  parameters_json TEXT NOT NULL DEFAULT '{}',
  built_at TEXT NOT NULL,
  profile_hash TEXT NOT NULL,
  UNIQUE(scorecard_id,version)
);
CREATE TABLE IF NOT EXISTS profile_members (
  profile_id INTEGER NOT NULL REFERENCES profile_versions(id) ON DELETE CASCADE,
  feedback_id INTEGER NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  feedback_class TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  PRIMARY KEY(profile_id,feedback_id)
);
CREATE TABLE IF NOT EXISTS profile_state (
  scorecard_id TEXT PRIMARY KEY,
  active_version INTEGER,
  pending_rebuild INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS embeddings (
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  vector_json TEXT NOT NULL,
  dims INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(paper_id,model,content_hash)
);

CREATE TABLE IF NOT EXISTS journal_metrics (
  name_key TEXT PRIMARY KEY,
  journal TEXT NOT NULL,
  impact_factor REAL,
  cas_tier TEXT,
  cas_score REAL,
  if_score REAL,
  source TEXT,
  journal_score REAL NOT NULL,
  jcr TEXT,
  jci TEXT,
  cas_top INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feed_state (
  feed_id TEXT PRIMARY KEY,
  last_run_at TEXT,
  last_error TEXT,
  last_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  fetched INTEGER NOT NULL DEFAULT 0,
  papers INTEGER NOT NULL DEFAULT 0,
  screenings INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  error_text TEXT
);
`;

  let db = null;

  async function init() {
    if (db) return db;
    db = new Zotero.DBConnection(ZR.Paths.db);
    await db.queryAsync('PRAGMA foreign_keys=ON');
    const statements = SCHEMA.split(';').map(s=>s.trim()).filter(Boolean);
    for (const sql of statements) await db.queryAsync(sql);
    const feedbackCols=(await db.queryAsync('PRAGMA table_info(feedback)')||[]).map(r=>String(r.name));
    if(!feedbackCols.includes('corrected_transferable_topic')) await db.queryAsync('ALTER TABLE feedback ADD COLUMN corrected_transferable_topic TEXT');
    await db.queryAsync('INSERT OR REPLACE INTO meta(key,value,updated_at) VALUES(?,?,?)', ['schema_version','5.2.0',ZR.Utils.nowISO()]);
    ZR.DB.conn = db;
    return db;
  }
  async function close() { if (db) { await db.closeDatabase(); db=null; ZR.DB.conn=null; } }
  async function all(sql, params=[]) { return (await db.queryAsync(sql, params)) || []; }
  async function row(sql, params=[]) { const rows=await all(sql,params); return rows[0] || null; }
  async function value(sql, params=[]) { return await db.valueQueryAsync(sql, params); }
  async function exec(sql, params=[]) { return await db.queryAsync(sql, params); }

  // Zotero DB SELECT rows are Proxy objects. JSON.stringify() probes `toJSON`,
  // which the Proxy interprets as a column lookup and throws. Never serialize
  // those proxies directly. Copy only known result columns at API boundaries.
  function pickRow(r, keys) {
    if (!r) return null;
    const out = {};
    for (const k of keys) out[k] = r[k];
    return out;
  }
  function pickRows(rows, keys) { return (rows || []).map(r => pickRow(r, keys)); }
  async function getMeta(key){return await value('SELECT value FROM meta WHERE key=?',[key]);}
  async function setMeta(key,val){await exec('INSERT OR REPLACE INTO meta(key,value,updated_at) VALUES(?,?,?)',[key,String(val),ZR.Utils.nowISO()]);}
  async function setReadStates(ids,read){
    await db.executeTransaction(async()=>{
      for(const id of ids)await exec('INSERT OR REPLACE INTO meta(key,value,updated_at) VALUES(?,?,?)',['paper:read:'+Number(id),read?'1':'0',ZR.Utils.nowISO()]);
    });
  }
  async function lastID() { return Number(await value('SELECT last_insert_rowid()')); }

  function titleNorm(t) { return ZR.Utils.normalizeText(ZR.Utils.stripMarkup(t)).replace(/[^a-z0-9\u4e00-\u9fff ]/g,'').replace(/\s+/g,' ').trim(); }

  async function upsertPaper(p) {
    const now=ZR.Utils.nowISO(); let found=null;
    const title=ZR.Utils.stripMarkup(p.title)||'Untitled';
    if (p.zotero_library_id != null && p.zotero_key) found=await row('SELECT id FROM papers WHERE zotero_library_id=? AND zotero_key=?',[p.zotero_library_id,p.zotero_key]);
    if (!found && p.doi) found=await row('SELECT id FROM papers WHERE doi=? ORDER BY id LIMIT 1',[ZR.Utils.normalizeDOI(p.doi)]);
    if (!found && p.pmid) found=await row('SELECT id FROM papers WHERE pmid=? ORDER BY id LIMIT 1',[String(p.pmid)]);
    if (!found) found=await row('SELECT id FROM papers WHERE title_norm=? ORDER BY id LIMIT 1',[titleNorm(p.title)]);
    const values=[p.zotero_library_id??null,p.zotero_key||null,title,titleNorm(title),p.abstract||'',JSON.stringify(p.authors||[]),p.published||null,ZR.Utils.normalizeDOI(p.doi),p.pmid||null,p.pmcid||null,p.url||'',p.journal||'',Number(p.citation_count||0),JSON.stringify(p.source_records||[]),now];
    if (found) {
      await exec(`UPDATE papers SET zotero_library_id=COALESCE(?,zotero_library_id),zotero_key=COALESCE(?,zotero_key),title=?,title_norm=?,abstract=?,authors_json=?,published=?,doi=COALESCE(?,doi),pmid=COALESCE(?,pmid),pmcid=COALESCE(?,pmcid),url=?,journal=?,citation_count=?,source_records_json=?,updated_at=? WHERE id=?`,[...values,Number(found.id)]);
      return Number(found.id);
    }
    await exec(`INSERT INTO papers(zotero_library_id,zotero_key,title,title_norm,abstract,authors_json,published,doi,pmid,pmcid,url,journal,citation_count,source_records_json,first_seen_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[...values.slice(0,14),now,now]);
    return await lastID();
  }

  async function getPaper(id) {
    const r=await row('SELECT * FROM papers WHERE id=?',[id]); if(!r)return null;
    const paper=pickRow(r,['id','zotero_library_id','zotero_key','title','title_norm','abstract','authors_json','published','doi','pmid','pmcid','url','journal','citation_count','source_records_json','first_seen_at','updated_at']);
    paper.authors=ZR.Utils.safeJSON(paper.authors_json,[]);
    paper.source_records=ZR.Utils.safeJSON(paper.source_records_json,[]);
    return paper;
  }
  async function findExistingPaper(p){
    const doi=ZR.Utils.normalizeDOI(p.doi),pmid=String(p.pmid||'').trim(),pmcid=String(p.pmcid||'').trim(),title=titleNorm(p.title);
    if(doi){const found=await row('SELECT id FROM papers WHERE doi=? LIMIT 1',[doi]);if(found)return Number(found.id)}
    if(pmid){const found=await row('SELECT id FROM papers WHERE pmid=? LIMIT 1',[pmid]);if(found)return Number(found.id)}
    if(pmcid){const found=await row('SELECT id FROM papers WHERE pmcid=? LIMIT 1',[pmcid]);if(found)return Number(found.id)}
    if(title&&title!=='untitled'){const found=await row('SELECT id FROM papers WHERE title_norm=? LIMIT 1',[title]);if(found)return Number(found.id)}
    return null;
  }
  async function paperByZotero(libraryID,key) { const r=await row('SELECT * FROM papers WHERE zotero_library_id=? AND zotero_key=?',[libraryID,key]); return r ? getPaper(Number(r.id)) : null; }

  async function saveScreening(runID, r) {
    const j=r.judgement, s=r.scores, mj=r.model_judgement||j;
    await exec(`INSERT INTO screenings(paper_id,run_id,subscription_id,scorecard_id,scorecard_version,scorecard_hash,scope,strength,topics_json,transferable_topic,rule_evidence_json,judgement_json,model_judgement_json,raw_model_json,model,prompt_contract_version,scoring_policy_version,base_relevance,feedback_adjustment,personalized_relevance,journal_score,journal_adjustment,reading_priority,grade,preference_profile_version,embedding_model_version,feedback_details_json,user_overridden,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
      r.paper_id,runID,r.subscription_id,r.scorecard_id,r.scorecard_version,r.scorecard_hash,j.scope,j.strength||null,JSON.stringify(j.topics||[]),j.transferable_topic||null,JSON.stringify(r.rule_evidence||{}),JSON.stringify(j),JSON.stringify(mj),r.raw_model_json||null,r.model,r.prompt_contract_version,r.scoring_policy_version,s.base_relevance,s.feedback_adjustment,s.personalized_relevance,s.journal_score,s.journal_adjustment,s.reading_priority,s.grade,r.preference_profile_version||null,r.embedding_model_version||null,JSON.stringify(r.feedback_details||{}),r.user_overridden?1:0,r.created_at||ZR.Utils.nowISO()
    ]);
    return await lastID();
  }
  const SCREENING_FIELDS=['id','paper_id','run_id','subscription_id','scorecard_id','scorecard_version','scorecard_hash','scope','strength','topics_json','transferable_topic','rule_evidence_json','judgement_json','model_judgement_json','raw_model_json','model','prompt_contract_version','scoring_policy_version','base_relevance','feedback_adjustment','personalized_relevance','journal_score','journal_adjustment','reading_priority','grade','preference_profile_version','embedding_model_version','feedback_details_json','user_overridden','created_at'];
  function decodeScreening(r) {
    if(!r)return null;
    const screening=pickRow(r,SCREENING_FIELDS);
    for(const k of ['topics_json','rule_evidence_json','judgement_json','model_judgement_json','feedback_details_json']) screening[k.replace('_json','')]=ZR.Utils.safeJSON(screening[k], k==='topics_json'?[]:{});
    return screening;
  }
  async function latestScreening(paperID, scorecardID) {
    return decodeScreening(await row('SELECT * FROM screenings WHERE paper_id=? AND scorecard_id=? ORDER BY id DESC LIMIT 1',[paperID,scorecardID]));
  }
  async function latestPaperSubscriptionScreening(paperID, subscriptionID) {
    return decodeScreening(await row('SELECT * FROM screenings WHERE paper_id=? AND subscription_id=? ORDER BY id DESC LIMIT 1',[paperID,subscriptionID]));
  }
  async function latestPaperScorecardScreenings(paperID,scorecardID) {
    const rows=await all('SELECT * FROM screenings WHERE id IN (SELECT MAX(id) FROM screenings WHERE paper_id=? AND scorecard_id=? GROUP BY subscription_id) ORDER BY id DESC',[paperID,scorecardID]);
    return rows.map(decodeScreening);
  }
  async function latestScreenings(scorecardID, limit=5000) {
    return await all(`SELECT s.*,p.title,p.abstract,p.authors_json,p.published,p.doi,p.pmid,p.pmcid,p.url,p.journal,p.citation_count,p.zotero_library_id,p.zotero_key FROM screenings s JOIN papers p ON p.id=s.paper_id WHERE s.id IN (SELECT MAX(id) FROM screenings WHERE scorecard_id=? GROUP BY paper_id,scorecard_id) ORDER BY s.reading_priority DESC, s.id DESC LIMIT ?`,[scorecardID,limit]);
  }
  async function latestSubscriptionScreenings(subscriptionID, limit=5000) {
    return await all(`SELECT s.*,p.title,p.abstract,p.authors_json,p.published,p.doi,p.pmid,p.pmcid,p.url,p.journal,p.source_records_json,p.citation_count,p.zotero_library_id,p.zotero_key,m.value AS read_state FROM screenings s JOIN papers p ON p.id=s.paper_id LEFT JOIN meta m ON m.key='paper:read:'||p.id WHERE s.id IN (SELECT MAX(id) FROM screenings WHERE subscription_id=? GROUP BY paper_id,subscription_id) ORDER BY s.reading_priority DESC, s.id DESC LIMIT ?`,[subscriptionID,limit]);
  }
  async function saveCache(key,cardID,j,evidence,raw,model,promptVersion) {
    await exec(`INSERT OR REPLACE INTO screen_cache(cache_key,scorecard_id,judgement_json,rule_evidence_json,raw_model_json,model,prompt_contract_version,created_at) VALUES(?,?,?,?,?,?,?,?)`,[key,cardID,JSON.stringify(j),JSON.stringify(evidence),raw||null,model,promptVersion,ZR.Utils.nowISO()]);
  }
  async function getCache(key) { const r=await row('SELECT * FROM screen_cache WHERE cache_key=?',[key]); if(!r)return null; const cache=pickRow(r,['cache_key','scorecard_id','judgement_json','rule_evidence_json','raw_model_json','model','prompt_contract_version','created_at']);cache.judgement=ZR.Utils.safeJSON(cache.judgement_json);cache.rule_evidence=ZR.Utils.safeJSON(cache.rule_evidence_json,{});return cache; }

  const FEEDBACK_FIELDS=['id','paper_id','scorecard_id','model_scope','model_strength','corrected_scope','corrected_strength','corrected_transferable_topic','priority_feedback','note','active','source','weight','created_at','updated_at','supersedes_feedback_id'];
  async function latestFeedback(paperID, scorecardID) {
    const r=await row('SELECT * FROM feedback WHERE paper_id=? AND scorecard_id=? AND active=1 ORDER BY id DESC LIMIT 1',[paperID,scorecardID]);
    return r ? pickRow(r,FEEDBACK_FIELDS) : null;
  }
  async function addFeedback(rec,{withinTransaction=false}={}) {
    const commit=async()=>{
      const now=ZR.Utils.nowISO();
      const old=await latestFeedback(rec.paper_id,rec.scorecard_id);
      if(old) await exec('UPDATE feedback SET active=0,updated_at=? WHERE id=?',[now,old.id]);
      await exec(`INSERT INTO feedback(paper_id,scorecard_id,model_scope,model_strength,corrected_scope,corrected_strength,corrected_transferable_topic,priority_feedback,note,active,source,weight,created_at,updated_at,supersedes_feedback_id) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?,?)`,[
        rec.paper_id,rec.scorecard_id,rec.model_scope||null,rec.model_strength||null,rec.corrected_scope||null,rec.corrected_strength||null,rec.corrected_transferable_topic||null,rec.priority_feedback||null,rec.note||'',rec.source||'USER_EXPLICIT',Number(rec.weight||1),now,now,old?old.id:null
      ]);
      const id=await lastID();await markProfilePending(rec.scorecard_id);return id;
    };
    return withinTransaction?await commit():await db.executeTransaction(commit);
  }
  async function revokeFeedback(id) {
    return await db.executeTransaction(async()=>{
      const r=await row('SELECT * FROM feedback WHERE id=? AND active=1',[id]);if(!r)return false;
      await exec('UPDATE feedback SET active=0,updated_at=? WHERE id=?',[ZR.Utils.nowISO(),id]);await markProfilePending(r.scorecard_id);return true;
    });
  }
  async function activeFeedback(scorecardID) { return await all('SELECT * FROM feedback WHERE scorecard_id=? AND active=1 ORDER BY id',[scorecardID]); }
  function feedbackClass(r) {
    if(r.corrected_scope==='TRANSFERABLE')return 'TRANSFERABLE';
    if(r.corrected_scope==='OUT_OF_SCOPE')return 'NEGATIVE';
    if(r.corrected_scope==='DIRECT'||r.corrected_scope==='CONTEXTUAL')return 'POSITIVE';
    return null;
  }
  async function markProfilePending(scorecardID) {
    await exec(`INSERT INTO profile_state(scorecard_id,active_version,pending_rebuild,updated_at) VALUES(?,NULL,1,?) ON CONFLICT(scorecard_id) DO UPDATE SET pending_rebuild=1,updated_at=excluded.updated_at`,[scorecardID,ZR.Utils.nowISO()]);
  }
  async function activeProfileVersion(scorecardID) { const r=await row('SELECT active_version FROM profile_state WHERE scorecard_id=?',[scorecardID]); return r&&r.active_version!=null?Number(r.active_version):null; }
  async function buildProfile(scorecardID, embeddingModel, parameters={}) {
    return await db.executeTransaction(async()=>{
      const feedback=await activeFeedback(scorecardID);const members=[];const counts={POSITIVE:0,NEGATIVE:0,TRANSFERABLE:0};
      for(const f of feedback){const klass=feedbackClass(f);if(!klass)continue;counts[klass]++;members.push({feedback_id:Number(f.id),paper_id:Number(f.paper_id),feedback_class:klass,weight:Number(f.weight||1)})}
      const next=Number(await value('SELECT COALESCE(MAX(version),0)+1 FROM profile_versions WHERE scorecard_id=?',[scorecardID])||1);
      const hash=ZR.Utils.hashString(ZR.Utils.stableStringify(members)),now=ZR.Utils.nowISO();
      await exec(`INSERT INTO profile_versions(scorecard_id,version,embedding_model,positive_count,negative_count,transferable_count,weak_positive_count,learning_method,parameters_json,built_at,profile_hash) VALUES(?,?,?,?,?,?,0,'manual',?,?,?)`,[scorecardID,next,embeddingModel,counts.POSITIVE,counts.NEGATIVE,counts.TRANSFERABLE,JSON.stringify(parameters),now,hash]);
      const pid=await lastID();
      for(const m of members)await exec('INSERT INTO profile_members(profile_id,feedback_id,paper_id,feedback_class,weight) VALUES(?,?,?,?,?)',[pid,m.feedback_id,m.paper_id,m.feedback_class,m.weight]);
      await exec(`INSERT INTO profile_state(scorecard_id,active_version,pending_rebuild,updated_at) VALUES(?,?,0,?) ON CONFLICT(scorecard_id) DO UPDATE SET active_version=excluded.active_version,pending_rebuild=0,updated_at=excluded.updated_at`,[scorecardID,next,now]);
      return{scorecard_id:scorecardID,version:next,counts};
    });
  }
  async function rollbackProfile(scorecardID, version) {
    const r=await row('SELECT 1 ok FROM profile_versions WHERE scorecard_id=? AND version=?',[scorecardID,version]); if(!r)return false;
    await exec(`INSERT INTO profile_state(scorecard_id,active_version,pending_rebuild,updated_at) VALUES(?,?,0,?) ON CONFLICT(scorecard_id) DO UPDATE SET active_version=excluded.active_version,pending_rebuild=0,updated_at=excluded.updated_at`,[scorecardID,version,ZR.Utils.nowISO()]); return true;
  }
  async function profileMembers(scorecardID, version, klass) {
    return await all(`SELECT m.paper_id,m.weight,m.feedback_class FROM profile_members m JOIN profile_versions v ON v.id=m.profile_id WHERE v.scorecard_id=? AND v.version=? AND m.feedback_class=?`,[scorecardID,version,klass]);
  }
  const PROFILE_STATE_FIELDS=['scorecard_id','active_version','pending_rebuild','updated_at'];
  const PROFILE_VERSION_FIELDS=['id','scorecard_id','version','embedding_model','positive_count','negative_count','transferable_count','weak_positive_count','learning_method','parameters_json','built_at','profile_hash'];
  const PROFILE_COUNT_FIELDS=['total','positive','negative','transferable'];
  async function profileStatus(scorecardID) {
    const stateRow=await row('SELECT * FROM profile_state WHERE scorecard_id=?',[scorecardID]);
    const versionRows=await all('SELECT * FROM profile_versions WHERE scorecard_id=? ORDER BY version DESC LIMIT 20',[scorecardID]);
    const countRow=await row(`SELECT COUNT(*) total,SUM(CASE WHEN corrected_scope IN ('DIRECT','CONTEXTUAL') THEN 1 ELSE 0 END) positive,SUM(CASE WHEN corrected_scope='OUT_OF_SCOPE' THEN 1 ELSE 0 END) negative,SUM(CASE WHEN corrected_scope='TRANSFERABLE' THEN 1 ELSE 0 END) transferable FROM feedback WHERE scorecard_id=? AND active=1`,[scorecardID]);
    const state=stateRow ? pickRow(stateRow,PROFILE_STATE_FIELDS) : {scorecard_id:scorecardID,active_version:null,pending_rebuild:0,updated_at:null};
    const versions=pickRows(versionRows,PROFILE_VERSION_FIELDS);
    const counts=countRow ? pickRow(countRow,PROFILE_COUNT_FIELDS) : {total:0,positive:0,negative:0,transferable:0};
    // SQLite SUM() returns NULL on an empty set; normalize for the browser UI.
    for (const k of PROFILE_COUNT_FIELDS) counts[k]=Number(counts[k]||0);
    return {state,versions,counts};
  }

  async function getEmbedding(paperID,model,contentHash) { const r=await row('SELECT vector_json FROM embeddings WHERE paper_id=? AND model=? AND content_hash=?',[paperID,model,contentHash]); return r?ZR.Utils.safeJSON(r.vector_json,[]):null; }
  async function saveEmbedding(paperID,model,contentHash,vector) { await exec('INSERT OR REPLACE INTO embeddings(paper_id,model,content_hash,vector_json,dims,created_at) VALUES(?,?,?,?,?,?)',[paperID,model,contentHash,JSON.stringify(vector),vector.length,ZR.Utils.nowISO()]); }
  const JOURNAL_METRIC_FIELDS=['name_key','journal','impact_factor','cas_tier','cas_score','if_score','source','journal_score','jcr','jci','cas_top','updated_at'];
  async function getJournalMetric(key){return pickRow(await row('SELECT * FROM journal_metrics WHERE name_key=?',[key]),JOURNAL_METRIC_FIELDS);}
  async function saveJournalMetric(r){await exec(`INSERT OR REPLACE INTO journal_metrics(name_key,journal,impact_factor,cas_tier,cas_score,if_score,source,journal_score,jcr,jci,cas_top,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,[r.name_key,r.journal,r.impact_factor??null,r.cas_tier??null,r.cas_score??null,r.if_score??null,r.source||'',r.journal_score,r.jcr??null,r.jci??null,r.cas_top?1:0,ZR.Utils.nowISO()]);}
  async function updateFeedState(id,count,errorText=null){await exec(`INSERT INTO feed_state(feed_id,last_run_at,last_error,last_count,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(feed_id) DO UPDATE SET last_run_at=excluded.last_run_at,last_error=excluded.last_error,last_count=excluded.last_count,updated_at=excluded.updated_at`,[id,ZR.Utils.nowISO(),errorText,count,ZR.Utils.nowISO()]);}
  async function startRun(mode){const id=(typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():ZR.Utils.randomToken(24);await exec('INSERT INTO runs(id,mode,started_at) VALUES(?,?,?)',[id,mode,ZR.Utils.nowISO()]);return id;}
  async function finishRun(id,stats,errorText=null){await exec('UPDATE runs SET finished_at=?,fetched=?,papers=?,screenings=?,errors=?,error_text=? WHERE id=?',[ZR.Utils.nowISO(),stats.fetched||0,stats.papers||0,stats.screenings||0,stats.errors||0,errorText,id]);}

  async function loadItemCache(){
    const subscriptionID=String(ZR.Utils.getPref('defaultSubscription','protein_design'));
    const rows=await all(`SELECT p.id paper_id,p.title paper_title,p.zotero_library_id,p.zotero_key,s.reading_priority,s.grade,s.scope,s.strength,s.scorecard_id,s.subscription_id,s.topics_json FROM screenings s JOIN papers p ON p.id=s.paper_id WHERE p.zotero_key IS NOT NULL AND s.subscription_id=? AND s.id IN (SELECT MAX(id) FROM screenings WHERE subscription_id=? GROUP BY paper_id,subscription_id)`,[subscriptionID,subscriptionID]);
    const next=new Map();
    for(const r of rows){
      if(ZR.Screening?.isCorrectionOrRetraction({title:r.paper_title}))continue;
      // Zotero DB rows are column-access Proxies. Do not assign new fields to
      // them or retain them in UI state; copy the selected columns instead.
      const item=pickRow(r,['paper_id','zotero_library_id','zotero_key','reading_priority','grade','scope','strength','scorecard_id','subscription_id','topics_json']);
      item.topics=ZR.Utils.safeJSON(item.topics_json,[]);
      next.set(`${item.zotero_library_id}:${item.zotero_key}`,item);
    }
    ZR.State.itemCache=next;
    return next.size;
  }
  function updateItemCache(libraryID,key,screen){if(libraryID!=null&&key)ZR.State.itemCache.set(`${libraryID}:${key}`,screen);}

  ZR.DB = { conn:null, init,close,all,row,value,exec,pickRow,pickRows,getMeta,setMeta,setReadStates,lastID,upsertPaper,getPaper,findExistingPaper,paperByZotero,saveScreening,latestScreening,latestPaperSubscriptionScreening,latestPaperScorecardScreenings,latestScreenings,latestSubscriptionScreenings,saveCache,getCache,latestFeedback,addFeedback,revokeFeedback,activeFeedback,feedbackClass,markProfilePending,activeProfileVersion,buildProfile,rollbackProfile,profileMembers,profileStatus,getEmbedding,saveEmbedding,getJournalMetric,saveJournalMetric,updateFeedState,startRun,finishRun,loadItemCache,updateItemCache,titleNorm };
})(ZR);
